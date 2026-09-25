import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { getClassHeatmap } from "../lib/api";

// Anonymized class-wide weak-spot heatmap — aggregate miss rates per topic
// across every student using the app, never anything about an individual
// (the backend only ever includes a topic once at least a few distinct
// students have answered questions on it). Shows a student they're not
// alone in what they're struggling with.
export default function ClassHeatmap() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    getClassHeatmap()
      .then((res) => setRows(res.heatmap || []))
      .catch(() => setRows([]));
  }, []);

  if (rows === null || rows.length === 0) return null;

  return (
    <div className="bg-white rounded-xl2 shadow-card p-5">
      <h2 className="font-display text-sm font-bold text-ink/50 mb-1 flex items-center gap-2">
        <Flame size={16} className="text-coral-500" /> What everyone's struggling with
      </h2>
      <p className="text-xs font-semibold text-ink/40 mb-3">
        Anonymized across every student on NoteBuddy — you're not the only one finding these tricky.
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.term} className="flex items-center gap-3">
            <span className="text-xs font-bold text-ink/60 w-28 truncate shrink-0" title={r.term}>
              {r.term}
            </span>
            <div className="flex-1 h-2.5 rounded-full bg-primary-50 overflow-hidden">
              <div
                className={`h-full rounded-full ${r.miss_rate >= 60 ? "bg-coral-500" : r.miss_rate >= 35 ? "bg-sun-400" : "bg-mint-500"}`}
                style={{ width: `${r.miss_rate}%` }}
              />
            </div>
            <span className="text-xs font-bold text-ink/50 w-24 text-right shrink-0">
              {r.miss_rate}% miss ({r.student_count})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
