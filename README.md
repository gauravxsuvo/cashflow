# Cashflow

A private, personal finance ledger that helps you see **where your money goes**.
Create an account, log income and expenses, organise them with your own
categories and accounts, watch your net balance and savings rate, and set
monthly budgets per category - all wrapped in a clean, modern interface.

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
- **Where your money goes** - an interactive donut of spending by category
  (click a slice or legend chip to filter the table)
- **Income vs. expenses** bar chart, month by month
- **Accounts** panel - net balance per wallet (Cash, Checking, Savings, …)

**Budgets**
- Set a **monthly limit** for any spending category
- Live progress bars that turn amber as you approach the limit and red when you
  go over, with the amount **left / over** shown for the current month

**Transactions & categories**
- Add income *or* expenses with a clean type toggle, an optional **account** tag
  and a free-text **note**
- **Your own categories** - every account starts with a sensible default set you
  can fully manage: create, rename, recolour, or delete. Pick a category (or
  create one on the spot) right from the add/edit form. Renames and deletes
  cascade safely (a deleted category's transactions fall back to *Uncategorized*).
- Live **search** (vendor + notes), filter by **type**, **account** or
  **category**, and **sortable** columns
- Optimistic add / edit / delete with a confirm step before deletes
- Toast notifications, CSV export, and keyboard shortcuts
  (`N` add · `/` focus search · `Esc` close)

---

## Design

The whole UI is a flat, solid-surface design system: clean cards with hairline
borders and soft shadows, no translucency or backdrop blur. It is fully
theme-aware (bright and airy in light mode, deep and focused in dark) and
responsive down to small phones - wide content scrolls inside its own
container so the page never scrolls sideways.

---

## Categories

Categorisation is **fully manual and yours to control** — there is no keyword
guessing that misfires on unusual descriptions. Every new account is seeded with
a sensible default set, and you can create, rename, recolour, or delete
categories from the **Categories** manager (or create one inline while adding a
transaction). Each category has a name, a kind (expense / income) and a colour
that's used consistently across the donut, budgets, and table.

Renames cascade to the affected transactions and budgets; deleting a category
reassigns its transactions to **Uncategorized** (which can't be deleted) and
removes its budget.

Default expense categories: Housing · Utilities · Groceries · Dining · Transport ·
Travel · Subscriptions · Entertainment · Health & Fitness · Shopping ·
Education · Other · Uncategorized. Default income categories: Salary · Freelance ·
Investments · Refunds · Other Income.

## Security

Passwords are hashed with salted **PBKDF2-HMAC-SHA256** and never stored in the
clear; a strength policy (length + letters + numbers + variety) is enforced.
Sessions are stateless **HMAC-signed, self-expiring tokens**. Repeated failed
logins are **rate-limited per username** (lockout after 5 failures in 15 minutes)
to blunt brute-force attempts. All data access is scoped to the authenticated
user, and every secret comparison is constant-time.

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

All routes except `/health`, `/api/auth/register`, and `/api/auth/login` require
an `Authorization: Bearer <token>` header and operate only on the signed-in
user's data.

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `POST` | `/api/auth/register` | Create an account → `{ token, user }` |
| `POST` | `/api/auth/login` | Sign in → `{ token, user }` (rate-limited) |
| `GET` | `/api/auth/me` | The current user |
| `PUT` | `/api/auth/password` | Change password (`current_password`, `new_password`) |
| `PUT` | `/api/auth/currency` | Update preferred currency |
| `DELETE` | `/api/auth/data` | Clear all of the user's transactions & budgets |
| `DELETE` | `/api/auth/account` | Delete the account and all its data |
| `GET` | `/api/categories` | The user's categories (`{ categories, expense, income }`) |
| `POST` | `/api/categories` | Create a category (`name`, `kind`, `color`) |
| `PUT` | `/api/categories/{name}` | Rename (`new_name`) and/or recolour (`color`); cascades |
| `DELETE` | `/api/categories/{name}` | Delete (reassigns its transactions to Uncategorized) |
| `GET` | `/api/transactions` | The user's transactions |
| `POST` | `/api/transactions` | Create (`type` `expense`\|`income`; optional `category`, `account`, `note`) |
| `PUT` | `/api/transactions/{id}` | Partial update |
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
| **Backend** | Python, FastAPI, Uvicorn (gzip + input validation), stdlib-only auth (PBKDF2 + HMAC-signed tokens, brute-force throttle) |
| **Database** | SQLite (`sqlite3`, no ORM), per-user scoping |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS v4 — custom flat/solid design system |
| **UI** | Framer Motion, Recharts, lucide-react, next-themes, react-day-picker |

No heavy ML or crypto dependencies — authentication is plain standard-library
Python, so installs stay fast and the service stays light. `npm run lint` and
`npm run build` validate the frontend.
