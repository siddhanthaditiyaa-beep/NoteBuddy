import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.auth import get_current_user, CurrentUser
from app.rate_limit import limiter
from app.config import MAX_UPLOAD_MB, MAX_AUDIO_MB, DAILY_GENERATION_LIMIT
from app.services.extraction import extract_text
from app.services.youtube_service import get_transcript_text, YouTubeImportError
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


def _generate_with_cache(
    source_text: str, level: str, quiz_count: int, language: str, mode: str, weak_topics: list[str] | None = None
) -> dict:
    """Serves a cached study kit for identical input instead of re-calling
    Gemini, saving quota on duplicate uploads/re-combines. Weak-topic-biased
    regenerations are never cached (they're personalized, not reusable)."""
    cache_key = None
    if not weak_topics:
        try:
            cache_key = supabase_client.make_cache_key(source_text, level, quiz_count, language, mode)
            cached = supabase_client.get_cached_study_kit(cache_key)
            if cached:
                return cached
        except RuntimeError:
            pass

    try:
        study_kit = generate_study_kit(
            source_text, level=level, quiz_count=quiz_count, language=language, mode=mode, weak_topics=weak_topics
        )
    except AIGenerationError:
        raise HTTPException(502, "NoteBuddy's AI is having trouble right now — please try again in a moment.")

    if cache_key:
        try:
            supabase_client.save_cached_study_kit(cache_key, study_kit)
        except RuntimeError:
            pass
    return study_kit


