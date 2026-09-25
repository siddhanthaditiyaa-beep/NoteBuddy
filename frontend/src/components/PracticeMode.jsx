import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { CheckCircle2, AlertCircle, XCircle, Loader2, ArrowRight } from "lucide-react";
import { gradeShortAnswer } from "../lib/api";

const VERDICT_STYLE = {
  correct: { icon: CheckCircle2, className: "bg-mint-50 border-mint-500 text-mint-700", label: "Correct!" },
  partially_correct: { icon: AlertCircle, className: "bg-sun-50 border-sun-500 text-sun-700", label: "Partly there" },
  incorrect: { icon: XCircle, className: "bg-coral-50 border-coral-500 text-coral-700", label: "Not quite" },
};

// Short-answer practice — stronger for retention than multiple choice,
// since the student has to produce the answer rather than just recognize
// it among four options. Reuses each flashcard's front as the prompt, so
// no extra generation step is needed.
export default function PracticeMode({ cards = [], rawText = "" }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null); // { verdict, feedback } | null
  const [grading, setGrading] = useState(false);

  if (!cards.length) {
    return <p className="text-center text-ink/40 font-semibold py-10">No flashcards to practice with yet.</p>;
  }

  const card = cards[index];

  const check = async () => {
    if (!answer.trim() || grading) return;
    setGrading(true);
    try {
      const res = await gradeShortAnswer({ contextText: rawText, question: card.front, studentAnswer: answer });
      setResult(res);
    } catch (e) {
      toast.error(e.message || "Couldn't grade that right now.");
    } finally {
      setGrading(false);
    }
  };

  const next = () => {
    setAnswer("");
    setResult(null);
    setIndex((i) => (i + 1) % cards.length);
  };

  const verdict = result ? VERDICT_STYLE[result.verdict] || VERDICT_STYLE.partially_correct : null;
  const VerdictIcon = verdict?.icon;

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-sm font-bold text-ink/50 mb-3">
        Question {index + 1} of {cards.length} — type your own answer, no options to pick from
      </div>
      <h3 className="font-display text-xl font-bold mb-5">{card.front}</h3>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={!!result}
        placeholder="Type your answer here..."
        aria-label="Your answer"
        rows={4}
        className="w-full p-4 rounded-xl2 bg-white shadow-card outline-none font-semibold focus:ring-2 focus:ring-primary-300 mb-3 disabled:opacity-70"
      />

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-4 p-4 rounded-xl2 border-2 ${verdict.className}`}
          >
            <div className="flex items-center gap-2 font-bold text-sm mb-1">
              <VerdictIcon size={18} /> {verdict.label}
            </div>
            <p className="text-sm font-semibold">{result.feedback}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {result ? (
        <button
          onClick={next}
          className="w-full py-3 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
        >
          Next question <ArrowRight size={16} />
        </button>
      ) : (
        <button
          onClick={check}
          disabled={grading || !answer.trim()}
          className="w-full py-3 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {grading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Checking...
            </>
          ) : (
            "Check my answer"
          )}
        </button>
      )}
    </div>
  );
}
