import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { UploadCloud, FileText, Image as ImageIcon, Wand2, Sparkles, Mic, Square, Play, Trash2 } from "lucide-react";
import NavBar from "../components/NavBar";
import LevelSlider from "../components/LevelSlider";
import { useAuth } from "../context/AuthContext";
import { processNote } from "../lib/api";

const EXAMPLES = [
  {
    label: "🌱 Biology example",
    text: "Photosynthesis is the process by which plants convert light energy into chemical energy. It occurs mainly in the leaves, within organelles called chloroplasts. The process has two main stages: the light-dependent reactions, which occur in the thylakoid membranes and produce ATP and NADPH using sunlight, water, and chlorophyll; and the Calvin cycle, which occurs in the stroma and uses that ATP and NADPH to convert carbon dioxide into glucose. The overall equation is: 6CO2 + 6H2O + light energy -> C6H12O6 + 6O2. Photosynthesis is essential because it produces the oxygen we breathe and forms the base of nearly every food chain on Earth.",
  },
  {
    label: "🏛️ History example",
    text: "The French Revolution began in 1789 and fundamentally transformed France's political and social structure. It was driven by widespread frustration with the absolute monarchy, a rigid class system dividing society into three estates, and severe financial crisis caused by costly wars and lavish royal spending. The storming of the Bastille on July 14, 1789 became a symbol of the uprising against royal authority. The revolution led to the abolition of feudal privileges, the Declaration of the Rights of Man and of the Citizen, and eventually the execution of King Louis XVI in 1793. It ultimately gave rise to Napoleon Bonaparte's rise to power by the end of the century.",
  },
  {
    label: "💻 Computer Science example",
    text: "A binary search tree (BST) is a data structure where each node has at most two children, referred to as the left and right child. For every node, all values in its left subtree are smaller than the node's value, and all values in its right subtree are larger. This property allows for efficient searching, insertion, and deletion, each typically taking O(log n) time on a balanced tree, since at each step you can eliminate half of the remaining nodes from consideration. However, if the tree becomes unbalanced (for example, if values are inserted in sorted order), performance can degrade to O(n), which is why self-balancing variants like AVL trees and Red-Black trees exist.",
  },
];

