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


@router.post("/quiz-answer")
async def record_quiz_answer(req: QuizAnswerRequest, current_user: CurrentUser = Depends(get_current_user)):
    """Feeds the weak-topic tracker — every quiz answer nudges a per-topic
    correct/wrong counter, used later to bias regeneration and Exam Cram
    Mode toward what this student actually struggles with."""
    try:
        supabase_client.record_quiz_answer(current_user.id, req.topic, req.correct)
    except RuntimeError:
        pass  # Supabase not configured yet — fail silently, this is best-effort
    return {"status": "ok"}
