import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from default_categories import UNCATEGORIZED, default_categories

DB_PATH = Path(__file__).parent / "finance.db"

# Fields that must never be set to NULL by a partial update.
_NON_NULLABLE = {"date", "vendor", "amount", "type"}
# Fields where an explicit None is meaningful (clears the value).
_NULLABLE = {"account", "note"}

VALID_TYPES = ("expense", "income")
VALID_KINDS = ("expense", "income")

_DATE_FORMATS = ("%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d", "%m-%d-%Y", "%b %d, %Y")


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize_date(value: str | None) -> str | None:
    """Coerce a date string to ISO `YYYY-MM-DD`; pass through if unrecognised."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return s
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return s


def _normalize_type(value: str | None) -> str:
    v = (value or "").strip().lower()
    return v if v in VALID_TYPES else "expense"


def _clean_category(value: str | None) -> str:
    v = (value or "").strip()
    return v or UNCATEGORIZED


@contextmanager
def _get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Create tables if they don't exist and tidy stored data."""
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY,
                username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                currency      TEXT NOT NULL DEFAULT 'USD',
                created_at    TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS transactions (
                id              TEXT PRIMARY KEY,
                user_id         TEXT NOT NULL,
                date            TEXT,
                vendor          TEXT,
                amount          REAL,
                type            TEXT NOT NULL DEFAULT 'expense',
                category        TEXT NOT NULL DEFAULT 'Uncategorized',
                account         TEXT,
                note            TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        # Additive migrations for older databases.
        for ddl in (
            "ALTER TABLE transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'",
            "ALTER TABLE transactions ADD COLUMN account TEXT",
            "ALTER TABLE transactions ADD COLUMN note TEXT",
            "ALTER TABLE transactions ADD COLUMN user_id TEXT",
            "ALTER TABLE transactions ADD COLUMN manual_category TEXT",
            "ALTER TABLE transactions ADD COLUMN category TEXT NOT NULL DEFAULT 'Uncategorized'",
        ):
            try:
                conn.execute(ddl)
            except sqlite3.OperationalError:
                pass  # column already exists

        # Carry any previous manual_category into the new category column.
        try:
            conn.execute(
                "UPDATE transactions SET category = manual_category "
                "WHERE (category IS NULL OR category = 'Uncategorized') "
                "AND manual_category IS NOT NULL AND manual_category != ''"
            )
        except sqlite3.OperationalError:
            pass

        conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, date)")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS categories (
                user_id    TEXT NOT NULL,
                name       TEXT NOT NULL,
                kind       TEXT NOT NULL,
                color      TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (user_id, name),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS budgets (
                user_id       TEXT NOT NULL,
                category      TEXT NOT NULL,
                monthly_limit REAL NOT NULL,
                PRIMARY KEY (user_id, category),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )

    _migrate_normalize_dates()


def _migrate_normalize_dates() -> None:
    with _get_conn() as conn:
        rows = conn.execute("SELECT id, date FROM transactions").fetchall()
        for row in rows:
            normalized = normalize_date(row["date"])
            if normalized != row["date"]:
                conn.execute(
                    "UPDATE transactions SET date = ? WHERE id = ?",
                    (normalized, row["id"]),
                )


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "transaction_id": row["id"],
        "date": row["date"],
        "vendor": row["vendor"],
        "amount": row["amount"],
        "type": row["type"] or "expense",
        "category": row["category"] or UNCATEGORIZED,
        "account": row["account"],
        "note": row["note"],
    }


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

def create_user(username: str, password_hash: str, currency: str = "USD") -> dict:
    new_id = str(uuid.uuid4())
    created_at = _now_iso()
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO users (id, username, password_hash, currency, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (new_id, username, password_hash, currency, created_at),
        )
        # Seed the user's default categories.
        conn.executemany(
            "INSERT INTO categories (user_id, name, kind, color, sort_order) VALUES (?, ?, ?, ?, ?)",
            [(new_id, name, kind, color, order) for (name, kind, color, order) in default_categories()],
        )
    return {"id": new_id, "username": username, "currency": currency, "created_at": created_at}


