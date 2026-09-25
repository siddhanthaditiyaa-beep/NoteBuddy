import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, FileText, Search } from "lucide-react";
import { getPublicGallery } from "../lib/api";

// Public, no-login gallery of study kits their owners chose to share. Part
// of the free growth loop from the roadmap: crawlable page titles + a meta
// description per visit mean a search for e.g. "Biology Chapter 5
// flashcards" can land a stranger here instead of on Quizlet, at zero
// acquisition cost — the reward for the shareable-link feature compounding
// over time instead of being a one-off social share.
export default function Gallery() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = "Public Study Kits — NoteBuddy";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = "Browse free, AI-generated study kits — summaries, flashcards, and quizzes — shared publicly by NoteBuddy students.";

    getPublicGallery()
      .then((res) => setNotes(res.notes || []))
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => {
      document.title = "NoteBuddy";
    };
  }, []);

  const subjects = useMemo(() => Array.from(new Set(notes.map((n) => n.subject || "General"))), [notes]);
  const [activeSubject, setActiveSubject] = useState(null);

  const filtered = notes.filter((n) => {
    const matchesSearch = !search || n.title.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = !activeSubject || (n.subject || "General") === activeSubject;
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="min-h-screen blob-bg relative overflow-hidden">
      <div className="border-b border-primary-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-display font-extrabold text-lg text-primary-600 flex items-center gap-2">
            <Sparkles size={18} /> NoteBuddy
          </Link>
          <Link to="/signup" className="text-xs font-bold text-primary-600 hover:underline">
            Make your own study kit →
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 relative">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-extrabold mb-2">Public study kits</h1>
          <p className="text-ink/50 font-semibold mb-6">
            Free, AI-generated summaries, flashcards, and quizzes shared by NoteBuddy students.
          </p>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shared study kits..."
              aria-label="Search shared study kits"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl2 bg-white shadow-card outline-none font-semibold text-sm focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {subjects.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setActiveSubject(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  !activeSubject ? "bg-primary-500 text-white" : "bg-white text-ink/60 shadow-card"
                }`}
              >
                All
              </button>
              {subjects.map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveSubject(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    activeSubject === s ? "bg-primary-500 text-white" : "bg-white text-ink/60 shadow-card"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <p className="text-ink/40 font-semibold text-center py-16">Loading shared study kits...</p>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl2 shadow-card p-10 text-center">
              <div className="w-16 h-16 rounded-xl3 bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <FileText className="text-primary-400" size={28} />
              </div>
              <p className="font-bold text-ink/60 mb-1">No public study kits yet</p>
              <p className="text-sm font-semibold text-ink/40">Be the first — share one from your Results page.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {filtered.map((n) => (
                <Link
                  key={n.id}
                  to={`/shared/${n.id}`}
                  className="text-left bg-white rounded-xl2 shadow-card p-5 hover:shadow-soft hover:-translate-y-0.5 transition-all block"
                >
                  <div className="w-9 h-9 rounded-xl2 bg-primary-50 flex items-center justify-center text-primary-500 mb-3">
                    <FileText size={18} />
                  </div>
                  <p className="font-display font-bold mb-1">{n.title}</p>
                  <p className="text-xs font-semibold text-ink/40 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600">
                      {n.subject || "General"}
                    </span>
                    {new Date(n.created_at).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
