# Cashflow

A personal finance tracker that helps you see **where your money goes**. Log
income and expenses, watch your net balance and savings rate, set monthly
budgets per category, and let Cashflow file every transaction into a sensible
category automatically — with a one-click manual override whenever it gets one
wrong.

---

## Features

**At a glance**
- **Net balance, income, expenses, and savings rate** stat cards
- A **time-period filter** (this month, last month, last 3 months, this year,
  all time) that scopes the whole dashboard
- **Where your money goes** — an interactive donut of spending by category
  (click a slice or legend chip to filter the table)
- **Income vs. expenses** bar chart, month by month

**Budgets**
- Set a **monthly limit** for any spending category
- Live progress bars that turn amber as you approach the limit and red when you
  go over, with the amount **left / over** shown for the current month

**Transactions**
- Add income *or* expenses with a clean type toggle
- **Automatic categorisation** on every transaction (predictable keyword rules —
  no waiting, no surprises), with a per-row **manual override** and one-click
  **revert to auto**
- Live **search**, filter by **type** or **category**, **manual-only** filter,
  and **sortable** columns
- Optimistic add / edit / delete with a confirm step before deletes
- Toast notifications, CSV export, and keyboard shortcuts
  (`N` add · `/` focus search · `Esc` close)

**Everywhere**
- Light / dark mode and a currency selector (USD, EUR, GBP, INR, JPY)

---

## How categorisation works

Every transaction is filed into a category the moment it's read, using ordered
keyword rules (`backend/categorize.py`) matched against the merchant/description
string — so `AMZN Mktp US` → **Shopping**, `SHELL OIL 57442` → **Transport**,
`DIRECT DEPOSIT PAYROLL` → **Salary**. This is:

- **instant** — no model to fit, works even for your very first transaction,
- **predictable** — the same input always yields the same category, and
- **overridable** — pick any category by hand and it sticks (stored as
  `manual_category`); the effective category is always
  `manual_category` if set, otherwise the auto suggestion. Clear the override to
  fall back to auto.

Expense categories: Housing · Utilities · Groceries · Dining · Transport ·
Travel · Subscriptions · Entertainment · Health & Fitness · Shopping ·
Education · Other. Income categories: Salary · Freelance · Investments ·
Refunds · Other Income.

---

## Quick Start (Local Dev)

### Prerequisites
- Python ≥ 3.11
- Node.js ≥ 18

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # macOS / Linux
# venv\Scripts\activate           # Windows
pip install -r requirements.txt

python seed.py                    # optional: load ~200 synthetic transactions
uvicorn main:app --reload
```

The API runs at `http://localhost:8000` (interactive docs at `/docs`).

> The database (`finance.db`) is created empty on first run. Use
> `python seed.py` to populate realistic sample data (`--force` to wipe and
> reseed, `-n N` for a custom count), or just add transactions through the UI.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard runs at `http://localhost:3000`. The frontend defaults to
`http://localhost:8000` when `NEXT_PUBLIC_API_URL` is unset.

---

## API

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `GET` | `/api/categories` | The fixed category vocabulary (all / expense / income) |
| `GET` | `/api/transactions` | All transactions, each enriched with an auto `category` |
| `POST` | `/api/transactions` | Create (validated; `type` is `expense`\|`income`) |
| `PUT` | `/api/transactions/{id}` | Partial update; send `manual_category: null` to clear an override |
| `DELETE` | `/api/transactions/{id}` | Delete |
| `GET` | `/api/budgets` | `{ category: monthly_limit }` for every budget set |
| `PUT` | `/api/budgets/{category}` | Set a monthly limit (`monthly_limit: null`/`0` removes it) |

Dates are normalised to `YYYY-MM-DD` on write (existing rows are migrated on
startup) so ordering is always chronological. CORS origins are configurable via
the `CORS_ORIGINS` env var (comma-separated).

---

## Deployment

### Backend — Render
1. Create a **Web Service** with **Root Directory** `backend`.
2. **Build:** `pip install -r requirements.txt`
3. **Start:** `uvicorn main:app --host 0.0.0.0 --port 8000`
4. Optionally set `CORS_ORIGINS` to your frontend origin(s).

### Frontend — Vercel
1. Import the repo; set **Root Directory** to `frontend`, framework **Next.js**.
2. **Required env var:** `NEXT_PUBLIC_API_URL = https://your-api.onrender.com`
   (no trailing slash). Without it the deployed frontend calls `localhost`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python, FastAPI, Uvicorn (gzip + input validation), pure-stdlib categorisation |
| **Database** | SQLite (`sqlite3`, no ORM) |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS v4 — custom neo-brutalist design system |
| **UI** | Framer Motion, Recharts, lucide-react, next-themes, react-day-picker |

The backend has **no heavy ML dependencies** — categorisation is plain Python,
so installs are fast and the service is light. `npm run lint` and `npm run build`
validate the frontend.
