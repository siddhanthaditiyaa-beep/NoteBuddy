import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, X, Gauge } from "lucide-react";

const RATES = [0.75, 1, 1.25, 1.5, 2];

// Splits into sentence-ish chunks so we can play a queue one utterance at a
// time — this is what makes skip-back/skip-forward, a real progress bar,
// and mid-playback speed changes possible at all. The Web Speech API has
// no native seek, pause-with-position, or "how far through are we" — a
// single giant utterance would only ever support a blunt play/stop.
function splitIntoChunks(text) {
  return (text.match(/[^.!?]+[.!?]*/g) || [text]).map((s) => s.trim()).filter(Boolean);
}

// A Spotify-style transport bar for read-aloud / study-podcast playback —
// play/pause, skip back & forward by sentence, a seekable progress bar,
// and a cycling playback-speed control. Always speaks whatever `text` is
// passed in at mount, so the caller is responsible for building that text
// from whatever's currently on screen (see Results.jsx's altAnswers map).
export default function AudioPlayerBar({ text, lang = "en-US", label, onClose }) {
  const chunksRef = useRef([]);
  const rateRef = useRef(1);
  const chunkIdxRef = useRef(0);
  const stoppedRef = useRef(false);

  const [chunkIndex, setChunkIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rateIdx, setRateIdx] = useState(1); // index into RATES, default 1x

  const pickVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.lang === lang) || voices.find((v) => v.lang?.startsWith(lang.split("-")[0]));
  }, [lang]);

  const speakFrom = useCallback(
    (idx) => {
      const chunks = chunksRef.current;
      if (idx < 0 || idx >= chunks.length) {
        setPlaying(false);
        setPaused(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(chunks[idx]);
      utter.lang = lang;
      utter.rate = rateRef.current;
      const v = pickVoice();
      if (v) utter.voice = v;
      utter.onend = () => {
        if (stoppedRef.current) return;
        const next = chunkIdxRef.current + 1;
        if (next < chunks.length) {
          chunkIdxRef.current = next;
          setChunkIndex(next);
          speakFrom(next);
        } else {
          setPlaying(false);
          setPaused(false);
        }
      };
      utter.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return;
        setPlaying(false);
      };
      window.speechSynthesis.speak(utter);
      chunkIdxRef.current = idx;
      setChunkIndex(idx);
      setPlaying(true);
      setPaused(false);
    },
    [lang, pickVoice]
  );

  useEffect(() => {
    stoppedRef.current = false;
    chunksRef.current = splitIntoChunks(text);
    setTotalChunks(chunksRef.current.length);
    chunkIdxRef.current = 0;
    // Voices sometimes load asynchronously — give them a beat on first mount.
    const kick = () => speakFrom(0);
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = kick;
      setTimeout(kick, 300);
    } else {
      kick();
    }
    return () => {
      stoppedRef.current = true;
      window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const togglePlayPause = () => {
    if (playing && !paused) {
      window.speechSynthesis.pause();
      setPaused(true);
    } else if (playing && paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      speakFrom(Math.min(chunkIdxRef.current, chunksRef.current.length - 1));
    }
  };

  const skip = (dir) => {
    const target = Math.min(Math.max(chunkIdxRef.current + dir, 0), chunksRef.current.length - 1);
    speakFrom(target);
  };

  const cycleRate = () => {
    const next = (rateIdx + 1) % RATES.length;
    rateRef.current = RATES[next];
    setRateIdx(next);
    if (playing) speakFrom(chunkIdxRef.current); // restart current sentence at the new speed
  };

  const seekTo = (e) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const target = Math.round(ratio * (chunksRef.current.length - 1));
    speakFrom(target);
  };

  const pct = totalChunks > 1 ? (chunkIndex / (totalChunks - 1)) * 100 : 0;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,480px)] bg-white rounded-xl3 shadow-pop px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-ink/50 truncate">{label}</p>
        <button onClick={onClose} aria-label="Close player" className="text-ink/30 hover:text-ink/60 transition-colors shrink-0 ml-2">
          <X size={16} />
        </button>
      </div>

      <div
        onClick={seekTo}
        role="slider"
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="h-1.5 rounded-full bg-primary-100 cursor-pointer mb-3 relative"
      >
        <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={cycleRate}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-ink/50 hover:bg-primary-50 hover:text-primary-600 transition-colors"
          title="Playback speed"
        >
          <Gauge size={13} /> {RATES[rateIdx]}x
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => skip(-1)}
            aria-label="Previous sentence"
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink/60 hover:bg-primary-50 hover:text-primary-600 transition-colors"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={togglePlayPause}
            aria-label={playing && !paused ? "Pause" : "Play"}
            className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 transition-colors shadow-soft"
          >
            {playing && !paused ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>
          <button
            onClick={() => skip(1)}
            aria-label="Next sentence"
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink/60 hover:bg-primary-50 hover:text-primary-600 transition-colors"
          >
            <SkipForward size={16} />
          </button>
        </div>

        <p className="text-xs font-bold text-ink/40 tabular-nums w-14 text-right">
          {Math.min(chunkIndex + 1, totalChunks)}/{totalChunks}
        </p>
      </div>
    </div>
  );
}
