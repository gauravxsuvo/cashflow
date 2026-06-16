"""
Populate finance.db with synthetic transactions for local development.

Standalone helper — NOT imported by the running app. The app never seeds
itself; the database starts empty. Run this from the `backend/` directory:

    python seed.py            # seed 200 rows (no-op if the DB already has data)
    python seed.py -n 500     # seed a custom number of rows
    python seed.py --force    # wipe existing rows, then reseed
"""

import argparse

from database import (
    clear_all_transactions,
    get_all_transactions,
    init_db,
    insert_transaction,
)
from data_generator import generate_transactions


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed finance.db with synthetic data.")
    parser.add_argument("-n", "--count", type=int, default=200, help="number of transactions")
    parser.add_argument("--force", action="store_true", help="wipe existing rows before seeding")
    args = parser.parse_args()

    init_db()
    existing = get_all_transactions()

    if existing and not args.force:
        print(
            f"finance.db already has {len(existing)} transactions. "
            "Use --force to wipe and reseed."
        )
        return

    if args.force and existing:
        removed = clear_all_transactions()
        print(f"Cleared {removed} existing rows.")

    for t in generate_transactions(args.count):
        insert_transaction(t["date"], t["vendor"], t["amount"])

    print(f"Seeded {args.count} transactions into finance.db.")


if __name__ == "__main__":
    main()
