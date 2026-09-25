"""Small, cheap, single-purpose Gemini calls that don't warrant their own
full study-kit regeneration: re-explaining one concept differently, and
grading a typed short answer against the source material."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from app.auth import get_current_user, CurrentUser
from app.rate_limit import limiter
from app.services.gemini_service import explain_differently, grade_short_answer, AIGenerationError

router = APIRouter(prefix="/api/practice", tags=["practice"])


class ExplainRequest(BaseModel):
    context_text: str
    concept: str


@router.post("/explain-differently")
@limiter.limit("30/minute")
async def explain_differently_route(
    request: Request, req: ExplainRequest, current_user: CurrentUser = Depends(get_current_user)
):
    if not req.concept or not req.concept.strip():
        raise HTTPException(400, "Nothing to re-explain.")
    try:
        explanation = explain_differently(req.context_text, req.concept)
    except AIGenerationError:
        raise HTTPException(502, "Couldn't get another explanation right now — please try again.")
    return {"explanation": explanation}


class GradeAnswerRequest(BaseModel):
    context_text: str
    question: str
    student_answer: str


@router.post("/grade-answer")
@limiter.limit("30/minute")
async def grade_answer_route(
    request: Request, req: GradeAnswerRequest, current_user: CurrentUser = Depends(get_current_user)
):
    if not req.student_answer or not req.student_answer.strip():
        raise HTTPException(400, "Write an answer first.")
    try:
        result = grade_short_answer(req.context_text, req.question, req.student_answer)
    except AIGenerationError:
        raise HTTPException(502, "Couldn't grade that right now — please try again.")
    return result
