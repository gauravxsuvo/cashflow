# Cashflow

Cashflow is a personal finance ledger. You log income and expenses, organise
them with your own categories and accounts, and track net balance, savings
rate, and monthly budgets over time. Every account is private and starts
empty; there is no shared or demo data.

---

## Features

### Accounts and privacy

Sign up with a username and password. Passwords are hashed with salted
PBKDF2-HMAC-SHA256 and sessions use signed, self-expiring tokens, so there is
nothing to store or leak beyond the hash. Each account is fully isolated:
one user can never see another user's data. Settings let you switch between
light, dark, and system theme, change your currency, clear all data, or
delete the account outright.

### Overview

The dashboard opens on stat cards for net balance, income, expenses, and
savings rate, including a month-over-month spending trend. A time-period
filter (this month, last month, last three months, this year, all time)
scopes the whole page. Below that sits a donut chart of spending by
category, clickable to filter the transaction table, and a bar chart of
income against expenses by month. If you tag transactions with an account,
an accounts panel shows net balance per wallet.

### Budgets

Set a monthly limit on any expense category. A progress bar fills as you
spend, turns amber near the limit, and turns red once you go over, with the
exact amount left or over shown underneath.

### Transactions and categories

Add income or expenses through a single form: type, date, amount, an
optional account tag, and a free-text note. Categories are entirely manual.
Every new account starts with a sensible default set, and you can create,
rename, recolour, or delete categories at any time, either from the
category manager or inline while adding a transaction. Renaming or deleting
a category cascades safely to every transaction and budget that used it; a
deleted category's transactions fall back to Uncategorized, which cannot
itself be deleted.

The transaction table supports live search across vendor and notes,
filtering by type, account, or category, and sortable columns. Edits and
deletes apply optimistically and roll back on failure, with a confirmation
step before anything is deleted. CSV export and keyboard shortcuts (N to
add, / to focus search, Esc to close) round out the workflow.

---

## Design

The interface uses a flat, solid-surface design: plain cards with hairline
borders and soft shadows, no translucency or blur effects. It supports
light and dark themes and is responsive down to small phones. Wide content,
such as tables and charts, scrolls inside its own container instead of the
page.

---

## Security

Passwords are hashed with salted PBKDF2-HMAC-SHA256 and never stored or
logged in plain text. A password policy enforces minimum length plus a mix
of letters, numbers, and character variety. Sessions are stateless,
HMAC-signed tokens that expire on their own; there is no server-side
session store to invalidate. Repeated failed logins are rate-limited per
username, with a lockout after five failures in fifteen minutes. Every
route except health, register, and login requires a valid token and
operates only on that token's own data, and every secret comparison in the
codebase runs in constant time to avoid timing side-channels.

---

## Quick start (local development)

### Prerequisites

- Python 3.11 or newer
- Node.js 18 or newer

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # macOS / Linux
# venv\Scripts\activate           # Windows
pip install -r requirements.txt

uvicorn main:app --reload
```

The API runs at `http://localhost:8000`, with interactive docs at `/docs`.
`finance.db` is created empty on first run; register a user through the UI
to begin. To populate a demo account with synthetic data for local
testing:

```bash
python seed.py --username demo --password demopass123   # create and seed a user
python seed.py --username demo --force                  # wipe and reseed that user
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:3000` and talks to `http://localhost:8000`
by default. Set `NEXT_PUBLIC_API_URL` to point it elsewhere.

---

## API reference

Every route except `/health`, `/api/auth/register`, and `/api/auth/login`
requires an `Authorization: Bearer <token>` header, and every request is
scoped to the signed-in user.

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Liveness probe |
| POST | `/api/auth/register` | Create an account, returns `{ token, user }` |
| POST | `/api/auth/login` | Sign in, returns `{ token, user }`, rate-limited |
| GET | `/api/auth/me` | The current user |
| PUT | `/api/auth/password` | Change password (`current_password`, `new_password`) |
| PUT | `/api/auth/currency` | Update preferred currency |
| DELETE | `/api/auth/data` | Clear all transactions and budgets for this user |
| DELETE | `/api/auth/account` | Delete the account and all associated data |
| GET | `/api/categories` | The user's categories, as `{ categories, expense, income }` |
| POST | `/api/categories` | Create a category (`name`, `kind`, `color`) |
| PUT | `/api/categories/{name}` | Rename (`new_name`) and/or recolour (`color`); cascades |
| DELETE | `/api/categories/{name}` | Delete; reassigns its transactions to Uncategorized |
| GET | `/api/transactions` | The user's transactions |
| POST | `/api/transactions` | Create a transaction (`type` is `expense` or `income`; `category`, `account`, and `note` are optional) |
| PUT | `/api/transactions/{id}` | Partial update |
| DELETE | `/api/transactions/{id}` | Delete |
| GET | `/api/budgets` | `{ category: monthly_limit }` for every budget set |
| PUT | `/api/budgets/{category}` | Set a monthly limit; `null` or `0` removes it |

Dates are normalised to `YYYY-MM-DD` on write. CORS origins are configured
through the `CORS_ORIGINS` environment variable as a comma-separated list.

---

## Deployment

### Backend on Render

1. Create a Web Service with root directory `backend`.
2. Build command: `pip install -r requirements.txt`.
3. Start command: `uvicorn main:app --host 0.0.0.0 --port 8000`.
4. Set `SECRET_KEY` to a long random string; it signs auth tokens. In local
   development a random key is generated automatically and cached in
   `backend/.secret_key`.
5. Optionally set `CORS_ORIGINS` to your frontend's origin.

Render's free tier has no persistent disk and wipes the filesystem on every
restart, which destroys `finance.db`. A durable deployment needs a paid
instance with a persistent disk mounted at the backend's working directory.

### Frontend on Vercel

1. Import the repository and set root directory to `frontend`, framework
   Next.js.
2. Set `NEXT_PUBLIC_API_URL` to your backend's URL, for example
   `https://your-api.onrender.com`, with no trailing slash. Without it the
   deployed frontend calls `localhost`.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, Uvicorn (gzip and input validation), stdlib-only auth (PBKDF2 and HMAC-signed tokens, brute-force throttle) |
| Database | SQLite (`sqlite3`, no ORM), scoped per user |
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, custom flat/solid design system |
| UI | Framer Motion, Recharts, lucide-react, next-themes, react-day-picker |

The backend has no ML or cryptography dependencies beyond the Python
standard library, so installs stay fast and the service stays light.
`npm run lint` and `npm run build` validate the frontend.