def get_user_by_username(username: str) -> dict | None:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash, currency, created_at "
            "FROM users WHERE username = ? COLLATE NOCASE",
            (username,),
        ).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: str) -> dict | None:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash, currency, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    return dict(row) if row else None


def update_user_currency(user_id: str, currency: str) -> None:
    with _get_conn() as conn:
        conn.execute("UPDATE users SET currency = ? WHERE id = ?", (currency, user_id))


def update_user_password(user_id: str, password_hash: str) -> None:
    with _get_conn() as conn:
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (password_hash, user_id))


def delete_user(user_id: str) -> None:
    with _get_conn() as conn:
        conn.execute("DELETE FROM transactions WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM budgets WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM categories WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))


def clear_user_data(user_id: str) -> int:
    """Delete all transactions and budgets for a user (keeps account + categories)."""
    with _get_conn() as conn:
        cursor = conn.execute("DELETE FROM transactions WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM budgets WHERE user_id = ?", (user_id,))
    return cursor.rowcount


# ---------------------------------------------------------------------------
# Categories (per-user)
# ---------------------------------------------------------------------------

def get_categories(user_id: str) -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT name, kind, color, sort_order FROM categories WHERE user_id = ? "
            "ORDER BY kind DESC, sort_order ASC, name ASC",
            (user_id,),
        ).fetchall()
    return [{"name": r["name"], "kind": r["kind"], "color": r["color"]} for r in rows]


def get_category(user_id: str, name: str) -> dict | None:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT name, kind, color FROM categories WHERE user_id = ? AND name = ?",
            (user_id, name),
        ).fetchone()
    return {"name": row["name"], "kind": row["kind"], "color": row["color"]} if row else None


def ensure_default_categories(user_id: str) -> None:
    """Make sure a user has categories (self-heals older accounts)."""
    with _get_conn() as conn:
        count = conn.execute(
            "SELECT COUNT(*) AS c FROM categories WHERE user_id = ?", (user_id,)
        ).fetchone()["c"]
        if count == 0:
            conn.executemany(
                "INSERT INTO categories (user_id, name, kind, color, sort_order) VALUES (?, ?, ?, ?, ?)",
                [(user_id, name, kind, color, order) for (name, kind, color, order) in default_categories()],
            )


def create_category(user_id: str, name: str, kind: str, color: str) -> dict | None:
    """Create a category. Returns None if the name already exists for the user."""
    if get_category(user_id, name) is not None:
        return None
    with _get_conn() as conn:
        order = conn.execute(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM categories WHERE user_id = ? AND kind = ?",
            (user_id, kind),
        ).fetchone()["n"]
        conn.execute(
            "INSERT INTO categories (user_id, name, kind, color, sort_order) VALUES (?, ?, ?, ?, ?)",
            (user_id, name, kind, color, order),
        )
    return {"name": name, "kind": kind, "color": color}


def update_category(
    user_id: str, name: str, new_name: str | None = None, color: str | None = None
) -> dict | None:
    """Recolour and/or rename a category; a rename cascades to transactions & budgets.

    Returns the updated category, or None if it doesn't exist. Raises ValueError
    if the new name collides with an existing category.
    """
    existing = get_category(user_id, name)
    if existing is None:
        return None

    renaming = bool(new_name) and new_name != name
    if renaming and get_category(user_id, new_name) is not None:  # type: ignore[arg-type]
        raise ValueError("A category with that name already exists.")

    final_name = new_name if renaming else name
    final_color = color if color else existing["color"]

    with _get_conn() as conn:
        if renaming:
            conn.execute(
                "UPDATE categories SET name = ?, color = ? WHERE user_id = ? AND name = ?",
                (final_name, final_color, user_id, name),
            )
            conn.execute(
                "UPDATE transactions SET category = ? WHERE user_id = ? AND category = ?",
                (final_name, user_id, name),
            )
            conn.execute(
                "UPDATE budgets SET category = ? WHERE user_id = ? AND category = ?",
                (final_name, user_id, name),
            )
        else:
            conn.execute(
                "UPDATE categories SET color = ? WHERE user_id = ? AND name = ?",
                (final_color, user_id, name),
            )
    return {"name": final_name, "kind": existing["kind"], "color": final_color}


