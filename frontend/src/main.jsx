import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Every deploy renames the JS chunk files (content-hashed by Vite). If
// someone already has the app open in a tab when we push a new batch, that
// tab's in-memory copy still references the OLD filenames — so the first
// time it lazily loads a chunk it hasn't fetched yet (like the Offline AI
// runtime, or the vendor "lib" bundle), the request 404s with "Failed to
// fetch dynamically imported module", because that exact filename no longer
// exists on the server. This is not a real bug in whatever feature the
// error appears to point at; it just means the tab is running a stale
// build. Vite fires "vite:preloadError" for exactly this case — recover by
// reloading once (a session-storage flag stops an infinite reload loop if
// something else is genuinely broken).
window.addEventListener('vite:preloadError', () => {
  const key = 'notebuddy_reloaded_after_stale_chunk';
  if (sessionStorage.getItem(key)) return; // already tried once this session — don't loop forever
  sessionStorage.setItem(key, '1');
  window.location.reload();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
