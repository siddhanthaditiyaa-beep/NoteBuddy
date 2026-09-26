import { useState } from "react";

const COUNTS = [5, 10, 15, 20, 25];

export default function QuizCountSlider({ value, onChange }) {
  // Whether the current value came from a preset button or a typed number —
  // starts open if the incoming value isn't one of the presets (e.g. a
  // saved draft that already had a custom count).
  const [customOpen, setCustomOpen] = useState(!COUNTS.includes(value));
  const [customValue, setCustomValue] = useState(COUNTS.includes(value) ? "" : String(value ?? ""));

  const pickPreset = (n) => {
    setCustomOpen(false);
    onChange(n);
  };

  const openCustom = () => {
    setCustomOpen(true);
    setCustomValue(String(value || ""));
  };

  const applyCustom = (raw) => {
    setCustomValue(raw);
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 50) {
      onChange(n);
    }
  };

  return (
    <div>
      {/* 3-column grid (not a flex-wrap row) — 5 presets plus "Custom" is 6
          buttons, which a single wrapping row left lopsided (a short last
          row of 1-2). A 3-wide grid gives two full, evenly aligned rows. */}
      <div className="grid grid-cols-3 gap-2">
        {COUNTS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => pickPreset(n)}
            className={`px-4 py-2 rounded-xl2 font-bold text-sm transition-all border-2 ${
              !customOpen && value === n
                ? "bg-primary-500 border-primary-500 text-white shadow-soft"
                : "bg-white border-primary-100 text-ink/70 hover:border-primary-300"
            }`}
          >
            {n} questions
          </button>
        ))}
        <button
          type="button"
          onClick={openCustom}
          className={`px-4 py-2 rounded-xl2 font-bold text-sm transition-all border-2 ${
            customOpen
              ? "bg-primary-500 border-primary-500 text-white shadow-soft"
              : "bg-white border-primary-100 text-ink/70 hover:border-primary-300"
          }`}
        >
          Custom
        </button>
      </div>
      {customOpen && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={50}
            value={customValue}
            onChange={(e) => applyCustom(e.target.value)}
            placeholder="e.g. 12"
            aria-label="Custom number of quiz questions"
            className="w-28 px-3 py-2 rounded-xl2 bg-white border-2 border-primary-200 outline-none font-bold text-sm focus:ring-2 focus:ring-primary-300"
          />
          <span className="text-xs font-semibold text-ink/40">questions (1-50)</span>
        </div>
      )}
    </div>
  );
}
