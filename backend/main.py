import math
import os
from contextlib import asynccontextmanager
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, field_validator

from categorize import ALL_CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES, categorize_transactions
from database import (
    delete_transaction,
    get_all_transactions,
    get_budgets,
    init_db,
    insert_transaction,
    set_budget,
    update_transaction,
)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

# Upper bound for any single amount / budget. Generous enough for real personal
# finance (a trillion) while preventing pathological values that would break
# formatting and the UI layout.
_MAX_AMOUNT = 1e12


def _check_finite(v: Optional[float]) -> Optional[float]:
    if v is not None and (math.isnan(v) or math.isinf(v)):
        raise ValueError("amount must be a finite number")
    return v


def _check_bounds(v: Optional[float]) -> Optional[float]:
    v = _check_finite(v)
    if v is not None and abs(v) > _MAX_AMOUNT:
        raise ValueError("amount is too large")
    return v


class TransactionCreate(BaseModel):
    date: str
    vendor: str
    amount: float
    type: Literal["expense", "income"] = "expense"
    manual_category: Optional[str] = None

    @field_validator("date", "vendor")
    @classmethod
    def _required_text(cls, v: str, info) -> str:
        if not v or not v.strip():
            raise ValueError(f"{info.field_name} is required")
        return v.strip()

    @field_validator("amount")
    @classmethod
    def _amount_valid(cls, v: float) -> float:
        v = _check_bounds(v)
        if v is not None and v < 0:
            raise ValueError("amount must be zero or positive")
        return v

    @field_validator("manual_category")
    @classmethod
    def _clean_category(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() or None if v else None


class TransactionUpdate(BaseModel):
    date: Optional[str] = None
    vendor: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[Literal["expense", "income"]] = None
    manual_category: Optional[str] = None

    @field_validator("date", "vendor")
    @classmethod
    def _non_empty_if_present(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("value cannot be empty")
        return v.strip() if v is not None else v

    @field_validator("amount")
    @classmethod
    def _amount_valid(cls, v: Optional[float]) -> Optional[float]:
        v = _check_bounds(v)
        if v is not None and v < 0:
            raise ValueError("amount must be zero or positive")
        return v

    @field_validator("manual_category")
    @classmethod
    def _clean_category(cls, v: Optional[str]) -> Optional[str]:
        # Empty string is treated as "clear the override" (→ None → SQL NULL).
        if v is None:
            return None
        return v.strip() or None


class BudgetUpdate(BaseModel):
    monthly_limit: Optional[float] = None

    @field_validator("monthly_limit")
    @classmethod
    def _valid_limit(cls, v: Optional[float]) -> Optional[float]:
        return _check_bounds(v)


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Cashflow API", lifespan=lifespan)

# Origins are configurable via the CORS_ORIGINS env var (comma-separated);
# falls back to the local dev + production Vercel origins.
_DEFAULT_ORIGINS = ["http://localhost:3000", "https://ai-finance-clustering.vercel.app"]
_env_origins = os.getenv("CORS_ORIGINS")
allow_origins = (
    [o.strip() for o in _env_origins.split(",") if o.strip()]
    if _env_origins
    else _DEFAULT_ORIGINS
)

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def read_root():
    return {"service": "Cashflow API", "docs": "/docs", "health": "/health"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/categories")
def list_categories() -> dict:
    """The fixed category vocabulary the frontend picker uses."""
    return {
        "all": ALL_CATEGORIES,
        "expense": EXPENSE_CATEGORIES,
        "income": INCOME_CATEGORIES,
    }


@app.get("/api/transactions")
def get_transactions() -> list[dict]:
    """All transactions, each enriched with an auto `category` suggestion."""
    return categorize_transactions(get_all_transactions())


# Back-compat alias for the old ML endpoint. Same enriched payload.
@app.get("/api/clusters")
def get_clusters() -> list[dict]:
    return categorize_transactions(get_all_transactions())


@app.post("/api/transactions", status_code=201)
def create_transaction(body: TransactionCreate) -> dict:
    row = insert_transaction(
        body.date, body.vendor, body.amount, body.type, body.manual_category
    )
    return categorize_transactions([row])[0]


@app.put("/api/transactions/{tx_id}")
def edit_transaction(tx_id: str, body: TransactionUpdate) -> dict:
    # exclude_unset=True: absent fields are not sent, so None means explicit NULL
    result = update_transaction(tx_id, body.model_dump(exclude_unset=True))
    if result is None:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return categorize_transactions([result])[0]


@app.delete("/api/transactions/{tx_id}", status_code=204)
def remove_transaction(tx_id: str) -> None:
    if not delete_transaction(tx_id):
        raise HTTPException(status_code=404, detail="Transaction not found.")


# ---------------------------------------------------------------------------
# Budgets
# ---------------------------------------------------------------------------

@app.get("/api/budgets")
def read_budgets() -> dict[str, float]:
    return get_budgets()


@app.put("/api/budgets/{category}")
def upsert_budget(category: str, body: BudgetUpdate) -> dict[str, float]:
    category = category.strip()
    if not category:
        raise HTTPException(status_code=400, detail="Category is required.")
    if body.monthly_limit is not None and body.monthly_limit < 0:
        raise HTTPException(status_code=400, detail="Budget cannot be negative.")
    set_budget(category, body.monthly_limit)
    return get_budgets()
