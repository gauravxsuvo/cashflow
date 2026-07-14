import math
import os
import re
from contextlib import asynccontextmanager
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, field_validator

from auth import create_token, hash_password, verify_password, verify_token
from categorize import ALL_CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES, categorize_transactions
from database import (
    clear_user_data,
    create_user,
    delete_transaction,
    delete_user,
    get_all_transactions,
    get_budgets,
    get_user_by_id,
    get_user_by_username,
    init_db,
    insert_transaction,
    set_budget,
    update_transaction,
    update_user_currency,
    update_user_password,
)

# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

# Upper bound for any single amount / budget. Generous enough for real personal
# finance (a trillion) while preventing pathological values that would break
# formatting and the UI layout.
_MAX_AMOUNT = 1e12
_SUPPORTED_CURRENCIES = {"USD", "EUR", "GBP", "INR", "JPY", "CAD", "AUD", "CHF", "CNY", "BRL"}
_USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,30}$")
_MIN_PASSWORD = 8
_MAX_PASSWORD = 128


def _check_finite(v: Optional[float]) -> Optional[float]:
    if v is not None and (math.isnan(v) or math.isinf(v)):
        raise ValueError("amount must be a finite number")
    return v


def _check_bounds(v: Optional[float]) -> Optional[float]:
    v = _check_finite(v)
    if v is not None and abs(v) > _MAX_AMOUNT:
        raise ValueError("amount is too large")
    return v


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class Credentials(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def _valid_username(cls, v: str) -> str:
        v = (v or "").strip()
        if not _USERNAME_RE.match(v):
            raise ValueError(
                "Username must be 3–30 characters (letters, numbers, . _ - )."
            )
        return v

    @field_validator("password")
    @classmethod
    def _valid_password(cls, v: str) -> str:
        if not v or len(v) < _MIN_PASSWORD:
            raise ValueError(f"Password must be at least {_MIN_PASSWORD} characters.")
        if len(v) > _MAX_PASSWORD:
            raise ValueError(f"Password must be at most {_MAX_PASSWORD} characters.")
        return v


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _valid_password(cls, v: str) -> str:
        if not v or len(v) < _MIN_PASSWORD:
            raise ValueError(f"Password must be at least {_MIN_PASSWORD} characters.")
        if len(v) > _MAX_PASSWORD:
            raise ValueError(f"Password must be at most {_MAX_PASSWORD} characters.")
        return v


class CurrencyUpdate(BaseModel):
    currency: str

    @field_validator("currency")
    @classmethod
    def _valid_currency(cls, v: str) -> str:
        v = (v or "").strip().upper()
        if v not in _SUPPORTED_CURRENCIES:
            raise ValueError("Unsupported currency.")
        return v


class TransactionCreate(BaseModel):
    date: str
    vendor: str
    amount: float
    type: Literal["expense", "income"] = "expense"
    manual_category: Optional[str] = None
    account: Optional[str] = None
    note: Optional[str] = None

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

    @field_validator("manual_category", "account", "note")
    @classmethod
    def _clean_optional(cls, v: Optional[str]) -> Optional[str]:
        return (v.strip() or None) if v else None


class TransactionUpdate(BaseModel):
    date: Optional[str] = None
    vendor: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[Literal["expense", "income"]] = None
    manual_category: Optional[str] = None
    account: Optional[str] = None
    note: Optional[str] = None

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

    @field_validator("manual_category", "account", "note")
    @classmethod
    def _clean_optional(cls, v: Optional[str]) -> Optional[str]:
        # Empty string is treated as "clear" (→ None → SQL NULL).
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

_bearer = HTTPBearer(auto_error=False)


def _public_user(user: dict) -> dict:
    """Strip secrets before sending a user object to the client."""
    return {
        "id": user["id"],
        "username": user["username"],
        "currency": user.get("currency", "USD"),
        "created_at": user.get("created_at"),
    }


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """Resolve the authenticated user from the Bearer token, or 401."""
    if creds is None or (creds.scheme or "").lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated.")
    user_id = verify_token(creds.credentials)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    user = get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Account no longer exists.")
    return user


# ---------------------------------------------------------------------------
# Meta
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
    return {"all": ALL_CATEGORIES, "expense": EXPENSE_CATEGORIES, "income": INCOME_CATEGORIES}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.post("/api/auth/register", status_code=201)
def register(body: Credentials) -> dict:
    if get_user_by_username(body.username) is not None:
        raise HTTPException(status_code=409, detail="That username is already taken.")
    user = create_user(body.username, hash_password(body.password))
    return {"token": create_token(user["id"]), "user": _public_user(user)}


@app.post("/api/auth/login")
def login(body: Credentials) -> dict:
    user = get_user_by_username(body.username)
    # Always run the verify to keep timing uniform whether or not the user exists.
    placeholder = "pbkdf2_sha256$240000$00$00"
    ok = verify_password(body.password, user["password_hash"] if user else placeholder)
    if not user or not ok:
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    return {"token": create_token(user["id"]), "user": _public_user(user)}


@app.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)) -> dict:
    return _public_user(user)


