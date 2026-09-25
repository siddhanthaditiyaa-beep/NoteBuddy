"""Semantic search across a student's own notes — "which of my notes
mentioned mitochondria?" — using Gemini's free, separate embeddings quota
(distinct from the generation quota) and Supabase's pgvector extension,
which ships free with every Supabase Postgres project. Turns a flat pile of
notes into an actual searchable knowledge base instead of a list a student
has to scroll through from memory."""

import google.generativeai as genai
from app.config import GEMINI_API_KEY
from app.services.supabase_client import get_client

genai.configure(api_key=GEMINI_API_KEY)

EMBED_MODEL = "models/text-embedding-004"
CHUNK_SIZE = 800  # characters — small enough for a tight semantic match, big enough for real context


def _chunk_text(text: str) -> list[str]:
    """Splits on paragraph breaks first, then hard-wraps anything still too
    long — keeps chunks topically coherent instead of cutting mid-thought
    wherever the character count happens to land."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    for para in paragraphs:
        if len(para) <= CHUNK_SIZE:
            chunks.append(para)
        else:
            for i in range(0, len(para), CHUNK_SIZE):
                chunks.append(para[i : i + CHUNK_SIZE])
    return chunks[:40]  # a hard cap so one enormous note can't blow the free embedding quota alone


def embed_and_store_note(note_id: str, user_id: str, raw_text: str) -> None:
    """Best-effort — a failure here should never block saving the note
    itself, since semantic search is a bonus feature, not core to the app."""
    chunks = _chunk_text(raw_text)
    if not chunks:
        return
    client = get_client()
    rows = []
    for chunk in chunks:
        try:
            result = genai.embed_content(model=EMBED_MODEL, content=chunk, task_type="retrieval_document")
            rows.append({
                "note_id": note_id,
                "user_id": user_id,
                "chunk_text": chunk,
                "embedding": result["embedding"],
            })
        except Exception:
            continue  # skip a chunk that failed to embed rather than losing the whole note
    if rows:
        client.table("note_embeddings").insert(rows).execute()


def search_notes(user_id: str, query: str, limit: int = 6) -> list[dict]:
    client = get_client()
    result = genai.embed_content(model=EMBED_MODEL, content=query, task_type="retrieval_query")
    query_embedding = result["embedding"]

    matches = client.rpc(
        "match_note_chunks",
        {"query_embedding": query_embedding, "match_user_id": user_id, "match_count": limit},
    ).execute()
    rows = matches.data or []
    if not rows:
        return []

    # Attach each chunk's note title in one follow-up query instead of one
    # query per row.
    note_ids = list({r["note_id"] for r in rows})
    titles_result = client.table("notes").select("id, title").in_("id", note_ids).execute()
    title_map = {n["id"]: n["title"] for n in (titles_result.data or [])}

    return [
        {
            "note_id": r["note_id"],
            "note_title": title_map.get(r["note_id"], "Untitled note"),
            "chunk_text": r["chunk_text"],
            "similarity": r["similarity"],
        }
        for r in rows
    ]
