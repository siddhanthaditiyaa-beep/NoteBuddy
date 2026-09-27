import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Swords, Loader2, CheckCircle2, Trophy, RotateCcw } from "lucide-react";
import { startDebate, debateRespond, logFeatureUse } from "../lib/api";

const STRENGTH_STYLE = {
  strong: { className: "bg-mint-50 border-mint-500 text-mint-700", label: "You held your ground!" },
  partial: { className: "bg-sun-50 border-sun-500 text-sun-700", label: "A fair fight" },
  weak: { className: "bg-coral-50 border-coral-500 text-coral-700", label: "Worth another round" },
};

// Debate Mode — a sharper, more active alternative to Teach-Back. Instead
// of just explaining a concept and being graded on it, the student has to
// defend a point from their own notes against an AI that's actively
// arguing the opposing side. Active argumentation forces genuine
// re-examination of the material in a way passive recitation doesn't.
export default function DebateMode({ rawText = "" }) {
  const [claim, setClaim] = useState(null);
  const [history, setHistory] = useState([]); // [{role: 'ai'|'student', text}]
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [isFinal, setIsFinal] = useState(false);

  const begin = async () => {
    setStarting(true);
    try {
      const res = await startDebate({ contextText: rawText });
      setClaim(res.claim);
      setHistory([{ role: "ai", text: res.opening_argument }]);
      setVerdict(null);
      setIsFinal(false);
      logFeatureUse("debate_mode");
    } catch (e) {
      toast.error(e.message || "Couldn't start a debate right now.");
    } finally {
      setStarting(false);
    }
  };

  const respond = async () => {
    if (input.trim().length < 5 || sending || isFinal) return;
    setSending(true);
    const nextHistory = [...history, { role: "student", text: input.trim() }];
    setHistory(nextHistory);
    setInput("");
    try {
      const res = await debateRespond({
        contextText: rawText,
        claim,
        history: nextHistory,
        studentResponse: nextHistory[nextHistory.length - 1].text,
      });
      setHistory((h) => [...h, { role: "ai", text: res.ai_response }]);
      if (res.is_final) {
        setIsFinal(true);
        if (res.verdict) setVerdict(res.verdict);
      }
    } catch (e) {
      toast.error(e.message || "Couldn't get a response right now.");
      setHistory(history); // roll back the optimistic student turn on failure
    } finally {
      setSending(false);
    }
  };

  const restart = () => {
    setClaim(null);
    setHistory([]);
    setInput("");
    setVerdict(null);
    setIsFinal(false);
  };

  if (!claim) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 rounded-xl3 bg-primary-50 flex items-center justify-center mx-auto mb-4">
          <Swords className="text-primary-500" size={28} />
        </div>
        <h3 className="font-display text-xl font-bold mb-2">Debate Mode</h3>
        <p className="text-sm font-semibold text-ink/50 mb-6 max-w-sm mx-auto">
          NoteBuddy will pick a debatable point from your notes, argue the OPPOSING side, and make you defend it —
          more dynamic than just explaining a concept back.
        </p>
        <button
          onClick={begin}
          disabled={starting}
          className="px-6 py-3 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center gap-2 mx-auto"
        >
          {starting ? <Loader2 size={16} className="animate-spin" /> : <Swords size={16} />}
          {starting ? "Finding a debatable point..." : "Start a debate"}
        </button>
      </div>
    );
  }

  const style = verdict ? STRENGTH_STYLE[verdict.strength] || STRENGTH_STYLE.partial : null;

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-4 p-3 rounded-xl2 bg-primary-50 text-primary-700">
        <p className="text-xs font-bold uppercase tracking-wide opacity-70 mb-1">Debating</p>
        <p className="text-sm font-bold">{claim}</p>
      </div>

      <div className="space-y-3 mb-4 max-h-96 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {history.map((turn, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-xl2 text-sm font-semibold ${
                turn.role === "ai" ? "bg-coral-50 text-coral-700 mr-8" : "bg-mint-50 text-mint-700 ml-8"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-60 mb-1">
                {turn.role === "ai" ? "Opposing side" : "You"}
              </p>
              {turn.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {verdict && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-4 p-4 rounded-xl2 border-2 ${style.className}`}
          >
            <div className="flex items-center gap-2 font-bold text-sm mb-2">
              {verdict.strength === "strong" ? <Trophy size={18} /> : <CheckCircle2 size={18} />}
              {style.label}
            </div>
            <p className="text-sm font-semibold">{verdict.feedback}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {isFinal ? (
        <button
          onClick={restart}
          className="w-full py-3 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw size={16} /> Debate another point
        </button>
      ) : (
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            placeholder="Push back — defend the material..."
            aria-label="Your rebuttal"
            rows={2}
            className="flex-1 p-3 rounded-xl2 bg-white shadow-card outline-none font-semibold text-sm focus:ring-2 focus:ring-primary-300 disabled:opacity-70"
          />
          <button
            onClick={respond}
            disabled={sending || input.trim().length < 5}
            className="px-4 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center justify-center shrink-0"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : "Reply"}
          </button>
        </div>
      )}
    </div>
  );
}
