import { motion } from "framer-motion";
import { Flame, Star } from "lucide-react";

export default function XPBar({ xp = 0, level = 1, xpToNext = 100, streak = 0 }) {
  const pct = Math.min(100, ((100 - xpToNext) / 100) * 100);

  return (
    <div className="bg-white rounded-xl2 shadow-card p-5 flex items-center gap-5">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-display font-bold text-lg shadow-soft shrink-0">
        {level}
      </div>
      <div className="flex-1">
        <div className="flex justify-between text-sm font-bold text-ink/70 mb-1">
          <span>Level {level}</span>
          <span>{xpToNext} XP to next level</span>
        </div>
        <div className="h-3 rounded-full bg-primary-50 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-primary-400 to-mint-400"
          />
        </div>
      </div>
      <div className="flex items-center gap-1 text-sun-500 font-bold shrink-0">
        <Flame size={20} fill="currentColor" />
        {streak}
      </div>
    </div>
  );
}
