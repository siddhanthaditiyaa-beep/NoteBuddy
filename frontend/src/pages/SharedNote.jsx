import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Layers, ListChecks, Sparkles } from "lucide-react";
import FlashcardDeck from "../components/FlashcardDeck";
import Quiz from "../components/Quiz";
import { getSharedNote } from "../lib/api";

const TABS = [
  { id: "summary", label: "Summary", icon: BookOpen },
  { id: "flashcards", label: "Flashcards", icon: Layers },
  { id: "quiz", label: "Quiz", icon: ListChecks },
];

// A public, read-only view of someone else's study kit — no login required.
// This is the entire point of a shareable link, so it deliberately doesn't
// use NavBar/ProtectedRoute or send an Authorization header for anything.
export default function SharedNote() {
  const { noteId } = useParams();
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("summary");

  useEffect(() => {
    getSharedNote(noteId)
      .then(setNote)
      .catch((e) => setError(e.message || "Couldn't load this study kit."));
  }, [noteId]);

  if (error) {
    return (
      <div className="min-h-screen blob-bg flex items-center justify-center px-6">
        <div className="bg-white rounded-xl2 shadow-card p-10 text-center max-w-sm">
          <p className="font-bold text-ink/60 mb-1">Can't find that study kit</p>
          <p className="text-sm font-semibold text-ink/40 mb-5">{error}</p>
          <Link to="/" className="px-6 py-2.5 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft inline-block">
            Go to NoteBuddy
          </Link>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen blob-bg flex items-center justify-center">
        <p className="text-ink/50 font-semibold">Loading shared study kit...</p>
      </div>
    );
  }

  const studyKit = note.study_kit;

  return (
    <div className="min-h-screen blob-bg relative overflow-hidden">
      <div className="border-b border-primary-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-display font-extrabold text-lg text-primary-600">
            NoteBuddy
          </Link>
          <Link to="/signup" className="text-xs font-bold text-primary-600 hover:underline">
            Make your own study kit →
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 relative">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 text-primary-600 font-bold text-sm mb-2">
            <Sparkles size={16} /> Shared study kit
          </div>
          <h1 className="font-display text-3xl font-extrabold mb-6">{studyKit.title}</h1>

          <div className="flex gap-2 mb-6 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 rounded-xl2 font-bold text-sm flex items-center gap-2 shrink-0 transition-all ${
                  tab === t.id ? "bg-primary-500 text-white shadow-soft" : "bg-white text-ink/60 shadow-card"
                }`}
              >
                <t.icon size={16} /> {t.label}
              </button>
            ))}
          </div>

          {tab === "summary" && (
            <div className="bg-white rounded-xl2 shadow-card p-6 space-y-6">
              <p className="font-semibold text-ink/80 leading-relaxed">{studyKit.summary}</p>
              <div>
                <h3 className="font-display font-bold mb-3">Key terms</h3>
                <div className="space-y-2">
                  {studyKit.key_terms?.map((kt) => (
                    <div key={kt.term} className="p-3 rounded-xl2 bg-primary-50">
                      <span className="font-bold text-primary-700">{kt.term}: </span>
                      <span className="font-semibold text-ink/70">{kt.definition}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {tab === "flashcards" && (
            <div className="bg-white rounded-xl2 shadow-card p-8">
              <FlashcardDeck cards={studyKit.flashcards} />
            </div>
          )}
          {tab === "quiz" && (
            <div className="bg-white rounded-xl2 shadow-card p-8">
              <Quiz questions={studyKit.quiz} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