def delete_category(user_id: str, name: str) -> bool:
    """Delete a category; its transactions fall back to Uncategorized and its
    budget is removed. Returns False if it doesn't exist. Uncategorized can't be
    deleted."""
    if name == UNCATEGORIZED:
        return False
    if get_category(user_id, name) is None:
        return False
    with _get_conn() as conn:
        conn.execute(
            "UPDATE transactions SET category = ? WHERE user_id = ? AND category = ?",
            (UNCATEGORIZED, user_id, name),
        )
        conn.execute("DELETE FROM budgets WHERE user_id = ? AND category = ?", (user_id, name))
        conn.execute("DELETE FROM categories WHERE user_id = ? AND name = ?", (user_id, name))
    return True


# ---------------------------------------------------------------------------
# Transactions (per-user)
# ---------------------------------------------------------------------------

def get_all_transactions(user_id: str) -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT id, user_id, date, vendor, amount, type, category, account, note "
            "FROM transactions WHERE user_id = ? ORDER BY date DESC",
            (user_id,),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def insert_transaction(
    user_id: str,
    date: str,
    vendor: str,
    amount: float,
    tx_type: str = "expense",
    category: str | None = None,
    account: str | None = None,
    note: str | None = None,
) -> dict:
    new_id = str(uuid.uuid4())
    date = normalize_date(date)
    tx_type = _normalize_type(tx_type)
    category = _clean_category(category)
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO transactions "
            "(id, user_id, date, vendor, amount, type, category, account, note) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (new_id, user_id, date, vendor, amount, tx_type, category, account, note),
        )
    return {
        "transaction_id": new_id,
        "date": date,
        "vendor": vendor,
        "amount": amount,
        "type": tx_type,
        "category": category,
        "account": account,
        "note": note,
    }


def update_transaction(user_id: str, tx_id: str, fields: dict) -> dict | None:
    if _fetch_one(user_id, tx_id) is None:
        return None

    updates: dict = {}
    for k, v in fields.items():
        if k in _NON_NULLABLE and v is not None:
            if k == "date":
                updates[k] = normalize_date(v)
            elif k == "type":
                updates[k] = _normalize_type(v)
            else:
                updates[k] = v
        elif k == "category":
            updates[k] = _clean_category(v)  # never NULL; empty → Uncategorized
        elif k in _NULLABLE:
            updates[k] = v  # None → SQL NULL is intentional

    if not updates:
        return _fetch_one(user_id, tx_id)

    set_clause = ", ".join(f"{col} = ?" for col in updates)
    values = list(updates.values()) + [tx_id, user_id]

    with _get_conn() as conn:
        conn.execute(
            f"UPDATE transactions SET {set_clause} WHERE id = ? AND user_id = ?", values
        )

    return _fetch_one(user_id, tx_id)


def delete_transaction(user_id: str, tx_id: str) -> bool:
    with _get_conn() as conn:
        cursor = conn.execute(
            "DELETE FROM transactions WHERE id = ? AND user_id = ?", (tx_id, user_id)
        )
    return cursor.rowcount > 0


def _fetch_one(user_id: str, tx_id: str) -> dict | None:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT id, user_id, date, vendor, amount, type, category, account, note "
            "FROM transactions WHERE id = ? AND user_id = ?",
            (tx_id, user_id),
        ).fetchone()
    return _row_to_dict(row) if row else None


# ---------------------------------------------------------------------------
# Budgets (per-user)
# ---------------------------------------------------------------------------

def get_budgets(user_id: str) -> dict[str, float]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT category, monthly_limit FROM budgets WHERE user_id = ?", (user_id,)
        ).fetchall()
    return {r["category"]: r["monthly_limit"] for r in rows}


def set_budget(user_id: str, category: str, monthly_limit: float | None) -> None:
    with _get_conn() as conn:
        if monthly_limit is None or monthly_limit <= 0:
            conn.execute(
                "DELETE FROM budgets WHERE user_id = ? AND category = ?", (user_id, category)
            )
        else:
            conn.execute(
                "INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, ?, ?) "
                "ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = excluded.monthly_limit",
                (user_id, category, monthly_limit),
            )
