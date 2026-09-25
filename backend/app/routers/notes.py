from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Request
from pydantic import BaseModel
from app.auth import get_current_user, CurrentUser
from app.rate_limit import limiter
from app.config import MAX_UPLOAD_MB, MAX_AUDIO_MB, DAILY_GENERATION_LIMIT
from app.services.extraction import extract_text
from app.services.gemini_service import generate_study_kit, transcribe_audio, AIGenerationError
from app.services import supabase_client
from app.services.supabase_client import DailyLimitExceeded

router = APIRouter(prefix="/api/notes", tags=["notes"])

AUDIO_EXTENSIONS = (".mp3", ".wav", ".m4a", ".ogg", ".oga", ".webm", ".aac", ".flac", ".mp4")
DOC_EXTENSIONS = (".pdf", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".txt")
ALLOWED_EXTENSIONS = AUDIO_EXTENSIONS + DOC_EXTENSIONS


def _enforce_daily_cap(user_id: str):
    try:
        supabase_client.check_and_increment_daily_generations(user_id, DAILY_GENERATION_LIMIT)
    except DailyLimitExceeded as e:
        raise HTTPException(429, str(e))
    except RuntimeError:
        pass  # Supabase not configured yet — don't block local dev


def _run_generation(source_text: str, level: str, quiz_count: int) -> dict:
    try:
        return generate_study_kit(source_text, level=level, quiz_count=quiz_count)
    except AIGenerationError as e:
        raise HTTPException(502, "NoteBuddy's AI is having trouble right now — please try again in a moment.")


@router.post("/process")
@limiter.limit("10/minute")
async def process_note(
    request: Request,
    level: str = Form("beginner"),
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
    quiz_count: int = Form(5),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Accepts either pasted text OR an uploaded file (PDF/image/audio), runs
    OCR/transcription if needed, then asks Gemini to build the full study kit."""
    user_id = current_user.id

    if file is not None:
        filename_lower = file.filename.lower()
        if not filename_lower.endswith(ALLOWED_EXTENSIONS):
            raise HTTPException(415, "That file type isn't supported. Try a PDF, photo, text file, or audio clip.")

        raw_bytes = await file.read()
        is_audio = filename_lower.endswith(AUDIO_EXTENSIONS)
        size_cap_mb = MAX_AUDIO_MB if is_audio else MAX_UPLOAD_MB
        if len(raw_bytes) > size_cap_mb * 1024 * 1024:
            raise HTTPException(
                413, f"That file is too large — please keep {'audio clips' if is_audio else 'uploads'} under {size_cap_mb:.0f}MB."
            )

        if is_audio:
            try:
                source_text = transcribe_audio(raw_bytes, file.filename)
            except AIGenerationError:
                raise HTTPException(502, "Couldn't transcribe that audio right now — please try again in a moment.")
        else:
            source_text = extract_text(file.filename, raw_bytes)
    elif text:
        source_text = text
    else:
        raise HTTPException(400, "Provide either 'text' or a 'file' upload.")

    if not source_text or len(source_text.strip()) < 20:
        raise HTTPException(
            422,
            "Couldn't find enough readable text in that input — try pasting "
            "text directly, or a clearer photo/PDF.",
        )

    _enforce_daily_cap(user_id)
    study_kit = _run_generation(source_text, level, quiz_count)

    saved = None
    try:
        saved = supabase_client.save_note(
            user_id=user_id,
            title=study_kit.get("title", "Untitled note"),
            raw_text=source_text,
            study_kit=study_kit,
        )
        supabase_client.award_xp(user_id, amount=10)
    except RuntimeError:
        # Supabase not configured yet — still return the study kit so the
        # app works locally before the DB is wired up.
        pass

    return {"note": saved, "study_kit": study_kit, "raw_text": source_text}


class CombineRequest(BaseModel):
    note_ids: list[str]
    level: str = "beginner"
    quiz_count: int = 5


@router.post("/combine")
@limiter.limit("10/minute")
async def combine_notes(
    request: Request,
    req: CombineRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Merges several of the learner's saved notes into one combined study
    kit — handy for reviewing everything before an exam that spans several
    lectures, rather than jumping between separate study kits."""
    user_id = current_user.id
    if len(req.note_ids) < 2:
        raise HTTPException(400, "Pick at least 2 notes to combine.")

    sections = []
    titles = []
    try:
        for note_id in req.note_ids:
            note = supabase_client.get_note(user_id, note_id)
            if not note:
                continue
            titles.append(note["title"])
            sections.append(f"--- {note['title']} ---\n{note['raw_text']}")
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    if len(sections) < 2:
        raise HTTPException(404, "Couldn't find enough of those notes to combine.")

    combined_text = "\n\n".join(sections)
    _enforce_daily_cap(user_id)
    study_kit = _run_generation(combined_text, req.level, req.quiz_count)
    study_kit["title"] = f"Combined review: {', '.join(titles[:3])}" + (
        f" +{len(titles) - 3} more" if len(titles) > 3 else ""
    )

    saved = None
    try:
        saved = supabase_client.save_note(
            user_id=user_id,
            title=study_kit["title"],
            raw_text=combined_text,
            study_kit=study_kit,
            subject="Combined",
        )
        supabase_client.award_xp(user_id, amount=15)
    except RuntimeError:
        pass

    return {"note": saved, "study_kit": study_kit, "raw_text": combined_text}


@router.get("/list")
async def list_notes(current_user: CurrentUser = Depends(get_current_user)):
    try:
        return {"notes": supabase_client.list_notes(current_user.id)}
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@router.get("/{note_id}")
async def get_note(note_id: str, current_user: CurrentUser = Depends(get_current_user)):
    try:
        note = supabase_client.get_note(current_user.id, note_id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    if not note:
        raise HTTPException(404, "Note not found")
    return note


@router.post("/{note_id}/regenerate")
@limiter.limit("10/minute")
async def regenerate_note(
    request: Request,
    note_id: str,
    level: str = Form(...),
    quiz_count: int = Form(5),
    current_user: CurrentUser = Depends(get_current_user),
):
    user_id = current_user.id
    try:
        note = supabase_client.get_note(user_id, note_id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    if not note:
        raise HTTPException(404, "Note not found")

    _enforce_daily_cap(user_id)
    study_kit = _run_generation(note["raw_text"], level, quiz_count)
    return {"study_kit": study_kit}
