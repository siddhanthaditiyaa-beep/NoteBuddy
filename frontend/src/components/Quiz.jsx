import { useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { CheckCircle2, XCircle, Trophy, Users, Loader2 } from "lucide-react";
import { submitLeaderboardScore, getLeaderboard } from "../lib/api";

// Shown after a quiz on a shared note — lets whoever's taking it log their
// score under a nickname and see how they stack up against everyone else
// who's taken this same quiz, all asynchronously (no need to be online at
// the same time as classmates).
function LeaderboardSection({ noteId, score, total }) {
  const [name, setName] = useState(() => localStorage.getItem("notebuddy_leaderboard_name") || "");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      localStorage.setItem("notebuddy_leaderboard_name", trimmed);
      await submitLeaderboardScore({ noteId, displayName: trimmed, score, total });
      const { leaderboard } = await getLeaderboard(noteId);
      setRows(leaderboard || []);
      setSubmitted(true);
    } catch (err) {
      toast.error(err.message || "Couldn't save your score right now.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-primary-50 w-full max-w-sm mx-auto text-left">
      <h4 className="font-display text-sm font-bold text-ink/60 mb-3 flex items-center gap-2">
        <Users size={16} className="text-primary-500" /> Group leaderboard
      </h4>
      {!submitted ? (
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name or nickname"
            maxLength={40}
            className="flex-1 px-3 py-2 rounded-xl2 bg-white shadow-card outline-none font-semibold text-sm focus:ring-2 focus:ring-primary-300"
          />
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="px-4 py-2 rounded-xl2 bg-primary-500 text-white font-bold text-sm shadow-soft hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center gap-1.5 shrink-0"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : "Post score"}
          </button>
        </form>
      ) : (
        <div className="space-y-1.5">
          {(rows || []).map((r, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-3 py-2 rounded-xl2 text-sm font-bold ${
                r.display_name === name.trim() && r.score === score ? "bg-primary-50 text-primary-700" : "bg-white shadow-card text-ink/70"
              }`}
            >
              <span className="truncate">{i + 1}. {r.display_name}</span>
              <span>{r.score}/{r.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Quiz({ questions = [], onAnswer, noteId, showLeaderboard = false }) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  if (!questions.length) return null;

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center gap-4 text-center py-10"
      >
        <div className="w-20 h-20 rounded-full bg-sun-300 flex items-center justify-center shadow-pop animate-popIn">
          <Trophy size={36} className="text-white" />
        </div>
        <h3 className="font-display text-2xl font-bold">
          You scored {score}/{questions.length}
        </h3>
        <p className="text-ink/60 font-semibold">
          {pct >= 80 ? "Amazing work! You really know this." : pct >= 50 ? "Nice progress — review the tricky ones and try again!" : "Good start — go through the flashcards again and retry!"}
        </p>
        <button
          onClick={() => {
            setCurrent(0);
            setSelected(null);
            setScore(0);
            setDone(false);
          }}
          className="mt-2 px-6 py-2.5 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft hover:bg-primary-600 transition-colors"
        >
          Try again
        </button>
        {showLeaderboard && noteId && <LeaderboardSection noteId={noteId} score={score} total={questions.length} />}
      </motion.div>
    );
  }

  const q = questions[current];

  const choose = (i) => {
    if (selected !== null) return;
    setSelected(i);
    const isCorrect = i === q.correct_index;
    if (isCorrect) setScore((s) => s + 1);
    // Feeds the weak-topic tracker on the dashboard — only sent when the
    // question actually has a topic (older cached study kits from before
    // this feature won't, so those just don't record anything).
    if (onAnswer && q.topic) onAnswer({ topic: q.topic, correct: isCorrect });
  };

  const next = () => {
    setSelected(null);
    if (current + 1 < questions.length) setCurrent((c) => c + 1);
    else setDone(true);
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-sm font-bold text-ink/50 mb-3">
        Question {current + 1} of {questions.length}
      </div>
      <h3 className="font-display text-xl font-bold mb-5">{q.question}</h3>

      <div className="space-y-3">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correct_index;
          const isChosen = i === selected;
          let style = "bg-white border-2 border-primary-100 hover:border-primary-300";
          if (selected !== null) {
            if (isCorrect) style = "bg-mint-50 border-2 border-mint-500";
            else if (isChosen) style = "bg-coral-50 border-2 border-coral-500";
            else style = "bg-white border-2 border-gray-100 opacity-60";
          }
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              className={`w-full text-left px-5 py-3.5 rounded-xl2 font-semibold transition-all flex items-center justify-between ${style}`}
            >
              {opt}
              {selected !== null && isCorrect && <CheckCircle2 className="text-mint-500" size={20} />}
              {selected !== null && isChosen && !isCorrect && <XCircle className="text-coral-500" size={20} />}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 rounded-xl2 bg-primary-50 text-sm font-semibold text-ink/80"
        >
          {q.explanation}
        </motion.div>
      )}

      {selected !== null && (
        <button
          onClick={next}
          className="mt-5 w-full py-3 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft hover:bg-primary-600 transition-colors"
        >
          {current + 1 < questions.length ? "Next question" : "See results"}
        </button>
      )}
    </div>
  );
}
