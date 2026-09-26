"""The Note-Organizer Agent — NoteBuddy's fourth genuinely agentic feature,
built the same way as the Study Planner, Study Coach, and Cross-Note Tutor:
Gemini gets tools and decides for itself what to call.

Given a pile of saved notes, a fixed pipeline would either check every
possible pair for contradictions (expensive, wasteful — O(n^2) Gemini
calls) or skip the check entirely. This agent instead looks at titles,
subjects, and short previews first, DECIDES which pairs actually look
related enough to be worth a full comparison, and only spends a real
Gemini call on those — the same judgment a student org­anizing their own
notes would use, not a brute-force sweep.
"""

import json
import re
import google.generativeai as genai
from app.config import GEMINI_API_KEY
from app.services import supabase_client
from app.services.gemini_service import detect_contradictions, AIGenerationError

genai.configure(api_key=GEMINI_API_KEY)

ORGANIZER_MODEL = "gemini-3.5-flash-lite"


class OrganizerError(Exception):
    """Raised when the organizer agent fails or returns something unusable."""


def _extract_json(raw: str) -> dict:
    cleaned = re.sub(r"^```(json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def run_note_organizer_agent(user_id: str, limit: int = 20) -> dict:
    def list_my_notes() -> dict:
        """Returns the id, title, current subject tag, and a short content preview of every note this student has saved."""
        try:
            notes = supabase_client.get_all_notes_with_text(user_id, limit=limit)
        except RuntimeError:
            notes = []
        return {"notes": [
            {"id": n["id"], "title": n["title"], "current_subject": n.get("subject") or "General", "preview": (n.get("raw_text") or "")[:300]}
            for n in notes
        ]}

    def compare_two_notes(note_id_a: str, note_id_b: str) -> dict:
        """Does a FULL comparison of two specific notes (by the ids from list_my_notes) for contradictions between them or a term one relies on that neither explains. This is an expensive check — only call it for pairs that already look related from their title/subject/preview, never for every possible pair."""
        try:
            notes = supabase_client.get_notes_by_ids(user_id, [note_id_a, note_id_b])
        except RuntimeError:
            notes = []
        if len(notes) < 2:
            return {"contradictions": [], "gaps": [], "summary": "Couldn't load both notes."}
        try:
            return detect_contradictions(notes)
        except AIGenerationError:
            return {"contradictions": [], "gaps": [], "summary": "Comparison failed."}

    model = genai.GenerativeModel(ORGANIZER_MODEL, tools=[list_my_notes, compare_two_notes])

    prompt = """You are NoteBuddy's Note-Organizer Agent — you help a student keep their saved notes tidy and consistent.

Start by calling list_my_notes to see what this student has saved. Then, using your own judgment from the titles/subjects/previews:
1. Decide which pairs of notes (if any) look closely related enough — same real-world topic, similar title, overlapping preview content — to be worth a full check with compare_two_notes. Call it only on those specific pairs, never on every possible combination (with more than a few notes, that would be wasteful and slow).
2. Judge whether any note's current subject tag looks wrong, too vague ("General" when the content is clearly about something specific), or inconsistent with a very similar note's tag.
3. Notice any notes that look like near-duplicates or natural candidates to combine into one study kit (very similar titles/topics).

Once you've gathered what you need, respond with ONLY a JSON object (no markdown fences, no commentary) in exactly this shape:
{
  "suggested_subjects": [
    {"note_id": "...", "note_title": "...", "current_subject": "...", "suggested_subject": "...", "why": "one short sentence"}
  ],
  "suggested_combines": [
    {"note_ids": ["...", "..."], "note_titles": ["...", "..."], "why": "one short sentence"}
  ],
  "contradictions": [
    {"note_titles": ["...", "..."], "issue": "one short sentence, from a compare_two_notes result"}
  ],
  "summary": "1-2 sentences overall — if everything already looks tidy and consistent, say so honestly rather than manufacturing issues"
}

Rules:
- If the student has fewer than 2 notes, or everything already looks consistent, return empty arrays — don't invent problems to fill the shape.
- Every suggestion must be traceable to something list_my_notes or compare_two_notes actually returned.
- suggested_subject should be a short, specific tag (e.g. "Cell Biology", not just restating the title).
"""

    last_err: Exception | None = None
    for attempt in range(2):
        try:
            chat = model.start_chat(enable_automatic_function_calling=True)
            response = chat.send_message(prompt)
            data = _extract_json(response.text)
            if not isinstance(data, dict) or "summary" not in data:
                raise ValueError("Organizer response was missing expected fields.")
            for key in ("suggested_subjects", "suggested_combines", "contradictions"):
                data.setdefault(key, [])
            return data
        except (json.JSONDecodeError, ValueError) as e:
            last_err = e
        except Exception as e:
            last_err = e
    raise OrganizerError(f"Note organizer failed: {last_err}")
