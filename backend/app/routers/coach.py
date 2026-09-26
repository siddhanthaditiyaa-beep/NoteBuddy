from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from app.auth import get_current_user, CurrentUser
from app.rate_limit import limiter
from app.services.coach_service import get_study_coach_advice, CoachError

router = APIRouter(prefix="/api/coach", tags=["coach"])


class CoachRequest(BaseModel):
    goal: str = ""


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
