import { useEffect } from "react";
import { prewarmOfflineModelIfNeeded } from "../lib/offlineAI";

// Kicks off the offline-AI engine warm-up as soon as the tab goes offline
// (or loads already offline) with a previously-downloaded model, so chat
// and the flashcard "explain differently" button aren't the ones paying
// the cold-start cost on whichever feature happens to be used first. See
// prewarmOfflineModelIfNeeded's comment in lib/offlineAI.js for why this
// matters — it was making offline flashcard explanations look broken.
export default function OfflineEnginePrewarmer() {
  useEffect(() => {
    prewarmOfflineModelIfNeeded();
    window.addEventListener("offline", prewarmOfflineModelIfNeeded);
    return () => window.removeEventListener("offline", prewarmOfflineModelIfNeeded);
  }, []);

  return null;
}
