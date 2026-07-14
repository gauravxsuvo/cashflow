"""
Deterministic, per-transaction categorisation.

Replaces the old K-Means clustering approach. Clustering was unpredictable
(it produced meaningless labels like "Misc 2"), re-ran on the entire dataset on
every request, and was useless for the common case of a user who has only
entered a handful of transactions. This module instead assigns a sensible
category to each transaction *individually* using keyword rules, so results are:

  * instant (no model fit),
  * stable (the same input always yields the same label), and
  * meaningful even for a single transaction.

The category returned here is a *suggestion*. A user can override it per
transaction (stored in `manual_category`); the effective category the user sees
is always `manual_category` if set, otherwise this auto-suggestion.
"""

from __future__ import annotations

# Canonical expense categories the UI knows about. Order matters: the first
# category with a keyword hit wins, so more specific buckets come before broad
# ones (e.g. Groceries before Shopping so "whole foods market" isn't "Shopping").
EXPENSE_CATEGORIES: list[str] = [
    "Housing",
    "Utilities",
    "Groceries",
    "Dining",
    "Transport",
    "Travel",
    "Subscriptions",
    "Entertainment",
    "Health & Fitness",
    "Shopping",
    "Education",
    "Other",
]

INCOME_CATEGORIES: list[str] = [
    "Salary",
    "Freelance",
    "Investments",
    "Refunds",
    "Other Income",
]

# Every selectable category, for the frontend picker.
ALL_CATEGORIES: list[str] = EXPENSE_CATEGORIES + INCOME_CATEGORIES

DEFAULT_EXPENSE_CATEGORY = "Other"
DEFAULT_INCOME_CATEGORY = "Other Income"

# Ordered keyword rules. Matched against a lowercased vendor string with a
# simple substring test — robust to the noisy vendor forms in bank exports
# ("AMZN Mktp US", "SHELL OIL 57442", "UBER *TRIP").
_EXPENSE_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("Housing", ("rent", "mortgage", "landlord", "hoa", "property mgmt", "zillow", "apartment")),
    ("Utilities", (
        "electric", "water bill", "gas bill", "utility", "utilit", "internet",
        "comcast", "xfinity", "verizon", "at&t", "att ", "t-mobile", "tmobile",
        "spectrum", "pg&e", "con ed", "phone", "wireless", "insurance",
    )),
    ("Groceries", (
        "whole foods", "wfm", "trader joe", "grocery", "groceries", "safeway",
        "kroger", "aldi", "costco", "walmart", "food mkt", "supermarket",
        "market", "mercado", "publix", "wegmans",
    )),
    ("Dining", (
        "starbucks", "coffee", "restaurant", "eats", "doordash", "grubhub",
        "mcdonald", "chipotle", "pizza", "cafe", " bar", "grill", "dining",
        "dunkin", "taco", "burger", "kitchen", "bistro", "diner", "brew",
    )),
    ("Transport", (
        "uber", "lyft", "shell", "chevron", "exxon", "bp ", "gas station",
        "fuel", "petrol", "transit", "metro", "parking", "atm", "taxi", "cab",
        "toll", "amtrak", "car wash",
    )),
    ("Travel", (
        "airline", "airlines", "flight", "hotel", "airbnb", "expedia",
        "booking.com", "delta", "united air", "marriott", "hilton", "hostel",
        "resort", "vacation", "travel",
    )),
    ("Subscriptions", (
        "netflix", "spotify", "hulu", "prime", "disney", "youtube", "icloud",
        "adobe", "premium", "subscription", "membership", "patreon", "hbo",
        "audible", "dropbox", "notion", "openai", "chatgpt",
    )),
    ("Entertainment", (
        "steam", "valve", "playstation", "xbox", "nintendo", "cinema", "movie",
        "theater", "theatre", "ticketmaster", "concert", "game", "amc ", "epic",
    )),
    ("Health & Fitness", (
        "pharmacy", "cvs", "walgreens", "fitness", "planet fit", "gym",
        "doctor", "clinic", "dental", "dentist", "hospital", "health", "sport",
        "yoga", "wellness", "medical",
    )),
    ("Shopping", (
        "amazon", "amzn", "target", "mktp", "ebay", "etsy", "best buy", "ikea",
        "mall", "store", "apple.com", "nike", "zara", "h&m", "shop",
    )),
    ("Education", (
        "tuition", "udemy", "coursera", "school", "university", "college",
        "textbook", "khan", "duolingo", "course",
    )),
]

_INCOME_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("Salary", ("salary", "payroll", "direct dep", "direct deposit", "employer", "wages", "paycheck")),
    ("Freelance", ("freelance", "invoice", "client", "upwork", "fiverr", "consult", "contract")),
    ("Investments", ("dividend", "interest", "capital", "stock", "brokerage", "vanguard", "fidelity", "coinbase")),
    ("Refunds", ("refund", "reimburse", "return", "cashback", "rebate")),
]


def auto_category(vendor: str | None, tx_type: str = "expense") -> str:
    """Best-guess category for a single transaction from its vendor + type."""
    text = (vendor or "").lower().strip()
    rules = _INCOME_RULES if tx_type == "income" else _EXPENSE_RULES
    default = DEFAULT_INCOME_CATEGORY if tx_type == "income" else DEFAULT_EXPENSE_CATEGORY
    if not text:
        return default
    for label, keywords in rules:
        if any(kw in text for kw in keywords):
            return label
    return default


def categorize_transactions(transactions: list[dict]) -> list[dict]:
    """
    Return each transaction augmented with an auto `category` suggestion.
    Non-destructive: the input dicts are copied. The effective category shown
    to the user (`manual_category ?? category`) is resolved on the frontend.
    """
    result = []
    for t in transactions:
        enriched = dict(t)
        enriched["category"] = auto_category(t.get("vendor"), t.get("type") or "expense")
        result.append(enriched)
    return result
