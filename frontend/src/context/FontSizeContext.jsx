import { createContext, useContext, useEffect, useState } from "react";

const FontSizeContext = createContext(null);
const STORAGE_KEY = "notebuddy_font_scale";
const MIN_SCALE = 0.875; // ~14px
const MAX_SCALE = 1.25; // ~20px
const STEP = 0.125;

// Since Tailwind's text-* utilities are rem-based by default, scaling the
// root font-size (--base-font-size, applied to <html> in index.css) scales
// the whole app's text proportionally — one CSS variable instead of a
// per-component "dark:"-style pass, matching the theme toggle's approach.
export function FontSizeProvider({ children }) {
  const [scale, setScale] = useState(() => {
    try {
      const saved = parseFloat(localStorage.getItem(STORAGE_KEY));
      return Number.isFinite(saved) ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, saved)) : 1;
    } catch {
      return 1;
    }
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--base-font-size", `${16 * scale}px`);
    try {
      localStorage.setItem(STORAGE_KEY, String(scale));
    } catch {
      /* ignore — private browsing / storage blocked */
    }
  }, [scale]);

  const increase = () => setScale((s) => Math.min(MAX_SCALE, Math.round((s + STEP) * 1000) / 1000));
  const decrease = () => setScale((s) => Math.max(MIN_SCALE, Math.round((s - STEP) * 1000) / 1000));

  return (
    <FontSizeContext.Provider
      value={{ scale, increase, decrease, atMin: scale <= MIN_SCALE, atMax: scale >= MAX_SCALE }}
    >
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  return useContext(FontSizeContext);
}
