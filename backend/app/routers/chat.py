from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user, CurrentUser
from app.rate_limit import limiter
from app.services.gemini_service import chat_about_notes, AIGenerationError
from app.services.tutor_service import run_tutor_agent, TutorAgentError

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatTurn(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    raw_text: str
    question: str
    history: list[ChatTurn] = []
    language: str = "English"


@router.post("")
@limiter.limit("20/minute")
async def chat(
    request: Request,
    req: ChatRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """The Cross-Note Tutor Agent — an agentic feature, not a one-shot
    prompt: Gemini decides for itself whether this question can be
    answered from the currently open note alone, or whether it should
    search across every note this student has ever saved first. Falls
    back to the plain single-note chat if the agent call fails for any
    reason, so a hiccup never breaks the chat entirely."""
    try:
        reply = run_tutor_agent(
            user_id=current_user.id,
            current_note_text=req.raw_text,
            question=req.question,
            history=[turn.model_dump() for turn in req.history],
            language=req.language,
        )
        return {"reply": reply}
    except TutorAgentError:
        pass  # fall through to the simpler, non-agentic path below

    try:
        reply = chat_about_notes(
            text=req.raw_text,
            question=req.question,
            history=[turn.model_dump() for turn in req.history],
            language=req.language,
        )
    except AIGenerationError:
        raise HTTPException(502, "NoteBuddy couldn't reply just now — please try again in a moment.")
    return {"reply": reply}
