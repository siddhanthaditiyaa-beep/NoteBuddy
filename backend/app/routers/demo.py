"""Keeps the demo account always feeling brand-new: every time someone logs
in as the demo user, the frontend calls this to wipe their previous notes
and XP so each demo run starts from a clean slate.
"""

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

    client.table("notes").delete().eq("user_id", current_user.id).execute()
    client.table("profiles").delete().eq("id", current_user.id).execute()
    return {"status": "reset"}
