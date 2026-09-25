const COUNTS = [5, 10, 15, 20];

export default function QuizCountSlider({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COUNTS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`px-4 py-2 rounded-xl2 font-bold text-sm transition-all border-2 ${
            value === n
              ? "bg-primary-500 border-primary-500 text-white shadow-soft"
              : "bg-white border-primary-100 text-ink/70 hover:border-primary-300"
          }`}
        >
          {n} questions
        </button>
      ))}
    </div>
  );
}
