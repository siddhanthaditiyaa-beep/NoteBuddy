from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user, CurrentUser
from app.rate_limit import limiter
from app.services.gemini_service import chat_about_notes, AIGenerationError

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatTurn(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    raw_text: str
    question: str
    history: list[ChatTurn] = []


@router.post("")
@limiter.limit("20/minute")
async def chat(
    request: Request,
    req: ChatRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        reply = chat_about_notes(
            text=req.raw_text,
            question=req.question,
            history=[turn.model_dump() for turn in req.history],
        )
    except AIGenerationError:
        raise HTTPException(502, "NoteBuddy couldn't reply just now — please try again in a moment.")
    return {"reply": reply}
