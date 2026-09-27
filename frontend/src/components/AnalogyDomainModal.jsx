import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { Sparkles, X, Loader2, Check } from "lucide-react";
import { getAnalogyDomain, setAnalogyDomain } from "../lib/api";

// Presets cover the most common "explain it through ___" requests, but the
// text field always stays open for anything else a student wants.
const PRESETS = ["Cricket", "Football", "Gaming", "Cooking", "Movies", "Music"];

// Personalized Analogy Domain — set once here, threaded into every
// explanation-shaped prompt across the app (summary/regen, tutor chat,
// Teach-Back feedback, "explain differently") so those explanations lean
// on analogies from something the student already understands.
export default function AnalogyDomainModal({ open, onClose }) {
  const [domain, setDomain] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getAnalogyDomain()
      .then((res) => {
        setDomain(res.domain || "");
        setSaved(res.domain || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const save = async (value) => {
    const next = (value ?? domain).trim();
    setSaving(true);
    try {
      await setAnalogyDomain(next || null);
      setSaved(next);
      setDomain(next);
      toast.success(next ? `Explanations will now lean on ${next} analogies.` : "Analogy preference cleared.");
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
              <p className="text-sm font-semibold text-ink/60 mb-4">
                Tell NoteBuddy what you understand best through, and it'll reach for analogies from that everywhere —
                summaries, tutor chat, Teach-Back feedback, "explain differently."
              </p>

              {loading ? (
                <div className="py-4 flex justify-center text-ink/30">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => save(p)}
                        disabled={saving}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-60 ${
                          saved === p ? "bg-primary-500 text-white" : "bg-primary-50 text-primary-600 hover:bg-primary-100"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="e.g. cricket, gardening, anime..."
                      className="flex-1 px-3 py-2.5 rounded-xl2 bg-primary-50 outline-none font-semibold text-sm focus:ring-2 focus:ring-primary-300"
                    />
                    <button
                      onClick={() => save()}
                      disabled={saving}
                      className="px-4 rounded-xl2 bg-primary-500 text-white font-bold text-sm hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center justify-center shrink-0"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                  </div>
                  {saved && (
                    <button
                      onClick={() => save("")}
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
