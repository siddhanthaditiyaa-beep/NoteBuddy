import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Brain, Trophy, MessageCircle, Sparkles, ArrowRight } from "lucide-react";
import NavBar from "../components/NavBar";

const FEATURES = [
  {
    icon: BookOpen,
    color: "bg-primary-500",
    title: "Paste, upload, or snap a photo",
    desc: "Drop in text, a PDF, or even a photo of handwritten notes — NoteBuddy reads it all.",
  },
  {
    icon: Brain,
    color: "bg-mint-500",
    title: "Explained at your level",
    desc: "Slide from 'explain like I'm 10' to full student-level detail, any time.",
  },
  {
    icon: Sparkles,
    color: "bg-sun-500",
    title: "Flashcards & quizzes, instantly",
    desc: "AI turns your notes into flip-cards and quizzes made for real learning, not just reading.",
  },
  {
    icon: MessageCircle,
    color: "bg-coral-500",
    title: "Ask follow-up questions",
    desc: "Confused about a line? Just ask NoteBuddy — it knows your material inside out.",
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
            <Sparkles size={14} /> Powered by Generative AI
          </span>
          <h1 className="font-display text-5xl md:text-6xl font-extrabold leading-tight text-ink mb-6">
            Turn any notes into <span className="text-primary-600">a study buddy</span> <br /> that gets you
          </h1>
          <p className="text-lg text-ink/60 font-semibold max-w-xl mx-auto mb-10">
            Built for kids, beginners, and anyone who finds studying overwhelming.
            Paste your notes and get summaries, flashcards, and quizzes made just for you.
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

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
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
    </div>
  );
}
