const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

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

export async function processNote({ userId, level, text, file }) {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("level", level);
  if (file) form.append("file", file);
  else form.append("text", text);

  const res = await fetch(`${API_BASE}/api/notes/process`, {
    method: "POST",
    body: form,
  });
  return handle(res);
}

export async function regenerateNote({ noteId, userId, level }) {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("level", level);
  const res = await fetch(`${API_BASE}/api/notes/${noteId}/regenerate`, {
    method: "POST",
    body: form,
  });
  return handle(res);
}

export async function listNotes(userId) {
  const res = await fetch(`${API_BASE}/api/notes/list?user_id=${userId}`);
  return handle(res);
}

export async function getNote(noteId, userId) {
  const res = await fetch(`${API_BASE}/api/notes/${noteId}?user_id=${userId}`);
  return handle(res);
}

export async function chatAboutNotes({ rawText, question, history }) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_text: rawText, question, history }),
  });
  return handle(res);
}

export async function getProgress(userId) {
  const res = await fetch(`${API_BASE}/api/user/progress?user_id=${userId}`);
  return handle(res);
}

export async function combineNotes({ userId, noteIds, level }) {
  const res = await fetch(`${API_BASE}/api/notes/combine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, note_ids: noteIds, level }),
  });
  return handle(res);
}

export async function getDueCards(userId) {
  const res = await fetch(`${API_BASE}/api/review/due?user_id=${userId}`);
  return handle(res);
}

export async function gradeCard({ userId, noteId, cardIndex, quality }) {
  const res = await fetch(`${API_BASE}/api/review/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      note_id: noteId,
      card_index: cardIndex,
      quality,
    }),
  });
  return handle(res);
}

export async function resetDemoAccount(userId) {
  const res = await fetch(`${API_BASE}/api/demo/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  return handle(res);
}
