"""Keeps the demo account always feeling brand-new: every time someone logs
in as the demo user, the frontend calls this to wipe their previous notes
and XP so each demo run starts from a clean slate.
"""

import asyncio
from fastapi import APIRouter, HTTPException, Depends
from app.auth import get_current_user, CurrentUser
from app.services import supabase_client

router = APIRouter(prefix="/api/demo", tags=["demo"])

DEMO_EMAIL = "demo@notebuddy.app"


@router.post("/reset")
async def reset_demo(current_user: CurrentUser = Depends(get_current_user)):
    # Safety check: only ever reset the actual demo account, never whoever
    # happens to be logged in — the caller's identity comes from their own
    # verified session token now, not a client-supplied id.
    if not current_user.email or current_user.email.lower() != DEMO_EMAIL:
        raise HTTPException(403, "Reset is only available for the demo account.")

    try:
        client = supabase_client.get_client()
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    # This used to only wipe notes + profiles, which left flashcard_progress,
    # topic_progress (weak topics), and quiz_answer_log behind — so an old
    # test note in a different language could keep surfacing in Study Coach's
    # weak-topics list forever, even right after a "fresh" demo reset, since
    # topic_progress is keyed by (user_id, term), not tied to any note that
    # got deleted. Clearing all of it now actually starts from a clean slate.
    #
    # These 5 deletes used to run one at a time, each a full network
    # round-trip to Supabase — on a slow connection (or a cold-started free
    # backend) that adds up to real, felt latency on every single demo
    # login. supabase-py's client is synchronous, so asyncio.to_thread lets
    # all 5 actually run concurrently instead of queued behind each other.
    def _delete(table: str, column: str, value: str) -> None:
        try:
            client.table(table).delete().eq(column, value).execute()
        except Exception:
            pass  # best-effort — a missing/renamed table shouldn't block the rest of the reset

    await asyncio.gather(
        *(
            asyncio.to_thread(_delete, table, "user_id", current_user.id)
            for table in ("notes", "flashcard_progress", "topic_progress", "quiz_answer_log")
        ),
        asyncio.to_thread(_delete, "profiles", "id", current_user.id),  # profiles is keyed by id, not user_id
    )
    return {"status": "reset"}
