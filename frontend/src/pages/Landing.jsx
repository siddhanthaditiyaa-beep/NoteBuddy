import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen,
  Brain,
  Trophy,
  MessageCircle,
  Sparkles,
  ArrowRight,
  Bot,
  Compass,
  FolderTree,
  CalendarDays,
  FileText,
  Search,
  Network,
  Mic,
  Timer,
  Users,
  WifiOff,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import NavBar from "../components/NavBar";

// The four genuinely agentic features — Gemini is handed tools and decides
// for itself which to call and in what order, instead of following a fixed
// prompt→JSON script. This is what separates these from every other
// AI feature in the app.
const AGENTS = [
  {
    icon: CalendarDays,
    title: "Adaptive Study Planner",
    desc: "Give it a goal — 'exam Friday on Chemistry' — and it checks your weak topics, due flashcards, and notes before building a day-by-day plan.",
  },
  {
    icon: Compass,
    title: "Study Coach",
    desc: "Pulls your real quiz history, confidence calibration, and mistake patterns, then tells you exactly what to do next and why — not generic tips.",
  },
  {
    icon: MessageCircle,
    title: "Cross-Note Tutor",
    desc: "Decides for itself whether your question needs a search across every note you've ever saved, not just the one you have open.",
  },
  {
    icon: FolderTree,
    title: "Note Organizer",
    desc: "Judges which of your notes are related enough to be worth comparing, then suggests subject-tag fixes, merges, and contradictions.",
  },
];

