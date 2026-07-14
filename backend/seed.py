"""
Populate finance.db with synthetic transactions for a specific user — for local
development only. The app itself never seeds; every account starts empty.

Run from the `backend/` directory:

    python seed.py --username demo --password demopass123   # create + seed a user
    python seed.py --username demo -n 500                    # seed 500 rows
    python seed.py --username demo --force                   # wipe that user's rows first
"""

import argparse

from auth import hash_password
from data_generator import generate_transactions
from database import (
    clear_user_data,
    create_user,
    get_all_transactions,
    get_user_by_username,
    init_db,
    insert_transaction,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed finance.db with synthetic data for a user.")
    parser.add_argument("--username", default="demo", help="account to seed into (created if missing)")
    parser.add_argument("--password", default="demopass123", help="password if the user must be created")
    parser.add_argument("-n", "--count", type=int, default=200, help="number of transactions")
    parser.add_argument("--force", action="store_true", help="wipe the user's rows before seeding")
    args = parser.parse_args()

    init_db()

    user = get_user_by_username(args.username)
    if user is None:
        user = create_user(args.username, hash_password(args.password))
        print(f"Created user '{args.username}' (password: {args.password}).")

    user_id = user["id"]
    existing = get_all_transactions(user_id)

    if existing and not args.force:
        print(
            f"'{args.username}' already has {len(existing)} transactions. "
            "Use --force to wipe and reseed."
        )
        return

    if args.force and existing:
        removed = clear_user_data(user_id)
        print(f"Cleared {removed} existing rows.")

    for t in generate_transactions(args.count):
        insert_transaction(user_id, t["date"], t["vendor"], t["amount"], t.get("type", "expense"))

    print(f"Seeded {args.count} transactions for '{args.username}'.")


if __name__ == "__main__":
    main()
