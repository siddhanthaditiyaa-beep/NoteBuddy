"""The Adaptive Study Planner — NoteBuddy's one genuinely agentic feature.

Unlike the rest of the app (one prompt in, one JSON blob out), this hands
Gemini a small set of tools and lets IT decide which ones to call and in
what order to build a day-by-day study plan: it can check what flashcards
are due, what topics this student is weak on, and what notes they have,
then reason over all of that together rather than following a fixed
template. Same Gemini free tier already used everywhere else in the app —
just a different prompt shape (function calling instead of one-shot JSON).
"""

import json
import re
import google.generativeai as genai
from app.config import GEMINI_API_KEY
from app.services import supabase_client

genai.configure(api_key=GEMINI_API_KEY)

PLANNER_MODEL = "gemini-3.5-flash-lite"


class PlannerError(Exception):
    """Raised when the planning agent fails or returns something unusable."""


def _extract_json(raw: str) -> dict:
    cleaned = re.sub(r"^```(json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def generate_study_plan(user_id: str, goal: str, note_ids: list[str] | None = None) -> dict:
    """Builds a day-by-day study plan for the given goal (e.g. "exam in 5
    days, covering biology and history"). The three tools below are plain
    Python closures bound to THIS user_id — Gemini can choose to call them,
    but it can never ask for or receive another student's data, because the
    scoping happens here, not inside the model's reasoning."""

    def get_due_flashcards() -> dict:
        """Returns how many flashcards are currently due for spaced-repetition review across this student's saved notes."""
        try:
            cards = supabase_client.get_due_flashcards(user_id)
        except RuntimeError:
            cards = []
        return {"due_count": len(cards)}

    def get_weak_topics() -> dict:
        """Returns topics this student has historically answered wrong more often than right in past quizzes, worst first."""
        try:
            topics = supabase_client.get_weak_topics(user_id, limit=8)
        except RuntimeError:
            topics = []
        return {"weak_topics": [t["term"] for t in topics]}

    def get_note_summaries() -> dict:
        """Returns the title and subject of each of this student's saved notes, so the plan can reference specific notes by name."""
        try:
            notes = supabase_client.list_notes(user_id)
        except RuntimeError:
            notes = []
        if note_ids:
            notes = [n for n in notes if n.get("id") in note_ids]
        return {"notes": [{"title": n["title"], "subject": n.get("subject", "General")} for n in notes[:20]]}

    model = genai.GenerativeModel(
        PLANNER_MODEL,
        tools=[get_due_flashcards, get_weak_topics, get_note_summaries],
    )

    prompt = f"""You are NoteBuddy's study planning agent. A student has told you their goal:

"{goal}"

Use the tools available to you to find out what's actually due for review, what topics this student is weak on, and what notes they have — then build a realistic day-by-day study plan. Prioritize weak topics and due flashcard reviews over spreading time evenly across everything.

STAY ON-SUBJECT — this is important:
- get_weak_topics returns this student's weak topics across EVERY subject they've ever studied, not just the one in this goal. get_note_summaries tells you each saved note's subject.
- If the goal names a specific subject or exam (e.g. "History", "exam about the French Revolution"), the plan must cover ONLY that subject. Before including a weak topic, check whether it plausibly belongs to that subject (cross-reference it against the subjects/titles from get_note_summaries) — if it clearly belongs to a different, unrelated subject (e.g. a Biology term like "Photosynthesis" showing up in a History plan), leave it out entirely, even though the tool returned it.
- Only fall back to mixing subjects together if the goal itself is broad/general (e.g. "catch up on everything", "prep for finals week" with no single subject named).
- Every task you write must be something the student would recognize as relevant to what they told you their goal was — don't pad days with unrelated material just because it happened to come back from a tool call.

Once you've gathered what you need, respond with ONLY a JSON object (no markdown fences, no commentary) in exactly this shape:
{{
  "days": [
    {{"day_label": "Day 1", "focus": "short focus for the day, a few words", "tasks": ["specific task 1", "specific task 2"]}}
  ],
  "reasoning": "one short sentence on why you prioritized things this way"
}}

Rules:
- Base the number of days on what the goal implies (e.g. "exam in 5 days" -> 5 days; no timeframe given -> default to 3 days).
- 2-5 concrete tasks per day. Reference specific note titles or weak topics when you have them, but only ones on-subject per the rule above.
- Most days should end with a short review task (due flashcards or a quick self-quiz), not just new material.
- Keep it realistic for a student — don't overload any single day.
"""

    last_err: Exception | None = None
    for attempt in range(2):
        try:
            chat = model.start_chat(enable_automatic_function_calling=True)
            response = chat.send_message(prompt)
            data = _extract_json(response.text)
            if not isinstance(data, dict) or "days" not in data:
                raise ValueError("Planner response was missing the expected 'days' field.")
            return data
        except (json.JSONDecodeError, ValueError) as e:
            last_err = e
        except Exception as e:
            last_err = e
    raise PlannerError(f"Study plan generation failed: {last_err}")
