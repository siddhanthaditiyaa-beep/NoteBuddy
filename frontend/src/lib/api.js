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

export async function processNote({ userId, level, text, file, quizCount = 5, language = "English", mode = "full", board }) {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("level", level);
  form.append("quiz_count", quizCount);
  form.append("language", language);
  form.append("mode", mode);
  if (board) form.append("board", board);
  if (file) form.append("file", file);
  else form.append("text", text);

  const res = await fetch(`${API_BASE}/api/notes/process`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
  return handle(res);
}

// Same job as processNote, but consumes the backend's Server-Sent Events
// stream so the caller gets real staged progress (extracting -> generating
// -> saving -> done) via onStage, instead of one opaque request that could
// be sitting anywhere in a 10-30s window. Plain fetch + a manual reader
// rather than EventSource, because EventSource can't send our auth header
// or a multipart body.
export async function processNoteStream({
  userId, level, text, file, quizCount = 5, language = "English", mode = "full", board, onStage,
}) {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("level", level);
  form.append("quiz_count", quizCount);
  form.append("language", language);
  form.append("mode", mode);
  if (board) form.append("board", board);
  if (file) form.append("file", file);
  else form.append("text", text);

  const res = await fetch(`${API_BASE}/api/notes/process-stream`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });

  if (!res.ok || !res.body) {
    return handle(res); // surfaces the normal JSON error body
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? ""; // last element may be an incomplete event — keep it for next read

    for (const raw of events) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      let payload;
      try {
        payload = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (payload.stage === "error") throw new Error(payload.message || "Something went wrong.");
      if (payload.stage === "done") return payload.data;
      onStage?.(payload.stage);
    }
  }
  throw new Error("Connection closed before NoteBuddy finished — please try again.");
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

// Free — no Gemini call. Pulls a YouTube lecture's existing captions so the
// student can review/edit them like any pasted note before generating.
export async function getYoutubeTranscript(url) {
  const res = await fetch(`${API_BASE}/api/notes/youtube-transcript`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ url }),
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

// Public, indexable gallery of every study kit its owner chose to share —
// no auth required, powers organic search traffic (Part 4: "Biology
// Chapter 5 flashcards" landing a stranger on NoteBuddy instead of Quizlet).
export async function getPublicGallery(subject) {
  const params = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  const res = await fetch(`${API_BASE}/api/notes/gallery${params}`);
  return handle(res);
}

export async function chatAboutNotes({ rawText, question, history, language = "English" }) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ raw_text: rawText, question, history, language }),
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

export async function recordQuizAnswer({ topic, correct, noteId, question, chosenAnswer, correctAnswer, confidence }) {
  const res = await fetch(`${API_BASE}/api/review/quiz-answer`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      topic, correct, note_id: noteId, question,
      chosen_answer: chosenAnswer, correct_answer: correctAnswer, confidence,
    }),
  });
  return handle(res);
}

export async function getConfidenceCalibration() {
  const res = await fetch(`${API_BASE}/api/review/confidence-calibration`, {
    headers: await authHeaders(),
  });
  return handle(res);
}

export async function getStudyCoachAdvice(goal = "") {
  const res = await fetch(`${API_BASE}/api/coach/advise`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ goal }),
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

export async function explainDifferently({ contextText, concept }) {
  const res = await fetch(`${API_BASE}/api/practice/explain-differently`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ context_text: contextText, concept }),
  });
  return handle(res);
}

export async function gradeShortAnswer({ contextText, question, studentAnswer }) {
  const res = await fetch(`${API_BASE}/api/practice/grade-answer`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ context_text: contextText, question, student_answer: studentAnswer }),
  });
  return handle(res);
}

// Async group-quiz leaderboard — anyone with a shared note's link can log
// their score under a nickname, no login required (mirrors getSharedNote).
export async function submitLeaderboardScore({ noteId, displayName, score, total }) {
  const res = await fetch(`${API_BASE}/api/notes/${noteId}/leaderboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName, score, total }),
  });
  return handle(res);
}

export async function getLeaderboard(noteId) {
  const res = await fetch(`${API_BASE}/api/notes/${noteId}/leaderboard`);
  return handle(res);
}

export async function deleteAccount() {
  const res = await fetch(`${API_BASE}/api/user/account`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  return handle(res);
}

export async function teachBack({ contextText, concept, explanation }) {
  const res = await fetch(`${API_BASE}/api/practice/teach-back`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ context_text: contextText, concept, explanation }),
  });
  return handle(res);
}

export async function getMistakePatterns() {
  const res = await fetch(`${API_BASE}/api/practice/mistake-patterns`, {
    headers: await authHeaders(),
  });
  return handle(res);
}

export async function getContradictions(noteIds) {
  const res = await fetch(`${API_BASE}/api/notes/contradictions`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ note_ids: noteIds }),
  });
  return handle(res);
}

export async function generateExamTwin({ noteId, durationMinutes = 60, board }) {
  const res = await fetch(`${API_BASE}/api/notes/${noteId}/exam-twin`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ duration_minutes: durationMinutes, board }),
  });
  return handle(res);
}

export async function getSyllabusGaps(syllabusText) {
  const res = await fetch(`${API_BASE}/api/notes/syllabus-gaps`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ syllabus_text: syllabusText }),
  });
  return handle(res);
}

export async function getKnowledgeGraph(noteId) {
  const res = await fetch(`${API_BASE}/api/notes/${noteId}/knowledge-graph`, {
    headers: await authHeaders(),
  });
  return handle(res);
}

export async function searchNotes(query) {
  const res = await fetch(`${API_BASE}/api/notes/search`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ query }),
  });
  return handle(res);
}

export async function getClassHeatmap() {
  const res = await fetch(`${API_BASE}/api/user/class-heatmap`, {
    headers: await authHeaders(),
  });
  return handle(res);
}

export async function getStudyBuddyStatus() {
  const res = await fetch(`${API_BASE}/api/user/study-buddy/status`, {
    headers: await authHeaders(),
  });
  return handle(res);
}

export async function setStudyBuddyOptIn({ optIn, displayName, note }) {
  const res = await fetch(`${API_BASE}/api/user/study-buddy/opt-in`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ opt_in: optIn, display_name: displayName, note }),
  });
  return handle(res);
}

export async function getStudyBuddyMatches() {
  const res = await fetch(`${API_BASE}/api/user/study-buddy/matches`, {
    headers: await authHeaders(),
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

export async function runNoteOrganizer() {
  const res = await fetch(`${API_BASE}/api/organizer/analyze`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
  });
  return handle(res);
}

export async function applyNoteSubject(noteId, subject) {
  const res = await fetch(`${API_BASE}/api/notes/${noteId}/subject`, {
    method: "PATCH",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ subject }),
  });
  return handle(res);
}
