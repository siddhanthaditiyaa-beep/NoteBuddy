from fastapi import APIRouter
from pydantic import BaseModel
from app.services.gemini_service import chat_about_notes

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatTurn(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    raw_text: str
    question: str
    history: list[ChatTurn] = []


@router.post("")
async def chat(req: ChatRequest):
    reply = chat_about_notes(
        text=req.raw_text,
        question=req.question,
        history=[turn.model_dump() for turn in req.history],
    )
    return {"reply": reply}
