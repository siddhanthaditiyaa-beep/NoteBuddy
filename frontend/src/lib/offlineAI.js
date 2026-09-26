// On-Device Offline AI Fallback — runs a small language model entirely in
// the browser via WebGPU (using @mlc-ai/web-llm), so core features like
// chat and re-explanations keep working with NO network connection and NO
// backend/Gemini call at all, once the model has been downloaded once.
//
// This is opt-in and heavy (the model is a few hundred MB), so nothing
// here downloads automatically — a student has to explicitly turn it on
// once, ideally on Wi-Fi, from Account settings. After that, the browser
// caches the model weights (via the Cache API, same mechanism the PWA
// service worker already uses for offline note caching) so it's available
// even with the network fully off on future visits.

// A small, fast instruction-tuned model — good enough for "explain this
// differently" and basic Q&A against a note's text, without needing a
// beefy GPU. web-llm ships several prebuilt quantized model IDs; this one
// is one of the smallest that still gives coherent answers.
const MODEL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

let enginePromise = null;
let engineInstance = null;

export function isWebGPUSupported() {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}

// Lazily imports the (large) web-llm library only when offline AI is
// actually used — it should never be part of the main app bundle that
// every visitor downloads just to load the landing page. The service
// worker (src/sw.js) caches this specific chunk cache-first the first time
// it's fetched, so it survives future truly-offline sessions — but if
// someone goes offline before that first successful fetch ever happens
// (e.g. testing Offline AI in airplane mode without ever having opened the
// "Download Offline AI" flow on this device while online), the browser has
// nothing to load it from. Give that case an honest, actionable message
// instead of a raw, unhandled fetch error.
async function loadWebLLM() {
  try {
    const webllm = await import("@mlc-ai/web-llm");
    primeOfflineRuntimeCache();
    return webllm;
  } catch {
    throw new Error(
      "Offline AI's engine hasn't been cached on this device yet — reconnect to the internet, reopen NoteBuddy once so it can fetch it, then try Offline AI again."
    );
  }
}

// Belt-and-suspenders alongside the service worker's own CacheFirst route
// for this chunk (src/sw.js): rather than trust that the SW was already
// installed, activated, AND controlling this exact page load in time to
// intercept the import() above (there's a real race the very first time a
// tab loads after a fresh install), explicitly find the chunk's own URL
// from the Performance API and cache it ourselves, directly via the page's
// own Cache Storage access — same cache name the SW route reads from, so
// either one finding it there first is enough. Best-effort: this must
// never throw or block the actual offline-AI flow if anything here fails.
function primeOfflineRuntimeCache() {
  if (typeof caches === "undefined" || typeof performance === "undefined") return;
  try {
    const entry = performance
      .getEntriesByType("resource")
      .reverse() // most recent first — there may be older entries with the same name from earlier navigations
      .find((r) => {
        try {
          return /\/assets\/lib-.*\.js$/.test(new URL(r.name).pathname);
        } catch {
          return false;
        }
      });
    if (!entry) return;
    caches.open("notebuddy-offline-ai-runtime").then((cache) =>
      cache.match(entry.name).then((hit) => {
        if (!hit) cache.add(entry.name).catch(() => {});
      })
    );
  } catch {
    /* best-effort only */
  }
}

export function isOfflineModelReady() {
  try {
    return localStorage.getItem("notebuddy_offline_model_ready") === MODEL_ID;
  } catch {
    return false;
  }
}

// Downloads (or loads from browser cache, if already downloaded) the
// offline model. onProgress receives {progress: 0-1, text} updates so the
// UI can show a real progress bar — this can be a genuinely large download
// on first run.
export async function initOfflineModel(onProgress) {
  if (!isWebGPUSupported()) {
    throw new Error("Your browser doesn't support WebGPU, so offline AI can't run here — try a recent Chrome or Edge.");
  }
  if (engineInstance) return engineInstance;
  if (!enginePromise) {
    enginePromise = (async () => {
      const webllm = await loadWebLLM();
      const engine = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => {
          onProgress?.({ progress: report.progress ?? 0, text: report.text || "Loading offline model..." });
        },
      });
      engineInstance = engine;
      try {
        localStorage.setItem("notebuddy_offline_model_ready", MODEL_ID);
      } catch {
        /* ignore — private browsing, quota, etc. */
      }
      return engine;
    })();
  }
  return enginePromise;
}

export function unloadOfflineModel() {
  engineInstance?.unload?.();
  engineInstance = null;
  enginePromise = null;
  try {
    localStorage.removeItem("notebuddy_offline_model_ready");
  } catch {
    /* ignore */
  }
}

// A simple one-shot chat completion against the offline model. Used for
// both the chat fallback and "explain differently" when there's no
// network — keeps the prompt short since a 0.5B model has a small context
// window and gets unreliable with too much stuffed into it.
export async function askOfflineAI(systemPrompt, userMessage) {
  const engine = await initOfflineModel();
  const reply = await engine.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.6,
    max_tokens: 400,
  });
  return reply.choices?.[0]?.message?.content?.trim() || "";
}
