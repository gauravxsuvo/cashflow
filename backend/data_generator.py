"""
Generate synthetic transactions for local development — pure standard library
(no pandas / numpy). Produces a realistic mix of recurring subscriptions,
everyday spending, and periodic income so the dashboard has something to show.

Standalone helper — NOT imported by the running app. Use it via `seed.py`.
"""

import random
import uuid
from datetime import datetime, timedelta

# Deterministic output for reproducible local data.
random.seed(42)

# Expense vendors: (display variants, amount sampler, category). Variants
# simulate the noisy vendor strings seen in real bank exports; the category is
# what a user would realistically pick (there is no auto-categorisation).
EXPENSE_PROFILES = [
    {"variants": ["Netflix", "NETFLIX.COM", "NETFLIX *1"], "amount": lambda: random.choice([15.49, 15.99, 22.99]), "category": "Subscriptions"},
    {"variants": ["Spotify", "SPOTIFY USA", "Spotify Premium"], "amount": lambda: random.choice([9.99, 10.99]), "category": "Subscriptions"},
    {"variants": ["Amazon", "AMZN Mktp US", "Amazon.com*1A2B3C"], "amount": lambda: round(random.uniform(8.99, 189.99), 2), "category": "Shopping"},
    {"variants": ["Uber", "UBER *TRIP", "Uber Trip"], "amount": lambda: round(random.uniform(9.50, 52.00), 2), "category": "Transport"},
    {"variants": ["Uber Eats", "UBER* EATS", "UberEATS"], "amount": lambda: round(random.uniform(18.00, 65.00), 2), "category": "Dining"},
    {"variants": ["Starbucks", "STARBUCKS #1234", "Starbucks Coffee"], "amount": lambda: round(random.uniform(5.25, 14.75), 2), "category": "Dining"},
    {"variants": ["Chipotle", "CHIPOTLE #0455", "Chipotle Mexican Grill"], "amount": lambda: round(random.uniform(9.50, 28.00), 2), "category": "Dining"},
    {"variants": ["Steam", "STEAM GAMES", "Valve/Steam"], "amount": lambda: random.choice([4.99, 9.99, 19.99, 29.99, 59.99]), "category": "Entertainment"},
    {"variants": ["Whole Foods", "WHOLE FOODS MKT", "WFM *Online"], "amount": lambda: round(random.uniform(22.00, 145.00), 2), "category": "Groceries"},
    {"variants": ["Trader Joe's", "TRADER JOES #212"], "amount": lambda: round(random.uniform(18.00, 96.00), 2), "category": "Groceries"},
    {"variants": ["Target", "TARGET #0456", "Target.com"], "amount": lambda: round(random.uniform(15.00, 210.00), 2), "category": "Shopping"},
    {"variants": ["Shell", "SHELL OIL 57442", "Shell Gas Station"], "amount": lambda: round(random.uniform(35.00, 95.00), 2), "category": "Transport"},
    {"variants": ["Planet Fitness", "PLANET FITNESS*", "PLANET FIT #0023"], "amount": lambda: random.choice([10.00, 24.99]), "category": "Health & Fitness"},
    {"variants": ["CVS Pharmacy", "CVS/PHARMACY #8812", "CVS PHARM"], "amount": lambda: round(random.uniform(4.99, 55.00), 2), "category": "Health & Fitness"},
    {"variants": ["Comcast Xfinity", "COMCAST CABLE", "XFINITY"], "amount": lambda: random.choice([69.99, 79.99, 89.99]), "category": "Utilities"},
    {"variants": ["Verizon Wireless", "VERIZON *WIRELESS"], "amount": lambda: random.choice([70.00, 85.00, 95.00]), "category": "Utilities"},
    {"variants": ["Greystar Rent", "PROPERTY MGMT RENT", "Landlord Rent"], "amount": lambda: random.choice([1450.00, 1600.00, 1750.00]), "category": "Housing"},
    {"variants": ["Delta Air Lines", "DELTA AIRLINES", "United Airlines"], "amount": lambda: round(random.uniform(180.00, 620.00), 2), "category": "Travel"},
]

# Income sources: less frequent, larger amounts.
INCOME_PROFILES = [
    {"variants": ["Acme Corp Payroll", "DIRECT DEPOSIT PAYROLL", "ACME SALARY"], "amount": lambda: random.choice([2850.00, 2850.00, 3100.00]), "category": "Salary"},
    {"variants": ["Upwork Client", "FREELANCE INVOICE", "Fiverr Payout"], "amount": lambda: round(random.uniform(220.00, 900.00), 2), "category": "Freelance"},
    {"variants": ["Vanguard Dividend", "BROKERAGE INTEREST"], "amount": lambda: round(random.uniform(12.00, 140.00), 2), "category": "Investments"},
    {"variants": ["Amazon Refund", "TARGET RETURN REFUND"], "amount": lambda: round(random.uniform(9.99, 85.00), 2), "category": "Refunds"},
]

TODAY = datetime(2026, 7, 14)
DAYS_BACK = 120
START = TODAY - timedelta(days=DAYS_BACK)


def _random_date() -> str:
    day = START + timedelta(days=random.randint(0, DAYS_BACK))
    return day.strftime("%Y-%m-%d")


def generate_transactions(n: int = 200) -> list[dict]:
    """
    Return ~n transactions. Roughly 1 in 6 is income; the rest expenses.
    Injects a few intentional data-quality quirks (null amount, non-ISO date,
    null vendor) so the cleaning path stays exercised.
    """
    rows: list[dict] = []
    for i in range(n):
        is_income = (i % 6 == 0)
        profile = random.choice(INCOME_PROFILES if is_income else EXPENSE_PROFILES)
        vendor = random.choice(profile["variants"])
        amount = round(profile["amount"](), 2)
        date = _random_date()
        tx_type = "income" if is_income else "expense"

        # Intentional data-quality issues spread across the set.
        if i == 47:
            amount = None
        if i == 113:
            date = "3/5/2026"  # non-ISO, missing leading zero
        if i == 178:
            vendor = None

        rows.append(
            {
                "transaction_id": str(uuid.uuid4()),
                "date": date,
                "vendor": vendor,
                "amount": amount,
                "type": tx_type,
                "category": profile["category"],
            }
        )

    return rows
