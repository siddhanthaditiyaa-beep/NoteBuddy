from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
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


@router.post("/reset-progress")
async def reset_progress(current_user: CurrentUser = Depends(get_current_user)):
    """Clears weak topics, logged quiz answers, and flashcard spaced-
    repetition progress — the study HISTORY that can go stale or wrong
    (e.g. old test data in a different language throwing off Study
    Coach's weak-topics list) — without touching notes, XP, streak, or
    badges. A lighter, reversible-in-spirit alternative to deleting the
    whole account just to clear out old quiz data."""
    try:
        supabase_client.reset_progress(current_user.id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return {"status": "reset"}


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


@router.get("/class-heatmap")
async def class_heatmap(current_user: CurrentUser = Depends(get_current_user)):
    """Anonymized class-wide weak-spot heatmap — aggregate miss rates per
    topic across every student using the app, never anything about an
    individual. Auth is only to gate this to logged-in students; the data
    returned carries no identity at all."""
    try:
        return {"heatmap": supabase_client.get_class_heatmap()}
    except RuntimeError as e:
        raise HTTPException(503, str(e))


class StudyBuddyOptInRequest(BaseModel):
    opt_in: bool
    display_name: str | None = None
    note: str | None = None


@router.get("/study-buddy/status")
async def study_buddy_status(current_user: CurrentUser = Depends(get_current_user)):
    try:
        return supabase_client.get_study_buddy_status(current_user.id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@router.post("/study-buddy/opt-in")
async def study_buddy_opt_in(req: StudyBuddyOptInRequest, current_user: CurrentUser = Depends(get_current_user)):
    if req.opt_in and not (req.display_name and req.display_name.strip()):
        raise HTTPException(400, "Pick a display name first — this is what other students will see, never your email.")
    try:
        supabase_client.set_study_buddy_opt_in(current_user.id, req.opt_in, req.display_name, req.note)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return {"status": "ok"}


@router.get("/study-buddy/matches")
async def study_buddy_matches(current_user: CurrentUser = Depends(get_current_user)):
    """Matches by shared note subjects with everyone else who's opted in.
    Only ever shows the display name and note THEY chose to share — never
    their email or anything else tied to their account."""
    try:
        matches = supabase_client.find_study_buddies(current_user.id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return {"matches": matches}
