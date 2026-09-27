import { useEffect, useState } from "react";
import { Globe2, Quote } from "lucide-react";
import { getHardestQuestions } from "../lib/api";

// Global, anonymized "hardest questions" databank — extends the class
// heatmap's per-topic miss rates one level further with a real (anonymized)
// example question per topic, and lets a student scope it to one of their
// own subjects. A genuine network effect: it gets smarter the more
// students use the app, at no extra AI cost since it's pure aggregation
// over quiz answers already being logged for other features.
export default function HardestQuestionsPanel({ subjects = [] }) {
  const [subject, setSubject] = useState(null);
  const [rows, setRows] = useState(null);

  useEffect(() => {
    setRows(null);
    getHardestQuestions(subject)
      .then((res) => setRows(res.topics || []))
      .catch(() => setRows([]));
  }, [subject]);

  if (rows !== null && rows.length === 0 && !subject) return null;

  return (
    <div className="bg-white rounded-xl2 shadow-card p-5">
      <h2 className="font-display text-sm font-bold text-ink/50 mb-1 flex items-center gap-2">
        <Globe2 size={16} className="text-primary-500" /> Hardest questions, across every NoteBuddy student
      </h2>
      <p className="text-xs font-semibold text-ink/40 mb-3">
        Anonymized and only shown once a handful of different students have hit a topic — never anything about one
        person.
      </p>

      {subjects.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setSubject(null)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
              !subject ? "bg-primary-500 text-white" : "bg-primary-50 text-ink/60"
            }`}
          >
            All subjects
          </button>
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                subject === s ? "bg-primary-500 text-white" : "bg-primary-50 text-ink/60"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {rows === null ? (
        <p className="text-xs font-semibold text-ink/30 py-2">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-xs font-semibold text-ink/40 py-2">
          Not enough students have answered questions on {subject ? `${subject} ` : ""}yet to show this anonymized.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.topic} className="p-3 rounded-xl2 bg-primary-50">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-sm font-bold text-ink/70">{r.topic}</span>
                <span className="text-xs font-bold text-coral-600 shrink-0">
                  {r.miss_rate}% miss · {r.student_count} students
                </span>
              </div>
              {r.example_question && (
                <p className="text-xs font-semibold text-ink/50 flex items-start gap-1.5">
                  <Quote size={12} className="mt-0.5 shrink-0" />
                  {r.example_question}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
