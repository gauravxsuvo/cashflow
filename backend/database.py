import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent / "finance.db"

# Fields that must never be set to NULL by a partial update.
_NON_NULLABLE = {"date", "vendor", "amount", "type"}
# Fields where an explicit None is meaningful (clears the value).
_NULLABLE = {"manual_category", "account", "note"}

VALID_TYPES = ("expense", "income")

# Date input formats we accept and normalise to ISO. ISO is tried first; the
# US "M/D/YYYY" form (with or without leading zeros — strptime is lenient)
# covers the noisy bank-export style. Storing everything as ISO means the
# plain `ORDER BY date` is chronologically correct.
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
    """Coerce a type string to one of VALID_TYPES; default to 'expense'."""
    v = (value or "").strip().lower()
    return v if v in VALID_TYPES else "expense"


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
                account         TEXT,
                note            TEXT,
                manual_category TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        # Additive migrations for databases created before these columns existed.
        for ddl in (
            "ALTER TABLE transactions ADD COLUMN manual_category TEXT",
            "ALTER TABLE transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'",
            "ALTER TABLE transactions ADD COLUMN account TEXT",
            "ALTER TABLE transactions ADD COLUMN note TEXT",
            "ALTER TABLE transactions ADD COLUMN user_id TEXT",
        ):
            try:
                conn.execute(ddl)
            except sqlite3.OperationalError:
                pass  # column already exists

        conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, date)")

        # Per-category monthly budget limits (expense categories only), per user.
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
    """One-time cleanup: rewrite any non-ISO stored dates to ISO so sorting works."""
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
        "account": row["account"],
        "note": row["note"],
        "manual_category": row["manual_category"],
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
    return {
        "id": new_id,
        "username": username,
        "currency": currency,
        "created_at": created_at,
    }


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
    """Delete a user and (via ON DELETE CASCADE) all of their data."""
    with _get_conn() as conn:
        conn.execute("DELETE FROM transactions WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM budgets WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))


def clear_user_data(user_id: str) -> int:
    """Delete all transactions and budgets for a user (keeps the account)."""
    with _get_conn() as conn:
        cursor = conn.execute("DELETE FROM transactions WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM budgets WHERE user_id = ?", (user_id,))
    return cursor.rowcount


# ---------------------------------------------------------------------------
# Transactions (all scoped to a user_id)
# ---------------------------------------------------------------------------

def get_all_transactions(user_id: str) -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT id, user_id, date, vendor, amount, type, account, note, manual_category "
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
    manual_category: str | None = None,
    account: str | None = None,
    note: str | None = None,
) -> dict:
    new_id = str(uuid.uuid4())
    date = normalize_date(date)
    tx_type = _normalize_type(tx_type)
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO transactions "
            "(id, user_id, date, vendor, amount, type, account, note, manual_category) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (new_id, user_id, date, vendor, amount, tx_type, account, note, manual_category),
        )
    return {
        "transaction_id": new_id,
        "date": date,
        "vendor": vendor,
        "amount": amount,
        "type": tx_type,
        "account": account,
        "note": note,
        "manual_category": manual_category,
    }


def update_transaction(user_id: str, tx_id: str, fields: dict) -> dict | None:
    """
    Partial update using only the keys present in `fields`, scoped to the user.
    - Non-nullable fields (date, vendor, amount, type): updated only when not None.
    - Nullable fields (manual_category, account, note): updated even when None,
      which sets the DB column to NULL.
    Returns None only when the transaction does not exist for this user.
    """
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
            "SELECT id, user_id, date, vendor, amount, type, account, note, manual_category "
            "FROM transactions WHERE id = ? AND user_id = ?",
            (tx_id, user_id),
        ).fetchone()
    return _row_to_dict(row) if row else None


# ---------------------------------------------------------------------------
# Budgets (scoped to a user_id)
# ---------------------------------------------------------------------------

def get_budgets(user_id: str) -> dict[str, float]:
    """Return {category: monthly_limit} for every category with a budget set."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT category, monthly_limit FROM budgets WHERE user_id = ?", (user_id,)
        ).fetchall()
    return {r["category"]: r["monthly_limit"] for r in rows}


def set_budget(user_id: str, category: str, monthly_limit: float | None) -> None:
    """Upsert a budget. A None/<=0 limit removes the budget for that category."""
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
