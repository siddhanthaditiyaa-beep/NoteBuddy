import { useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { FolderTree, Sparkles, Loader2, Tag, Layers, AlertTriangle, Check } from "lucide-react";
import { runNoteOrganizer, applyNoteSubject } from "../lib/api";

// The Note-Organizer Agent — an agentic feature: Gemini decides for itself
// which pairs of notes are related enough to be worth a full contradiction
// check (never a brute-force sweep), then suggests subject-tag fixes and
// combine candidates from what it actually found, not from a fixed script.
export default function NoteOrganizer() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [appliedIds, setAppliedIds] = useState(new Set());

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await runNoteOrganizer();
      setResult(res);
    } catch (e) {
      toast.error(e.message || "Your note organizer couldn't finish its analysis right now.");
    } finally {
      setLoading(false);
    }
  };

  const apply = async (noteId, subject) => {
    try {
      await applyNoteSubject(noteId, subject);
      setAppliedIds((prev) => new Set(prev).add(noteId));
      toast.success(`Retagged as "${subject}"`);
    } catch (e) {
      toast.error(e.message || "Couldn't apply that subject.");
    }
  };

  const nothingToShow =
    result &&
    (result.suggested_subjects?.length ?? 0) === 0 &&
    (result.suggested_combines?.length ?? 0) === 0 &&
    (result.contradictions?.length ?? 0) === 0;

  return (
    <div className="bg-white rounded-xl2 shadow-card p-5">
      <h2 className="font-display text-sm font-bold text-ink/50 mb-3 flex items-center gap-2">
        <FolderTree size={16} className="text-primary-500" /> Note Organizer
      </h2>

      {!result ? (
        <>
          <p className="text-sm font-semibold text-ink/50 mb-3">
            An AI agent that looks over all your saved notes, decides which ones are worth a closer comparison, and
            suggests subject-tag fixes, combine candidates, and contradictions — without checking every possible
            pair.
          </p>
          <button
            onClick={analyze}
            disabled={loading}
            className="px-4 py-2 rounded-xl2 bg-primary-500 text-white font-bold text-sm shadow-soft hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Organize my notes
          </button>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm font-semibold text-ink/70 mb-4">{result.summary}</p>

          {nothingToShow && (
            <p className="text-xs font-semibold text-mint-700 mb-3">Everything already looks tidy and consistent!</p>
          )}

          {result.suggested_subjects?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold text-ink/40 uppercase mb-2 flex items-center gap-1">
                <Tag size={12} /> Suggested subject fixes
              </p>
              <div className="space-y-2">
                {result.suggested_subjects.map((s, i) => (
                  <div key={i} className="p-3 rounded-xl2 bg-primary-50/50 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-primary-700">{s.note_title}</p>
                      <p className="text-xs font-semibold text-ink/50">
                        {s.current_subject} → <span className="text-primary-600">{s.suggested_subject}</span>
                      </p>
                      <p className="text-xs text-ink/40">{s.why}</p>
                    </div>
                    {appliedIds.has(s.note_id) ? (
                      <span className="text-xs font-bold text-mint-600 flex items-center gap-1 shrink-0">
                        <Check size={12} /> Applied
                      </span>
                    ) : (
                      <button
                        onClick={() => apply(s.note_id, s.suggested_subject)}
                        className="px-3 py-1.5 rounded-xl2 bg-primary-500 text-white text-xs font-bold shrink-0 hover:bg-primary-600 transition-colors"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.suggested_combines?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold text-ink/40 uppercase mb-2 flex items-center gap-1">
                <Layers size={12} /> Candidates to combine
              </p>
              <div className="space-y-2">
                {result.suggested_combines.map((c, i) => (
                  <div key={i} className="p-3 rounded-xl2 bg-sun-50/60">
                    <p className="font-bold text-sm text-ink/70">{c.note_titles?.join(" + ")}</p>
                    <p className="text-xs font-semibold text-ink/50">{c.why}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.contradictions?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-bold text-ink/40 uppercase mb-2 flex items-center gap-1">
                <AlertTriangle size={12} /> Contradictions found
              </p>
              <div className="space-y-2">
                {result.contradictions.map((c, i) => (
                  <div key={i} className="p-3 rounded-xl2 bg-coral-50/60">
                    <p className="font-bold text-sm text-ink/70">{c.note_titles?.join(" vs. ")}</p>
                    <p className="text-xs font-semibold text-ink/50">{c.issue}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setResult(null);
              setAppliedIds(new Set());
            }}
            className="text-xs font-bold text-ink/40 hover:text-primary-600 transition-colors"
          >
            Run again
          </button>
        </motion.div>
      )}
    </div>
  );
}