const FEATURES = [
  {
    icon: BookOpen,
    color: "bg-primary-500",
    title: "Capture it any way",
    desc: "Paste text, upload a PDF or photo of handwritten notes, record audio, or drop in a YouTube link — NoteBuddy reads and transcribes all of it.",
  },
  {
    icon: Brain,
    color: "bg-mint-500",
    title: "Explained at your level",
    desc: "Slide from 'explain like I'm 10' to full student-level detail, plus an 'explain differently' button when something still isn't clicking.",
  },
  {
    icon: Sparkles,
    color: "bg-sun-500",
    title: "A full study kit, instantly",
    desc: "Summary, key terms, flashcards, quizzes, a visual knowledge graph, and a study podcast — generated from your notes in one go.",
  },
  {
    icon: FileText,
    color: "bg-coral-500",
    title: "Exam Twin & syllabus gaps",
    desc: "Generate a full timed mock exam from your notes, auto-graded, plus a tracker that flags what your syllabus covers that your notes don't.",
  },
  {
    icon: ListChecks,
    color: "bg-primary-500",
    title: "Practice that checks itself",
    desc: "Teach-Back (Feynman) mode, confidence-calibration tracking to catch overconfidence, and a mistake-pattern retrospective across all your quizzes.",
  },
  {
    icon: Search,
    color: "bg-mint-500",
    title: "Semantic search across everything",
    desc: "Ask a question and NoteBuddy searches the meaning of every note you've saved, not just keywords — plus a cross-note contradiction & gap detector.",
  },
  {
    icon: Mic,
    color: "bg-sun-500",
    title: "Hands-free & accessible",
    desc: "Voice-first review mode you can run by speaking grades out loud, read-aloud and podcast modes, and an adjustable-size UI for easier reading.",
  },
  {
    icon: Timer,
    color: "bg-coral-500",
    title: "Built to keep you consistent",
    desc: "Spaced-repetition review (SM-2), a built-in Pomodoro timer, XP, streaks, and badges that make sticking with it feel like a game.",
  },
  {
    icon: Users,
    color: "bg-[#15142c]",
    title: "Study together, privately",
    desc: "A public gallery of shared study kits, async leaderboards on shared notes, opt-in study-buddy matching, and an anonymized class weak-spot heatmap.",
  },
  {
    icon: WifiOff,
    color: "bg-primary-500",
    title: "Works even offline",
    desc: "An on-device AI model (WebGPU) keeps chat and flashcards working with no connection, and the whole app installs as a PWA.",
  },
  {
    icon: Network,
    color: "bg-mint-500",
    title: "Visual knowledge graph",
    desc: "See how the concepts in a note connect to each other in an interactive force-directed graph, not just a flat list of terms.",
  },
  {
    icon: ShieldCheck,
    color: "bg-sun-500",
    title: "Privacy you control",
    desc: "A plain-language privacy page, one-click account deletion that wipes everything, and student-chosen display names that never expose your email.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen blob-bg">
      <NavBar />

      <section className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-card font-bold text-sm text-primary-600 mb-6">
            <Bot size={14} /> Powered by Generative &amp; Agentic AI
          </span>
          <h1 className="font-display text-5xl md:text-6xl font-extrabold leading-tight text-ink mb-6">
            Turn any notes into <span className="text-primary-600">a study buddy</span> <br /> that gets you
          </h1>
          <p className="text-lg text-ink/60 font-semibold max-w-xl mx-auto mb-10">
            Not just AI-generated flashcards — four real AI agents that look at your actual study data
            and decide for themselves what you need next.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
            <Link
              to="/signup"
              className="group w-full sm:w-auto px-7 py-3.5 rounded-xl2 bg-primary-500 text-white font-bold shadow-pop hover:bg-primary-600 transition-all flex items-center justify-center gap-2"
            >
              Start learning free
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl2 bg-white text-ink font-bold shadow-card hover:shadow-soft transition-all text-center"
            >
              I already have an account
            </Link>
          </div>
          <Link to="/gallery" className="inline-block mt-5 text-sm font-bold text-ink/40 hover:text-primary-600 hover:underline">
            Or browse public study kits made by other students →
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-20 relative"
        >
          <div className="absolute -top-6 -left-6 w-16 h-16 rounded-xl3 bg-sun-300 shadow-soft animate-float hidden md:block" />
          <div className="absolute -bottom-8 -right-8 w-20 h-20 rounded-full bg-mint-400 shadow-soft animate-float hidden md:block" style={{ animationDelay: "1s" }} />
          <div className="bg-white rounded-xl3 shadow-pop p-8 md:p-10 text-left max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-coral-400" />
              <div className="w-3 h-3 rounded-full bg-sun-300" />
              <div className="w-3 h-3 rounded-full bg-mint-400" />
            </div>
            <p className="font-display font-bold text-xl mb-2">📘 Photosynthesis</p>
            <p className="text-ink/60 font-semibold mb-4">
              Plants make their own food using sunlight, water, and carbon dioxide — turning
              light energy into sugar they can use to grow.
            </p>
            <div className="flex gap-2 flex-wrap">
              {["chlorophyll", "glucose", "sunlight"].map((t) => (
                <span key={t} className="px-3 py-1 rounded-full bg-primary-50 text-primary-600 text-xs font-bold">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Agentic AI — called out on its own, since this is what makes NoteBuddy
          more than a wrapper around a single prompt. */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#15142c] text-white shadow-card font-bold text-sm mb-4">
            <Bot size={14} /> Agentic AI
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-ink mb-3">
            Four agents. Real tools. Their own decisions.
          </h2>
          <p className="text-ink/60 font-semibold max-w-2xl mx-auto">
            Each one is handed a set of tools — real functions that read your actual data — and Gemini decides
            for itself which ones to call, in what order, before answering. Not a fixed script.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {AGENTS.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-[#15142c] rounded-xl2 p-6 shadow-card text-white"
            >
              <div className="w-11 h-11 rounded-xl2 bg-white/10 flex items-center justify-center mb-4">
                <a.icon size={20} />
              </div>
              <h3 className="font-display font-bold text-base mb-1.5">{a.title}</h3>
              <p className="text-white/60 font-semibold text-sm">{a.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-ink mb-3">
            Everything else you'd want in a study companion
          </h2>
          <p className="text-ink/60 font-semibold max-w-2xl mx-auto">
            All built on top of the same notes you already have.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 3) * 0.1 }}
              className="bg-white rounded-xl2 p-6 shadow-card flex gap-4"
            >
              <div className={`w-12 h-12 rounded-xl2 ${f.color} flex items-center justify-center text-white shrink-0`}>
                <f.icon size={22} />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg mb-1">{f.title}</h3>
                <p className="text-ink/60 font-semibold text-sm">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
        <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl3 p-12 text-white shadow-pop">
          <Trophy className="mx-auto mb-4" size={36} />
          <h2 className="font-display text-3xl font-extrabold mb-3">Learning that feels like a game</h2>
          <p className="font-semibold text-primary-100 mb-6">
            Earn XP, build streaks, and level up every time you study — because sticking with it
            should feel good.
          </p>
          <Link
            to="/signup"
            className="inline-block px-7 py-3.5 rounded-xl2 bg-white text-primary-600 font-bold shadow-soft hover:bg-primary-50 transition-colors"
          >
            Create your free account
          </Link>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 pb-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-bold text-ink/40">
        <span>&copy; {new Date().getFullYear()} NoteBuddy</span>
        <Link to="/privacy" className="hover:text-primary-600 hover:underline">
          Privacy
        </Link>
        <Link to="/gallery" className="hover:text-primary-600 hover:underline">
          Gallery
        </Link>
      </footer>
    </div>
  );
}
