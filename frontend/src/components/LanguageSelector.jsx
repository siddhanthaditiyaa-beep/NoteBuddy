const LANGUAGES = [
  "English", "Hindi", "Marathi", "Tamil", "Telugu", "Kannada",
  "Gujarati", "Bengali", "Malayalam", "Punjabi", "Urdu",
];

export default function LanguageSelector({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-4 py-2.5 rounded-xl2 bg-white shadow-card border-2 border-primary-100 font-bold text-sm text-ink/70 outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang} value={lang}>
          {lang}
        </option>
      ))}
    </select>
  );
}
