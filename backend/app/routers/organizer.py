from fastapi import APIRouter, Depends, HTTPException, Request
from app.auth import get_current_user, CurrentUser
from app.rate_limit import limiter
from app.services.organizer_service import run_note_organizer_agent, OrganizerError

router = APIRouter(prefix="/api/organizer", tags=["organizer"])


@router.post("/analyze")
@limiter.limit("6/minute")
async def analyze(request: Request, current_user: CurrentUser = Depends(get_current_user)):
    """The Note-Organizer Agent — an agentic feature, not a fixed pipeline:
    Gemini looks at this student's saved notes, decides for itself which
    pairs are worth a full contradiction check, and suggests subject-tag
    fixes and combine candidates from real data, not guesses."""
    try:
        result = run_note_organizer_agent(current_user.id)
    except OrganizerError:
        raise HTTPException(502, "Your note organizer couldn't finish its analysis right now — please try again.")
    return result
