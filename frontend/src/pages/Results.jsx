import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import toast from "react-hot-toast";
import {
  BookOpen,
  Layers,
  ListChecks,
  MessageCircle,
  Sparkles,
  GitBranch,
  Download,
  Volume2,
  VolumeX,
} from "lucide-react";
import NavBar from "../components/NavBar";
import FlashcardDeck from "../components/FlashcardDeck";
import Quiz from "../components/Quiz";
import ChatPanel from "../components/ChatPanel";
import LevelSlider from "../components/LevelSlider";
import { useAuth } from "../context/AuthContext";
import { regenerateNote } from "../lib/api";

const TABS = [
  { id: "summary", label: "Summary", icon: BookOpen },
  { id: "flashcards", label: "Flashcards", icon: Layers },
  { id: "quiz", label: "Quiz", icon: ListChecks },
  { id: "mindmap", label: "Mind Map", icon: GitBranch },
  { id: "chat", label: "Ask NoteBuddy", icon: MessageCircle },
];

export default function Results() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const stored = location.state?.result || JSON.parse(sessionStorage.getItem("notebuddy_last_result") || "null");

  const [studyKit, setStudyKit] = useState(stored?.study_kit);
  const [rawText] = useState(stored?.raw_text || stored?.note?.raw_text || "");
  const [noteId] = useState(stored?.note?.id);
  const [tab, setTab] = useState("summary");
  const [level, setLevel] = useState("beginner");
  const [regenLoading, setRegenLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // Stop any in-progress read-aloud if the user navigates away mid-speech.
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const toggleSpeak = () => {
    if (!("speechSynthesis" in window)) {
      toast.error("Your browser doesn't support read-aloud.");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(studyKit.summary || "");
    utterance.rate = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  const downloadPdf = () => {
    const doc = new jsPDF();
    const marginLeft = 15;
    const pageWidth = doc.internal.pageSize.getWidth() - marginLeft * 2;
    let y = 20;

    const ensureSpace = (needed = 10) => {
      if (y + needed > 280) {
        doc.addPage();
        y = 20;
      }
    };

    const addWrapped = (text, size, bold = false) => {
      doc.setFontSize(size);
      doc.setFont(undefined, bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, pageWidth);
      lines.forEach((line) => {
        ensureSpace(8);
        doc.text(line, marginLeft, y);
        y += size * 0.5 + 2;
      });
    };

    addWrapped(studyKit.title || "Study Kit", 18, true);
    y += 4;

    addWrapped("Summary", 14, true);
    addWrapped(studyKit.summary || "", 11);
    y += 4;

    if (studyKit.key_terms?.length) {
      addWrapped("Key Terms", 14, true);
      studyKit.key_terms.forEach((kt) => {
        addWrapped(`${kt.term}: ${kt.definition}`, 11);
      });
      y += 4;
    }

    if (studyKit.flashcards?.length) {
      ensureSpace(14);
      addWrapped("Flashcards", 14, true);
      studyKit.flashcards.forEach((fc, i) => {
        addWrapped(`${i + 1}. Q: ${fc.question}`, 11, true);
        addWrapped(`   A: ${fc.answer}`, 11);
      });
      y += 4;
    }

    if (studyKit.quiz?.length) {
      ensureSpace(14);
      addWrapped("Quiz", 14, true);
      studyKit.quiz.forEach((q, i) => {
        addWrapped(`${i + 1}. ${q.question}`, 11, true);
        (q.options || []).forEach((opt, oi) => {
          addWrapped(`   ${String.fromCharCode(97 + oi)}) ${opt}`, 10);
        });
        if (q.answer) addWrapped(`   Answer: ${q.answer}`, 10);
      });
    }

    const safeName = (studyKit.title || "study-kit").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
    doc.save(`${safeName}.pdf`);
  };

  if (!studyKit) {
    return (
      <div className="min-h-screen blob-bg">
        <NavBar />
        <div className="max-w-xl mx-auto text-center py-24">
          <p className="font-bold text-ink/60 mb-4">No study kit to show yet.</p>
          <button
            onClick={() => navigate("/upload")}
            className="px-6 py-3 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft"
          >
            Create one now
          </button>
        </div>
      </div>
    );
  }

  const handleLevelChange = async (newLevel) => {
    setLevel(newLevel);
    if (!noteId) return; // Supabase not configured — nothing to regenerate against
    setRegenLoading(true);
    try {
      const { study_kit } = await regenerateNote({ noteId, userId: user.id, level: newLevel });
      setStudyKit(study_kit);
    } finally {
      setRegenLoading(false);
    }
  };

  return (
    <div className="min-h-screen blob-bg relative overflow-hidden">
      <div className="absolute top-32 -right-10 w-24 h-24 rounded-full bg-primary-300/20 animate-float hidden md:block" />
      <div
        className="absolute bottom-20 -left-8 w-20 h-20 rounded-xl3 bg-mint-400/20 animate-float hidden md:block"
        style={{ animationDelay: "1s" }}
      />
      <NavBar />
      <div className="max-w-3xl mx-auto px-6 py-10 relative">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <div className="flex items-center gap-2 text-primary-600 font-bold text-sm">
              <Sparkles size={16} /> Your AI-generated study kit
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSpeak}
                title={speaking ? "Stop reading" : "Read summary aloud"}
                className="w-9 h-9 rounded-xl2 bg-white shadow-card flex items-center justify-center text-ink/60 hover:text-primary-600 transition-colors"
              >
                {speaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <button
                onClick={downloadPdf}
                title="Download as PDF"
                className="w-9 h-9 rounded-xl2 bg-white shadow-card flex items-center justify-center text-ink/60 hover:text-primary-600 transition-colors"
              >
                <Download size={16} />
              </button>
            </div>
          </div>
          <h1 className="font-display text-3xl font-extrabold mb-6">{studyKit.title}</h1>

          <div className="mb-6">
            <p className="text-sm font-bold text-ink/70 mb-2">Explanation level</p>
            <LevelSlider value={level} onChange={handleLevelChange} />
          </div>

          <div className="flex gap-2 mb-6 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 rounded-xl2 font-bold text-sm flex items-center gap-2 shrink-0 transition-all ${
                  tab === t.id ? "bg-primary-500 text-white shadow-soft" : "bg-white text-ink/60 shadow-card"
                }`}
              >
                <t.icon size={16} /> {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {regenLoading ? (
              <div className="text-center py-20 font-bold text-ink/50">Adjusting explanation...</div>
            ) : (
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                {tab === "summary" && (
                  <div className="bg-white rounded-xl2 shadow-card p-6 space-y-6">
                    <p className="font-semibold text-ink/80 leading-relaxed">{studyKit.summary}</p>
                    <div>
                      <h3 className="font-display font-bold mb-3">Key terms</h3>
                      <div className="space-y-2">
                        {studyKit.key_terms?.map((kt) => (
                          <div key={kt.term} className="p-3 rounded-xl2 bg-primary-50">
                            <span className="font-bold text-primary-700">{kt.term}: </span>
                            <span className="font-semibold text-ink/70">{kt.definition}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {tab === "flashcards" && (
                  <div className="bg-white rounded-xl2 shadow-card p-8">
                    <FlashcardDeck cards={studyKit.flashcards} />
                  </div>
                )}
                {tab === "quiz" && (
                  <div className="bg-white rounded-xl2 shadow-card p-8">
                    <Quiz questions={studyKit.quiz} />
                  </div>
                )}
                {tab === "mindmap" && (
                  <div className="bg-white rounded-xl2 shadow-card p-8">
                    {studyKit.mind_map ? (
                      <div className="flex flex-col items-center gap-6">
                        <div className="px-6 py-3 rounded-xl2 bg-primary-500 text-white font-display font-extrabold text-center shadow-soft">
                          {studyKit.mind_map.root}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4 w-full">
                          {studyKit.mind_map.branches?.map((branch, i) => (
                            <div
                              key={i}
                              className="border-2 border-primary-100 rounded-xl2 p-4 bg-primary-50/40"
                            >
                              <p className="font-display font-bold text-primary-700 mb-3">
                                {branch.label}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {branch.children?.map((child, ci) => (
                                  <span
                                    key={ci}
                                    className="px-2.5 py-1 rounded-full bg-white shadow-card text-xs font-semibold text-ink/70"
                                  >
                                    {child}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-ink/40 font-semibold py-10">
                        No mind map available for this note.
                      </p>
                    )}
                  </div>
                )}
                {tab === "chat" && <ChatPanel rawText={rawText} />}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
