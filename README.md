# Personal Finance Dashboard

A full-stack personal finance application with an ML-powered transaction
categorisation engine, a **human-in-the-loop** override system, and a bold
**neo-brutalist** UI.

Raw bank transactions are clustered into spending categories by an unsupervised
ML pipeline (character-level TF-IDF + K-Means), while a manual override layer lets
you correct any category by hand — without ever retraining or biasing the model.

---

## Features

**Dashboard & insights**
- Summary stat cards : total spent, transaction count, average, and top category
- Interactive **donut chart** of spending by category (click a slice/legend to filter the table)
- **Spending over time** bar chart aggregated by month
- Light / dark mode and a multi-currency display toggle (USD, EUR, GBP, INR, JPY)

**Transactions**
- Live **search** by vendor, **filter** by category, **manual-only** filter, and **sortable** columns
- Add / edit / delete with **optimistic updates** (the UI responds instantly)
- **Confirm dialog** before destructive deletes
- One-click **"revert to ML"** on any manually-categorised row
- Toast notifications for every action; CSV export of the current view
- Keyboard shortcuts: `N` add · `/` focus search · `Esc` close

**Machine learning**
- Categories are learned from the data, not hard-coded string rules
- The model **always runs on raw data** — your manual edits never bias it
- Results are **memoised on a content hash**, so the API stays snappy and
  override-only edits never trigger a recompute

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

python seed.py                    # optional: load 200 synthetic transactions
uvicorn main:app --reload
```

The API runs at `http://localhost:8000` (interactive docs at `/docs`).

> **The database is not auto-seeded** — `finance.db` is created empty on first
> run. Use `python seed.py` to populate it with realistic, intentionally noisy
> sample data (`--force` to wipe and reseed, `-n N` for a custom count), or just
> add transactions through the UI.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard runs at `http://localhost:3000`.

> Both servers must run simultaneously. The frontend defaults to
> `http://localhost:8000` when `NEXT_PUBLIC_API_URL` is unset.

---

## How the human-in-the-loop model works

This is the core design and it spans both apps:

- **ML runs on raw data, every request, and is never persisted.**
  `GET /api/clusters` reads all rows fresh and clusters the full set each call.
  This keeps the model unbiased by user edits. (Identical inputs are served from
  an in-memory cache, so this is fast — see below.)
- **`manual_category` is the override layer**, applied at render time. The
  effective category a user sees is always `manual_category ?? cluster_name`.
- **Clearing an override** (setting `manual_category` to `NULL`) instantly
  reverts a row to its ML-assigned cluster.

### ML pipeline (`backend/ml_service.py`)
1. **Clean** — coerce dates and amounts (null amounts → median), fill null vendors.
2. **Features** — character n-gram TF-IDF on vendor strings (`char_wb`, 2–4 grams),
   robust to noisy strings like `"AMZN Mktp US"`, stacked with a scaled amount.
3. **Cluster** — `KMeans` (k adapts down for tiny datasets, so every row always
   gets a label).
4. **Label** — each cluster is named by scoring its vendor text against keyword
   sets, assigned greedily so labels are unique (`Misc`, `Misc 1`, … as fallback).

### Performance
Clustering is deterministic and depends only on vendor/amount/date, so results
are memoised on a content hash of those fields. Repeated reads and (critically)
override-only edits skip K-Means entirely — a ~150× speedup on cached calls —
while any change to the underlying data invalidates the cache automatically.

---

## API

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `GET` | `/api/clusters` | All transactions enriched with `cluster_id` + `cluster_name` |
| `GET` | `/api/transactions` | Raw transactions (no ML) |
| `POST` | `/api/transactions` | Create (validated; dates normalised to ISO) |
| `PUT` | `/api/transactions/{id}` | Partial update; send `manual_category: null` to clear an override |
| `DELETE` | `/api/transactions/{id}` | Delete |

Dates are normalised to `YYYY-MM-DD` on write (and existing rows are migrated on
startup), so ordering is always chronological. CORS origins are configurable via
the `CORS_ORIGINS` env var (comma-separated).

---

## Deployment

### Backend — Render
1. Create a **Web Service** and set **Root Directory** to `backend`.
2. **Build:** `pip install -r requirements.txt`
3. **Start:** `uvicorn main:app --host 0.0.0.0 --port 8000`
   (`--host 0.0.0.0` is required for Render to reach the service.)
4. Optionally set `CORS_ORIGINS` to your frontend origin(s).

### Frontend — Vercel
1. Import the repo; set **Root Directory** to `frontend`, framework **Next.js**.
2. **Required env var:** `NEXT_PUBLIC_API_URL = https://your-api.onrender.com`
   (no trailing slash). Without it the deployed frontend calls `localhost` and
   every request fails.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python, FastAPI, Uvicorn (gzip + input validation) |
| **ML / Data** | scikit-learn (KMeans, TfidfVectorizer, StandardScaler), Pandas, NumPy |
| **Database** | SQLite (`sqlite3`, no ORM) |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS v4 — custom neo-brutalist design system |
| **UI** | Framer Motion, Recharts, lucide-react, next-themes, react-day-picker |

There is no automated test suite; `npm run lint` and `npm run build` validate the frontend.
