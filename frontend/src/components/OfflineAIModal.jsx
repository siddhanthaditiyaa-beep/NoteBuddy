import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { WifiOff, X, Download, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import { isWebGPUSupported, isOfflineModelReady, initOfflineModel, unloadOfflineModel } from "../lib/offlineAI";

export default function OfflineAIModal({ open, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [ready, setReady] = useState(isOfflineModelReady());
  const supported = isWebGPUSupported();

  const download = async () => {
    setDownloading(true);
    setProgress(0);
    try {
      await initOfflineModel(({ progress: p, text }) => {
        setProgress(p);
        setProgressText(text);
      });
      setReady(true);
      toast.success("Offline AI is ready — chat and flashcard explanations will keep working without internet.");
    } catch (e) {
      toast.error(e.message || "Couldn't download the offline model right now.");
    } finally {
      setDownloading(false);
    }
  };

  const remove = () => {
    unloadOfflineModel();
    setReady(false);
    toast.success("Offline AI removed.");
  };

  // Portalled to <body> — NavBar's <nav> uses backdrop-blur-md, and a
  // backdrop-filter on an ancestor becomes the containing block for any
  // `position: fixed` descendant. Left un-portalled, this modal's overlay
  // was being sized against the nav bar's own strip instead of the real
  // viewport, which is what "goes beyond the chrome tab" actually was.
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
          {/* See ChangelogPanel for why centering has to happen here, via flexbox,
              rather than with left-1/2/top-1/2 + translate on the motion.div itself:
              framer-motion's own inline transform (from animate={{ y, scale }})
              overwrites any Tailwind translate classes on the same element. */}
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
              aria-label="Offline AI"
              className="w-full max-w-sm bg-white rounded-xl2 shadow-pop p-5 sm:p-6 max-h-[85dvh] overflow-y-auto overscroll-contain"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl2 bg-primary-50 flex items-center justify-center text-primary-500 shrink-0">
                  <WifiOff size={22} />
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-8 h-8 rounded-xl2 bg-primary-50 flex items-center justify-center text-ink/50 hover:text-primary-600 transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
              <h2 className="font-display text-lg font-bold mb-2">Offline AI</h2>

            {!supported ? (
              <p className="text-sm font-semibold text-ink/60">
                Your browser doesn't support WebGPU, which offline AI needs to run a model on-device — try a recent
                version of Chrome or Edge instead.
              </p>
            ) : ready ? (
              <>
                <p className="text-sm font-semibold text-mint-700 mb-4 flex items-center gap-1.5">
                  <CheckCircle2 size={16} /> Offline AI is downloaded and ready.
                </p>
                <p className="text-xs font-semibold text-ink/50 mb-4">
                  When you lose your connection, chat and "explain it differently" will keep working, answered
                  entirely on this device — nothing is sent anywhere.
                </p>
                <button
                  onClick={remove}
                  className="w-full py-2.5 rounded-xl2 bg-coral-50 text-coral-600 font-bold text-sm hover:bg-coral-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} /> Remove offline model
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-ink/60 mb-4">
                  Downloads a small AI model (a few hundred MB, one-time) that runs entirely in your browser — no
                  server, no internet needed afterward. Best done on Wi-Fi.
                </p>
                {downloading ? (
                  <div>
                    <div className="h-2 rounded-full bg-primary-50 overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full bg-primary-500 transition-all"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs font-semibold text-ink/40 flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" /> {progressText || "Starting download..."}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={download}
                    className="w-full py-2.5 rounded-xl2 bg-primary-500 text-white font-bold text-sm hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download size={14} /> Download offline AI
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
