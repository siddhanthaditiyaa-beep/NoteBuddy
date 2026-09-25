import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";

export default function FlashcardDeck({ cards = [] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards.length) return null;
  const card = cards[index];

  const go = (dir) => {
    setFlipped(false);
    setIndex((i) => (i + dir + cards.length) % cards.length);
  };

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
        >
          <div
            className="absolute inset-0 rounded-xl3 bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-pop flex items-center justify-center p-8 text-center [backface-visibility:hidden]"
          >
            <p className="font-display font-bold text-xl">{card.front}</p>
          </div>
          <div
            className="absolute inset-0 rounded-xl3 bg-gradient-to-br from-mint-400 to-mint-500 text-white shadow-pop flex items-center justify-center p-8 text-center [backface-visibility:hidden]"
            style={{ transform: "rotateY(180deg)" }}
          >
            <p className="font-bold text-lg">{card.back}</p>
          </div>
        </motion.div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => go(-1)}
          className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center hover:bg-primary-50 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => setFlipped((f) => !f)}
          className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center hover:bg-primary-50 transition-colors"
        >
          <RotateCw size={16} />
        </button>
        <button
          onClick={() => go(1)}
          className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center hover:bg-primary-50 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
