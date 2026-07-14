# Cashflow

A private, personal finance ledger that helps you see **where your money goes**.
Create an account, log income and expenses, watch your net balance and savings
rate, tag transactions to accounts, set monthly budgets per category, and let
Cashflow file every transaction into a sensible category automatically — all
wrapped in an Apple-style **liquid-glass** interface.

---

## Features

**Accounts & privacy**
- **Sign up / sign in** with a username and password — your data is private to
  your account. Passwords are hashed (PBKDF2-HMAC-SHA256, salted); sessions use
  signed, self-expiring tokens. Every account starts empty.
- **Settings** you control: light / dark / system theme, currency, change
  password, clear all data, or delete your account.

**At a glance**
- **Net balance, income, expenses, and savings rate** stat cards, with a
  month-over-month spending trend
- A **time-period filter** (this month, last month, last 3 months, this year,
  all time) that scopes the whole dashboard
- **Where your money goes** — an interactive donut of spending by category
  (click a slice or legend chip to filter the table)
- **Income vs. expenses** bar chart, month by month
- **Accounts** panel — net balance per wallet (Cash, Checking, Savings, …)

**Budgets**
- Set a **monthly limit** for any spending category
- Live progress bars that turn amber as you approach the limit and red when you
  go over, with the amount **left / over** shown for the current month

**Transactions**
- Add income *or* expenses with a clean type toggle, an optional **account** tag
  and a free-text **note**
- **Automatic categorisation** on every transaction (predictable keyword rules —
  no waiting, no surprises), with a per-row **manual override** and one-click
  **revert to auto**
- Live **search** (vendor + notes), filter by **type**, **account** or
  **category**, **manual-only** filter, and **sortable** columns
- Optimistic add / edit / delete with a confirm step before deletes
- Toast notifications, CSV export, and keyboard shortcuts
  (`N` add · `/` focus search · `Esc` close)

---

## Design — Liquid Glass

The whole UI is a frosted-glass design system: translucent surfaces with real
backdrop blur + saturation, hairline light-catching borders, soft layered
shadows, and a gently drifting aurora backdrop. It is fully theme-aware (bright
and airy in light mode, deep and luminous in dark) and responsive down to small
phones — wide content scrolls inside its own container so the page never scrolls
sideways.

---

## How categorisation works

Every transaction is filed into a category the moment it's read, using ordered
keyword rules (`backend/categorize.py`) matched against the merchant/description
string — so `AMZN Mktp US` → **Shopping**, `SHELL OIL 57442` → **Transport**,
`DIRECT DEPOSIT PAYROLL` → **Salary**. This is **instant**, **predictable**, and
**overridable** — pick any category by hand and it sticks (stored as
`manual_category`); the effective category is `manual_category` if set, otherwise
the auto suggestion. Clear the override to fall back to auto.

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

uvicorn main:app --reload
```

The API runs at `http://localhost:8000` (interactive docs at `/docs`). The
database (`finance.db`) is created empty on first run — register a user in the
UI to begin. For local testing you can populate a demo account with synthetic
data:

```bash
python seed.py --username demo --password demopass123   # create + seed a user
python seed.py --username demo --force                  # wipe & reseed that user
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:3000`. The frontend defaults to
`http://localhost:8000` when `NEXT_PUBLIC_API_URL` is unset.

---

## API

All `/api/transactions`, `/api/budgets`, and `/api/auth/*` (except register /
login) routes require an `Authorization: Bearer <token>` header and operate only
on the signed-in user's data.

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `GET` | `/api/categories` | The fixed category vocabulary (all / expense / income) |
| `POST` | `/api/auth/register` | Create an account → `{ token, user }` |
| `POST` | `/api/auth/login` | Sign in → `{ token, user }` |
| `GET` | `/api/auth/me` | The current user |
| `PUT` | `/api/auth/password` | Change password (`current_password`, `new_password`) |
| `PUT` | `/api/auth/currency` | Update preferred currency |
| `DELETE` | `/api/auth/data` | Clear all of the user's transactions & budgets |
| `DELETE` | `/api/auth/account` | Delete the account and all its data |
| `GET` | `/api/transactions` | The user's transactions, each with an auto `category` |
| `POST` | `/api/transactions` | Create (`type` `expense`\|`income`; optional `account`, `note`) |
| `PUT` | `/api/transactions/{id}` | Partial update; send `manual_category: null` to clear an override |
| `DELETE` | `/api/transactions/{id}` | Delete |
| `GET` | `/api/budgets` | `{ category: monthly_limit }` for every budget set |
| `PUT` | `/api/budgets/{category}` | Set a monthly limit (`monthly_limit: null`/`0` removes it) |

Dates are normalised to `YYYY-MM-DD` on write. CORS origins are configurable via
the `CORS_ORIGINS` env var (comma-separated).

---

## Deployment

### Backend — Render
1. Create a **Web Service** with **Root Directory** `backend`.
2. **Build:** `pip install -r requirements.txt`
3. **Start:** `uvicorn main:app --host 0.0.0.0 --port 8000`
4. **Set `SECRET_KEY`** to a long random string — it signs auth tokens. (In
   local dev a random key is generated and cached in `backend/.secret_key`.)
5. Optionally set `CORS_ORIGINS` to your frontend origin(s).

> SQLite (`finance.db`) is stored on the service's disk. For a durable
> production deployment, mount a **persistent disk** at `backend/` so the
> database and secret survive restarts.

### Frontend — Vercel
1. Import the repo; set **Root Directory** to `frontend`, framework **Next.js**.
2. **Required env var:** `NEXT_PUBLIC_API_URL = https://your-api.onrender.com`
   (no trailing slash). Without it the deployed frontend calls `localhost`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python, FastAPI, Uvicorn (gzip + input validation), stdlib-only auth (PBKDF2 + HMAC-signed tokens) & categorisation |
| **Database** | SQLite (`sqlite3`, no ORM), per-user scoping |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS v4 — custom **glassmorphism** design system |
| **UI** | Framer Motion, Recharts, lucide-react, next-themes, react-day-picker |

No heavy ML or crypto dependencies — authentication and categorisation are plain
Python, so installs stay fast and the service stays light. `npm run lint` and
`npm run build` validate the frontend.