@app.put("/api/auth/password")
def change_password(body: PasswordChange, user: dict = Depends(get_current_user)) -> dict:
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Your current password is incorrect.")
    update_user_password(user["id"], hash_password(body.new_password))
    return {"status": "ok"}


@app.put("/api/auth/currency")
def change_currency(body: CurrencyUpdate, user: dict = Depends(get_current_user)) -> dict:
    update_user_currency(user["id"], body.currency)
    return {"currency": body.currency}


@app.delete("/api/auth/data")
def wipe_data(user: dict = Depends(get_current_user)) -> dict:
    removed = clear_user_data(user["id"])
    return {"removed": removed}


@app.delete("/api/auth/account", status_code=204)
def delete_account(user: dict = Depends(get_current_user)) -> None:
    delete_user(user["id"])


# ---------------------------------------------------------------------------
# Transactions (per-user)
# ---------------------------------------------------------------------------

@app.get("/api/transactions")
def get_transactions(user: dict = Depends(get_current_user)) -> list[dict]:
    """All of the user's transactions, each enriched with an auto `category`."""
    return categorize_transactions(get_all_transactions(user["id"]))


@app.post("/api/transactions", status_code=201)
def create_transaction(body: TransactionCreate, user: dict = Depends(get_current_user)) -> dict:
    row = insert_transaction(
        user["id"],
        body.date,
        body.vendor,
        body.amount,
        body.type,
        body.manual_category,
        body.account,
        body.note,
    )
    return categorize_transactions([row])[0]


@app.put("/api/transactions/{tx_id}")
def edit_transaction(
    tx_id: str, body: TransactionUpdate, user: dict = Depends(get_current_user)
) -> dict:
    # exclude_unset=True: absent fields are not sent, so None means explicit NULL
    result = update_transaction(user["id"], tx_id, body.model_dump(exclude_unset=True))
    if result is None:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return categorize_transactions([result])[0]


@app.delete("/api/transactions/{tx_id}", status_code=204)
def remove_transaction(tx_id: str, user: dict = Depends(get_current_user)) -> None:
    if not delete_transaction(user["id"], tx_id):
        raise HTTPException(status_code=404, detail="Transaction not found.")


# ---------------------------------------------------------------------------
# Budgets (per-user)
# ---------------------------------------------------------------------------

@app.get("/api/budgets")
def read_budgets(user: dict = Depends(get_current_user)) -> dict[str, float]:
    return get_budgets(user["id"])


@app.put("/api/budgets/{category}")
def upsert_budget(
    category: str, body: BudgetUpdate, user: dict = Depends(get_current_user)
) -> dict[str, float]:
    category = category.strip()
    if not category:
        raise HTTPException(status_code=400, detail="Category is required.")
    if body.monthly_limit is not None and body.monthly_limit < 0:
        raise HTTPException(status_code=400, detail="Budget cannot be negative.")
    set_budget(user["id"], category, body.monthly_limit)
    return get_budgets(user["id"])
