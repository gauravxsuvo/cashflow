"""
Default category sets seeded for every new user. After sign-up these are just
ordinary rows in the `categories` table — the user can recolour, rename, add,
or delete them freely. There is no automatic categorisation: the category on a
transaction is always the one the user chose (falling back to "Uncategorized").
"""

UNCATEGORIZED = "Uncategorized"

# (name, colour) — bold, saturated Bauhaus palette mirrored on the frontend so
# the donut, legend and badges read as one system.
DEFAULT_EXPENSE_CATEGORIES: list[tuple[str, str]] = [
    ("Housing", "#e63329"),
    ("Utilities", "#144eb8"),
    ("Groceries", "#1f8a4c"),
    ("Dining", "#e8792b"),
    ("Transport", "#159aa8"),
    ("Travel", "#7a3fb0"),
    ("Subscriptions", "#d6336c"),
    ("Entertainment", "#f6c019"),
    ("Health & Fitness", "#0ca678"),
    ("Shopping", "#3b5bdb"),
    ("Education", "#e6a817"),
    ("Other", "#868e96"),
    (UNCATEGORIZED, "#adb5bd"),
]

DEFAULT_INCOME_CATEGORIES: list[tuple[str, str]] = [
    ("Salary", "#1f8a4c"),
    ("Freelance", "#0ca678"),
    ("Investments", "#159aa8"),
    ("Refunds", "#66a80f"),
    ("Other Income", "#2f9e44"),
]


def default_categories() -> list[tuple[str, str, str, int]]:
    """Return seed rows as (name, kind, color, sort_order)."""
    rows: list[tuple[str, str, str, int]] = []
    for i, (name, color) in enumerate(DEFAULT_EXPENSE_CATEGORIES):
        rows.append((name, "expense", color, i))
    for i, (name, color) in enumerate(DEFAULT_INCOME_CATEGORIES):
        rows.append((name, "income", color, i))
    return rows
