import math
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, field_validator

from database import (
    delete_transaction,
    get_all_transactions,
    init_db,
    insert_transaction,
    update_transaction,
)
from ml_service import cluster_transactions


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

def _check_finite(v: Optional[float]) -> Optional[float]:
    if v is not None and (math.isnan(v) or math.isinf(v)):
        raise ValueError("amount must be a finite number")
    return v


class TransactionCreate(BaseModel):
    date: str
    vendor: str
    amount: float
    manual_category: Optional[str] = None

    @field_validator("date", "vendor")
    @classmethod
    def _required_text(cls, v: str, info) -> str:
        if not v or not v.strip():
            raise ValueError(f"{info.field_name} is required")
        return v.strip()

    @field_validator("amount")
    @classmethod
    def _amount_finite(cls, v: float) -> float:
        return _check_finite(v)

    @field_validator("manual_category")
    @classmethod
    def _clean_category(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() or None if v else None


class TransactionUpdate(BaseModel):
    date: Optional[str] = None
    vendor: Optional[str] = None
    amount: Optional[float] = None
    manual_category: Optional[str] = None

    @field_validator("date", "vendor")
    @classmethod
    def _non_empty_if_present(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("value cannot be empty")
        return v.strip() if v is not None else v

    @field_validator("amount")
    @classmethod
    def _amount_finite(cls, v: Optional[float]) -> Optional[float]:
        return _check_finite(v)

    @field_validator("manual_category")
    @classmethod
    def _clean_category(cls, v: Optional[str]) -> Optional[str]:
        # Empty string is treated as "clear the override" (→ None → SQL NULL).
        if v is None:
            return None
        return v.strip() or None


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Finance Clustering API", lifespan=lifespan)

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
    return {"service": "Finance Clustering API", "docs": "/docs", "health": "/health"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/transactions")
def get_transactions() -> list[dict]:
    return get_all_transactions()


@app.get("/api/clusters")
def get_clusters() -> list[dict]:
    try:
        raw = get_all_transactions()
        if not raw:
            return []
        return cluster_transactions(raw)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/transactions", status_code=201)
def create_transaction(body: TransactionCreate) -> dict:
    return insert_transaction(
        body.date, body.vendor, body.amount, body.manual_category
    )


@app.put("/api/transactions/{tx_id}")
def edit_transaction(tx_id: str, body: TransactionUpdate) -> dict:
    # exclude_unset=True: absent fields are not sent, so None means explicit NULL
    result = update_transaction(tx_id, body.model_dump(exclude_unset=True))
    if result is None:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return result


@app.delete("/api/transactions/{tx_id}", status_code=204)
def remove_transaction(tx_id: str) -> None:
    if not delete_transaction(tx_id):
        raise HTTPException(status_code=404, detail="Transaction not found.")
