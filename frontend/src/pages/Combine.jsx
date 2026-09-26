import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Layers, Wand2, CheckSquare, Square, GitCompare, Loader2, AlertTriangle, HelpCircle } from "lucide-react";
import NavBar from "../components/NavBar";
import LevelSlider from "../components/LevelSlider";
import QuizCountSlider from "../components/QuizCountSlider";
import LanguageSelector from "../components/LanguageSelector";
import { useAuth } from "../context/AuthContext";
import { listNotes, combineNotes, getContradictions } from "../lib/api";

export default function Combine() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [level, setLevel] = useState("beginner");
  const [quizCount, setQuizCount] = useState(5);
  const [language, setLanguage] = useState("English");
  const [generating, setGenerating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  useEffect(() => {
    if (!user) return;
    listNotes(user.id)
      .then((res) => setNotes(res.notes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setCheckResult(null); // selection changed — stale results would be misleading
  };

  // Cross-Note Contradiction & Gap Detector — reads the selected notes side
  // by side and flags places where they disagree, or where one leans on a
  // term none of them actually explain. Separate from combining: this is
  // for catching inconsistencies BEFORE exam day, not for generating a
  // study kit.
  const checkContradictions = async () => {
    if (selected.length < 2) {
      toast.error("Pick at least 2 notes to compare.");
      return;
    }
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await getContradictions(selected);
      setCheckResult(res);
    } catch (e) {
      toast.error(e.message || "Couldn't compare those notes right now.");
    } finally {
      setChecking(false);
    }
  };

  const submit = async () => {
    if (selected.length < 2) {
      toast.error("Pick at least 2 notes to combine.");
      return;
    }
    setGenerating(true);
    try {
      const result = await combineNotes({ userId: user.id, noteIds: selected, level, quizCount, language });
      sessionStorage.setItem("notebuddy_last_result", JSON.stringify(result));
      toast.success("Combined study kit ready! +15 XP 🎉");
      navigate("/results", { state: { result } });
    } catch (e) {
      toast.error(e.message || "Couldn't combine those notes.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen blob-bg relative overflow-hidden">
      <div className="absolute top-20 -right-12 w-28 h-28 rounded-xl3 bg-sun-300/20 animate-float hidden md:block" />
      <NavBar />
      <div className="max-w-2xl mx-auto px-6 py-12 relative">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 text-primary-600 font-bold text-sm mb-2">
            <Layers size={16} /> Combine notes
          </div>
          <h1 className="font-display text-3xl font-extrabold mb-2">Study several notes at once</h1>
          <p className="text-ink/60 font-semibold mb-6">
            Pick 2 or more saved notes and NoteBuddy will build one combined summary, flashcard
            deck, and quiz across all of them — great before an exam covering multiple lectures.
          </p>

          {loading ? (
            <p className="text-ink/50 font-semibold">Loading your notes...</p>
          ) : notes.length < 2 ? (
            <div className="bg-white rounded-xl2 shadow-card p-8 text-center">
              <p className="font-bold text-ink/60 mb-1">You need at least 2 saved notes first</p>
              <p className="text-sm font-semibold text-ink/40">
                Make a couple of study kits, then come back here to combine them.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-6">
                {notes.map((n) => {
                  const isSelected = selected.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      onClick={() => toggle(n.id)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl2 border-2 text-left transition-all ${
                        isSelected
                          ? "bg-primary-50 border-primary-400"
                          : "bg-white border-primary-100 hover:border-primary-200"
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="text-primary-500 shrink-0" size={20} />
                      ) : (
                        <Square className="text-ink/30 shrink-0" size={20} />
                      )}
                      <div className="min-w-0">
                        <p className="font-bold truncate">{n.title}</p>
                        <p className="text-xs font-semibold text-ink/40">
                          {n.subject || "General"} &middot; {new Date(n.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="text-sm font-bold text-ink/70 mb-2">How should NoteBuddy explain it?</p>
              <LevelSlider value={level} onChange={setLevel} />

              <p className="text-sm font-bold text-ink/70 mb-2 mt-5">How many quiz questions?</p>
              <QuizCountSlider value={quizCount} onChange={setQuizCount} />

              <p className="text-sm font-bold text-ink/70 mb-2 mt-5">Language</p>
              <LanguageSelector value={language} onChange={setLanguage} />

              <button
                onClick={submit}
                disabled={generating || selected.length < 2}
                className="mt-8 w-full py-4 rounded-xl2 bg-primary-500 text-white font-bold text-lg shadow-pop hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    >
                      <Wand2 size={20} />
                    </motion.span>
                    Combining {selected.length} notes...
                  </>
                ) : (
                  <>
                    <Wand2 size={20} />
                    Combine {selected.length > 0 ? selected.length : ""} note
                    {selected.length === 1 ? "" : "s"}
                  </>
                )}
              </button>

              <button
                onClick={checkContradictions}
                disabled={checking || selected.length < 2}
                className="mt-3 w-full py-3 rounded-xl2 bg-white text-ink/70 font-bold text-sm shadow-card hover:text-primary-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {checking ? <Loader2 size={16} className="animate-spin" /> : <GitCompare size={16} />}
                Check these notes for contradictions & gaps
              </button>

              {checkResult && (
                <div className="mt-4 bg-white rounded-xl2 shadow-card p-5">
                  {checkResult.contradictions?.length === 0 && checkResult.gaps?.length === 0 ? (
                    <p className="text-sm font-semibold text-mint-700">{checkResult.summary}</p>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-ink/60 mb-4">{checkResult.summary}</p>
                      {checkResult.contradictions?.length > 0 && (
                        <div className="mb-4">
                          <h4 className="font-display text-sm font-bold text-coral-600 mb-2 flex items-center gap-1.5">
                            <AlertTriangle size={15} /> Contradictions
                          </h4>
                          <div className="space-y-2">
                            {checkResult.contradictions.map((c, i) => (
                              <div key={i} className="p-3 rounded-xl2 bg-coral-50">
                                <p className="font-bold text-sm text-coral-700">{c.topic}</p>
                                <p className="text-xs font-semibold text-ink/50 mb-1">
                                  {c.note_a} vs {c.note_b}
                                </p>
                                <p className="text-sm font-semibold text-ink/70">{c.issue}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {checkResult.gaps?.length > 0 && (
                        <div>
                          <h4 className="font-display text-sm font-bold text-sun-600 mb-2 flex items-center gap-1.5">
                            <HelpCircle size={15} /> Gaps
                          </h4>
                          <div className="space-y-2">
                            {checkResult.gaps.map((g, i) => (
                              <div key={i} className="p-3 rounded-xl2 bg-sun-50">
                                <p className="font-bold text-sm text-sun-700">{g.term}</p>
                                <p className="text-xs font-semibold text-ink/50 mb-1">{g.mentioned_in}</p>
                                <p className="text-sm font-semibold text-ink/70">{g.why_it_matters}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
