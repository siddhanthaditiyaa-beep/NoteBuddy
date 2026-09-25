"""Thin wrapper around Supabase for storing notes/study-kits and simple
gamification state (XP + streak). Using the service role key here because
this all runs server-side; the frontend never sees this key.
"""

from datetime import datetime, timedelta, timezone
from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "Supabase is not configured yet — set SUPABASE_URL and "
                "SUPABASE_SERVICE_KEY in backend/.env"
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


def save_note(user_id: str, title: str, raw_text: str, study_kit: dict, subject: str | None = None) -> dict:
    client = get_client()
    result = client.table("notes").insert({
        "user_id": user_id,
        "title": title,
        "raw_text": raw_text,
        "study_kit": study_kit,
        "subject": subject or study_kit.get("subject") or "General",
    }).execute()
    return result.data[0] if result.data else {}


def list_notes(user_id: str) -> list[dict]:
    client = get_client()
    result = (
        client.table("notes")
        .select("id, title, subject, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def get_note(user_id: str, note_id: str) -> dict | None:
    client = get_client()
    result = (
        client.table("notes")
        .select("*")
        .eq("user_id", user_id)
        .eq("id", note_id)
        .single()
        .execute()
    )
    return result.data


def award_xp(user_id: str, amount: int) -> dict:
    """Adds XP and bumps the streak if the last activity was yesterday or today."""
    client = get_client()
    existing = (
        client.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
    )
    profile = existing.data if existing and existing.data else None

    if profile is None:
        new_profile = {"id": user_id, "xp": amount, "streak": 1}
        client.table("profiles").insert(new_profile).execute()
        return new_profile

    updated_xp = profile.get("xp", 0) + amount
    client.table("profiles").update({"xp": updated_xp}).eq("id", user_id).execute()
    profile["xp"] = updated_xp
    return profile


def get_profile(user_id: str) -> dict:
    client = get_client()
    result = client.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
    return result.data if result and result.data else {"id": user_id, "xp": 0, "streak": 0}


# ---------------------------------------------------------------------------
# Spaced-repetition flashcard review (SM-2 algorithm)
# ---------------------------------------------------------------------------
# Flashcards themselves live inside notes.study_kit (no separate table) — we
# only persist per-card *progress* here, keyed by (user_id, note_id,
# card_index). A card with no progress row yet is treated as brand new and
# always due.

REVIEW_BATCH_LIMIT = 30


def get_due_flashcards(user_id: str) -> list[dict]:
    client = get_client()
    notes_result = (
        client.table("notes")
        .select("id, title, study_kit")
        .eq("user_id", user_id)
        .execute()
    )
    notes = notes_result.data or []
    if not notes:
        return []

    progress_result = (
        client.table("flashcard_progress")
        .select("note_id, card_index, next_review_date")
        .eq("user_id", user_id)
        .execute()
    )
    progress_by_key = {
        (row["note_id"], row["card_index"]): row for row in (progress_result.data or [])
    }

    now = datetime.now(timezone.utc)
    due: list[dict] = []
    for note in notes:
        cards = (note.get("study_kit") or {}).get("flashcards") or []
        for idx, card in enumerate(cards):
            key = (note["id"], idx)
            row = progress_by_key.get(key)
            is_new = row is None
            if is_new:
                due.append({
                    "note_id": note["id"],
                    "note_title": note["title"],
                    "card_index": idx,
                    "front": card.get("front", ""),
                    "back": card.get("back", ""),
                    "is_new": True,
                })
                continue
            next_review = row.get("next_review_date")
            if next_review:
                try:
                    next_review_dt = datetime.fromisoformat(next_review.replace("Z", "+00:00"))
                except ValueError:
                    next_review_dt = now
                if next_review_dt <= now:
                    due.append({
                        "note_id": note["id"],
                        "note_title": note["title"],
                        "card_index": idx,
                        "front": card.get("front", ""),
                        "back": card.get("back", ""),
                        "is_new": False,
                    })
            if len(due) >= REVIEW_BATCH_LIMIT:
                return due
    return due


def grade_flashcard(user_id: str, note_id: str, card_index: int, quality: int) -> dict:
    """quality is 0-5 (SM-2 scale): 0 = totally forgot, 5 = perfect recall.
    The frontend maps its four buttons (Again/Hard/Good/Easy) to 0/3/4/5."""
    client = get_client()
    existing = (
        client.table("flashcard_progress")
        .select("*")
        .eq("user_id", user_id)
        .eq("note_id", note_id)
        .eq("card_index", card_index)
        .maybe_single()
        .execute()
    )
    row = existing.data if existing and existing.data else None

    ease = row["ease_factor"] if row else 2.5
    interval = row["interval_days"] if row else 0
    repetitions = row["repetitions"] if row else 0

    if quality < 3:
        repetitions = 0
        interval = 1
    else:
        if repetitions == 0:
            interval = 1
        elif repetitions == 1:
            interval = 6
        else:
            interval = round(interval * ease)
        repetitions += 1

    ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    ease = max(ease, 1.3)

    next_review = datetime.now(timezone.utc) + timedelta(days=interval)

    payload = {
        "user_id": user_id,
        "note_id": note_id,
        "card_index": card_index,
        "ease_factor": ease,
        "interval_days": interval,
        "repetitions": repetitions,
        "next_review_date": next_review.isoformat(),
        "last_reviewed": datetime.now(timezone.utc).isoformat(),
    }
    client.table("flashcard_progress").upsert(
        payload, on_conflict="user_id,note_id,card_index"
    ).execute()
    return {"next_review_date": payload["next_review_date"], "interval_days": interval}


# ---------------------------------------------------------------------------
# Badges — computed on the fly from data we already have, no extra table.
# ---------------------------------------------------------------------------

BADGE_DEFS = [
    {"id": "first_note", "label": "First Steps", "description": "Made your first study kit", "min_notes": 1},
    {"id": "five_notes", "label": "Getting Serious", "description": "Made 5 study kits", "min_notes": 5},
    {"id": "ten_notes", "label": "Study Machine", "description": "Made 10 study kits", "min_notes": 10},
    {"id": "three_streak", "label": "On a Roll", "description": "3-day streak", "min_streak": 3},
    {"id": "week_streak", "label": "Week Warrior", "description": "7-day streak", "min_streak": 7},
]


def get_badges(notes_count: int, streak: int) -> list[dict]:
    earned = []
    for b in BADGE_DEFS:
        if "min_notes" in b and notes_count >= b["min_notes"]:
            earned.append({"id": b["id"], "label": b["label"], "description": b["description"]})
        elif "min_streak" in b and streak >= b["min_streak"]:
            earned.append({"id": b["id"], "label": b["label"], "description": b["description"]})
    return earned
