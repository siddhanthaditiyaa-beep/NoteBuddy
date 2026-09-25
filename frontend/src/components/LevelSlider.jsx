const LEVELS = [
  { id: "kid", label: "Explain like I'm 10", emoji: "🧒" },
  { id: "beginner", label: "I'm new to this", emoji: "🌱" },
  { id: "student", label: "Standard level", emoji: "🎓" },
];

export default function LevelSlider({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {LEVELS.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => onChange(l.id)}
          className={`px-4 py-2 rounded-xl2 font-bold text-sm flex items-center gap-2 transition-all border-2 ${
            value === l.id
              ? "bg-primary-500 border-primary-500 text-white shadow-soft"
              : "bg-white border-primary-100 text-ink/70 hover:border-primary-300"
          }`}
        >
          <span>{l.emoji}</span> {l.label}
        </button>
      ))}
    </div>
  );
}
