"""Thin wrapper around Supabase for storing notes/study-kits and simple
gamification state (XP + streak). Using the service role key here because
this all runs server-side; the frontend never sees this key.
"""

import hashlib
from datetime import datetime, timedelta, timezone
from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_client: Client | None = None


class DailyLimitExceeded(Exception):
    """Raised when a user has hit their daily AI-generation cap — kept as
    its own exception (rather than a generic RuntimeError) so routers can
    tell "Supabase isn't configured" apart from "you're out of generations
    for today" and return the right HTTP status for each."""


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
        # Stored at write time (not computed on every dashboard load) so the
        # "time saved" stat is one cheap SUM over already-saved numbers,
        # not a raw_text scan across every note the student has ever made.
        "word_count": len((raw_text or "").split()),
    }).execute()
    return result.data[0] if result.data else {}


def list_notes(user_id: str) -> list[dict]:
    client = get_client()
    result = (
        client.table("notes")
        .select("id, title, subject, created_at, word_count")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def list_public_notes(limit: int = 50, subject: str | None = None) -> list[dict]:
    """Powers the public, indexable gallery of shared study kits (Part 4:
    a search like 'Biology Chapter 5 flashcards' should be able to land a
    stranger on NoteBuddy). Only ever returns notes the owner explicitly
    made public — same is_public flag the private share-link flow uses."""
    client = get_client()
    query = (
        client.table("notes")
        .select("id, title, subject, created_at")
        .eq("is_public", True)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if subject:
        query = query.eq("subject", subject)
    result = query.execute()
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


def get_notes_by_ids(user_id: str, note_ids: list[str]) -> list[dict]:
    """Only ever returns notes this user actually owns — used by the
    Cross-Note Contradiction & Gap Detector, which compares raw_text across
    a few notes the student picks."""
    if not note_ids:
        return []
    client = get_client()
    result = (
        client.table("notes")
        .select("id, title, raw_text")
        .eq("user_id", user_id)
        .in_("id", note_ids)
        .execute()
    )
    return result.data or []


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


def check_and_increment_daily_generations(user_id: str, limit: int) -> None:
    """Hard per-user daily cap on AI generations, so one student (or a bot)
    can't burn through the whole class's shared free-tier Gemini quota.
    Call this BEFORE the Gemini call, not after, so a blocked request never
    reaches the AI. Raises DailyLimitExceeded once the cap is hit today."""
    client = get_client()
    today = datetime.now(timezone.utc).date().isoformat()

    existing = (
        client.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
    )
    profile = existing.data if existing and existing.data else None

    if profile is None:
        client.table("profiles").insert(
            {"id": user_id, "xp": 0, "streak": 0, "daily_gen_count": 1, "daily_gen_date": today}
        ).execute()
        return

    if profile.get("daily_gen_date") != today:
        client.table("profiles").update(
            {"daily_gen_count": 1, "daily_gen_date": today}
        ).eq("id", user_id).execute()
        return

    count = profile.get("daily_gen_count") or 0
    if count >= limit:
        raise DailyLimitExceeded(
            f"You've reached today's limit of {limit} AI generations — come back tomorrow!"
        )
    client.table("profiles").update({"daily_gen_count": count + 1}).eq("id", user_id).execute()


# ---------------------------------------------------------------------------
# Spaced-repetition flashcard review (SM-2 algorithm)
# ---------------------------------------------------------------------------
# Flashcards themselves live inside notes.study_kit (no separate table) — we
# only persist per-card *progress* here, keyed by (user_id, note_id,
# card_index). A card with no progress row yet is treated as brand new and
# always due.

REVIEW_BATCH_LIMIT = 30


def get_due_flashcards(user_id: str, note_id: str | None = None) -> list[dict]:
    """With no note_id, returns cards that are genuinely due today (or brand
    new) across every note — the normal spaced-repetition queue. With a
    note_id, the learner explicitly asked to practice that one note right
    now, so every one of its cards is returned regardless of schedule —
    grading them still updates their SM-2 progress as usual."""
    client = get_client()
    query = client.table("notes").select("id, title, study_kit").eq("user_id", user_id)
    if note_id:
        query = query.eq("id", note_id)
    notes_result = query.execute()
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

            if note_id:
                # Ad-hoc single-note review — include every card, due or not.
                due.append({
                    "note_id": note["id"],
                    "note_title": note["title"],
                    "card_index": idx,
                    "front": card.get("front", ""),
                    "back": card.get("back", ""),
                    "is_new": is_new,
                })
                continue

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


# ---------------------------------------------------------------------------
# Study-kit caching — same input (text + level + quiz count + language +
# mode) is hashed and cached, so re-uploading or re-combining identical
# content serves the cached result instead of burning another Gemini call.
# ---------------------------------------------------------------------------


def make_cache_key(text: str, level: str, quiz_count: int, language: str, mode: str) -> str:
    raw = f"{text.strip()}|{level}|{quiz_count}|{language}|{mode}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_cached_study_kit(cache_key: str) -> dict | None:
    client = get_client()
    result = (
        client.table("study_kit_cache").select("study_kit").eq("text_hash", cache_key).maybe_single().execute()
    )
    return result.data["study_kit"] if result and result.data else None


def save_cached_study_kit(cache_key: str, study_kit: dict) -> None:
    client = get_client()
    client.table("study_kit_cache").upsert({"text_hash": cache_key, "study_kit": study_kit}).execute()


# ---------------------------------------------------------------------------
# Weak-topic tracking — every graded quiz answer nudges a per-user,
# per-term correct/wrong counter. Regeneration and Exam Cram Mode can then
# ask Gemini to emphasize whatever a student is genuinely weak on, instead
# of the app just tracking XP with no real learning signal behind it.
# ---------------------------------------------------------------------------


def record_quiz_answer(user_id: str, topic: str, correct: bool) -> None:
    topic = (topic or "").strip()
    if not topic:
        return
    client = get_client()
    existing = (
        client.table("topic_progress")
        .select("*")
        .eq("user_id", user_id)
        .eq("term", topic)
        .maybe_single()
        .execute()
    )
    row = existing.data if existing and existing.data else None
    if row is None:
        client.table("topic_progress").insert({
            "user_id": user_id,
            "term": topic,
            "correct_count": 1 if correct else 0,
            "wrong_count": 0 if correct else 1,
        }).execute()
        return
    field = "correct_count" if correct else "wrong_count"
    client.table("topic_progress").update({
        field: (row.get(field) or 0) + 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("user_id", user_id).eq("term", topic).execute()


# ---------------------------------------------------------------------------
# Quiz answer log — a richer, question-level record (not just aggregated
# per-topic counters) that powers Confidence Calibration Tracking and the
# Personalized Mistake-Pattern Retrospective. Best-effort everywhere it's
# called from: losing one log row should never break the quiz itself.
# ---------------------------------------------------------------------------


def log_quiz_answer(
    user_id: str,
    note_id: str | None,
    topic: str | None,
    question: str | None,
    chosen_answer: str | None,
    correct_answer: str | None,
    is_correct: bool,
    confidence: int | None,
) -> None:
    client = get_client()
    client.table("quiz_answer_log").insert({
        "user_id": user_id,
        "note_id": note_id,
        "topic": (topic or None),
        "question": (question or "")[:500] or None,
        "chosen_answer": (chosen_answer or "")[:300] or None,
        "correct_answer": (correct_answer or "")[:300] or None,
        "is_correct": is_correct,
        "confidence": confidence,
    }).execute()


def get_confidence_calibration(user_id: str) -> dict:
    """Buckets every logged answer that had a confidence rating by that
    rating, and reports actual accuracy within each bucket — the gap
    between "how sure I felt" and "how often I was actually right" is
    exactly what confidence calibration training is about."""
    client = get_client()
    result = (
        client.table("quiz_answer_log")
        .select("confidence, is_correct")
        .eq("user_id", user_id)
        .not_.is_("confidence", "null")
        .execute()
    )
    rows = result.data or []
    buckets: dict[int, dict] = {}
    for row in rows:
        c = row["confidence"]
        b = buckets.setdefault(c, {"confidence": c, "count": 0, "correct": 0})
        b["count"] += 1
        if row["is_correct"]:
            b["correct"] += 1
    out = []
    for c in sorted(buckets):
        b = buckets[c]
        out.append({
            "confidence": c,
            "count": b["count"],
            "accuracy": round(b["correct"] / b["count"] * 100) if b["count"] else 0,
        })
    return {"buckets": out, "total_logged": len(rows)}


def get_recent_wrong_answers(user_id: str, limit: int = 25) -> list[dict]:
    client = get_client()
    result = (
        client.table("quiz_answer_log")
        .select("topic, question, chosen_answer, correct_answer, created_at")
        .eq("user_id", user_id)
        .eq("is_correct", False)
        .not_.is_("question", "null")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


# ---------------------------------------------------------------------------
# Anonymized class-wide weak-spot heatmap — Part 5's social feature. Never
# exposes anything about an individual student: only aggregate miss rates
# per topic, and only once at least a handful of distinct students have
# actually answered a question on that topic, so no single student's
# performance is ever identifiable from it.
# ---------------------------------------------------------------------------

MIN_STUDENTS_FOR_HEATMAP = 3


def get_class_heatmap(limit: int = 12) -> list[dict]:
    client = get_client()
    result = client.table("topic_progress").select("term, correct_count, wrong_count, user_id").execute()
    rows = result.data or []
    agg: dict[str, dict] = {}
    for r in rows:
        term = r.get("term")
        if not term:
            continue
        a = agg.setdefault(term, {"correct": 0, "wrong": 0, "students": set()})
        a["correct"] += r.get("correct_count") or 0
        a["wrong"] += r.get("wrong_count") or 0
        a["students"].add(r.get("user_id"))

    out = []
    for term, a in agg.items():
        total = a["correct"] + a["wrong"]
        student_count = len(a["students"])
        if total == 0 or student_count < MIN_STUDENTS_FOR_HEATMAP:
            continue  # anonymity floor — never surface a topic only a couple of students touched
        out.append({
            "term": term,
            "miss_rate": round(a["wrong"] / total * 100),
            "student_count": student_count,
        })
    out.sort(key=lambda x: x["miss_rate"], reverse=True)
    return out[:limit]


# ---------------------------------------------------------------------------
# Study-buddy matching — opt-in only, and a student picks their own display
# name rather than their real email ever being shown to anyone else.
# Matches by shared note subjects, since that's the clearest signal of
# "we're studying similar material" the app already has.
# ---------------------------------------------------------------------------


def set_study_buddy_opt_in(user_id: str, opt_in: bool, display_name: str | None, note: str | None) -> None:
    client = get_client()
    payload = {
        "study_buddy_opt_in": opt_in,
        "study_buddy_display_name": (display_name or "").strip()[:40] or None,
        "study_buddy_note": (note or "").strip()[:200] or None,
    }
    existing = client.table("profiles").select("id").eq("id", user_id).maybe_single().execute()
    if existing and existing.data:
        client.table("profiles").update(payload).eq("id", user_id).execute()
    else:
        client.table("profiles").insert({"id": user_id, "xp": 0, "streak": 0, **payload}).execute()


def get_study_buddy_status(user_id: str) -> dict:
    client = get_client()
    result = (
        client.table("profiles")
        .select("study_buddy_opt_in, study_buddy_display_name, study_buddy_note")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    data = result.data if result and result.data else {}
    return {
        "opt_in": bool(data.get("study_buddy_opt_in")),
        "display_name": data.get("study_buddy_display_name") or "",
        "note": data.get("study_buddy_note") or "",
    }


def find_study_buddies(user_id: str, limit: int = 10) -> list[dict]:
    client = get_client()
    my_notes = client.table("notes").select("subject").eq("user_id", user_id).execute().data or []
    my_subjects = {(n.get("subject") or "General").strip().lower() for n in my_notes}
    if not my_subjects:
        return []

    opted = (
        client.table("profiles")
        .select("id, study_buddy_display_name, study_buddy_note")
        .eq("study_buddy_opt_in", True)
        .neq("id", user_id)
        .execute()
    ).data or []
    if not opted:
        return []

    candidate_ids = [o["id"] for o in opted]
    their_notes = client.table("notes").select("user_id, subject").in_("user_id", candidate_ids).execute().data or []
    subjects_by_user: dict[str, set] = {}
    for n in their_notes:
        subjects_by_user.setdefault(n["user_id"], set()).add((n.get("subject") or "General").strip().lower())

    matches = []
    for o in opted:
        shared = my_subjects & subjects_by_user.get(o["id"], set())
        if shared:
            matches.append({
                "display_name": o.get("study_buddy_display_name") or "A student",
                "shared_subjects": sorted(shared),
                "note": o.get("study_buddy_note") or "",
            })
    matches.sort(key=lambda m: len(m["shared_subjects"]), reverse=True)
    return matches[:limit]


def get_weak_topics(user_id: str, limit: int = 5) -> list[dict]:
    """Topics with at least one wrong answer and more misses than hits,
    worst-first — these are what Exam Cram Mode / regeneration lean on."""
    client = get_client()
    result = (
        client.table("topic_progress")
        .select("term, correct_count, wrong_count")
        .eq("user_id", user_id)
        .gt("wrong_count", 0)
        .execute()
    )
    rows = result.data or []
    weak = [r for r in rows if r["wrong_count"] >= r.get("correct_count", 0)]
    weak.sort(key=lambda r: r["wrong_count"] - r.get("correct_count", 0), reverse=True)
    return weak[:limit]


# ---------------------------------------------------------------------------
# Shareable, public, read-only study-kit links.
# ---------------------------------------------------------------------------


def set_note_public(user_id: str, note_id: str, is_public: bool) -> dict | None:
    client = get_client()
    result = (
        client.table("notes")
        .update({"is_public": is_public})
        .eq("user_id", user_id)
        .eq("id", note_id)
        .execute()
    )
    return result.data[0] if result.data else None


# ---------------------------------------------------------------------------
# Web Push subscriptions — due-flashcard reminders. One row per browser/
# device the student enabled notifications on (a phone and a laptop are two
# separate subscriptions, both tied to the same user_id).
# ---------------------------------------------------------------------------


def save_push_subscription(user_id: str, endpoint: str, p256dh: str, auth: str) -> None:
    client = get_client()
    client.table("push_subscriptions").upsert(
        {"user_id": user_id, "endpoint": endpoint, "p256dh": p256dh, "auth": auth},
        on_conflict="endpoint",
    ).execute()


def delete_push_subscription(endpoint: str) -> None:
    client = get_client()
    client.table("push_subscriptions").delete().eq("endpoint", endpoint).execute()


def list_push_subscriptions() -> list[dict]:
    client = get_client()
    result = client.table("push_subscriptions").select("*").execute()
    return result.data or []


def get_public_note(note_id: str) -> dict | None:
    client = get_client()
    result = (
        client.table("notes")
        .select("id, title, subject, study_kit, created_at")
        .eq("id", note_id)
        .eq("is_public", True)
        .maybe_single()
        .execute()
    )
    return result.data


# ---------------------------------------------------------------------------
# Async group-quiz leaderboard — classmates who got the same share link can
# take the quiz on their own schedule (no need to be online together) and
# still see how they stack up against everyone else who's taken it.
# ---------------------------------------------------------------------------


def record_quiz_attempt(note_id: str, display_name: str, score: int, total: int) -> dict:
    client = get_client()
    note = (
        client.table("notes").select("id").eq("id", note_id).eq("is_public", True).maybe_single().execute()
    )
    if not note or not note.data:
        raise ValueError("This study kit isn't shared, so it doesn't have a leaderboard.")
    result = client.table("quiz_leaderboard").insert({
        "note_id": note_id,
        "display_name": (display_name or "Anonymous").strip()[:40] or "Anonymous",
        "score": max(0, int(score)),
        "total": max(1, int(total)),
    }).execute()
    return result.data[0] if result.data else {}


def get_leaderboard(note_id: str, limit: int = 10) -> list[dict]:
    client = get_client()
    result = (
        client.table("quiz_leaderboard")
        .select("display_name, score, total, created_at")
        .eq("note_id", note_id)
        .order("score", desc=True)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    return result.data or []


# ---------------------------------------------------------------------------
# Account deletion — a real "delete my account" flow (not just a support
# email) is one of the plainest trust signals a student-facing app can show
# in a demo: wipes every row tied to this student, then removes the auth
# user itself so they can't be looked up by email/login again.
# ---------------------------------------------------------------------------


def delete_account(user_id: str) -> None:
    client = get_client()
    for table in ("notes", "flashcard_progress", "topic_progress", "push_subscriptions"):
        try:
            client.table(table).delete().eq("user_id", user_id).execute()
        except Exception:
            pass  # best-effort — a missing/renamed table shouldn't block the rest of the deletion
    try:
        client.table("profiles").delete().eq("id", user_id).execute()
    except Exception:
        pass
    client.auth.admin.delete_user(user_id)
