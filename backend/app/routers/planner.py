from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from app.auth import get_current_user, CurrentUser
from app.rate_limit import limiter
from app.services.planner_service import generate_study_plan, PlannerError

router = APIRouter(prefix="/api/planner", tags=["planner"])


class PlanRequest(BaseModel):
    goal: str
    note_ids: list[str] | None = None


@router.post("/plan")
@limiter.limit("5/minute")
async def plan(request: Request, req: PlanRequest, current_user: CurrentUser = Depends(get_current_user)):
    if not req.goal or len(req.goal.strip()) < 5:
        raise HTTPException(
            400, "Tell NoteBuddy a bit more about your goal — e.g. \"exam in 5 days, covering biology and history\"."
        )
    try:
        study_plan = generate_study_plan(current_user.id, req.goal.strip(), req.note_ids)
    except PlannerError:
        raise HTTPException(502, "NoteBuddy's planner is having trouble right now — please try again in a moment.")
    return {"plan": study_plan}
