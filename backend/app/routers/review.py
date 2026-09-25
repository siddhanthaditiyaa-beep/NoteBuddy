"""Spaced-repetition flashcard review — the SM-2 algorithm decides which
cards are due today, and grading a card reschedules it further out (or
brings it back sooner) based on how well the learner remembered it."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services import supabase_client

router = APIRouter(prefix="/api/review", tags=["review"])


@router.get("/due")
async def due_cards(user_id: str, note_id: str | None = None):
    try:
        cards = supabase_client.get_due_flashcards(user_id, note_id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return {"cards": cards, "count": len(cards)}


class GradeRequest(BaseModel):
    user_id: str
    note_id: str
    card_index: int
    quality: int  # 0-5, SM-2 scale


@router.post("/grade")
async def grade_card(req: GradeRequest):
    if not 0 <= req.quality <= 5:
        raise HTTPException(400, "quality must be between 0 and 5")
    try:
        result = supabase_client.grade_flashcard(
            req.user_id, req.note_id, req.card_index, req.quality
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return result
