"""Verifies the Supabase JWT on every protected request and derives the
real, verified user id/email from it — routers must NEVER trust a
client-supplied user_id again (form field, query param, or JSON body).

Every note, review, and progress route now depends on get_current_user
instead of reading user_id directly from the request, which closes the
"anyone who guesses a UUID can read/edit anyone else's data" hole.
"""

from fastapi import Header, HTTPException
from app.services.supabase_client import get_client


class CurrentUser:
    """Minimal verified-identity object — just what routers need."""

    def __init__(self, id: str, email: str | None):
        self.id = id
        self.email = email


async def get_current_user(authorization: str | None = Header(None)) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "You're not logged in (missing session token).")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(401, "You're not logged in (missing session token).")

    try:
        client = get_client()
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    try:
        result = client.auth.get_user(token)
    except Exception:
        raise HTTPException(401, "Your session has expired — please log in again.")

    if not result or not result.user:
        raise HTTPException(401, "Your session has expired — please log in again.")

    return CurrentUser(id=result.user.id, email=result.user.email)
