import { supabase } from "./supabaseClient";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Every request now carries the learner's real Supabase session token —
// the backend verifies it and derives who's asking from that, rather than
// trusting whatever user_id a request claims to be. userId params kept on
// these functions are harmless leftovers the backend ignores; nothing here
// relies on them for identity anymore.
async function authHeaders(extra = {}) {
  const headers = { ...extra };
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function handle(res) {
  if (!res.ok) {
    let detail = "Something went wrong.";
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function processNote({ userId, level, text, file, quizCount = 5, language = "English", mode = "full" }) {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("level", level);
  form.append("quiz_count", quizCount);
  form.append("language", language);
  form.append("mode", mode);
  if (file) form.append("file", file);
  else form.append("text", text);

  const res = await fetch(`${API_BASE}/api/notes/process`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
  return handle(res);
}

// Extraction only (OCR/PDF text) — no Gemini call, completely free. Lets the
// student review and fix bad OCR before spending a generation on it.
export async function extractText({ files }) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await fetch(`${API_BASE}/api/notes/extract`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
  return handle(res);
}

export async function regenerateNote({ noteId, userId, level, quizCount = 5, language = "English", useWeakTopics = false }) {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("level", level);
  form.append("quiz_count", quizCount);
  form.append("language", language);
  form.append("use_weak_topics", useWeakTopics);
  const res = await fetch(`${API_BASE}/api/notes/${noteId}/regenerate`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
  return handle(res);
}

export async function listNotes(userId) {
  const res = await fetch(`${API_BASE}/api/notes/list?user_id=${userId}`, {
    headers: await authHeaders(),
  });
  return handle(res);
}

export async function getNote(noteId, userId) {
  const res = await fetch(`${API_BASE}/api/notes/${noteId}?user_id=${userId}`, {
    headers: await authHeaders(),
  });
  return handle(res);
}

export async function shareNote(noteId, isPublic = true) {
  const res = await fetch(`${API_BASE}/api/notes/${noteId}/share`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ is_public: isPublic }),
  });
  return handle(res);
}

// No auth header — this is the whole point of a public shared link.
export async function getSharedNote(noteId) {
  const res = await fetch(`${API_BASE}/api/notes/public/${noteId}`);
  return handle(res);
}

export async function chatAboutNotes({ rawText, question, history }) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ raw_text: rawText, question, history }),
  });
  return handle(res);
}

export async function getProgress(userId) {
  const res = await fetch(`${API_BASE}/api/user/progress?user_id=${userId}`, {
    headers: await authHeaders(),
  });
  return handle(res);
}

export async function getWeakTopics(userId) {
  const res = await fetch(`${API_BASE}/api/user/weak-topics?user_id=${userId}`, {
    headers: await authHeaders(),
  });
  return handle(res);
}

export async function combineNotes({ userId, noteIds, level, quizCount = 5, language = "English" }) {
  const res = await fetch(`${API_BASE}/api/notes/combine`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ user_id: userId, note_ids: noteIds, level, quiz_count: quizCount, language }),
  });
  return handle(res);
}

export async function getDueCards(userId, noteId) {
  const params = new URLSearchParams({ user_id: userId });
  if (noteId) params.set("note_id", noteId);
  const res = await fetch(`${API_BASE}/api/review/due?${params.toString()}`, {
    headers: await authHeaders(),
  });
  return handle(res);
}

export async function gradeCard({ userId, noteId, cardIndex, quality }) {
  const res = await fetch(`${API_BASE}/api/review/grade`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      user_id: userId,
      note_id: noteId,
      card_index: cardIndex,
      quality,
    }),
  });
  return handle(res);
}

export async function recordQuizAnswer({ topic, correct }) {
  const res = await fetch(`${API_BASE}/api/review/quiz-answer`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ topic, correct }),
  });
  return handle(res);
}

export async function createStudyPlan({ goal, noteIds }) {
  const res = await fetch(`${API_BASE}/api/planner/plan`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ goal, note_ids: noteIds }),
  });
  return handle(res);
}

export async function resetDemoAccount(userId) {
  const res = await fetch(`${API_BASE}/api/demo/reset`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ user_id: userId }),
  });
  return handle(res);
}
