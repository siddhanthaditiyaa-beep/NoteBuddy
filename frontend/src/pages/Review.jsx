import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Brain, CheckCircle2, RotateCcw } from "lucide-react";
import NavBar from "../components/NavBar";
import { useAuth } from "../context/AuthContext";
import { getDueCards, gradeCard } from "../lib/api";

// Maps the four learner-facing buttons to the 0-5 SM-2 quality scale.
const GRADES = [
  { label: "Again", quality: 0, className: "bg-coral-500 hover:bg-coral-600" },
  { label: "Hard", quality: 3, className: "bg-sun-500 hover:bg-sun-600" },
  { label: "Good", quality: 4, className: "bg-mint-500 hover:bg-mint-600" },
  { label: "Easy", quality: 5, className: "bg-primary-500 hover:bg-primary-600" },
];

export default function Review() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState(null); // null = loading
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDueCards(user.id)
      .then((res) => setCards(res.cards || []))
      .catch(() => setCards([]));
  }, [user]);

  const current = cards?.[index];

  const grade = async (quality) => {
    if (!current || grading) return;
    setGrading(true);
    try {
      await gradeCard({
        userId: user.id,
        noteId: current.note_id,
        cardIndex: current.card_index,
        quality,
      });
    } catch {
      toast.error("Couldn't save that — check the backend is running.");
    } finally {
      setGrading(false);
      setFlipped(false);
      setIndex((i) => i + 1);
    }
  };

  return (
    <div className="min-h-screen blob-bg relative overflow-hidden">
      <div className="absolute top-24 -right-10 w-24 h-24 rounded-full bg-mint-400/20 animate-float hidden md:block" />
      <NavBar />
      <div className="max-w-xl mx-auto px-6 py-12 relative">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 text-primary-600 font-bold text-sm mb-2">
            <Brain size={16} /> Spaced-repetition review
          </div>
          <h1 className="font-display text-3xl font-extrabold mb-6">Review your flashcards</h1>

          {cards === null ? (
            <p className="text-ink/50 font-semibold text-center py-20">Loading your due cards...</p>
          ) : cards.length === 0 ? (
            <div className="bg-white rounded-xl2 shadow-card p-10 text-center">
              <CheckCircle2 className="mx-auto text-mint-500 mb-4" size={40} />
              <p className="font-display font-bold text-lg mb-1">You're all caught up!</p>
              <p className="text-sm font-semibold text-ink/50 mb-5">
                No flashcards are due right now — come back later, or make a new study kit.
              </p>
              <button
                onClick={() => navigate("/dashboard")}
                className="px-6 py-2.5 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft"
              >
                Back to dashboard
              </button>
            </div>
          ) : !current ? (
            <div className="bg-white rounded-xl2 shadow-card p-10 text-center">
              <CheckCircle2 className="mx-auto text-mint-500 mb-4" size={40} />
              <p className="font-display font-bold text-lg mb-1">Session complete! 🎉</p>
              <p className="text-sm font-semibold text-ink/50 mb-5">
                You reviewed {cards.length} card{cards.length === 1 ? "" : "s"}.
              </p>
              <button
                onClick={() => navigate("/dashboard")}
                className="px-6 py-2.5 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft"
              >
                Back to dashboard
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold text-ink/40 mb-3">
                Card {index + 1} of {cards.length} &middot; from &ldquo;{current.note_title}&rdquo;
                {current.is_new && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-primary-50 text-primary-600">new</span>
                )}
              </p>

              <AnimatePresence mode="wait">
                <motion.div
                  key={`${current.note_id}-${current.card_index}`}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                >
                  <button
                    onClick={() => setFlipped((f) => !f)}
                    className="w-full min-h-[220px] bg-white rounded-xl2 shadow-card p-8 flex items-center justify-center text-center mb-2"
                  >
                    <p className="font-display text-xl font-bold leading-relaxed">
                      {flipped ? current.back : current.front}
                    </p>
                  </button>
                  <p className="text-center text-xs font-bold text-ink/30 flex items-center justify-center gap-1 mb-6">
                    <RotateCcw size={12} /> Click the card to {flipped ? "hide" : "reveal"} the answer
                  </p>
                </motion.div>
              </AnimatePresence>

              {flipped ? (
                <div className="grid grid-cols-4 gap-2">
                  {GRADES.map((g) => (
                    <button
                      key={g.label}
                      onClick={() => grade(g.quality)}
                      disabled={grading}
                      className={`py-3 rounded-xl2 text-white font-bold text-sm shadow-soft transition-colors disabled:opacity-60 ${g.className}`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm font-semibold text-ink/40">
                  Flip the card first, then grade how well you remembered it.
                </p>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
