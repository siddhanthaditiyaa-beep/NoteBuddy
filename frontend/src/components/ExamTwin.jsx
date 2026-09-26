import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { FileText, Clock, Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { generateExamTwin, gradeShortAnswer } from "../lib/api";

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const DURATIONS = [30, 45, 60, 90];

// Exam Twin — a full mock exam paper (not just another quiz) generated
// from a note, with a real countdown timer and mixed question types, so a
// student can actually rehearse exam conditions instead of just reviewing
// material passively.
export default function ExamTwin({ noteId, rawText, board }) {
  const [phase, setPhase] = useState("setup"); // setup | generating | taking | grading | results
  const [duration, setDuration] = useState(60);
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({}); // `${sectionIdx}-${qIdx}` -> value
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [results, setResults] = useState(null); // { totalScore, totalMarks, breakdown: [...] }
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const generate = async () => {
    setPhase("generating");
    try {
      const data = await generateExamTwin({ noteId, durationMinutes: duration, board });
      setExam(data);
      setAnswers({});
      setSecondsLeft((data.duration_minutes || duration) * 60);
      setPhase("taking");
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current);
            toast("Time's up! Submitting your exam...", { icon: "⏰" });
            finishExam();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (e) {
      toast.error(e.message || "Couldn't generate a mock exam right now.");
      setPhase("setup");
    }
  };

  const setAnswer = (key, value) => setAnswers((prev) => ({ ...prev, [key]: value }));

  const finishExam = async () => {
    clearInterval(timerRef.current);
    setPhase("grading");
    let totalScore = 0;
    let totalMarks = 0;
    const breakdown = [];

    for (let si = 0; si < exam.sections.length; si++) {
      const section = exam.sections[si];
      for (let qi = 0; qi < section.questions.length; qi++) {
        const q = section.questions[qi];
        const key = `${si}-${qi}`;
        const marks = q.marks || 1;
        totalMarks += marks;

        if (q.type === "mcq") {
          const chosen = answers[key];
          const isCorrect = chosen === q.correct_index;
          const earned = isCorrect ? marks : 0;
          totalScore += earned;
          breakdown.push({ question: q.question, marks, earned, correct: isCorrect, type: "mcq" });
        } else {
          const studentAnswer = (answers[key] || "").trim();
          if (!studentAnswer) {
            breakdown.push({ question: q.question, marks, earned: 0, feedback: "No answer given.", type: q.type });
            continue;
          }
          try {
            const graded = await gradeShortAnswer({
              contextText: rawText,
              question: q.question,
              studentAnswer,
            });
            const fraction = graded.verdict === "correct" ? 1 : graded.verdict === "partially_correct" ? 0.5 : 0;
            const earned = Math.round(marks * fraction);
            totalScore += earned;
            breakdown.push({ question: q.question, marks, earned, feedback: graded.feedback, type: q.type });
          } catch {
            breakdown.push({ question: q.question, marks, earned: 0, feedback: "Couldn't grade this one — please review manually.", type: q.type });
          }
        }
      }
    }

    setResults({ totalScore, totalMarks, breakdown });
    setPhase("results");
  };

  if (phase === "setup") {
    return (
      <div className="max-w-md mx-auto text-center py-6">
        <div className="w-16 h-16 rounded-xl3 bg-primary-50 flex items-center justify-center mx-auto mb-4">
          <FileText className="text-primary-500" size={28} />
        </div>
        <h3 className="font-display text-xl font-bold mb-2">Exam Twin</h3>
        <p className="text-sm font-semibold text-ink/50 mb-6">
          Generates a full mock exam paper from this note — mixed question types, real marks, a countdown timer.
          Sit it like the real thing.
        </p>
        <p className="text-xs font-bold text-ink/40 mb-2">How long?</p>
        <div className="flex justify-center gap-2 mb-6">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className={`px-4 py-2 rounded-xl2 text-sm font-bold transition-all ${
                duration === d ? "bg-primary-500 text-white" : "bg-primary-50 text-ink/60"
              }`}
            >
              {d} min
            </button>
          ))}
        </div>
        <button
          onClick={generate}
          className="px-6 py-3 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft hover:bg-primary-600 transition-colors flex items-center gap-2 mx-auto"
        >
          <Sparkles size={16} /> Generate my mock exam
        </button>
      </div>
    );
  }

  if (phase === "generating") {
    return <p className="text-center text-ink/50 font-semibold py-20">Writing your exam paper...</p>;
  }

  if (phase === "taking") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="sticky top-16 z-10 bg-white backdrop-blur-sm rounded-xl2 shadow-card px-4 py-3 mb-5 flex items-center justify-between">
          <div>
            <p className="font-display font-bold">{exam.title}</p>
            <p className="text-xs font-bold text-ink/40">{exam.total_marks} marks total</p>
          </div>
          <div className="flex items-center gap-2 font-display font-bold text-lg tabular-nums text-primary-600">
            <Clock size={18} /> {formatClock(secondsLeft)}
          </div>
        </div>

        {exam.sections.map((section, si) => (
          <div key={si} className="mb-8">
            <h4 className="font-display font-bold text-lg mb-1">{section.name}</h4>
            <p className="text-xs font-semibold text-ink/40 mb-4">{section.instructions}</p>
            <div className="space-y-5">
              {section.questions.map((q, qi) => {
                const key = `${si}-${qi}`;
                return (
                  <div key={key} className="bg-white rounded-xl2 shadow-card p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="font-semibold text-ink/80">{q.question}</p>
                      <span className="text-xs font-bold text-primary-500 shrink-0 whitespace-nowrap">{q.marks} mk</span>
                    </div>
                    {q.type === "mcq" ? (
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <button
                            key={oi}
                            onClick={() => setAnswer(key, oi)}
                            className={`w-full text-left px-4 py-2.5 rounded-xl2 font-semibold text-sm transition-all border-2 ${
                              answers[key] === oi ? "bg-primary-50 border-primary-400" : "bg-white border-primary-100 hover:border-primary-200"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        value={answers[key] || ""}
                        onChange={(e) => setAnswer(key, e.target.value)}
                        rows={q.type === "long" ? 5 : 3}
                        placeholder="Your answer..."
                        className="w-full p-3 rounded-xl2 bg-primary-50 shadow-card outline-none font-semibold text-sm focus:ring-2 focus:ring-primary-300"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <button
          onClick={finishExam}
          className="w-full py-4 rounded-xl2 bg-primary-500 text-white font-bold text-lg shadow-pop hover:bg-primary-600 transition-colors"
        >
          Finish & submit exam
        </button>
      </div>
    );
  }

  if (phase === "grading") {
    return (
      <p className="text-center text-ink/50 font-semibold py-20 flex items-center justify-center gap-2">
        <Loader2 size={18} className="animate-spin" /> Grading your exam...
      </p>
    );
  }

  // results
  const pct = results.totalMarks ? Math.round((results.totalScore / results.totalMarks) * 100) : 0;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto">
      <div className="text-center mb-6">
        <p className="font-display text-3xl font-extrabold mb-1">
          {results.totalScore}/{results.totalMarks}
        </p>
        <p className="text-ink/50 font-semibold">{pct}% overall</p>
      </div>
      <div className="space-y-2">
        {results.breakdown.map((b, i) => (
          <div key={i} className="bg-white rounded-xl2 shadow-card p-4">
            <div className="flex items-start justify-between gap-3 mb-1">
              <p className="font-semibold text-sm text-ink/80">{b.question}</p>
              <span className={`text-xs font-bold shrink-0 flex items-center gap-1 ${b.earned === b.marks ? "text-mint-600" : b.earned > 0 ? "text-sun-600" : "text-coral-600"}`}>
                {b.earned === b.marks ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {b.earned}/{b.marks}
              </span>
            </div>
            {b.feedback && <p className="text-xs font-semibold text-ink/50">{b.feedback}</p>}
          </div>
        ))}
      </div>
      <button
        onClick={() => setPhase("setup")}
        className="mt-6 w-full py-3 rounded-xl2 bg-primary-50 text-primary-600 font-bold shadow-card hover:bg-primary-100 transition-colors"
      >
        Take another mock exam
      </button>
    </motion.div>
  );
}
