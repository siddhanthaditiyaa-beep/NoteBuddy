from fastapi import APIRouter, HTTPException, Depends
from app.auth import get_current_user, CurrentUser
from app.services import supabase_client

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/progress")
async def progress(current_user: CurrentUser = Depends(get_current_user)):
    user_id = current_user.id
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


@router.get("/weak-topics")
async def weak_topics(current_user: CurrentUser = Depends(get_current_user)):
    try:
        topics = supabase_client.get_weak_topics(current_user.id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return {"topics": topics}


@router.delete("/account")
async def delete_account(current_user: CurrentUser = Depends(get_current_user)):
    """A real account-deletion flow, not a support-email dead end — wipes
    every row tied to this student (notes, flashcard/topic progress, push
    subscriptions, profile) and then removes the auth user itself."""
    try:
        supabase_client.delete_account(current_user.id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    except Exception:
        raise HTTPException(502, "Couldn't fully delete your account right now — please try again in a moment.")
    return {"status": "deleted"}
