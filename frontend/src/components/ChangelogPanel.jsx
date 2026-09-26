import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { CHANGELOG } from "../lib/changelog";

export default function ChangelogPanel({ open, onClose }) {
  return (
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
          {/* Centering wrapper kept separate from the animated card: framer-motion
              writes its own inline `transform` from the animate={{ y, scale }} prop,
              which silently replaces (not merges with) Tailwind's translate-x/y
              centering classes — that was pinning this panel to the exact center
              *point* of the screen with no offset, so it rendered stretching off
              the right edge on narrow phones instead of centered. Centering via
              flexbox here needs no transform, so it can't collide with framer's. */}
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
              aria-label="What's new in NoteBuddy"
              className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-white rounded-xl2 shadow-pop p-5 sm:p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2">
                  <Sparkles size={18} className="text-primary-500 shrink-0" /> What's new
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-8 h-8 rounded-xl2 bg-primary-50 flex items-center justify-center text-ink/50 hover:text-primary-600 transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-6">
                {CHANGELOG.map((entry) => (
                  <div key={entry.version}>
                    <p className="text-xs font-bold text-ink/40 mb-2">{entry.date}</p>
                    <ul className="space-y-1.5">
                      {entry.items.map((item, i) => (
                        <li key={i} className="text-sm font-semibold text-ink/70 flex gap-2">
                          <span className="text-primary-400 shrink-0">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
