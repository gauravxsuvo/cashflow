"""
Authentication primitives — password hashing and stateless signed tokens.

Deliberately dependency-free (Python standard library only), matching the rest
of Cashflow's "light install" philosophy, while still being genuinely secure:

  * Passwords are hashed with PBKDF2-HMAC-SHA256 (a NIST-recommended KDF) using
    a unique 16-byte random salt per user and a high iteration count. The plain
    password is never stored and never logged.
  * Auth tokens are compact HMAC-SHA256 signed blobs (`payload.signature`) with
    an expiry. Any tampering or a wrong secret fails signature verification.
  * All secret comparisons use `hmac.compare_digest` (constant time) to avoid
    leaking information through timing.

The signing secret comes from the `SECRET_KEY` environment variable in
production. For local dev a random key is generated once and persisted to
`backend/.secret_key` (gitignored) so tokens survive server restarts.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path

_PBKDF2_ITERATIONS = 240_000
_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days
_SECRET_FILE = Path(__file__).parent / ".secret_key"


def _load_secret() -> bytes:
    """Signing secret: env var in prod, a persisted random key in dev."""
    env = os.getenv("SECRET_KEY")
    if env:
        return env.encode("utf-8")
    if _SECRET_FILE.exists():
        data = _SECRET_FILE.read_bytes()
        if data:
            return data
    key = secrets.token_bytes(32)
    try:
        _SECRET_FILE.write_bytes(key)
    except OSError:
        pass  # read-only fs (e.g. some hosts): fall back to an in-memory key
    return key


_SECRET = _load_secret()


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Return a salted PBKDF2 hash string: `pbkdf2_sha256$iters$salt$hash`."""
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Constant-time verify a password against a stored PBKDF2 hash string."""
    try:
        algo, iters_s, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iters_s)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
    except (ValueError, AttributeError):
        return False
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(dk, expected)


# ---------------------------------------------------------------------------
# Tokens (compact HMAC-signed, self-expiring)
# ---------------------------------------------------------------------------

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(text: str) -> bytes:
    padding = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + padding)


def create_token(user_id: str, ttl_seconds: int = _TOKEN_TTL_SECONDS) -> str:
    """Issue a signed token for `user_id` that expires after `ttl_seconds`."""
    now = int(time.time())
    payload = {"sub": user_id, "iat": now, "exp": now + ttl_seconds}
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(_SECRET, payload_b64.encode("ascii"), hashlib.sha256).digest()
    return f"{payload_b64}.{_b64url_encode(signature)}"


def verify_token(token: str) -> str | None:
    """Return the user id for a valid, unexpired token, else None."""
    if not token or token.count(".") != 1:
        return None
    payload_b64, signature_b64 = token.split(".")
    expected_sig = hmac.new(_SECRET, payload_b64.encode("ascii"), hashlib.sha256).digest()
    try:
        actual_sig = _b64url_decode(signature_b64)
    except (ValueError, base64.binascii.Error):  # type: ignore[attr-defined]
        return None
    if not hmac.compare_digest(expected_sig, actual_sig):
        return None
    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except (ValueError, base64.binascii.Error):  # type: ignore[attr-defined]
        return None
    if not isinstance(payload, dict):
        return None
    exp = payload.get("exp", 0)
    if not isinstance(exp, (int, float)) or exp < time.time():
        return None
    sub = payload.get("sub")
    return sub if isinstance(sub, str) else None
