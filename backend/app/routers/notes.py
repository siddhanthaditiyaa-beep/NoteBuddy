from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from app.services.extraction import extract_text
from app.services.gemini_service import generate_study_kit, transcribe_audio
from app.services import supabase_client

router = APIRouter(prefix="/api/notes", tags=["notes"])

AUDIO_EXTENSIONS = (".mp3", ".wav", ".m4a", ".ogg", ".oga", ".webm", ".aac", ".flac", ".mp4")


@router.post("/process")
async def process_note(
    user_id: str = Form(...),
    level: str = Form("beginner"),
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
):
    """Accepts either pasted text OR an uploaded file (PDF/image), runs OCR/
    extraction if needed, then asks Gemini to build the full study kit."""
    if file is not None:
        raw_bytes = await file.read()
        if file.filename.lower().endswith(AUDIO_EXTENSIONS):
            source_text = transcribe_audio(raw_bytes, file.filename)
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

    study_kit = generate_study_kit(source_text, level=level)

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
    user_id: str
    note_ids: list[str]
    level: str = "beginner"


@router.post("/combine")
async def combine_notes(req: CombineRequest):
    """Merges several of the learner's saved notes into one combined study
    kit — handy for reviewing everything before an exam that spans several
    lectures, rather than jumping between separate study kits."""
    if len(req.note_ids) < 2:
        raise HTTPException(400, "Pick at least 2 notes to combine.")

    sections = []
    titles = []
    try:
        for note_id in req.note_ids:
            note = supabase_client.get_note(req.user_id, note_id)
            if not note:
                continue
            titles.append(note["title"])
            sections.append(f"--- {note['title']} ---\n{note['raw_text']}")
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    if len(sections) < 2:
        raise HTTPException(404, "Couldn't find enough of those notes to combine.")

    combined_text = "\n\n".join(sections)
    study_kit = generate_study_kit(combined_text, level=req.level)
    study_kit["title"] = f"Combined review: {', '.join(titles[:3])}" + (
        f" +{len(titles) - 3} more" if len(titles) > 3 else ""
    )

    saved = None
    try:
        saved = supabase_client.save_note(
            user_id=req.user_id,
            title=study_kit["title"],
            raw_text=combined_text,
            study_kit=study_kit,
            subject="Combined",
        )
        supabase_client.award_xp(req.user_id, amount=15)
    except RuntimeError:
        pass

    return {"note": saved, "study_kit": study_kit, "raw_text": combined_text}


@router.get("/list")
async def list_notes(user_id: str):
    try:
        return {"notes": supabase_client.list_notes(user_id)}
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@router.get("/{note_id}")
async def get_note(note_id: str, user_id: str):
    try:
        note = supabase_client.get_note(user_id, note_id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    if not note:
        raise HTTPException(404, "Note not found")
    return note


@router.post("/{note_id}/regenerate")
async def regenerate_note(note_id: str, user_id: str = Form(...), level: str = Form(...)):
    try:
        note = supabase_client.get_note(user_id, note_id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    if not note:
        raise HTTPException(404, "Note not found")

    study_kit = generate_study_kit(note["raw_text"], level=level)
    return {"study_kit": study_kit}
