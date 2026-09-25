"""Per-user rate limiting (slowapi) for the endpoints that call Gemini —
protects the shared free-tier quota from one runaway user or bot."""

from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request


def _rate_limit_key(request: Request) -> str:
    """Buckets by the logged-in user's own token when present (so one
    student can't drown out another on the same college wifi/NAT), falling
    back to IP for unauthenticated requests. This is only ever used to pick
    a rate-limit bucket, never to establish identity — get_current_user in
    app/auth.py is what actually verifies who's making the request."""
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth.split(" ", 1)[1].strip()
        if token:
            return f"user:{token[-32:]}"
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key)
