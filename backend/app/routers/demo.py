"""Keeps the demo account always feeling brand-new: every time someone logs
in as the demo user, the frontend calls this to wipe their previous notes
and XP so each demo run starts from a clean slate.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services import supabase_client

router = APIRouter(prefix="/api/demo", tags=["demo"])

DEMO_EMAIL = "demo@notebuddy.app"


class ResetRequest(BaseModel):
    user_id: str


@router.post("/reset")
async def reset_demo(req: ResetRequest):
    try:
        client = supabase_client.get_client()
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    # Safety check: only ever reset the actual demo account, never an
    # arbitrary user_id someone might pass in.
    try:
        user_resp = client.auth.admin.get_user_by_id(req.user_id)
        email = user_resp.user.email if user_resp and user_resp.user else None
    except Exception:
        raise HTTPException(400, "Could not verify this account.")

    if not email or email.lower() != DEMO_EMAIL:
        raise HTTPException(403, "Reset is only available for the demo account.")

    client.table("notes").delete().eq("user_id", req.user_id).execute()
    client.table("profiles").delete().eq("id", req.user_id).execute()
    return {"status": "reset"}
