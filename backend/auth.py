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
import threading
import time
from pathlib import Path

_PBKDF2_ITERATIONS = 240_000
_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days
_SECRET_FILE = Path(__file__).parent / ".secret_key"

# Password policy
PASSWORD_MIN = 8
PASSWORD_MAX = 128


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


def validate_password(password: str) -> str | None:
    """Return an error message if the password is too weak, else None.

    Requires a reasonable length plus a mix of letters and numbers so accounts
    aren't protected by trivially guessable secrets.
    """
    if not password or len(password) < PASSWORD_MIN:
        return f"Password must be at least {PASSWORD_MIN} characters."
    if len(password) > PASSWORD_MAX:
        return f"Password must be at most {PASSWORD_MAX} characters."
    if not any(c.isalpha() for c in password):
        return "Password must include at least one letter."
    if not any(c.isdigit() for c in password):
        return "Password must include at least one number."
    if len(set(password)) < 4:
        return "Password is too repetitive — mix in more characters."
    return None


# ---------------------------------------------------------------------------
# Brute-force protection (in-memory sliding window per identifier)
# ---------------------------------------------------------------------------

class LoginThrottle:
    """Locks out an identifier after too many failures inside a time window.

    Thread-safe: FastAPI runs sync endpoints in a worker threadpool, so the
    shared failure map needs a lock. State is per-process and in-memory — plenty
    for a single-service deployment; a multi-instance deployment would swap this
    for a shared store.
    """

    def __init__(self, max_attempts: int = 5, window_seconds: int = 900) -> None:
        self.max_attempts = max_attempts
        self.window = window_seconds
        self._fails: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> list[float]:
        arr = [t for t in self._fails.get(key, ()) if now - t < self.window]
        if arr:
            self._fails[key] = arr
        else:
            self._fails.pop(key, None)
        return arr

    def seconds_until_unlocked(self, key: str) -> int:
        now = time.time()
        with self._lock:
            arr = self._prune(key, now)
            if len(arr) >= self.max_attempts:
                return max(0, int(arr[0] + self.window - now))
            return 0

    def record_failure(self, key: str) -> None:
        now = time.time()
        with self._lock:
            arr = self._prune(key, now)
            arr.append(now)
            self._fails[key] = arr

    def reset(self, key: str) -> None:
        with self._lock:
            self._fails.pop(key, None)


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
