# NoteBuddy

**AI study companion that turns any notes into a full study kit — and includes four genuinely agentic AI features that reason over your real study data, not just prompts.**

[![Live App](https://img.shields.io/badge/app-note--buddy--wheat.vercel.app-7c5cff)](https://note-buddy-wheat.vercel.app)
[![API](https://img.shields.io/badge/api-render-46a3ff)](https://notebuddy-backend-92m7.onrender.com/docs)
[![Backend](https://img.shields.io/badge/backend-FastAPI-009688)](https://fastapi.tiangolo.com/)
[![Frontend](https://img.shields.io/badge/frontend-React%2019-61dafb)](https://react.dev/)
[![AI](https://img.shields.io/badge/AI-Gemini-8e44ad)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#license)

**Live app:** https://note-buddy-wheat.vercel.app
**Live API docs:** https://notebuddy-backend-92m7.onrender.com/docs

> Render's free tier sleeps after inactivity — the first request can take 30–60s to wake up.

---

## Table of Contents

- [What is NoteBuddy](#what-is-notebuddy)
- [Agentic AI](#agentic-ai)
- [Full Feature List](#full-feature-list)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Security & Privacy](#security--privacy)
- [License](#license)

---

## What is NoteBuddy

NoteBuddy takes any input a student already has — pasted text, a PDF, a photo of handwritten notes, a recorded lecture, or even a YouTube link — and turns it into a complete, personalized study kit: a plain-language summary, key terms, flashcards, quizzes, a mock exam, a visual knowledge graph, and a chat you can ask follow-up questions to.

It's built around one idea: **studying should adapt to the student, not the other way around.** Everything is explainable at three levels (kid / beginner / student), tracked with spaced repetition so nothing gets forgotten, and — increasingly — handled by AI agents that look at what you're actually struggling with before deciding what to recommend.

---

## Agentic AI

Most "AI features" in this app — and in most AI apps — are a single prompt in, a single JSON response out. NoteBuddy has four features that are different in kind: each one hands Gemini a set of **tools** (real backend functions that query this student's actual data) and lets the model decide for itself which tools to call, in what order, and when it has enough information to answer. This is done via `google-generativeai`'s native function calling (`model.start_chat(enable_automatic_function_calling=True)`), not a hand-rolled if/else pipeline.

| Agent | What it decides for itself | Tools it can call |
|---|---|---|
| **Adaptive Study Planner** | Which of the student's weak topics, due flashcards, and notes actually matter for the stated goal, before building a schedule | `get_due_flashcards`, `get_weak_topics`, `get_note_summaries` |
| **Study Coach** | Whether the student is overconfident, behind on review, or genuinely fine — and what to recommend as a result | `get_weak_topics`, `get_due_flashcards_count`, `get_note_summaries`, `get_confidence_calibration`, `get_recent_mistakes` |
| **Cross-Note Tutor** | Whether a chat question can be answered from the currently open note, or needs a semantic search across every note the student has ever saved | `search_my_other_notes`, `get_my_weak_topics` |
| **Note Organizer** | Which *pairs* of notes are related enough to be worth a full comparison — never a brute-force O(n²) sweep — before flagging contradictions, tag fixes, or merge candidates | `list_my_notes`, `compare_two_notes` |

Each agent is implemented as its own service module under `backend/app/services/` (`planner_service.py`, `coach_service.py`, `tutor_service.py`, `organizer_service.py`), and every tool is a closure bound to the authenticated student's `user_id` — so the model can never see or query another student's data, by construction, not just by prompt instruction.

Every other AI feature in the app (study-kit generation, chat, grading, contradiction detection, exam generation, etc.) uses a conventional single-shot prompt → structured JSON pattern, and is documented as such below for contrast.

---

## Full Feature List

### Capture & understand
- Paste text, upload a PDF, or upload/snap a photo of handwritten notes (OCR via Tesseract + OpenCV preprocessing)
- Upload or record audio and get it transcribed (Gemini audio transcription)
- Import a YouTube video by link and pull its transcript straight in
- Explain-at-your-level slider (kid / beginner / student) plus an on-demand "explain differently" rewrite
- Multi-language support for summaries, quizzes, and chat

### Study kit generation
- Plain-language summary, key terms, flashcards, and quizzes generated per note
- Combine multiple notes into one merged study kit ahead of a multi-lecture exam
- **Exam Twin** — a full timed mock exam generated from a note, auto-graded on submission
- **Visual Knowledge Graph** — an interactive, force-directed graph of how a note's concepts connect
- **Syllabus Coverage Gap Tracker** — paste a syllabus and see what your notes do and don't cover
- **Cross-Note Contradiction & Gap Detector** — checks combined notes for conflicting claims or unexplained gaps

### Practice that adapts
- Spaced-repetition flashcard review (SM-2 algorithm)
- Short-answer practice mode, graded by AI
- **Teach-Back (Feynman) Mode** — explain a concept back in your own words and get graded on understanding
- **Confidence Calibration Tracking** — quizzes ask "how sure are you?" and the dashboard shows where overconfidence is hiding
- **Mistake-Pattern Retrospective** — AI looks across your quiz history for a recurring pattern, not just a list of wrong answers

### Chat & voice
- Ask follow-up questions about any note, by text or voice
- Semantic search across every note you've ever saved (pgvector embeddings)
- Voice-first, hands-free review mode — listens for spoken grades ("easy" / "good" / "hard" / "again")
- Read-aloud and full study-podcast mode (summary → key terms → flashcards)

### Staying consistent
- XP, streaks, and badges
- Built-in Pomodoro focus timer
- PDF export and public shareable links for any study kit
- Onboarding spotlight tour, personalized to how the student says they study

### Social & collaborative
- Public gallery of shared study kits
- Async group-quiz leaderboard on shared notes
- Opt-in, privacy-first study-buddy matching (student-chosen display name, never a real email)
- Anonymized class-wide weak-spot heatmap (a topic only ever appears once 3+ distinct students have contributed to it)

### Offline & installable
- Installable as a PWA with offline caching
- **On-device AI fallback** — a small quantized model (`Qwen2.5-0.5B-Instruct`) runs fully client-side via WebGPU (`@mlc-ai/web-llm`) so chat and "explain differently" keep working with no connection

### Trust & privacy
- Plain-language Privacy page
- One-click account deletion that wipes every table and the auth record
- In-app "What's New" changelog
- Accessibility: adjustable text size, dark/light theme

---

## Tech Stack

| Layer | Choice |
|---|---|
| AI | Google Gemini (`gemini-3.5-flash-lite`) — study kits, chat, grading, agentic tool-calling, audio transcription |
| Backend | Python 3.11, FastAPI, slowapi (rate limiting), Sentry (error tracking) |
| Database & Auth | Supabase (Postgres, Row-Level Security, Auth incl. Google OAuth, `pgvector` for semantic search) |
| Frontend | React 19, Vite, Tailwind CSS, Framer Motion, React Router |
| Offline AI | `@mlc-ai/web-llm` (WebGPU, in-browser inference) |
| PWA | `vite-plugin-pwa` (`injectManifest` strategy) |
| Hosting | Vercel (frontend) + Render (backend), both on free tiers |

---

## Architecture

```
┌─────────────┐      HTTPS       ┌──────────────┐      ┌──────────────┐
│   React SPA │ ───────────────▶ │   FastAPI    │ ───▶ │  Gemini API  │
│  (Vercel)   │ ◀─────────────── │  (Render)    │ ◀─── │  (agentic +  │
└─────────────┘                  └──────┬───────┘      │  one-shot)   │
      │                                  │              └──────────────┘
      │ direct (auth, some reads)        │
      ▼                                  ▼
┌─────────────────────────────────────────────┐
│                   Supabase                    │
│   Postgres · Auth · pgvector · RLS policies   │
└─────────────────────────────────────────────┘
```

- The frontend talks to Supabase directly for auth and a few simple reads, and to the FastAPI backend for everything that needs Gemini, server-side validation, or the service-role key.
- Every write path that touches another user's data (leaderboards, shared notes, class heatmap) is scoped and, where relevant, floored on a minimum contributor count to preserve anonymity.
- Agentic endpoints (`/api/planner`, `/api/coach`, `/api/chat`, `/api/organizer`) hand Gemini a closure-bound tool set per request rather than a shared global one, so tool access is always scoped to the authenticated caller.

---

## Project Structure

```
Notebuddy/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI app, CORS, router registration
│   │   ├── config.py                  # env var loading
│   │   ├── auth.py                    # Supabase JWT verification
│   │   ├── rate_limit.py              # slowapi config
│   │   ├── routers/
│   │   │   ├── notes.py               # upload, study kit, exam twin, syllabus gaps, contradictions
│   │   │   ├── chat.py                # chat — tries the Cross-Note Tutor agent, falls back to one-shot
│   │   │   ├── planner.py             # Adaptive Study Planner (agentic)
│   │   │   ├── coach.py               # Study Coach (agentic)
│   │   │   ├── organizer.py           # Note Organizer (agentic)
│   │   │   ├── review.py              # spaced repetition, confidence calibration
│   │   │   ├── practice.py            # teach-back, mistake patterns, explain-differently
│   │   │   ├── user.py                # account, study-buddy, class heatmap
│   │   │   ├── push.py                # web push notifications
│   │   │   └── demo.py                # demo-account reset
│   │   └── services/
│   │       ├── gemini_service.py      # one-shot prompt→JSON AI calls (study kits, grading, exams, ...)
│   │       ├── planner_service.py     # agentic — Adaptive Study Planner
│   │       ├── coach_service.py       # agentic — Study Coach
│   │       ├── tutor_service.py       # agentic — Cross-Note Tutor
│   │       ├── organizer_service.py   # agentic — Note Organizer
│   │       ├── embeddings_service.py  # pgvector semantic search
│   │       ├── extraction.py          # PDF/OCR text extraction
│   │       ├── youtube_service.py     # transcript import
│   │       └── supabase_client.py     # all DB access
│   ├── requirements.txt
│   ├── .env.example
│   └── supabase_schema.sql
└── frontend/
    ├── src/
    │   ├── pages/          # Landing, Login, Signup, Upload, Results, Dashboard, Review, Combine, Planner, Gallery, Privacy
    │   ├── components/     # FlashcardDeck, Quiz, ChatPanel, StudyCoach, NoteOrganizer, KnowledgeGraph, ExamTwin, ...
    │   ├── context/        # AuthContext, TourContext
    │   └── lib/            # api.js, supabaseClient.js, offlineAI.js, changelog.js
    └── .env.example
```

---

## Getting Started

### Prerequisites

- **Node.js** v18+
- **Python** 3.11 (newer versions can fail to build some backend dependencies)
- A free **Gemini API key** — https://aistudio.google.com/app/apikey
- A free **Supabase project** — https://supabase.com

### 1. Set up Supabase

1. Create a new project at supabase.com.
2. Go to **Project Settings → API** and copy the **Project URL**, **anon public key**, and **service_role key**.
3. Go to **SQL Editor → New query**, paste the contents of `backend/supabase_schema.sql`, and run it. This creates every table the app needs (notes, profiles, flashcard progress, quiz logs, leaderboards, note embeddings, etc.).
4. If you're rebuilding an existing project incrementally, check the delivered SQL migrations for each feature batch instead.

### 2. Backend

```bash
cd backend
python -m venv venv

# macOS / Linux
source venv/bin/activate
# Windows (PowerShell)
venv\Scripts\Activate.ps1

pip install -r requirements.txt
cp .env.example .env
# now paste your GEMINI_API_KEY, SUPABASE_URL, and SUPABASE_SERVICE_KEY into backend/.env

uvicorn app.main:app --reload --port 8000
```

Visit http://localhost:8000/docs to confirm it's running.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# paste your Supabase URL + anon key into frontend/.env; leave VITE_API_BASE_URL as http://localhost:8000

npm run dev
```

Open the printed URL (usually http://localhost:5173), sign up, and you're in.

### 4. Demo account (optional, for judges/testers)

Create an account with email `demo@notebuddy.app` / password `Demo1234!` once. From then on, the "Try the demo account" button on the login page resets that account's data on every login, so it's always a clean first-time demo.

### 5. Google Sign-In (optional)

See the [full walkthrough](#google-sign-in-setup) below — it needs a Google Cloud OAuth client wired into Supabase Auth.

---

## Environment Variables

**`backend/.env`**

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase **service_role** key (server-side only — never expose this) |
| `FRONTEND_ORIGIN` | Your deployed frontend URL, for CORS |

**`frontend/.env`**

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase **anon public** key |
| `VITE_API_BASE_URL` | Your backend URL (`http://localhost:8000` locally) |

---

## Deployment

### Backend → Render

1. New **Web Service**, root directory `backend`.
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Environment: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `FRONTEND_ORIGIN`, `PYTHON_VERSION=3.11.9`

### Frontend → Vercel

1. New project, root directory `frontend`.
2. Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (your Render URL).
3. Deploy, then update the backend's `FRONTEND_ORIGIN` to match.

### Google Sign-In Setup

1. **Google Cloud Console** → new project → **APIs & Services → OAuth consent screen** (External) → fill in app name + email.
2. **Google Auth Platform → Branding** → set an application home page + privacy policy URL.
3. **Google Auth Platform → Clients → Create OAuth client** (Web application):
   - Authorized JavaScript origins: `http://localhost:5173` and your live frontend URL
   - Authorized redirect URI: `https://YOUR-SUPABASE-PROJECT.supabase.co/auth/v1/callback`
4. **Supabase → Authentication → Providers → Google** → paste the Client ID + Secret.
5. **Supabase → Authentication → URL Configuration** → set Site URL and add your live URL under Redirect URLs.

---

## Security & Privacy

- All service-role/secret keys live only in backend environment variables, never in the frontend bundle.
- Every agentic tool function is a closure bound to the authenticated caller's `user_id` — the model has no path to another student's data.
- Aggregate/social features (class heatmap) enforce a minimum-contributor floor before surfacing anything, so no individual is ever identifiable.
- Study-buddy matching uses a student-chosen display name; a real email is never shown to another student.
- Account deletion is a real, one-click, irreversible wipe across every table plus the Supabase Auth record.
- See the in-app [Privacy page](https://note-buddy-wheat.vercel.app/privacy) for the plain-language version of all of this.

---

## License

MIT — see [LICENSE](LICENSE) if included, or treat this as free to use and adapt for educational purposes.

---

<p align="center">Built by <a href="https://github.com/siddhanthaditiyaa-beep">Siddhanthaditiyaa</a> for a college AI competition.</p>
