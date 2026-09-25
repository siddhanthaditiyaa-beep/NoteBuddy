import { useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, RotateCw, Lightbulb, Loader2 } from "lucide-react";
import { explainDifferently } from "../lib/api";

export default function FlashcardDeck({ cards = [], rawText = "" }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [altExplanation, setAltExplanation] = useState(null); // { cardIndex, text } | null
  const [explaining, setExplaining] = useState(false);

  if (!cards.length) return null;
  const card = cards[index];

  const go = (dir) => {
    setFlipped(false);
    setAltExplanation(null);
    setIndex((i) => (i + dir + cards.length) % cards.length);
  };

  const handleExplainDifferently = async (e) => {
    e.stopPropagation(); // don't also flip the card back over
    if (explaining) return;
    setExplaining(true);
    try {
      const res = await explainDifferently({
        contextText: rawText,
        concept: `${card.front}\n${card.back}`,
      });
      setAltExplanation({ cardIndex: index, text: res.explanation });
    } catch (err) {
      toast.error(err.message || "Couldn't get another explanation right now.");
    } finally {
      setExplaining(false);
    }
  };

  const showingAlt = altExplanation?.cardIndex === index;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="text-sm font-bold text-ink/50">
        Card {index + 1} of {cards.length} — tap to flip
      </div>

      <div className="w-full max-w-md h-64 [perspective:1200px]">
        <motion.div
          className="relative w-full h-full cursor-pointer"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5 }}
          onClick={() => setFlipped((f) => !f)}
          role="button"
          tabIndex={0}
          aria-label={flipped ? "Showing answer — press Enter to flip back" : "Showing question — press Enter to reveal answer"}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFlipped((f) => !f);
            }
          }}
        >
          <div
            className="absolute inset-0 rounded-xl3 bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-pop flex items-center justify-center p-8 text-center [backface-visibility:hidden]"
          >
            <p className="font-display font-bold text-xl">{card.front}</p>
          </div>
          <div
            className="absolute inset-0 rounded-xl3 bg-gradient-to-br from-mint-400 to-mint-500 text-white shadow-pop flex flex-col items-center justify-center p-8 text-center gap-3 [backface-visibility:hidden]"
            style={{ transform: "rotateY(180deg)" }}
          >
            {showingAlt ? (
              <p className="font-semibold text-base leading-snug">{altExplanation.text}</p>
            ) : (
              <p className="font-bold text-lg">{card.back}</p>
            )}
            {rawText && (
              <button
                onClick={handleExplainDifferently}
                disabled={explaining}
                className="mt-1 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-60"
              >
                {explaining ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Thinking...
                  </>
                ) : (
                  <>
                    <Lightbulb size={12} /> {showingAlt ? "One more way" : "Explain it differently"}
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => go(-1)}
          aria-label="Previous flashcard"
          className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center hover:bg-primary-50 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => setFlipped((f) => !f)}
          aria-label="Flip flashcard"
          className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center hover:bg-primary-50 transition-colors"
        >
          <RotateCw size={16} />
        </button>
        <button
          onClick={() => go(1)}
          aria-label="Next flashcard"
          className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center hover:bg-primary-50 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
