import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, Database, Trash2, Eye, Lock } from "lucide-react";
import NavBar from "../components/NavBar";

const POINTS = [
  {
    icon: Database,
    title: "What we store",
    body: "Your account email, the notes you paste or upload, the study kits generated from them, and basic progress data (XP, streaks, quiz/flashcard history) so features like spaced repetition and weak-topic tracking work.",
  },
  {
    icon: Eye,
    title: "Who can see it",
    body: "Only you — unless you explicitly turn on a shareable link or the public gallery for a specific note. Nothing is shared or sold to anyone, ever.",
  },
  {
    icon: Lock,
    title: "How it's protected",
    body: "Every request is verified against your logged-in session — there's no way for one student to read another's notes by guessing a link. Passwords are handled entirely by Supabase Auth; NoteBuddy never sees or stores them in plain text.",
  },
  {
    icon: Trash2,
    title: "Deleting your data",
    body: "You can permanently delete your account and everything tied to it at any time from the account menu — it's a real deletion, not a deactivation, and it can't be undone.",
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen blob-bg">
      <NavBar />
      <div className="max-w-2xl mx-auto px-6 py-14">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 text-primary-600 font-bold text-sm mb-2">
            <ShieldCheck size={16} /> Privacy, in plain language
          </div>
          <h1 className="font-display text-3xl font-extrabold mb-2">Your notes are yours</h1>
          <p className="text-ink/60 font-semibold mb-8">
            NoteBuddy is a student project built to help you study, not to collect data about you. Here's exactly what
            that means.
          </p>

          <div className="space-y-4">
            {POINTS.map((p) => (
              <div key={p.title} className="bg-white rounded-xl2 shadow-card p-5 flex gap-4">
                <div className="w-11 h-11 rounded-xl2 bg-primary-50 flex items-center justify-center text-primary-500 shrink-0">
                  <p.icon size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold mb-1">{p.title}</h3>
                  <p className="text-sm font-semibold text-ink/60 leading-relaxed">{p.body}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs font-semibold text-ink/40 mt-8">
            Questions about your data? Reach out to whoever's running this instance of NoteBuddy, or{" "}
            <Link to="/dashboard" className="text-primary-600 hover:underline">
              delete your account
            </Link>{" "}
            directly from the account menu at any time.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
