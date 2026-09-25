from fastapi import APIRouter, HTTPException
from app.services import supabase_client

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/progress")
async def progress(user_id: str):
    try:
        profile = supabase_client.get_profile(user_id)
        notes_count = len(supabase_client.list_notes(user_id))
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    xp = profile.get("xp", 0)
    streak = profile.get("streak", 0)
    return {
        "xp": xp,
        "streak": streak,
        "level": xp // 100 + 1,
        "xp_to_next_level": 100 - (xp % 100),
        "notes_count": notes_count,
        "badges": supabase_client.get_badges(notes_count, streak),
    }
