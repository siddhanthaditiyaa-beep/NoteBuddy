import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Gauge, Brain, Loader2, Sparkles } from "lucide-react";
import { getConfidenceCalibration, getMistakePatterns } from "../lib/api";

const CONFIDENCE_LABELS = { 1: "Not sure", 2: "Somewhat sure", 3: "Very sure" };

// Confidence Calibration Tracking — compares how sure a student SAID they
// felt about each quiz answer against how often they were actually right.
// The interesting failure mode isn't low accuracy, it's low accuracy at
// HIGH confidence — that's overconfidence, and it's invisible from a plain
// score alone.
function ConfidenceCalibration() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getConfidenceCalibration()
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data || data.total_logged < 3) return null;

  const overconfident = data.buckets.find((b) => b.confidence === 3 && b.accuracy < 60);

  return (
    <div className="bg-white rounded-xl2 shadow-card p-5">
      <h2 className="font-display text-sm font-bold text-ink/50 mb-3 flex items-center gap-2">
        <Gauge size={16} className="text-primary-500" /> Confidence calibration
      </h2>
      <div className="space-y-2">
        {data.buckets.map((b) => (
          <div key={b.confidence} className="flex items-center gap-3">
            <span className="text-xs font-bold text-ink/50 w-24 shrink-0">{CONFIDENCE_LABELS[b.confidence]}</span>
            <div className="flex-1 h-2.5 rounded-full bg-primary-50 overflow-hidden">
              <div
                className={`h-full rounded-full ${b.accuracy >= 70 ? "bg-mint-500" : b.accuracy >= 40 ? "bg-sun-400" : "bg-coral-500"}`}
                style={{ width: `${b.accuracy}%` }}
              />
            </div>
            <span className="text-xs font-bold text-ink/60 w-16 text-right shrink-0">
              {b.accuracy}% ({b.count})
            </span>
          </div>
        ))}
      </div>
      {overconfident && (
        <p className="text-xs font-semibold text-coral-600 mt-3">
          You said "very sure" but were only right {overconfident.accuracy}% of the time on those — worth
          double-checking answers that feel obvious before locking them in.
        </p>
      )}
    </div>
  );
}

// Personalized Mistake-Pattern Retrospective — a Gemini call, so it's
// button-triggered rather than auto-fetched on every dashboard load.
function MistakeRetrospective() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await getMistakePatterns();
      setResult(res);
    } catch (e) {
      toast.error(e.message || "Couldn't analyze your mistakes right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl2 shadow-card p-5">
      <h2 className="font-display text-sm font-bold text-ink/50 mb-3 flex items-center gap-2">
        <Brain size={16} className="text-coral-500" /> Mistake-pattern retrospective
      </h2>
      {!result ? (
        <>
          <p className="text-sm font-semibold text-ink/50 mb-3">
            Find the underlying habit behind your recent wrong quiz answers — not just which topics, but why.
          </p>
          <button
            onClick={analyze}
            disabled={loading}
            className="px-4 py-2 rounded-xl2 bg-primary-500 text-white font-bold text-sm shadow-soft hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Analyze my mistakes
          </button>
        </>
      ) : !result.has_pattern || !result.patterns?.length ? (
        <p className="text-sm font-semibold text-ink/50">{result.summary}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-ink/60">{result.summary}</p>
          {result.patterns.map((p, i) => (
            <div key={i} className="p-3 rounded-xl2 bg-coral-50">
              <p className="font-bold text-sm text-coral-700 mb-1">{p.pattern}</p>
              <p className="text-sm font-semibold text-ink/70 mb-1">{p.explanation}</p>
              <p className="text-xs font-bold text-mint-700">Try this: {p.fix}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InsightsPanel() {
  return (
    <div className="mb-8 grid sm:grid-cols-2 gap-4">
      <ConfidenceCalibration />
      <MistakeRetrospective />
    </div>
  );
}
