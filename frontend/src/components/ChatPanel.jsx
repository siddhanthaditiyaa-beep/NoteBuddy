import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Send, Bot, User, Mic, Square } from "lucide-react";
import { chatAboutNotes } from "../lib/api";

const SpeechRecognitionAPI =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function ChatPanel({ rawText }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm NoteBuddy 👋 Ask me anything about this material and I'll explain it." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cancel any in-progress voice capture if the panel unmounts mid-listen.
  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  const toggleListen = () => {
    if (!SpeechRecognitionAPI) {
      toast.error("Voice input isn't supported in this browser — try Chrome.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => {
      toast.error("Couldn't catch that — try again?");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    const nextMessages = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const { reply } = await chatAboutNotes({ rawText, question, history: nextMessages });
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "Hmm, I couldn't reach the AI just now. Try again?" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl2 shadow-card flex flex-col h-[420px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center text-white shrink-0">
                <Bot size={14} />
              </div>
            )}
            <div
              className={`max-w-[75%] px-4 py-2.5 rounded-xl2 text-sm font-semibold ${
                m.role === "user" ? "bg-primary-500 text-white" : "bg-primary-50 text-ink"
              }`}
            >
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-ink/10 flex items-center justify-center shrink-0">
                <User size={14} />
              </div>
            )}
          </motion.div>
        ))}
        {loading && (
          <div className="flex gap-1 pl-9">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-2 h-2 rounded-full bg-primary-300"
                animate={{ y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
              />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-primary-50 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={listening ? "Listening..." : "Ask a question about this..."}
          className="flex-1 px-4 py-2.5 rounded-xl2 bg-primary-50 outline-none font-semibold text-sm focus:ring-2 focus:ring-primary-300"
        />
        <button
          onClick={toggleListen}
          title={listening ? "Stop listening" : "Ask by voice"}
          className={`w-10 h-10 rounded-xl2 flex items-center justify-center shrink-0 transition-colors ${
            listening ? "bg-coral-500 text-white animate-pulse" : "bg-primary-50 text-primary-600 hover:bg-primary-100"
          }`}
        >
          {listening ? <Square size={14} /> : <Mic size={16} />}
        </button>
        <button
          onClick={send}
          disabled={loading}
          className="w-10 h-10 rounded-xl2 bg-primary-500 text-white flex items-center justify-center shrink-0 hover:bg-primary-600 disabled:opacity-50 transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
