import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { GraduationCap, CheckCircle2, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { teachBack } from "../lib/api";

const LEVEL_STYLE = {
  solid: { className: "bg-mint-50 border-mint-500 text-mint-700", label: "Solid understanding!" },
  partial: { className: "bg-sun-50 border-sun-500 text-sun-700", label: "Partly there" },
  shaky: { className: "bg-coral-50 border-coral-500 text-coral-700", label: "Needs another look" },
};

// The Feynman technique: explain a concept in your own words as if
// teaching it to someone who's never heard of it. You can't fake teaching
// something you don't actually understand, so this exposes gaps that
// multiple-choice quizzes and flashcards routinely miss.
export default function TeachBackMode({ cards = [], rawText = "" }) {
  const [index, setIndex] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);

  if (!cards.length) {
    return <p className="text-center text-ink/40 font-semibold py-10">No concepts to teach back yet.</p>;
  }

  const card = cards[index];
  const concept = `${card.front}\n${card.back}`;

  const check = async () => {
    if (explanation.trim().length < 15 || checking) return;
    setChecking(true);
    try {
      const res = await teachBack({ contextText: rawText, concept, explanation });
      setResult(res);
    } catch (e) {
      toast.error(e.message || "Couldn't check that explanation right now.");
    } finally {
      setChecking(false);
    }
  };

  const next = () => {
    setExplanation("");
    setResult(null);
    setIndex((i) => (i + 1) % cards.length);
  };

  const style = result ? LEVEL_STYLE[result.understanding_level] || LEVEL_STYLE.partial : null;

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-sm font-bold text-ink/50 mb-3 flex items-center gap-2">
        <GraduationCap size={16} className="text-primary-500" />
        Concept {index + 1} of {cards.length} — teach it back like you're explaining it to a friend
      </div>
      <h3 className="font-display text-xl font-bold mb-5">{card.front}</h3>

      <textarea
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        disabled={!!result}
        placeholder="Explain this in your own words, as if teaching someone who's never heard of it..."
        aria-label="Your explanation"
        rows={5}
        className="w-full p-4 rounded-xl2 bg-white shadow-card outline-none font-semibold focus:ring-2 focus:ring-primary-300 mb-3 disabled:opacity-70"
      />

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-4 p-4 rounded-xl2 border-2 ${style.className}`}
          >
            <div className="flex items-center gap-2 font-bold text-sm mb-2">
              {result.understanding_level === "solid" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              {style.label}
            </div>
            <p className="text-sm font-semibold mb-3">{result.feedback}</p>
            {result.got_right?.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-bold uppercase tracking-wide opacity-70 mb-1">What you nailed</p>
                <ul className="text-sm font-semibold space-y-0.5">
                  {result.got_right.map((g, i) => (
                    <li key={i}>✓ {g}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.gaps?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide opacity-70 mb-1">Worth revisiting</p>
                <ul className="text-sm font-semibold space-y-0.5">
                  {result.gaps.map((g, i) => (
                    <li key={i}>• {g}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {result ? (
        <button
          onClick={next}
          className="w-full py-3 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
        >
          Next concept <ArrowRight size={16} />
        </button>
      ) : (
        <button
          onClick={check}
          disabled={checking || explanation.trim().length < 15}
          className="w-full py-3 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {checking ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Checking your explanation...
            </>
          ) : (
            "Check my explanation"
          )}
        </button>
      )}
    </div>
  );
}
