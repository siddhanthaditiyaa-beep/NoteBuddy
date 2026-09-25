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
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-label="What's new in NoteBuddy"
            className="fixed z-[61] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md max-h-[80vh] overflow-y-auto bg-white rounded-xl2 shadow-pop p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Sparkles size={18} className="text-primary-500" /> What's new
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-xl2 bg-primary-50 flex items-center justify-center text-ink/50 hover:text-primary-600 transition-colors"
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
        </>
      )}
    </AnimatePresence>
  );
}