export default function Upload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [level, setLevel] = useState("beginner");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const audioFileInputRef = useRef(null);

  // Voice recording state — captures mic audio into a Blob we turn into a
  // File, so it flows through the exact same upload path as a PDF/image.
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const recordedFile = new File([blob], `recording-${Date.now()}.webm`, { type: "audio/webm" });
        setFile(recordedFile);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Couldn't access your microphone — check your browser permissions.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const clearAudio = () => {
    setFile(null);
    setAudioUrl(null);
  };

  const switchMode = (m) => {
    setMode(m);
    setFile(null);
    setAudioUrl(null);
  };

  const useExample = (example) => {
    setMode("text");
    setText(example.text);
    toast.success("Example loaded — feel free to edit it, or just generate!");
  };

  const handleSubmit = async () => {
    if (mode === "text" && text.trim().length < 20) {
      toast.error("Paste a bit more text so NoteBuddy has something to work with!");
      return;
    }
    if (mode === "file" && !file) {
      toast.error("Choose a PDF or image first.");
      return;
    }
    if (mode === "audio" && !file) {
      toast.error("Record or upload an audio clip first.");
      return;
    }
    setLoading(true);
    try {
      const result = await processNote({
        userId: user.id,
        level,
        text: mode === "text" ? text : undefined,
        file: mode === "text" ? undefined : file,
      });
      sessionStorage.setItem("notebuddy_last_result", JSON.stringify(result));
      toast.success("+10 XP! Your study kit is ready 🎉");
      navigate("/results", { state: { result } });
    } catch (e) {
      if (e.message === "Failed to fetch") {
        toast.error(
          "Couldn't reach the NoteBuddy server. Make sure the backend (uvicorn) terminal is still running.",
          { duration: 6000 }
        );
      } else {
        toast.error(e.message || "Something went wrong generating your study kit.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen blob-bg relative overflow-hidden">
      <div className="absolute top-20 -right-12 w-28 h-28 rounded-xl3 bg-mint-400/20 animate-float hidden md:block" />
      <div
        className="absolute bottom-16 -left-10 w-20 h-20 rounded-full bg-sun-300/25 animate-float hidden md:block"
        style={{ animationDelay: "0.8s" }}
      />

      <NavBar />
      <div className="max-w-2xl mx-auto px-6 py-12 relative">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white shadow-card font-bold text-xs text-primary-600 mb-3">
            <Sparkles size={12} /> AI study kit generator
          </span>
          <h1 className="font-display text-3xl font-extrabold mb-2">What are we studying today?</h1>
          <p className="text-ink/60 font-semibold mb-6">
            Paste your notes, or upload a PDF / photo — NoteBuddy will build your study kit.
          </p>

          <div className="flex gap-2 mb-5 flex-wrap" data-tour="mode-toggle">
            <button
              onClick={() => switchMode("text")}
              className={`flex-1 py-3 rounded-xl2 font-bold flex items-center justify-center gap-2 border-2 transition-all ${
                mode === "text" ? "bg-primary-500 border-primary-500 text-white" : "bg-white border-primary-100 text-ink/60"
              }`}
            >
              <FileText size={18} /> Paste text
            </button>
            <button
              onClick={() => switchMode("file")}
              className={`flex-1 py-3 rounded-xl2 font-bold flex items-center justify-center gap-2 border-2 transition-all ${
                mode === "file" ? "bg-primary-500 border-primary-500 text-white" : "bg-white border-primary-100 text-ink/60"
              }`}
            >
              <ImageIcon size={18} /> PDF / photo
            </button>
            <button
              onClick={() => switchMode("audio")}
              className={`flex-1 py-3 rounded-xl2 font-bold flex items-center justify-center gap-2 border-2 transition-all ${
                mode === "audio" ? "bg-primary-500 border-primary-500 text-white" : "bg-white border-primary-100 text-ink/60"
              }`}
            >
              <Mic size={18} /> Record / audio
            </button>
          </div>

          {mode === "text" ? (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your notes, textbook paragraph, or lecture transcript here..."
                rows={10}
                className="w-full p-4 rounded-xl2 bg-white shadow-card outline-none font-semibold focus:ring-2 focus:ring-primary-300 mb-3"
              />
              <div className="flex items-center gap-2 flex-wrap mb-6" data-tour="example-chips">
                <span className="text-xs font-bold text-ink/40">Or try an example:</span>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => useExample(ex)}
                    className="px-3 py-1.5 rounded-full bg-white shadow-card text-xs font-bold text-ink/70 hover:text-primary-600 hover:shadow-soft transition-all"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </>
          ) : mode === "file" ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 rounded-xl2 bg-white shadow-card border-2 border-dashed border-primary-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary-400 transition-colors mb-6"
            >
              <UploadCloud size={32} className="text-primary-400" />
              <p className="font-bold text-ink/60">
                {file ? file.name : "Click to choose a PDF or image"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          ) : null}

          {mode === "audio" && (
            <div className="mb-6 space-y-4">
              <div className="w-full rounded-xl2 bg-white shadow-card border-2 border-dashed border-primary-200 flex flex-col items-center justify-center gap-3 py-8">
                {recording ? (
                  <>
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className="w-14 h-14 rounded-full bg-coral-500 flex items-center justify-center text-white"
                    >
                      <Mic size={26} />
                    </motion.div>
                    <p className="font-bold text-ink/60">Listening... speak your notes aloud</p>
                    <button
                      onClick={stopRecording}
                      className="px-5 py-2.5 rounded-xl2 bg-coral-500 text-white font-bold flex items-center gap-2 hover:bg-coral-600 transition-colors"
                    >
                      <Square size={16} /> Stop recording
                    </button>
                  </>
                ) : audioUrl ? (
                  <>
                    <Play size={28} className="text-primary-400" />
                    <p className="font-bold text-ink/60">Recording ready</p>
                    <audio src={audioUrl} controls className="w-64" />
                    <div className="flex gap-2">
                      <button
                        onClick={startRecording}
                        className="px-4 py-2 rounded-xl2 bg-white border-2 border-primary-200 text-primary-600 font-bold text-sm hover:border-primary-400 transition-colors"
                      >
                        Re-record
                      </button>
                      <button
                        onClick={clearAudio}
                        className="px-4 py-2 rounded-xl2 bg-white border-2 border-coral-200 text-coral-500 font-bold text-sm flex items-center gap-1 hover:border-coral-400 transition-colors"
                      >
                        <Trash2 size={14} /> Clear
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Mic size={28} className="text-primary-400" />
                    <p className="font-bold text-ink/60">Record a lecture, or read your notes aloud</p>
                    <button
                      onClick={startRecording}
                      className="px-5 py-2.5 rounded-xl2 bg-primary-500 text-white font-bold flex items-center gap-2 hover:bg-primary-600 transition-colors"
                    >
                      <Mic size={16} /> Start recording
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-primary-100" />
                <span className="text-xs font-bold text-ink/30">OR</span>
                <div className="flex-1 h-px bg-primary-100" />
              </div>

              <div
                onClick={() => audioFileInputRef.current?.click()}
                className="w-full h-24 rounded-xl2 bg-white shadow-card border-2 border-dashed border-primary-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary-400 transition-colors"
              >
                <UploadCloud size={22} className="text-primary-400" />
                <p className="font-bold text-ink/60 text-sm">
                  {file && !audioUrl ? file.name : "Upload an audio file (mp3, wav, m4a...)"}
                </p>
                <input
                  ref={audioFileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac,.flac"
                  className="hidden"
                  onChange={(e) => {
                    const picked = e.target.files?.[0] ?? null;
                    setFile(picked);
                    setAudioUrl(null);
                  }}
                />
              </div>
            </div>
          )}

          <div data-tour="level-slider">
            <p className="text-sm font-bold text-ink/70 mb-2">How should NoteBuddy explain it?</p>
            <LevelSlider value={level} onChange={setLevel} />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            data-tour="generate-btn"
            className="mt-8 w-full py-4 rounded-xl2 bg-primary-500 text-white font-bold text-lg shadow-pop hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                >
                  <Wand2 size={20} />
                </motion.span>
                NoteBuddy is thinking...
              </>
            ) : (
              <>
                <Wand2 size={20} /> Generate my study kit
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
