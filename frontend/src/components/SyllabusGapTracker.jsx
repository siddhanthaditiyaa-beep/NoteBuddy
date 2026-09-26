import { useState } from "react";
import toast from "react-hot-toast";
import { ListTodo, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { getSyllabusGaps } from "../lib/api";

// Syllabus Coverage Gap Tracker — paste in a chapter list / syllabus and
// see which topics don't have a matching note yet, catching "I never
// actually made notes on Chapter 7" before it becomes an exam-day surprise.
export default function SyllabusGapTracker() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const check = async () => {
    if (text.trim().length < 10 || loading) return;
    setLoading(true);
    try {
      const res = await getSyllabusGaps(text);
      setResult(res);
    } catch (e) {
      toast.error(e.message || "Couldn't check your syllabus right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl2 shadow-card p-5">
      <h2 className="font-display text-sm font-bold text-ink/50 mb-3 flex items-center gap-2">
        <ListTodo size={16} className="text-primary-500" /> Syllabus coverage gap tracker
      </h2>
      <p className="text-sm font-semibold text-ink/50 mb-3">
        Paste your syllabus or chapter list — NoteBuddy checks it against the notes you've actually made.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="e.g. Chapter 1: Cell structure&#10;Chapter 2: Mitosis and meiosis&#10;Chapter 3: DNA replication..."
        className="w-full p-3 rounded-xl2 bg-primary-50 shadow-card outline-none font-semibold text-sm mb-3 focus:ring-2 focus:ring-primary-300"
      />
      <button
        onClick={check}
        disabled={loading || text.trim().length < 10}
        className="px-4 py-2 rounded-xl2 bg-primary-500 text-white font-bold text-sm shadow-soft hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center gap-2"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <ListTodo size={14} />}
        Check coverage
      </button>

      {result && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-ink/60">{result.summary}</p>
          {result.missing?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-coral-600 mb-1.5 flex items-center gap-1">
                <AlertCircle size={13} /> Not covered yet
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.missing.map((m, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-coral-50 text-coral-600 text-xs font-bold">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
          {result.covered?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-mint-600 mb-1.5 flex items-center gap-1">
                <CheckCircle2 size={13} /> Covered
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.covered.map((c, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-mint-50 text-mint-600 text-xs font-bold">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
