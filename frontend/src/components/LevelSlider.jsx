// Three clean, consistently-named tiers — Simple / Standard / Deep Dive — instead
// of the old "Explain like I'm 10" / "I'm new to this" / "Standard level" set,
// where the first two overlapped so much they read as inconsistent rather than
// as a real spectrum. "Explain like I'm 10" lives on as Simple's subtitle, so
// that description isn't lost, just tidied up. "Deep Dive" is a genuinely new,
// more advanced tier (see LEVEL_INSTRUCTIONS["advanced"] on the backend).
const LEVELS = [
  { id: "kid", label: "Simple", subtitle: "Explained like you're 10", emoji: "🧒" },
  { id: "student", label: "Standard", subtitle: "Normal study-level detail", emoji: "🎓" },
  { id: "advanced", label: "Deep Dive", subtitle: "Nuance, depth, the 'why'", emoji: "🧠" },
];

export default function LevelSlider({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {LEVELS.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => onChange(l.id)}
          aria-pressed={value === l.id}
          className={`px-2 py-2.5 rounded-xl2 font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-0.5 text-center transition-all border-2 ${
            value === l.id
              ? "bg-primary-500 border-primary-500 text-white shadow-soft"
              : "bg-white border-primary-100 text-ink/70 hover:border-primary-300"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span>{l.emoji}</span> {l.label}
          </span>
          <span className={`text-[10px] font-semibold ${value === l.id ? "text-white/80" : "text-ink/40"}`}>
            {l.subtitle}
          </span>
        </button>
      ))}
    </div>
  );
}
