import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, Plus, Flame, Trophy, BookOpen, Search, Layers, Brain, Target, CalendarDays, Clock, Share2, Sparkles, Loader2 } from "lucide-react";
import NavBar from "../components/NavBar";
import XPBar from "../components/XPBar";
import Skeleton from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";
import { useTour } from "../context/TourContext";
import { isDemoUser } from "../lib/constants";
import { getBadgeVisual } from "../lib/badges";
import { listNotes, getProgress, getNote, getWeakTopics, searchNotes } from "../lib/api";
import { shareAchievementCard } from "../lib/achievementCard";
import InsightsPanel from "../components/InsightsPanel";
import SyllabusGapTracker from "../components/SyllabusGapTracker";
import toast from "react-hot-toast";

function getGreeting(user, notesCount, demo) {
  if (demo) return "You're exploring the NoteBuddy demo 🎮";
  const name = user?.email?.split("@")[0] || "there";
  if (notesCount === 0) return `Welcome, ${name}! Let's build your first study kit 🎉`;
  return `Welcome back, ${name} 👋`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const demo = isDemoUser(user);
  const tour = useTour();
  const [notes, setNotes] = useState([]);
  const [progress, setProgress] = useState({
    xp: 0,
    level: 1,
    xp_to_next_level: 100,
    streak: 0,
    badges: [],
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeSubject, setActiveSubject] = useState(null);
  const [weakTopics, setWeakTopics] = useState([]);
  const [semQuery, setSemQuery] = useState("");
  const [semResults, setSemResults] = useState(null); // null = not searched yet
  const [semLoading, setSemLoading] = useState(false);
  const [semOpeningId, setSemOpeningId] = useState(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([listNotes(user.id), getProgress(user.id)])
      .then(([notesRes, progressRes]) => {
        setNotes(notesRes.notes || []);
        setProgress(progressRes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    getWeakTopics(user.id)
      .then((res) => setWeakTopics(res.topics || []))
      .catch(() => {});
  }, [user]);

  // Kick off the interactive spotlight tour once per login, not on every
  // visit to this page. Login.jsx clears notebuddy_tour_seen_<id> every
  // time someone signs in as the demo account, so a fresh demo login
  // always sees it again — but navigating back to the dashboard mid-demo
  // (or later in the same session) won't keep re-triggering it. The
  // hasRun ref guards against this effect firing more than once even if
  // something upstream re-renders, which is what was causing the tour to
  // restart itself right after Skip was clicked.
  const hasRunTourCheck = useRef(false);
  useEffect(() => {
    if (!user || !tour || hasRunTourCheck.current) return;
    hasRunTourCheck.current = true;
    const key = `notebuddy_tour_seen_${user.id}`;
    if (!localStorage.getItem(key)) {
      tour.start();
      localStorage.setItem(key, "1");
    }
  }, [user, tour]);

  // Purely arithmetic, no AI call: estimates how long it would have taken
  // to hand-write a summary of this much material PLUS make flashcards and
  // a quiz from it (~8 words/minute of focused handwriting/typing, plus a
  // flat ~15 minutes per note for manually drafting flashcards and quiz
  // questions), vs. the seconds NoteBuddy actually took. The single most
  // persuasive number in a demo/pitch — a concrete before/after, not a
  // feature list.
  const timeSavedHours = useMemo(() => {
    const totalMinutes = notes.reduce((sum, n) => sum + (n.word_count || 0) / 8 + 15, 0);
    return Math.round((totalMinutes / 60) * 10) / 10;
  }, [notes]);

  // Semantic search — "which of my notes mentioned mitochondria?" — finds
  // matching passages by meaning, not just title substring like the search
  // box further down. Separate from that box on purpose: this one costs a
  // Gemini embeddings call, so it only fires on submit, not on every
  // keystroke.
  const runSemanticSearch = async (e) => {
    e.preventDefault();
    const q = semQuery.trim();
    if (q.length < 3 || semLoading) return;
    setSemLoading(true);
    try {
      const { results } = await searchNotes(q);
      setSemResults(results || []);
    } catch (err) {
      toast.error(err.message || "Search isn't available right now.");
      setSemResults([]);
    } finally {
      setSemLoading(false);
    }
  };

  const openFromSearch = async (noteId) => {
    setSemOpeningId(noteId);
    try {
      const full = await getNote(noteId, user.id);
      sessionStorage.setItem(
        "notebuddy_last_result",
        JSON.stringify({ study_kit: full.study_kit, raw_text: full.raw_text, note: full })
      );
      window.location.href = "/results";
    } catch {
      toast.error("Couldn't open that note right now.");
      setSemOpeningId(null);
    }
  };

  const shareCard = async (opts) => {
    try {
      const result = await shareAchievementCard(opts);
      if (result === "downloaded") toast.success("Achievement card saved — share it anywhere!");
    } catch (e) {
      if (e.name !== "AbortError") toast.error("Couldn't create the share card right now.");
    }
  };

  const subjects = useMemo(() => {
    const set = new Set(notes.map((n) => n.subject || "General"));
    return Array.from(set);
  }, [notes]);

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const matchesSearch = !search || n.title.toLowerCase().includes(search.toLowerCase());
      const matchesSubject = !activeSubject || (n.subject || "General") === activeSubject;
      return matchesSearch && matchesSubject;
    });
  }, [notes, search, activeSubject]);

  return (
    <div className="min-h-screen blob-bg relative overflow-hidden">
      <div className="absolute top-24 -left-10 w-24 h-24 rounded-xl3 bg-sun-300/30 animate-float hidden md:block" />
      <div
        className="absolute bottom-10 -right-10 w-28 h-28 rounded-full bg-mint-400/20 animate-float hidden md:block"
        style={{ animationDelay: "1.2s" }}
      />

      <NavBar />
      <div className="max-w-4xl mx-auto px-6 py-10 relative">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-extrabold mb-1">
            {getGreeting(user, notes.length, demo)}
          </h1>
          <p className="text-ink/50 font-semibold mb-6">
            {demo
              ? "Feel free to click around — nothing here is permanent."
              : "Here's where your learning is at."}
          </p>

          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div className="sm:col-span-2">
              <XPBar
                xp={progress.xp}
                level={progress.level}
                xpToNext={progress.xp_to_next_level}
                streak={progress.streak}
              />
            </div>
            <div className="bg-white rounded-xl2 shadow-card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl2 bg-mint-50 flex items-center justify-center text-mint-500 shrink-0">
                <BookOpen size={22} />
              </div>
              <div>
                <p className="font-display text-2xl font-bold leading-none">{notes.length}</p>
                <p className="text-xs font-bold text-ink/40 mt-1">study kits made</p>
              </div>
            </div>
          </div>

          {timeSavedHours > 0 && (
            <div className="mb-8 bg-gradient-to-br from-mint-400 to-mint-500 rounded-xl2 p-5 text-white flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl2 bg-white/20 flex items-center justify-center shrink-0">
                <Clock size={24} />
              </div>
              <div>
                <p className="font-display text-xl font-extrabold leading-none">
                  ~{timeSavedHours} hour{timeSavedHours === 1 ? "" : "s"} saved
                </p>
                <p className="text-xs font-bold text-white/80 mt-1">
                  vs. making these notes, flashcards, and quizzes by hand
                </p>
              </div>
            </div>
          )}

          {notes.length >= 2 && (
            <div className="mb-8 bg-white rounded-xl2 shadow-card p-5">
              <h2 className="font-display text-sm font-bold text-ink/50 mb-3 flex items-center gap-2">
                <Sparkles size={16} className="text-primary-500" /> Search across everything you've studied
              </h2>
              <form onSubmit={runSemanticSearch} className="flex gap-2">
                <input
                  value={semQuery}
                  onChange={(e) => setSemQuery(e.target.value)}
                  placeholder="e.g. 'what did I write about mitochondria?'"
                  className="flex-1 px-4 py-2.5 rounded-xl2 bg-white shadow-card outline-none font-semibold text-sm focus:ring-2 focus:ring-primary-300"
                />
                <button
                  type="submit"
                  disabled={semLoading || semQuery.trim().length < 3}
                  className="px-4 py-2.5 rounded-xl2 bg-primary-500 text-white font-bold text-sm shadow-soft hover:bg-primary-600 transition-colors disabled:opacity-60 flex items-center gap-2 shrink-0"
                >
                  {semLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Search
                </button>
              </form>
              {semResults !== null && (
                <div className="mt-4 space-y-2">
                  {semResults.length === 0 ? (
                    <p className="text-sm font-semibold text-ink/40">No matching passages found — try different words.</p>
                  ) : (
                    semResults.map((r, i) => (
                      <button
                        key={`${r.note_id}-${i}`}
                        onClick={() => openFromSearch(r.note_id)}
                        disabled={semOpeningId === r.note_id}
                        className="w-full text-left p-3 rounded-xl2 bg-primary-50/50 hover:bg-primary-50 transition-colors disabled:opacity-60"
                      >
                        <p className="text-xs font-bold text-primary-700 mb-1">{r.note_title}</p>
                        <p className="text-sm font-semibold text-ink/70 line-clamp-2">{r.chunk_text}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {notes.length > 0 && <InsightsPanel />}

          {notes.length > 0 && (
            <div className="mb-8">
              <SyllabusGapTracker />
            </div>
          )}

          {weakTopics.length > 0 && (
            <div className="mb-8 bg-white rounded-xl2 shadow-card p-5">
              <h2 className="font-display text-sm font-bold text-ink/50 mb-3 flex items-center gap-2">
                <Target size={16} className="text-coral-500" /> Topics to review
              </h2>
              <div className="flex flex-wrap gap-2">
                {weakTopics.map((t) => (
                  <span
                    key={t.term}
                    title={`${t.wrong_count} missed vs ${t.correct_count} correct`}
                    className="px-3 py-1.5 rounded-full bg-coral-50 text-coral-600 text-xs font-bold"
                  >
                    {t.term}
                  </span>
                ))}
              </div>
              <p className="text-xs font-semibold text-ink/40 mt-3">
                Open a note on this subject and hit "Focus on my weak topics" to get flashcards and quiz questions targeting these.
              </p>
            </div>
          )}

          {progress.badges && progress.badges.length > 0 && (
            <div className="mb-8">
              <h2 className="font-display text-sm font-bold text-ink/50 mb-3">Your badges</h2>
              <div className="flex flex-wrap gap-3">
                {progress.badges.map((b) => {
                  const { icon: Icon, color, bg } = getBadgeVisual(b.id);
                  return (
                    <div
                      key={b.id}
                      title={b.description}
                      className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl2 bg-white shadow-card"
                    >
                      <div className={`w-8 h-8 rounded-xl2 ${bg} flex items-center justify-center ${color} shrink-0`}>
                        <Icon size={16} />
                      </div>
                      <span className="text-xs font-bold text-ink/70">{b.label}</span>
                      <button
                        onClick={() =>
                          shareCard({ emoji: "🏆", title: b.label, subtitle: b.description || "Badge earned on NoteBuddy" })
                        }
                        title="Share this badge"
                        aria-label={`Share ${b.label} badge`}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-ink/30 hover:text-primary-600 hover:bg-primary-50 transition-colors shrink-0"
                      >
                        <Share2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-display text-xl font-bold">Your notes</h2>
            <div className="flex items-center gap-2">
              {notes.length > 0 && (
                <Link
                  to="/planner"
                  className="px-3 py-2 rounded-xl2 bg-white shadow-card text-ink/70 font-bold text-sm flex items-center gap-1 hover:text-primary-600 transition-colors"
                >
                  <CalendarDays size={16} /> Plan
                </Link>
              )}
              {notes.length >= 2 && (
                <>
                  <Link
                    to="/review"
                    className="px-3 py-2 rounded-xl2 bg-white shadow-card text-ink/70 font-bold text-sm flex items-center gap-1 hover:text-primary-600 transition-colors"
                  >
                    <Brain size={16} /> Review
                  </Link>
                  <Link
                    to="/combine"
                    className="px-3 py-2 rounded-xl2 bg-white shadow-card text-ink/70 font-bold text-sm flex items-center gap-1 hover:text-primary-600 transition-colors"
                  >
                    <Layers size={16} /> Combine
                  </Link>
                </>
              )}
              <Link
                to="/upload"
                className="px-4 py-2 rounded-xl2 bg-primary-500 text-white font-bold text-sm shadow-soft flex items-center gap-1 hover:bg-primary-600 transition-colors"
              >
                <Plus size={16} /> New note
              </Link>
            </div>
          </div>

          {notes.length > 0 && (
            <div className="mb-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" size={16} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your notes..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl2 bg-white shadow-card outline-none font-semibold text-sm focus:ring-2 focus:ring-primary-300"
                />
              </div>
              {subjects.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveSubject(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      !activeSubject ? "bg-primary-500 text-white" : "bg-white text-ink/60 shadow-card"
                    }`}
                  >
                    All
                  </button>
                  {subjects.map((s) => (
                    <button
                      key={s}
                      onClick={() => setActiveSubject(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        activeSubject === s ? "bg-primary-500 text-white" : "bg-white text-ink/60 shadow-card"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : notes.length === 0 ? (
            <div className="bg-white rounded-xl2 shadow-card p-10 text-center relative overflow-hidden">
              <div className="w-16 h-16 rounded-xl3 bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <FileText className="text-primary-400" size={28} />
              </div>
              <p className="font-bold text-ink/60 mb-1">No study kits yet</p>
              <p className="text-sm font-semibold text-ink/40 mb-5">
                Paste some notes or upload a PDF to see NoteBuddy in action.
              </p>
              <Link
                to="/upload"
                className="inline-block px-6 py-2.5 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft hover:bg-primary-600 transition-colors"
              >
                Create your first one
              </Link>
            </div>
          ) : filteredNotes.length === 0 ? (
            <p className="text-ink/40 font-semibold text-center py-10">No notes match that search.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {filteredNotes.map((n) => (
                <NoteCard key={n.id} note={n} userId={user.id} />
              ))}
            </div>
          )}

          {notes.length > 0 && (
            <div className="mt-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl2 p-6 text-white flex items-center gap-4">
              <Trophy size={28} />
              <div>
                <p className="font-display font-bold">Keep the streak alive!</p>
                <p className="text-sm font-semibold text-primary-100">
                  Come back tomorrow and study something new to grow your streak.
                </p>
              </div>
              {progress.streak > 0 && (
                <button
                  onClick={() =>
                    shareCard({
                      emoji: "🔥",
                      title: `${progress.streak}-day streak`,
                      subtitle: "Studying consistently with NoteBuddy",
                    })
                  }
                  title="Share your streak"
                  aria-label="Share your streak"
                  className="ml-auto w-9 h-9 rounded-xl2 bg-white/15 hover:bg-white/25 flex items-center justify-center shrink-0 transition-colors"
                >
                  <Share2 size={16} />
                </button>
              )}
              <Flame size={22} className={progress.streak > 0 ? "text-sun-300 shrink-0" : "ml-auto text-sun-300 shrink-0"} fill="currentColor" />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function NoteCard({ note, userId }) {
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    try {
      const full = await getNote(note.id, userId);
      sessionStorage.setItem(
        "notebuddy_last_result",
        JSON.stringify({ study_kit: full.study_kit, raw_text: full.raw_text, note: full })
      );
      window.location.href = "/results";
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={open}
      disabled={loading}
      className="text-left bg-white rounded-xl2 shadow-card p-5 hover:shadow-soft hover:-translate-y-0.5 transition-all"
    >
      <div className="w-9 h-9 rounded-xl2 bg-primary-50 flex items-center justify-center text-primary-500 mb-3">
        <FileText size={18} />
      </div>
      <p className="font-display font-bold mb-1">{note.title}</p>
      <p className="text-xs font-semibold text-ink/40 flex items-center gap-1.5">
        <span className="px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600">
          {note.subject || "General"}
        </span>
        {new Date(note.created_at).toLocaleDateString()}
      </p>
    </button>
  );
}
