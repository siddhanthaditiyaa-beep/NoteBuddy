import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Loader2 } from "lucide-react";
import { getExamReadiness } from "../lib/api";
import { useAuth } from "../context/AuthContext";

// The single headline stat for the dashboard: one bold "you are X%
// exam-ready" number, combined from data the app already collects
// elsewhere (per-topic quiz accuracy + how overdue the flashcard deck
// is) — zero extra AI calls, pure arithmetic on the backend. Meant to be
// the first thing a judge/parent/student's eye lands on; everything else
// on the dashboard (XP, streak, weak topics) is supporting detail for
// this one number.
function readinessTone(score) {
  if (score >= 80) return { grad: "from-mint-400 to-mint-500", label: "Looking exam-ready" };
  if (score >= 55) return { grad: "from-sun-300 to-sun-400", label: "Getting there" };
  return { grad: "from-coral-400 to-coral-500", label: "Needs more review" };
}

export default function ExamReadinessCard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getExamReadiness(user.id)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="mb-8 bg-white rounded-xl2 shadow-card p-6 flex items-center gap-3 text-ink/30">
        <Loader2 size={18} className="animate-spin" /> Calculating exam readiness...
      </div>
    );
  }

  // No quiz history yet — a fabricated 0% (or a fake starting number)
  // would be actively misleading, so show an honest "answer a few
  // questions" prompt instead of a number with no signal behind it.
  if (!data || !data.ready) {
    return (
      <div className="mb-8 bg-white rounded-xl2 shadow-card p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl2 bg-primary-50 flex items-center justify-center text-primary-400 shrink-0">
          <GraduationCap size={26} />
        </div>
        <div>
          <p className="font-display font-bold text-ink/70">Your exam-readiness score</p>
          <p className="text-sm font-semibold text-ink/40">
            Answer a few practice quiz questions and this turns into a live readiness %.
          </p>
        </div>
      </div>
    );
  }

  const tone = readinessTone(data.score);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`mb-8 bg-gradient-to-br ${tone.grad} rounded-xl2 p-6 text-white shadow-soft relative overflow-hidden`}
    >
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 rounded-xl2 bg-white/20 flex items-center justify-center shrink-0">
          <GraduationCap size={30} />
        </div>
        <div className="min-w-0">
          <p className="font-display text-4xl font-extrabold leading-none tracking-tight">
            {data.score}% exam-ready
          </p>
          <p className="text-sm font-bold text-white/85 mt-1.5">{tone.label}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-white/80">
        <span>{data.accuracy_pct}% quiz accuracy</span>
        <span>·</span>
        <span>
          {data.due_count} of {data.total_cards} cards due for review
        </span>
        {data.weak_topics_count > 0 && (
          <>
            <span>·</span>
            <span>{data.weak_topics_count} weak topic{data.weak_topics_count === 1 ? "" : "s"}</span>
          </>
        )}
      </div>
    </motion.div>
  );
}
