from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from app.auth import get_current_user, CurrentUser
from app.rate_limit import limiter
from app.services.planner_service import generate_study_plan, PlannerError
from app.services import supabase_client

router = APIRouter(prefix="/api/planner", tags=["planner"])


class PlanRequest(BaseModel):
    goal: str
    note_ids: list[str] | None = None


class CheckedUpdate(BaseModel):
    checked: dict


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

    # Persist it so leaving the Planner tab (or refreshing) doesn't lose it —
    # previously this only ever lived in this response and nowhere else.
    # Best-effort: if Supabase isn't configured, the plan still comes back
    # and works for this session, it just won't be listed/reopenable later.
    saved_id = None
    try:
        saved = supabase_client.save_study_plan(current_user.id, req.goal.strip(), study_plan)
        saved_id = saved.get("id")
    except RuntimeError:
        pass

    return {"plan": study_plan, "id": saved_id}


@router.get("/plans")
async def list_plans(current_user: CurrentUser = Depends(get_current_user)):
    try:
        plans = supabase_client.list_study_plans(current_user.id)
    except RuntimeError:
        plans = []
    return {"plans": plans}


@router.get("/plans/{plan_id}")
async def get_plan(plan_id: str, current_user: CurrentUser = Depends(get_current_user)):
    try:
        found = supabase_client.get_study_plan(current_user.id, plan_id)
    except RuntimeError:
        found = None
    if not found:
        raise HTTPException(404, "That study plan couldn't be found.")
    return found


@router.patch("/plans/{plan_id}/checked")
async def update_plan_checked(
    plan_id: str, req: CheckedUpdate, current_user: CurrentUser = Depends(get_current_user)
):
    try:
        ok = supabase_client.update_study_plan_checked(current_user.id, plan_id, req.checked)
    except RuntimeError:
        ok = False
    if not ok:
        raise HTTPException(404, "That study plan couldn't be found.")
    return {"status": "ok"}


@router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, current_user: CurrentUser = Depends(get_current_user)):
    try:
        ok = supabase_client.delete_study_plan(current_user.id, plan_id)
    except RuntimeError:
        ok = False
    if not ok:
        raise HTTPException(404, "That study plan couldn't be found.")
    return {"status": "deleted"}
