"""All generative-AI calls live here, using Google Gemini's free-tier model.
Every function returns structured JSON that the frontend renders directly —
the model does the actual thinking (summarizing, writing questions, judging
difficulty), nothing here is a canned template.
"""

import json
import os
import re
import tempfile
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)

MODEL_NAME = "gemini-3.5-flash-lite"


def _model():
    return genai.GenerativeModel(MODEL_NAME)


def _extract_json(raw: str):
    """Gemini sometimes wraps JSON in ```json fences — strip those before parsing."""
    cleaned = re.sub(r"^```(json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    return json.loads(cleaned)


LEVEL_INSTRUCTIONS = {
    "kid": "Explain it like you're talking to a curious 10-year-old: short sentences, everyday words, fun comparisons. Avoid jargon entirely.",
    "beginner": "Explain it simply, as if to someone brand new to the subject. Define any technical term the first time you use it.",
    "student": "Explain it at a standard high-school/early-college level. You can use normal academic vocabulary.",
}


def generate_study_kit(text: str, level: str = "beginner") -> dict:
    """One call that produces the full study kit: summary, key terms,
    flashcards, and a quiz — all tailored to the requested reading level."""
    level_instruction = LEVEL_INSTRUCTIONS.get(level, LEVEL_INSTRUCTIONS["beginner"])

    prompt = f"""You are NoteBuddy, an AI study assistant that helps students (including young or beginner learners) understand their study material.

{level_instruction}

Given the study material below, produce a JSON object with EXACTLY this shape and nothing else (no markdown fences, no commentary):

{{
  "title": "a short descriptive title for this material",
  "subject": "a short 1-3 word subject category, e.g. Biology, World History, Computer Science, Chemistry",
  "summary": "a clear summary in 4-6 sentences",
  "key_terms": [
    {{"term": "...", "definition": "..."}}
  ],
  "flashcards": [
    {{"front": "a question or term", "back": "the answer or explanation"}}
  ],
  "quiz": [
    {{
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "why this is correct, one sentence"
    }}
  ],
  "mind_map": {{
    "root": "the central topic, 2-4 words",
    "branches": [
      {{"label": "a major subtopic, 1-4 words", "children": ["a related idea, 1-5 words", "another related idea"]}}
    ]
  }}
}}

Rules:
- key_terms: 4-8 items, most important terms only.
- flashcards: 6-10 items, good for active recall.
- quiz: 5 multiple-choice questions, exactly 4 options each, mix of difficulty.
- mind_map: 3-6 branches, each with 2-4 short children. Keep every label short enough to fit in a small box (a few words max).
- Keep everything grounded in the material below. Do not invent facts not implied by it.

STUDY MATERIAL:
\"\"\"
{text[:12000]}
\"\"\"
"""
    response = _model().generate_content(prompt)
    return _extract_json(response.text)


def chat_about_notes(text: str, question: str, history: list[dict]) -> str:
    """Lets the learner ask a follow-up question about their own material."""
    history_text = ""
    for turn in history[-6:]:
        role = "Student" if turn.get("role") == "user" else "NoteBuddy"
        history_text += f"{role}: {turn.get('content', '')}\n"

    prompt = f"""You are NoteBuddy, a friendly AI tutor. Answer the student's question using ONLY the study material below as context. Keep answers short, clear, and encouraging. If the question can't be answered from the material, say so honestly and give your best general explanation instead.

STUDY MATERIAL:
\"\"\"
{text[:8000]}
\"\"\"

CONVERSATION SO FAR:
{history_text}

Student's new question: {question}

Reply as NoteBuddy:"""
    response = _model().generate_content(prompt)
    return response.text.strip()


def regenerate_at_level(text: str, level: str) -> dict:
    """Used when the learner drags the difficulty slider after the fact."""
    return generate_study_kit(text, level)


def transcribe_audio(file_bytes: bytes, filename: str) -> str:
    """Turns an uploaded (or recorded) audio clip — a lecture, a voice memo of
    notes, etc. — into a plain-text transcript, using Gemini's native audio
    understanding. The result is then fed through the same generate_study_kit
    pipeline as pasted text, a PDF, or a photo."""
    suffix = os.path.splitext(filename)[1] or ".webm"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        uploaded = genai.upload_file(tmp_path)
        prompt = (
            "Transcribe this audio recording into clean, plain text. If it's a "
            "lecture, voice memo, or spoken study notes, just give the accurate "
            "transcript — fix obvious stutters/filler words, but don't summarize "
            "or add commentary of your own."
        )
        response = _model().generate_content([uploaded, prompt])
        return response.text.strip()
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
