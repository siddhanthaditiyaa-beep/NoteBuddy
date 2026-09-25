"""Spaced-repetition flashcard review — the SM-2 algorithm decides which
cards are due today, and grading a card reschedules it further out (or
brings it back sooner) based on how well the learner remembered it."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.auth import get_current_user, CurrentUser
from app.services import supabase_client

router = APIRouter(prefix="/api/review", tags=["review"])


@router.get("/due")
async def due_cards(note_id: str | None = None, current_user: CurrentUser = Depends(get_current_user)):
    try:
        cards = supabase_client.get_due_flashcards(current_user.id, note_id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return {"cards": cards, "count": len(cards)}


class GradeRequest(BaseModel):
    note_id: str
    card_index: int
    quality: int  # 0-5, SM-2 scale


@router.post("/grade")
async def grade_card(req: GradeRequest, current_user: CurrentUser = Depends(get_current_user)):
    if not 0 <= req.quality <= 5:
        raise HTTPException(400, "quality must be between 0 and 5")
    try:
        result = supabase_client.grade_flashcard(
            current_user.id, req.note_id, req.card_index, req.quality
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return result


class QuizAnswerRequest(BaseModel):
    topic: str
    correct: bool
    # Everything below is optional and additive — older frontend builds that
    # only ever sent topic/correct keep working unchanged.
    note_id: str | None = None
    question: str | None = None
    chosen_answer: str | None = None
    correct_answer: str | None = None
    confidence: int | None = None  # 1 (not sure) - 3 (very sure), student-rated before seeing the result


@router.post("/quiz-answer")
async def record_quiz_answer(req: QuizAnswerRequest, current_user: CurrentUser = Depends(get_current_user)):
    """Feeds the weak-topic tracker — every quiz answer nudges a per-topic
    correct/wrong counter, used later to bias regeneration and Exam Cram
    Mode toward what this student actually struggles with. Also, best-effort,
    logs the full answer so Confidence Calibration and the Mistake-Pattern
    Retrospective have real question-level history to work from."""
    try:
        supabase_client.record_quiz_answer(current_user.id, req.topic, req.correct)
    except RuntimeError:
        pass  # Supabase not configured yet — fail silently, this is best-effort
    try:
        supabase_client.log_quiz_answer(
            current_user.id, req.note_id, req.topic, req.question,
            req.chosen_answer, req.correct_answer, req.correct, req.confidence,
        )
    except Exception:
        pass  # best-effort — never let logging block the quiz flow
    return {"status": "ok"}


@router.get("/confidence-calibration")
async def confidence_calibration(current_user: CurrentUser = Depends(get_current_user)):
    """Buckets logged answers by how confident the student said they felt,
    and reports real accuracy per bucket — the gap between the two is the
    whole point of Confidence Calibration Tracking."""
    try:
        return supabase_client.get_confidence_calibration(current_user.id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
