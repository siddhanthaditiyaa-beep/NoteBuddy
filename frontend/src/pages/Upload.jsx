import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  UploadCloud, FileText, Image as ImageIcon, Wand2, Sparkles, Mic, Square, Play, Trash2, X, Zap,
  Camera, FolderOpen, Loader2, ArrowLeft, FileWarning,
} from "lucide-react";
import NavBar from "../components/NavBar";
import LevelSlider from "../components/LevelSlider";
import QuizCountSlider from "../components/QuizCountSlider";
import LanguageSelector from "../components/LanguageSelector";
import { useAuth } from "../context/AuthContext";
import { processNote, extractText } from "../lib/api";

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

const DOC_ACCEPT = ".pdf,image/*";

// Shrinks a photographed page down before it ever leaves the device — a
// typical 4-8MB phone photo becomes ~200-500KB, which matters a lot on
// limited mobile data. Pure canvas, no extra npm dependency. PDFs and
// anything compression can't shrink are returned untouched.
async function compressImage(file, maxWidth = 1600, quality = 0.75) {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file; // compression didn't help — keep the original
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file; // if anything goes wrong, just upload the original
  }
}

let pageIdCounter = 0;

export default function Upload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("text");
  const [text, setText] = useState("");
  const [level, setLevel] = useState("beginner");
  const [quizCount, setQuizCount] = useState(5);
  const [language, setLanguage] = useState("English");
  const [cramMode, setCramMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioFileInputRef = useRef(null);

  // --- Multi-page file mode (PDF / photos) ------------------------------
  // "pages" holds every page the student has added (usually several photos
  // of one chapter of handwritten notes) — extraction joins them into one
  // block of text the student reviews/edits before anything is sent to
  // Gemini, so a bad OCR read never silently wastes a generation.
  const [pages, setPages] = useState([]); // [{id, file, previewUrl}]
  const [extractedText, setExtractedText] = useState(null); // null = not extracted yet
  const [extracting, setExtracting] = useState(false);
  const cameraInputRef = useRef(null);
  const browseInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  // --- Audio mode ---------------------------------------------------------
  const [file, setFile] = useState(null);
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

  const resetPages = () => {
    pages.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
    setPages([]);
    setExtractedText(null);
  };

  const switchMode = (m) => {
    setMode(m);
    setFile(null);
    setAudioUrl(null);
    resetPages();
  };

  const addFiles = async (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const accepted = incoming.filter((f) => f.type === "application/pdf" || f.type.startsWith("image/"));
    if (accepted.length < incoming.length) {
      toast.error("Only PDF and image files are supported.");
    }
    const processed = await Promise.all(
      accepted.map(async (f) => {
        const compressed = await compressImage(f);
        return {
          id: `p${pageIdCounter++}`,
          file: compressed,
          previewUrl: compressed.type.startsWith("image/") ? URL.createObjectURL(compressed) : null,
        };
      })
    );
    setPages((prev) => [...prev, ...processed]);
    setExtractedText(null); // adding/removing pages invalidates any previous extraction
  };

  const removePage = (id) => {
    setPages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
    setExtractedText(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleExtract = async () => {
    if (!pages.length) {
      toast.error("Add at least one page first.");
      return;
    }
    setExtracting(true);
    try {
      const res = await extractText({ files: pages.map((p) => p.file) });
      setExtractedText(res.text || "");
    } catch (e) {
      toast.error(e.message || "Couldn't read those files — try a clearer photo or a different PDF.");
    } finally {
      setExtracting(false);
    }
  };

  const useExample = (example) => {
    setMode("text");
    setText(example.text);
    toast.success("Example loaded — feel free to edit it, or just generate!");
  };

  const handleSubmit = async () => {
    const effectiveText = mode === "file" ? extractedText : mode === "text" ? text : null;

    if (mode === "text" && text.trim().length < 20) {
      toast.error("Paste a bit more text so NoteBuddy has something to work with!");
      return;
    }
    if (mode === "file" && (extractedText === null || extractedText.trim().length < 20)) {
      toast.error("Extract and review the text from your pages first.");
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
        quizCount,
        language,
        mode: cramMode ? "cram" : "full",
        text: mode === "audio" ? undefined : effectiveText,
        file: mode === "audio" ? file : undefined,
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

  const wordCount = extractedText ? extractedText.trim().split(/\s+/).filter(Boolean).length : 0;
  const suspiciouslyShort = extractedText !== null && wordCount > 0 && wordCount < 15;

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

          {mode === "text" && (
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
          )}

          {mode === "file" && extractedText === null && (
            <div className="mb-6 space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                className={`w-full rounded-xl2 bg-white shadow-card border-2 border-dashed transition-colors p-5 ${
                  dragOver ? "border-primary-400 bg-primary-50/40" : "border-primary-200"
                }`}
              >
                {pages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <UploadCloud size={32} className="text-primary-400" />
                    <p className="font-bold text-ink/60 px-6">
                      Drag pages here, take a photo, or browse a PDF / images
                    </p>
                    <p className="text-xs font-semibold text-ink/40">Multiple pages? Add them all — they'll be combined into one note.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-1">
                    {pages.map((p, i) => (
                      <div key={p.id} className="relative aspect-square rounded-xl2 overflow-hidden bg-primary-50 border border-primary-100">
                        {p.previewUrl ? (
                          <img src={p.previewUrl} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-primary-400">
                            <FileText size={24} />
                            <span className="text-[10px] font-bold mt-1 px-1 text-center truncate w-full">{p.file.name}</span>
                          </div>
                        )}
                        <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-ink/60 text-white text-[10px] font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePage(p.id)}
                          title="Remove page"
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-coral-500 text-white flex items-center justify-center"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 py-2.5 rounded-xl2 bg-primary-50 text-primary-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary-100 transition-colors"
                  >
                    <Camera size={16} /> Take photo
                  </button>
                  <button
                    type="button"
                    onClick={() => browseInputRef.current?.click()}
                    className="flex-1 py-2.5 rounded-xl2 bg-white border-2 border-primary-100 text-ink/70 font-bold text-sm flex items-center justify-center gap-2 hover:border-primary-300 transition-colors"
                  >
                    <FolderOpen size={16} /> Browse files
                  </button>
                </div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                />
                <input
                  ref={browseInputRef}
                  type="file"
                  accept={DOC_ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                />
              </div>

              {pages.length > 0 && (
                <button
                  onClick={handleExtract}
                  disabled={extracting}
                  className="w-full py-3.5 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {extracting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Reading {pages.length > 1 ? `${pages.length} pages` : "page"}...
                    </>
                  ) : (
                    <>Extract text from {pages.length} page{pages.length === 1 ? "" : "s"}</>
                  )}
                </button>
              )}
            </div>
          )}

          {mode === "file" && extractedText !== null && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setExtractedText(null)}
                  className="flex items-center gap-1.5 text-xs font-bold text-ink/50 hover:text-primary-600 transition-colors"
                >
                  <ArrowLeft size={14} /> Back to pages
                </button>
                <span className="text-xs font-bold text-ink/40">{wordCount} words</span>
              </div>
              {suspiciouslyShort && (
                <div className="mb-2 px-3 py-2 rounded-xl2 bg-sun-50 border border-sun-300 text-xs font-bold text-ink/70 flex items-center gap-2">
                  <FileWarning size={14} className="text-sun-500 shrink-0" />
                  That's not much text — the photo/PDF may have read poorly. Double-check it below, or retake the photo.
                </div>
              )}
              <textarea
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                rows={10}
                placeholder="Extracted text will appear here — fix anything OCR got wrong before generating."
                className={`w-full p-4 rounded-xl2 bg-white shadow-card outline-none font-semibold focus:ring-2 mb-1 ${
                  suspiciouslyShort ? "ring-2 ring-sun-300 focus:ring-sun-400" : "focus:ring-primary-300"
                }`}
              />
              <p className="text-xs font-semibold text-ink/40">
                This is exactly what NoteBuddy will study from — edit anything the scan got wrong, then generate below.
              </p>
            </div>
          )}

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
                    <audio src={audioUrl} controls className="w-full max-w-[260px]" />
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
                onClick={() => !(file && !audioUrl) && audioFileInputRef.current?.click()}
                className={`relative w-full h-24 rounded-xl2 bg-white shadow-card border-2 border-dashed border-primary-200 flex flex-col items-center justify-center gap-1 transition-colors ${
                  file && !audioUrl ? "" : "cursor-pointer hover:border-primary-400"
                }`}
              >
                {file && !audioUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (audioFileInputRef.current) audioFileInputRef.current.value = "";
                    }}
                    title="Remove file"
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-coral-50 text-coral-500 flex items-center justify-center hover:bg-coral-100 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
                <UploadCloud size={22} className="text-primary-400" />
                <p className="font-bold text-ink/60 text-sm px-8 text-center">
                  {file && !audioUrl ? file.name : "Upload an audio file (mp3, wav, m4a...)"}
                </p>
                {!(file && !audioUrl) && (
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
                )}
              </div>
            </div>
          )}

          <div data-tour="level-slider">
            <p className="text-sm font-bold text-ink/70 mb-2">How should NoteBuddy explain it?</p>
            <LevelSlider value={level} onChange={setLevel} />
          </div>

          <div className="mt-6">
            <p className="text-sm font-bold text-ink/70 mb-2">How many quiz questions?</p>
            <QuizCountSlider value={quizCount} onChange={setQuizCount} />
          </div>

          <div className="mt-6">
            <p className="text-sm font-bold text-ink/70 mb-2">Language</p>
            <LanguageSelector value={language} onChange={setLanguage} />
          </div>

          <button
            type="button"
            onClick={() => setCramMode((c) => !c)}
            className={`mt-6 w-full flex items-center gap-3 p-4 rounded-xl2 border-2 text-left transition-all ${
              cramMode ? "bg-sun-50 border-sun-400" : "bg-white border-primary-100 hover:border-primary-200"
            }`}
          >
            <div className={`w-9 h-9 rounded-xl2 flex items-center justify-center shrink-0 ${cramMode ? "bg-sun-400 text-white" : "bg-primary-50 text-primary-500"}`}>
              <Zap size={18} />
            </div>
            <div>
              <p className="font-bold text-sm">Exam Cram Mode</p>
              <p className="text-xs font-semibold text-ink/50">
                Exam in a few hours? Get a dense 1-page cheat sheet + the 10 highest-yield flashcards instead of the full kit.
              </p>
            </div>
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading || (mode === "file" && extractedText === null)}
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
