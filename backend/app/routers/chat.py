from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user, CurrentUser
from app.rate_limit import limiter
from app.services import supabase_client
from app.services.gemini_service import chat_about_notes, extract_chat_diagram, looks_like_process, AIGenerationError
from app.services.tutor_service import run_tutor_agent, TutorAgentError

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _diagram_for(question: str, reply: str) -> dict | None:
    """Inline auto-generated diagrams — best-effort, never lets a hiccup in
    the (optional) extra call break the actual chat reply that already
    succeeded. Gated by a cheap keyword check so most ordinary chat turns
    never pay for the extra Gemini call at all."""
    if not looks_like_process(question, reply):
        return None
    try:
        result = extract_chat_diagram(reply)
    except AIGenerationError:
        return None
    if not result.get("has_diagram") or len(result.get("steps") or []) < 3:
        return None
    return {"steps": result["steps"][:6]}


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
        return {"reply": reply, "diagram": _diagram_for(req.question, reply)}
    except TutorAgentError:
        pass  # fall through to the simpler, non-agentic path below

    try:
        analogy_domain = supabase_client.get_analogy_domain(current_user.id)
    except RuntimeError:
        analogy_domain = None
    try:
        reply = chat_about_notes(
            text=req.raw_text,
            question=req.question,
            history=[turn.model_dump() for turn in req.history],
            language=req.language,
            analogy_domain=analogy_domain,
        )
    except AIGenerationError:
        raise HTTPException(502, "NoteBuddy couldn't reply just now — please try again in a moment.")
    return {"reply": reply, "diagram": _diagram_for(req.question, reply)}
