import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowRight, ArrowLeft, SkipForward } from "lucide-react";
import { useTour } from "../context/TourContext";

const PAD = 10; // breathing room around the highlighted element

export default function Spotlight() {
  const tour = useTour();
  const [rect, setRect] = useState(null);
  const pollRef = useRef(null);

  const { active, step } = tour || {};

  // The tour just navigated to a new route, so the target element may not
  // exist in the DOM yet (page still rendering, data still loading). Poll
  // for it instead of assuming it's there immediately.
  useEffect(() => {
    setRect(null);
    if (!active || !step) return;

    clearInterval(pollRef.current);
    let attempts = 0;

    const locate = () => {
      const el = document.querySelector(step.selector);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // give scrollIntoView a beat to finish before measuring
        setTimeout(() => {
          const r = el.getBoundingClientRect();
          setRect({
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
          });
        }, 250);
        clearInterval(pollRef.current);
      } else {
        attempts += 1;
        if (attempts > 40) clearInterval(pollRef.current); // ~10s, give up gracefully
      }
    };

    locate();
    pollRef.current = setInterval(locate, 250);

    const onScroll = () => {
      const el = document.querySelector(step.selector);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);

    return () => {
      clearInterval(pollRef.current);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [active, step]);

  if (!active || !step) return null;

  const highlightBox = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Darkened backdrop with a cutout around the target, via the
          box-shadow trick: a huge spread on a transparent box punches a
          hole exactly where the target element is. */}
      <AnimatePresence>
        {highlightBox ? (
          <motion.div
            key={step.selector}
            className="absolute rounded-2xl pointer-events-none"
            style={{
              top: highlightBox.top,
              left: highlightBox.left,
              width: highlightBox.width,
              height: highlightBox.height,
              boxShadow: "0 0 0 9999px rgba(15,15,30,0.72)",
              border: "3px solid #7C5CFC",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          />
        ) : (
          // Target not found yet (or ever) — still dim the page so the
          // tooltip below is readable, just without a cutout.
          <motion.div
            className="absolute inset-0 bg-ink/60 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* A ring of pointer-events:auto around the cutout would be complex;
          simplest robust approach is to let clicks pass through everywhere
          except the tooltip card, so the person can directly click the
          highlighted real element to try it. */}

      <TourCard tour={tour} step={step} anchorRect={highlightBox} />
    </div>
  );
}

const CARD_WIDTH = 340;
const MARGIN = 16;

function TourCard({ tour, step, anchorRect }) {
  const { stepIndex, total, next, back, skip } = tour;
  const cardRef = useRef(null);
  // Start off-screen (not visible) until we've measured the card's real
  // height and can place it fully inside the viewport — otherwise the
  // Next/Skip buttons can end up clipped below the fold.
  const [pos, setPos] = useState(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const place = () => {
      const cardH = el.offsetHeight;
      const cardW = el.offsetWidth || CARD_WIDTH;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let top;
      let left;

      if (anchorRect) {
        const spaceBelow = vh - (anchorRect.top + anchorRect.height);
        const spaceAbove = anchorRect.top;
        if (spaceBelow >= cardH + MARGIN + 20) {
          top = anchorRect.top + anchorRect.height + 20;
        } else if (spaceAbove >= cardH + MARGIN + 20) {
          top = anchorRect.top - cardH - 20;
        } else {
          // Neither side has room — pin to whichever edge fits best.
          top = spaceBelow > spaceAbove ? vh - cardH - MARGIN : MARGIN;
        }
        left = anchorRect.left;
      } else {
        top = vh - cardH - MARGIN - 24;
        left = (vw - cardW) / 2;
      }

      // Always clamp fully inside the viewport, however it was computed.
      top = Math.min(Math.max(top, MARGIN), vh - cardH - MARGIN);
      left = Math.min(Math.max(left, MARGIN), vw - cardW - MARGIN);

      setPos({ top, left });
    };

    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchorRect, step]);

  const style = pos
    ? { position: "fixed", top: pos.top, left: pos.left }
    : { position: "fixed", top: -9999, left: -9999 }; // measure off-screen first

  return (
    <motion.div
      key={stepIndex}
      ref={cardRef}
      style={{ ...style, width: CARD_WIDTH, maxWidth: "calc(100vw - 32px)" }}
      className="pointer-events-auto bg-white rounded-xl2 shadow-pop p-5 z-[101]"
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: pos ? 1 : 0, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-display font-extrabold text-lg text-ink leading-snug">{step.title}</h3>
        <button
          onClick={skip}
          className="text-ink/30 hover:text-ink/60 transition-colors shrink-0 -mt-1 -mr-1"
          title="Skip tutorial"
        >
          <X size={18} />
        </button>
      </div>
      <p className="text-sm font-semibold text-ink/60 leading-relaxed mb-4">{step.body}</p>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIndex ? "w-5 bg-primary-500" : "w-1.5 bg-primary-100"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              onClick={back}
              className="p-2 rounded-xl2 text-ink/50 hover:bg-primary-50 hover:text-primary-600 transition-colors"
              title="Back"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <button
            onClick={skip}
            className="text-xs font-bold text-ink/40 hover:text-ink/60 transition-colors flex items-center gap-1 px-2"
          >
            <SkipForward size={13} /> Skip
          </button>
          <button
            onClick={next}
            className="px-4 py-2 rounded-xl2 bg-primary-500 text-white font-bold text-sm shadow-soft hover:bg-primary-600 transition-colors flex items-center gap-1"
          >
            {step.isLast ? "Let's go" : "Next"}
            {!step.isLast && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
