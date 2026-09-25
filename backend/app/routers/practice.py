"""Small, cheap, single-purpose Gemini calls that don't warrant their own
full study-kit regeneration: re-explaining one concept differently, and
grading a typed short answer against the source material."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from app.auth import get_current_user, CurrentUser
from app.rate_limit import limiter
from app.services import supabase_client
from app.services.gemini_service import (
    explain_differently, grade_short_answer, evaluate_teach_back,
    analyze_mistake_patterns, AIGenerationError,
)

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


class TeachBackRequest(BaseModel):
    context_text: str
    concept: str
    explanation: str


@router.post("/teach-back")
@limiter.limit("20/minute")
async def teach_back_route(
    request: Request, req: TeachBackRequest, current_user: CurrentUser = Depends(get_current_user)
):
    """Feynman/Teach-Back Mode — the student explains a concept in their own
    words as if teaching it to someone else, and gets tutor-style feedback
    on whether that explanation actually holds up."""
    if not req.explanation or len(req.explanation.strip()) < 15:
        raise HTTPException(400, "Try explaining it in a bit more detail — a sentence or two at least.")
    try:
        result = evaluate_teach_back(req.context_text, req.concept, req.explanation)
    except AIGenerationError:
        raise HTTPException(502, "Couldn't check that explanation right now — please try again.")
    return result


@router.get("/mistake-patterns")
@limiter.limit("10/minute")
async def mistake_patterns_route(request: Request, current_user: CurrentUser = Depends(get_current_user)):
    """Personalized Mistake-Pattern Retrospective — looks at a student's
    actual recent wrong quiz answers (question-level, not just topic
    counters) and asks Gemini to name the underlying pattern, not just the
    list of missed topics."""
    try:
        wrong = supabase_client.get_recent_wrong_answers(current_user.id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    try:
        result = analyze_mistake_patterns(wrong)
    except AIGenerationError:
        raise HTTPException(502, "Couldn't analyze your mistakes right now — please try again.")
    return result
