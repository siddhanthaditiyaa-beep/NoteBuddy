"""The Study Coach Agent — NoteBuddy's second genuinely agentic feature,
built the same way as the Adaptive Study Planner (planner_service.py):
Gemini is handed a small set of read-only tools and DECIDES for itself
which ones to call and in what order, rather than following a fixed
pipeline. Where the Planner turns a goal into a day-by-day schedule, the
Coach diagnoses the student's CURRENT state across everything NoteBuddy
already tracks — weak topics, due reviews, confidence calibration, recent
mistakes — and prescribes specific next actions with its reasoning shown,
like a tutor who actually looked at your gradebook before talking to you.
"""

import json
import re
import google.generativeai as genai
from app.config import GEMINI_API_KEY
from app.services import supabase_client

genai.configure(api_key=GEMINI_API_KEY)

COACH_MODEL = "gemini-3.5-flash-lite"


class CoachError(Exception):
    """Raised when the coaching agent fails or returns something unusable."""


def _extract_json(raw: str) -> dict:
    cleaned = re.sub(r"^```(json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def get_study_coach_advice(user_id: str, goal: str = "") -> dict:
    """Runs the Coach agent for this student. `goal` is optional free text
    ("I have a Chemistry exam Friday", "just tell me what to focus on") —
    when empty, the agent is simply asked to figure out what matters most
    right now from the data alone.

    Every tool below is a plain Python closure scoped to THIS user_id, so
    Gemini can choose to call any of them but can never see another
    student's data — the scoping happens here, not inside the model's
    reasoning, exactly like the Planner."""

    def get_weak_topics() -> dict:
        """Returns topics this student has historically answered wrong more often than right in past quizzes, worst first."""
        try:
            topics = supabase_client.get_weak_topics(user_id, limit=8)
        except RuntimeError:
            topics = []
        return {"weak_topics": [{"term": t["term"], "wrong": t["wrong_count"], "correct": t.get("correct_count", 0)} for t in topics]}

    def get_due_flashcards_count() -> dict:
        """Returns how many flashcards are currently due for spaced-repetition review across this student's saved notes."""
        try:
            cards = supabase_client.get_due_flashcards(user_id)
        except RuntimeError:
            cards = []
        return {"due_count": len(cards)}

    def get_note_summaries() -> dict:
        """Returns the title and subject of each of this student's saved notes, so advice can reference specific notes by name."""
        try:
            notes = supabase_client.list_notes(user_id)
        except RuntimeError:
            notes = []
        return {"notes": [{"title": n["title"], "subject": n.get("subject", "General")} for n in notes[:20]]}

    def get_confidence_calibration() -> dict:
        """Returns how accurate this student's quiz answers were, bucketed by how confident they said they felt beforehand (1=not sure, 2=somewhat sure, 3=very sure). A low accuracy % at confidence 3 means the student is OVERCONFIDENT — answering fast without actually checking."""
        try:
            data = supabase_client.get_confidence_calibration(user_id)
        except RuntimeError:
            data = {"buckets": [], "total_logged": 0}
        return data

    def get_recent_mistakes() -> dict:
        """Returns this student's most recent wrong quiz answers (question, topic, what they chose vs. the correct answer) — use this to spot a PATTERN in mistakes, not just which topics are weak."""
        try:
            wrong = supabase_client.get_recent_wrong_answers(user_id, limit=15)
        except RuntimeError:
            wrong = []
        return {"recent_mistakes": [
            {"topic": w.get("topic"), "question": w.get("question")} for w in wrong if w.get("question")
        ]}

    model = genai.GenerativeModel(
        COACH_MODEL,
        tools=[get_weak_topics, get_due_flashcards_count, get_note_summaries, get_confidence_calibration, get_recent_mistakes],
    )

    goal_line = f'The student told you: "{goal.strip()}"' if goal and goal.strip() else "The student didn't give you a specific goal — figure out what matters most from the data alone."

    prompt = f"""You are NoteBuddy's Study Coach — an AI agent that actually looks at a student's real study data before giving advice, instead of generic tips.

{goal_line}

Use the tools available to you to find out: what topics they're weak on, how many flashcards are due, what notes they have, how well-calibrated their confidence is (are they overconfident?), and what their recent mistakes actually look like. You don't need to call every tool if some clearly aren't relevant, but a genuinely useful diagnosis usually needs more than one.

Once you've gathered what you need, respond with ONLY a JSON object (no markdown fences, no commentary) in exactly this shape:
{{
  "diagnosis": "2-3 sentences, like a coach talking directly to the student, summarizing their actual current state based on the real data you pulled — be specific (name topics, numbers), not generic",
  "actions": [
    {{
      "action": "a specific, concrete next step, e.g. 'Review your Photosynthesis flashcards' or 'Take a Chemistry mock exam under timed conditions'",
      "why": "one sentence grounded in the actual data — which tool result led you here",
      "feature": "which NoteBuddy feature this points to — one of: review, exam_twin, teach_back, practice, syllabus_gap, planner, upload"
    }}
  ],
  "encouragement": "one short, genuine, non-generic sentence to end on"
}}

Rules:
- 2-4 actions, ordered most-important first.
- Every action must be traceable to something a tool actually returned — never invent a weak topic or number that didn't come back from a tool call.
- If the data shows the student is actually in good shape (little due, no major weak spots), say so honestly instead of manufacturing urgency.
"""

    last_err: Exception | None = None
    for attempt in range(2):
        try:
            chat = model.start_chat(enable_automatic_function_calling=True)
            response = chat.send_message(prompt)
            data = _extract_json(response.text)
            if not isinstance(data, dict) or "diagnosis" not in data or "actions" not in data:
                raise ValueError("Coach response was missing expected fields.")
            return data
        except (json.JSONDecodeError, ValueError) as e:
            last_err = e
        except Exception as e:
            last_err = e
    raise CoachError(f"Study coach failed: {last_err}")
