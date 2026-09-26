import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { CalendarDays, Wand2, CheckSquare, Square, Sparkles, History, Trash2, Plus } from "lucide-react";
import NavBar from "../components/NavBar";
import { useAuth } from "../context/AuthContext";
import {
  listNotes,
  createStudyPlan,
  listStudyPlans,
  deleteStudyPlan,
  updateStudyPlanChecked,
} from "../lib/api";

// The one genuinely agentic feature in NoteBuddy: instead of one prompt in,
// one answer out, Gemini is handed tools (due flashcards, weak topics,
// note summaries) and decides for itself what to check and how to weigh it
// into a day-by-day plan — see backend/app/services/planner_service.py.
//
// Every generated plan is now saved server-side (see backend/app/routers/
// planner.py + supabase_client.py) instead of only ever living in this
// page's local state, which used to vanish the moment a student left the
// tab or refreshed. `activePlanId` tracks which saved row (if any) is on
// screen, so ticking a task can persist that change to the same row.
export default function Planner() {
  const { user } = useAuth();
  const [goal, setGoal] = useState("");
  const [notes, setNotes] = useState([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const [plan, setPlan] = useState(null);
  const [activePlanId, setActivePlanId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState({});
  const [pastPlans, setPastPlans] = useState([]);
  const [pastPlansOpen, setPastPlansOpen] = useState(true);

  const refreshPastPlans = () => {
    listStudyPlans().then((res) => setPastPlans(res.plans || [])).catch(() => {});
  };

  useEffect(() => {
    if (!user) return;
    listNotes(user.id).then((res) => setNotes(res.notes || [])).catch(() => {});
    refreshPastPlans();
  }, [user]);

  const toggleNote = (id) => {
    setSelectedNoteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleTask = (dayIdx, taskIdx) => {
    const key = `${dayIdx}-${taskIdx}`;
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Best-effort — a student's ticked-off progress is worth saving, but
      // shouldn't ever block or error out the actual checking-off gesture.
      if (activePlanId) updateStudyPlanChecked(activePlanId, next).catch(() => {});
      return next;
    });
  };

  const generate = async () => {
    if (goal.trim().length < 5) {
      toast.error('Tell NoteBuddy a bit more — e.g. "exam in 5 days, covering biology and history".');
      return;
    }
    setLoading(true);
    setChecked({});
    try {
      const res = await createStudyPlan({ goal: goal.trim(), noteIds: selectedNoteIds.length ? selectedNoteIds : undefined });
      setPlan(res.plan);
      setActivePlanId(res.id || null);
      refreshPastPlans();
    } catch (e) {
      toast.error(e.message || "Couldn't build a plan right now — try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const openPastPlan = (p) => {
    setPlan(p.plan);
    setChecked(p.checked || {});
    setActivePlanId(p.id);
    setGoal(p.goal || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startNewPlan = () => {
    setPlan(null);
    setActivePlanId(null);
    setChecked({});
    setGoal("");
    setSelectedNoteIds([]);
  };

  const removePastPlan = async (e, planId) => {
    e.stopPropagation();
    try {
      await deleteStudyPlan(planId);
      setPastPlans((prev) => prev.filter((p) => p.id !== planId));
      if (activePlanId === planId) startNewPlan();
      toast.success("Plan deleted.");
    } catch (err) {
      toast.error(err.message || "Couldn't delete that plan — try again.");
    }
  };

  return (
    <div className="min-h-screen blob-bg relative overflow-hidden">
      <NavBar />
      <div className="max-w-2xl mx-auto px-6 py-12 relative">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 text-primary-600 font-bold text-sm mb-2">
            <CalendarDays size={16} /> Adaptive Study Planner
          </div>
          <h1 className="font-display text-3xl font-extrabold mb-2">What are you preparing for?</h1>
          <p className="text-ink/60 font-semibold mb-6">
            Tell NoteBuddy your goal — it'll check what's due, what you're weak on, and build a day-by-day plan around it.
          </p>

          {pastPlans.length > 0 && (
            <div className="mb-6 bg-white rounded-xl2 shadow-card overflow-hidden">
              <button
                onClick={() => setPastPlansOpen((v) => !v)}
                className="w-full flex items-center justify-between p-4"
              >
                <span className="flex items-center gap-2 font-bold text-sm text-ink/70">
                  <History size={16} /> Your past plans ({pastPlans.length})
                </span>
                {activePlanId && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      startNewPlan();
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700"
                  >
                    <Plus size={14} /> New plan
                  </span>
                )}
              </button>
              {pastPlansOpen && (
                <div className="border-t border-primary-50 divide-y divide-primary-50 max-h-64 overflow-y-auto">
                  {pastPlans.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => openPastPlan(p)}
                      className={`w-full flex items-center justify-between gap-3 p-4 text-left transition-colors ${
                        activePlanId === p.id ? "bg-primary-50" : "hover:bg-primary-50/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-ink/80 truncate">{p.goal}</p>
                        <p className="text-xs font-semibold text-ink/40">
                          {(p.plan?.days || []).length} day{(p.plan?.days || []).length === 1 ? "" : "s"} ·{" "}
                          {p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}
                        </p>
                      </div>
                      <span
                        onClick={(e) => removePastPlan(e, p.id)}
                        className="p-2 rounded-xl2 text-ink/30 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                        title="Delete this plan"
                      >
                        <Trash2 size={16} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder='e.g. "Exam in 5 days, covering my Biology and History notes" or "Steady revision, no exam yet"'
            rows={3}
            className="w-full p-4 rounded-xl2 bg-white shadow-card outline-none font-semibold focus:ring-2 focus:ring-primary-300 mb-4"
          />

          {notes.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-bold text-ink/70 mb-2">Focus on specific notes (optional)</p>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {notes.map((n) => {
                  const isSelected = selectedNoteIds.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      onClick={() => toggleNote(n.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl2 border-2 text-left transition-all ${
                        isSelected ? "bg-primary-50 border-primary-400" : "bg-white border-primary-100 hover:border-primary-200"
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="text-primary-500 shrink-0" size={18} />
                      ) : (
                        <Square className="text-ink/30 shrink-0" size={18} />
                      )}
                      <span className="font-semibold text-sm truncate">{n.title}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs font-semibold text-ink/40 mt-1">Leave all unchecked to consider every saved note.</p>
            </div>
          )}

          <button
            onClick={generate}
            disabled={loading}
            className="w-full py-4 rounded-xl2 bg-primary-500 text-white font-bold text-lg shadow-pop hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <Wand2 size={20} />
                </motion.span>
                Building your plan...
              </>
            ) : (
              <>
                <Wand2 size={20} /> Build my study plan
              </>
            )}
          </button>

          {plan && (
            <div className="mt-8 space-y-4">
              {plan.reasoning && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl2 bg-primary-50 text-sm font-semibold text-primary-700">
                  <Sparkles size={16} className="shrink-0 mt-0.5" />
                  {plan.reasoning}
                </div>
              )}
              {(plan.days || []).map((day, di) => (
                <div key={di} className="bg-white rounded-xl2 shadow-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-display font-bold text-lg">{day.day_label}</p>
                    <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
                      {day.focus}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(day.tasks || []).map((task, ti) => {
                      const key = `${di}-${ti}`;
                      const done = !!checked[key];
                      return (
                        <button
                          key={ti}
                          onClick={() => toggleTask(di, ti)}
                          className="w-full flex items-center gap-3 text-left"
                        >
                          {done ? (
                            <CheckSquare className="text-mint-500 shrink-0" size={18} />
                          ) : (
                            <Square className="text-ink/30 shrink-0" size={18} />
                          )}
                          <span className={`text-sm font-semibold ${done ? "line-through text-ink/30" : "text-ink/80"}`}>
                            {task}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
