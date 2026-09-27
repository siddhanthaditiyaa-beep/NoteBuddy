import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { Sparkles, X, Loader2, Check } from "lucide-react";
import { getAnalogyDomain, setAnalogyDomain } from "../lib/api";

// Presets cover the most common "explain it through ___" requests, but the
// text field always stays open for anything else a student wants.
const PRESETS = ["Cricket", "Football", "Gaming", "Cooking", "Movies", "Music"];
const MAX_DOMAINS = 3;

// Personalized Analogy Domain — pick 1-3 things here, threaded into every
// explanation-shaped prompt across the app (summary/regen, tutor chat,
// Teach-Back feedback, "explain differently") so those explanations mix
// analogies from whichever of these a student actually recognizes. Most
// people know more than one thing (a sport AND gaming, say), so this isn't
// locked to a single choice the way it used to be.
export default function AnalogyDomainModal({ open, onClose }) {
  const [selected, setSelected] = useState([]);
  const [savedSelected, setSavedSelected] = useState([]);
  const [customInput, setCustomInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getAnalogyDomain()
      .then((res) => {
        const domains = res.domains || (res.domain ? res.domain.split(",").map((d) => d.trim()).filter(Boolean) : []);
        setSelected(domains);
        setSavedSelected(domains);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const isDirty = JSON.stringify(selected) !== JSON.stringify(savedSelected);

  const toggle = (value) => {
    setSelected((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (prev.length >= MAX_DOMAINS) {
        toast(`You can pick up to ${MAX_DOMAINS} — remove one first.`, { icon: "✨" });
        return prev;
      }
      return [...prev, value];
    });
  };

  const addCustom = () => {
    const value = customInput.trim();
    if (!value) return;
    if (selected.some((v) => v.toLowerCase() === value.toLowerCase())) {
      setCustomInput("");
      return;
    }
    if (selected.length >= MAX_DOMAINS) {
      toast(`You can pick up to ${MAX_DOMAINS} — remove one first.`, { icon: "✨" });
      return;
    }
    setSelected((prev) => [...prev, value]);
    setCustomInput("");
  };

  const save = async (next = selected) => {
    setSaving(true);
    try {
      await setAnalogyDomain(next);
      setSelected(next);
      setSavedSelected(next);
      if (next.length === 0) {
        toast.success("Analogy preference cleared.");
      } else {
        toast.success(`Explanations will now mix in ${next.join(", ")} analogies.`);
      }
    } catch (e) {
      toast.error(e.message || "Couldn't save that right now.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/30 z-[60]"
          />
          <div
            className="fixed inset-0 z-[61] flex items-center justify-center p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Personalize explanations"
              className="w-full max-w-sm bg-white rounded-xl2 shadow-pop p-5 sm:p-6 max-h-[85dvh] overflow-y-auto overscroll-contain"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl2 bg-primary-50 flex items-center justify-center text-primary-500 shrink-0">
                  <Sparkles size={22} />
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-8 h-8 rounded-xl2 bg-primary-50 flex items-center justify-center text-ink/50 hover:text-primary-600 transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
              <h2 className="font-display text-lg font-bold mb-2">Personalize explanations</h2>
              <p className="text-sm font-semibold text-ink/60 mb-1">
                Pick 1-3 things you understand best, and NoteBuddy will mix in analogies from them —
                summaries, tutor chat, Teach-Back feedback, "explain differently."
              </p>
              <p className="text-xs font-bold text-primary-500 mb-4">
                {selected.length}/{MAX_DOMAINS} selected
              </p>

              {loading ? (
                <div className="py-4 flex justify-center text-ink/30">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {PRESETS.map((preset) => {
                      const active = selected.includes(preset);
                      const disabled = !active && selected.length >= MAX_DOMAINS;
                      return (
                        <button
                          key={preset}
                          onClick={() => toggle(preset)}
                          disabled={saving || disabled}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-40 ${
                            active ? "bg-primary-500 text-white" : "bg-primary-50 text-primary-600 hover:bg-primary-100"
                          }`}
                        >
                          {active && <Check size={11} className="inline mr-1 -mt-0.5" />}
                          {preset}
                        </button>
                      );
                    })}
                  </div>

                  {/* Any custom (non-preset) domains the student has picked, shown as removable chips */}
                  {selected.filter((v) => !PRESETS.includes(v)).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selected.filter((v) => !PRESETS.includes(v)).map((v) => (
                        <button
                          key={v}
                          onClick={() => toggle(v)}
                          disabled={saving}
                          className="px-3 py-1.5 rounded-full text-xs font-bold bg-primary-500 text-white flex items-center gap-1 disabled:opacity-60"
                        >
                          {v} <X size={11} />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustom();
                        }
                      }}
                      placeholder="e.g. anime, gardening..."
                      disabled={selected.length >= MAX_DOMAINS}
                      className="flex-1 px-3 py-2.5 rounded-xl2 bg-primary-50 outline-none font-semibold text-sm focus:ring-2 focus:ring-primary-300 disabled:opacity-50"
                    />
                    <button
                      onClick={addCustom}
                      disabled={saving || !customInput.trim() || selected.length >= MAX_DOMAINS}
                      className="px-4 rounded-xl2 bg-primary-50 text-primary-600 font-bold text-sm hover:bg-primary-100 disabled:opacity-40 transition-colors shrink-0"
                    >
                      Add
                    </button>
                  </div>

                  <button
                    onClick={() => save()}
                    disabled={saving || !isDirty || selected.length === 0}
                    className="w-full mt-4 py-2.5 rounded-xl2 bg-primary-500 text-white font-bold text-sm hover:bg-primary-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Save
                  </button>

                  {savedSelected.length > 0 && (
                    <button
                      onClick={() => save([])}
                      disabled={saving}
                      className="mt-3 text-xs font-bold text-ink/40 hover:text-coral-500 transition-colors"
                    >
                      Clear preference
                    </button>
                  )}
                </>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
