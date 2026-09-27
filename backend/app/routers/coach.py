from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from app.auth import get_current_user, CurrentUser
from app.rate_limit import limiter
from app.services.coach_service import get_study_coach_advice, generate_session_replay, CoachError

router = APIRouter(prefix="/api/coach", tags=["coach"])


class CoachRequest(BaseModel):
    goal: str = ""


class SessionCard(BaseModel):
    front: str
    quality: int  # 0-5, the SM-2 grade the student gave this card


class SessionReplayRequest(BaseModel):
    cards: list[SessionCard]


@router.post("/session-replay")
@limiter.limit("15/minute")
async def session_replay(
    request: Request, req: SessionReplayRequest, current_user: CurrentUser = Depends(get_current_user)
):
    """Study Session Replay — turns the flashcards just reviewed this
    session into one short, warm coach-style text message instead of a
    dashboard card. Same signal as the Study Coach, framed as a personal
    message right when a session wraps up."""
    if not req.cards:
        raise HTTPException(400, "No cards reviewed this session.")
    try:
        message = generate_session_replay([c.model_dump() for c in req.cards])
    except CoachError:
        raise HTTPException(502, "Couldn't put together a session recap right now — please try again.")
    return {"message": message}


@router.post("/advise")
@limiter.limit("6/minute")
async def advise(request: Request, req: CoachRequest, current_user: CurrentUser = Depends(get_current_user)):
    """The Study Coach Agent — an agentic feature, not a canned prompt: Gemini
    autonomously calls into this student's real weak-topic, due-flashcard,
    confidence-calibration, and mistake-history data before diagnosing what
    they should do next."""
    try:
        result = get_study_coach_advice(current_user.id, req.goal)
    except CoachError:
        raise HTTPException(502, "Your study coach couldn't put together advice right now — please try again.")
    return result