@router.post("/extract")
@limiter.limit("20/minute")
async def extract_only(
    request: Request,
    files: list[UploadFile] = File(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Extraction only (OCR/PDF text) — no Gemini call involved, so this is
    completely free. Powers the "review before you generate" step: multiple
    photographed pages of one note come in here, get joined in order, and
    go back as one editable block of text before anything is spent on AI."""
    if not files:
        raise HTTPException(400, "No files provided.")

    texts = []
    for f in files:
        filename_lower = f.filename.lower()
        if filename_lower.endswith(AUDIO_EXTENSIONS):
            raise HTTPException(400, "Audio clips go through the record/upload flow, not text extraction.")
        if not filename_lower.endswith(DOC_EXTENSIONS):
            raise HTTPException(415, f"'{f.filename}' isn't a supported type — use a PDF or image.")

        raw_bytes = await f.read()
        if len(raw_bytes) > MAX_UPLOAD_MB * 1024 * 1024:
            raise HTTPException(413, f"'{f.filename}' is too large — please keep each file under {MAX_UPLOAD_MB:.0f}MB.")

        texts.append(extract_text(f.filename, raw_bytes))

    combined = "\n\n--- page break ---\n\n".join(t for t in texts if t and t.strip())
    return {"text": combined, "pages": len(files)}


class YouTubeRequest(BaseModel):
    url: str


@router.post("/youtube-transcript")
@limiter.limit("15/minute")
async def youtube_transcript(
    request: Request, req: YouTubeRequest, current_user: CurrentUser = Depends(get_current_user)
):
    """Free — no Gemini call. Returns the raw transcript text so the
    frontend can drop it into the same editable-text flow as a pasted note
    (review/edit, then generate), rather than a special-cased pipeline."""
    try:
        result = get_transcript_text(req.url)
    except YouTubeImportError as e:
        raise HTTPException(422, str(e))
    return result


@router.post("/process")
@limiter.limit("10/minute")
async def process_note(
    request: Request,
    level: str = Form("beginner"),
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
    quiz_count: int = Form(5),
    language: str = Form("English"),
    mode: str = Form("full"),
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
    study_kit = _generate_with_cache(source_text, level, quiz_count, language, mode)

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

    return {"note": saved, "study_kit": study_kit, "raw_text": source_text, "language": language, "mode": mode}


def _sse(stage: str, **extra) -> str:
    return f"data: {json.dumps({'stage': stage, **extra})}\n\n"


async def _process_stream_generator(
    user_id: str, level: str, text: str | None, file: UploadFile | None,
    quiz_count: int, language: str, mode: str,
):
    """Same work as /process, but reports real stages as it goes (extracting
    -> generating -> saving -> done) instead of the frontend showing one
    static spinner for the whole 10-30 second request. A student on a slow
    connection can now tell the app is actually doing something, not frozen."""
    try:
        source_text = None
        if file is not None:
            filename_lower = file.filename.lower()
            if not filename_lower.endswith(ALLOWED_EXTENSIONS):
                yield _sse("error", message="That file type isn't supported. Try a PDF, photo, text file, or audio clip.")
                return
            raw_bytes = await file.read()
            is_audio = filename_lower.endswith(AUDIO_EXTENSIONS)
            size_cap_mb = MAX_AUDIO_MB if is_audio else MAX_UPLOAD_MB
            if len(raw_bytes) > size_cap_mb * 1024 * 1024:
                yield _sse(
                    "error",
                    message=f"That file is too large — please keep {'audio clips' if is_audio else 'uploads'} under {size_cap_mb:.0f}MB.",
                )
                return
            yield _sse("extracting")
            if is_audio:
                try:
                    source_text = transcribe_audio(raw_bytes, file.filename)
                except AIGenerationError:
                    yield _sse("error", message="Couldn't transcribe that audio right now — please try again in a moment.")
                    return
            else:
                source_text = extract_text(file.filename, raw_bytes)
        elif text:
            source_text = text
        else:
            yield _sse("error", message="Provide either 'text' or a 'file' upload.")
            return

        if not source_text or len(source_text.strip()) < 20:
            yield _sse(
                "error",
                message="Couldn't find enough readable text in that input — try pasting text directly, or a clearer photo/PDF.",
            )
            return

        try:
            _enforce_daily_cap(user_id)
        except HTTPException as e:
            yield _sse("error", message=str(e.detail))
            return

        yield _sse("generating")
        try:
            study_kit = _generate_with_cache(source_text, level, quiz_count, language, mode)
        except HTTPException as e:
            yield _sse("error", message=str(e.detail))
            return

        yield _sse("saving")
        saved = None
        try:
            saved = supabase_client.save_note(
                user_id=user_id, title=study_kit.get("title", "Untitled note"), raw_text=source_text, study_kit=study_kit
            )
            supabase_client.award_xp(user_id, amount=10)
        except RuntimeError:
            pass

        yield _sse(
            "done",
            data={"note": saved, "study_kit": study_kit, "raw_text": source_text, "language": language, "mode": mode},
        )
    except Exception:
        yield _sse("error", message="Something went wrong generating your study kit.")


@router.post("/process-stream")
@limiter.limit("10/minute")
async def process_note_stream(
    request: Request,
    level: str = Form("beginner"),
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
    quiz_count: int = Form(5),
    language: str = Form("English"),
    mode: str = Form("full"),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Same request shape as /process, but streamed as Server-Sent Events
    (one 'data: {...}' line per stage) instead of one final JSON blob."""
    return StreamingResponse(
        _process_stream_generator(current_user.id, level, text, file, quiz_count, language, mode),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class CombineRequest(BaseModel):
    note_ids: list[str]
    level: str = "beginner"
    quiz_count: int = 5
    language: str = "English"


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
    study_kit = _generate_with_cache(combined_text, req.level, req.quiz_count, req.language, "full")
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


@router.get("/public/{note_id}")
async def get_public_note(note_id: str):
    """No auth required — this is the whole point of a shareable link. Only
    ever returns a note the owner explicitly marked public."""
    try:
        note = supabase_client.get_public_note(note_id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    if not note:
        raise HTTPException(404, "This study kit isn't shared (or doesn't exist).")
    return note


@router.get("/{note_id}")
async def get_note(note_id: str, current_user: CurrentUser = Depends(get_current_user)):
    try:
        note = supabase_client.get_note(current_user.id, note_id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    if not note:
        raise HTTPException(404, "Note not found")
    return note


class ShareRequest(BaseModel):
    is_public: bool = True


@router.post("/{note_id}/share")
async def share_note(
    note_id: str, req: ShareRequest, current_user: CurrentUser = Depends(get_current_user)
):
    """Toggles a note's public/private share link. Only the owner (verified
    via their session token) can flip this."""
    try:
        updated = supabase_client.set_note_public(current_user.id, note_id, req.is_public)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    if not updated:
        raise HTTPException(404, "Note not found")
    return {"note_id": note_id, "is_public": req.is_public}


@router.post("/{note_id}/regenerate")
@limiter.limit("10/minute")
async def regenerate_note(
    request: Request,
    note_id: str,
    level: str = Form(...),
    quiz_count: int = Form(5),
    language: str = Form("English"),
    use_weak_topics: bool = Form(False),
    current_user: CurrentUser = Depends(get_current_user),
):
    user_id = current_user.id
    try:
        note = supabase_client.get_note(user_id, note_id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    if not note:
        raise HTTPException(404, "Note not found")

    weak_topics = None
    if use_weak_topics:
        try:
            weak_topics = [t["term"] for t in supabase_client.get_weak_topics(user_id)]
        except RuntimeError:
            weak_topics = None

    _enforce_daily_cap(user_id)
    study_kit = _generate_with_cache(note["raw_text"], level, quiz_count, language, "full", weak_topics)
    return {"study_kit": study_kit}
