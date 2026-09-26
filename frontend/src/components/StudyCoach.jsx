import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Compass, Sparkles, Loader2, ArrowRight, Brain, FileText, GraduationCap, PenLine, ListTodo, CalendarDays, Upload } from "lucide-react";
import { getStudyCoachAdvice } from "../lib/api";

// Maps the agent's chosen "feature" to something clickable. exam_twin,
// teach_back and practice live inside a specific saved note's Results
// page rather than at their own URL, so those point at the dashboard
// (where the student picks the note) instead of a dead link.
const FEATURE_META = {
  review: { label: "Go review", to: "/review", icon: Brain },
  exam_twin: { label: "Open a note → Exam Twin tab", to: "/dashboard", icon: FileText },
  teach_back: { label: "Open a note → Teach It Back tab", to: "/dashboard", icon: GraduationCap },
  practice: { label: "Open a note → Practice tab", to: "/dashboard", icon: PenLine },
  syllabus_gap: { label: "Check syllabus coverage", to: "/dashboard", icon: ListTodo },
  planner: { label: "Build a study plan", to: "/planner", icon: CalendarDays },
  upload: { label: "Make a new study kit", to: "/upload", icon: Upload },
};

// The Study Coach Agent — an agentic feature (Gemini decides which of its
// own data-lookup tools to call before diagnosing anything), not a canned
// tip generator. Companion to the Adaptive Study Planner: the Planner
// turns a goal into a schedule, the Coach reads your actual current state
// and tells you what to do right now.
export default function StudyCoach() {
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState(null);

  const ask = async () => {
    setLoading(true);
    try {
      const res = await getStudyCoachAdvice(goal);
      setAdvice(res);
    } catch (e) {
      toast.error(e.message || "Your study coach couldn't put together advice right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl2 shadow-card p-5">
      <h2 className="font-display text-sm font-bold text-ink/50 mb-3 flex items-center gap-2">
        <Compass size={16} className="text-primary-500" /> Study Coach
      </h2>

      {!advice ? (
        <>
          <p className="text-sm font-semibold text-ink/50 mb-3">
            An AI agent that actually checks your weak topics, due reviews, and mistake history before telling you
            what to do next — not generic advice.
          </p>
          <div className="flex gap-2">
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="Optional: 'exam Friday on Chemistry'..."
              className="flex-1 px-3 py-2 rounded-xl2 bg-primary-50 shadow-card outline-none font-semibold text-sm focus:ring-2 focus:ring-primary-300"
            />
            <button
              onClick={ask}
              disabled={loading}
              className="px-4 py-2 rounded-xl2 bg-primary-500 text-white font-bold text-sm shadow-soft hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center gap-2 shrink-0"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Ask my coach
            </button>
          </div>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm font-semibold text-ink/70 mb-4">{advice.diagnosis}</p>
          <div className="space-y-2 mb-3">
            {advice.actions?.map((a, i) => {
              const meta = FEATURE_META[a.feature] || { label: "Take a look", to: "/dashboard", icon: ArrowRight };
              const Icon = meta.icon;
              return (
                <div key={i} className="p-3 rounded-xl2 bg-primary-50">
                  <p className="font-bold text-sm text-primary-700 mb-0.5">{a.action}</p>
                  <p className="text-xs font-semibold text-ink/50 mb-2">{a.why}</p>
                  <Link to={meta.to} className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1 w-fit">
                    <Icon size={12} /> {meta.label}
                  </Link>
                </div>
              );
            })}
          </div>
          {advice.encouragement && <p className="text-xs font-semibold text-mint-700 mb-3">{advice.encouragement}</p>}
          <button
            onClick={() => setAdvice(null)}
            className="text-xs font-bold text-ink/40 hover:text-primary-600 transition-colors"
          >
            Ask again
          </button>
        </motion.div>
      )}
    </div>
  );
}
