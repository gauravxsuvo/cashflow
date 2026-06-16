import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "finance.db"

# Columns that must never be set to NULL via a PATCH
_NON_NULLABLE = {"date", "vendor", "amount"}
# Columns that may be explicitly set to NULL (clearing a user override)
_NULLABLE = {"manual_category"}

# Date input formats we accept and normalise to ISO. ISO is tried first; the
# US "M/D/YYYY" form (with or without leading zeros — strptime is lenient)
# covers the noisy bank-export style. Storing everything as ISO means the
# plain `ORDER BY date` is chronologically correct.
_DATE_FORMATS = ("%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d", "%m-%d-%Y", "%b %d, %Y")


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


@contextmanager
def _get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Create the transactions table if it doesn't exist and tidy stored data."""
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS transactions (
                id              TEXT PRIMARY KEY,
                date            TEXT,
                vendor          TEXT,
                amount          REAL,
                manual_category TEXT
            )
            """
        )
        # Idempotent migration: add column to existing DBs that pre-date it
        try:
            conn.execute("ALTER TABLE transactions ADD COLUMN manual_category TEXT")
        except sqlite3.OperationalError:
            pass  # Column already exists

        # Speeds up the ORDER BY date on every read.
        conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)")

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
        "manual_category": row["manual_category"],
    }


def get_all_transactions() -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT id, date, vendor, amount, manual_category FROM transactions ORDER BY date DESC"
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def insert_transaction(
    date: str, vendor: str, amount: float, manual_category: str | None = None
) -> dict:
    new_id = str(uuid.uuid4())
    date = normalize_date(date)
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO transactions (id, date, vendor, amount, manual_category) VALUES (?, ?, ?, ?, ?)",
            (new_id, date, vendor, amount, manual_category),
        )
    return {
        "transaction_id": new_id,
        "date": date,
        "vendor": vendor,
        "amount": amount,
        "manual_category": manual_category,
    }


def update_transaction(tx_id: str, fields: dict) -> dict | None:
    """
    Partial update using only the keys present in `fields`.
    - Non-nullable fields (date, vendor, amount): updated only when value is not None.
    - Nullable fields (manual_category): updated even when value is None, which
      sets the DB column to NULL (clears the user override, reverts to ML clustering).
    Returns None only when the transaction does not exist.
    """
    if _fetch_one(tx_id) is None:
        return None

    updates = {}
    for k, v in fields.items():
        if k in _NON_NULLABLE and v is not None:
            updates[k] = normalize_date(v) if k == "date" else v
        elif k in _NULLABLE:
            updates[k] = v  # None → SQL NULL is intentional

    if not updates:
        return _fetch_one(tx_id)

    set_clause = ", ".join(f"{col} = ?" for col in updates)
    values = list(updates.values()) + [tx_id]

    with _get_conn() as conn:
        conn.execute(f"UPDATE transactions SET {set_clause} WHERE id = ?", values)

    return _fetch_one(tx_id)


def delete_transaction(tx_id: str) -> bool:
    with _get_conn() as conn:
        cursor = conn.execute("DELETE FROM transactions WHERE id = ?", (tx_id,))
    return cursor.rowcount > 0


def clear_all_transactions() -> int:
    """Delete every transaction. Returns how many rows were removed (dev/seed use)."""
    with _get_conn() as conn:
        cursor = conn.execute("DELETE FROM transactions")
    return cursor.rowcount


def _fetch_one(tx_id: str) -> dict | None:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT id, date, vendor, amount, manual_category FROM transactions WHERE id = ?",
            (tx_id,),
        ).fetchone()
    return _row_to_dict(row) if row else None
