"""
Default category sets seeded for every new user. After sign-up these are just
ordinary rows in the `categories` table — the user can recolour, rename, add,
or delete them freely. There is no automatic categorisation: the category on a
transaction is always the one the user chose (falling back to "Uncategorized").
"""

UNCATEGORIZED = "Uncategorized"

# (name, colour) — colours mirror the frontend palette so charts look cohesive.
DEFAULT_EXPENSE_CATEGORIES: list[tuple[str, str]] = [
    ("Housing", "#fca5a5"),
    ("Utilities", "#93c5fd"),
    ("Groceries", "#bef264"),
    ("Dining", "#fdba74"),
    ("Transport", "#67e8f9"),
    ("Travel", "#a5b4fc"),
    ("Subscriptions", "#c4b5fd"),
    ("Entertainment", "#f9a8d4"),
    ("Health & Fitness", "#5eead4"),
    ("Shopping", "#fcd34d"),
    ("Education", "#d8b4fe"),
    ("Other", "#d4d4d8"),
    (UNCATEGORIZED, "#cbd5e1"),
]

DEFAULT_INCOME_CATEGORIES: list[tuple[str, str]] = [
    ("Salary", "#86efac"),
    ("Freelance", "#6ee7b7"),
    ("Investments", "#a7f3d0"),
    ("Refunds", "#99f6e4"),
    ("Other Income", "#bbf7d0"),
]


def default_categories() -> list[tuple[str, str, str, int]]:
    """Return seed rows as (name, kind, color, sort_order)."""
    rows: list[tuple[str, str, str, int]] = []
    for i, (name, color) in enumerate(DEFAULT_EXPENSE_CATEGORIES):
        rows.append((name, "expense", color, i))
    for i, (name, color) in enumerate(DEFAULT_INCOME_CATEGORIES):
        rows.append((name, "income", color, i))
    return rows
