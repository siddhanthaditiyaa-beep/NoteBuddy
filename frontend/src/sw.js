// Custom service worker source — built with vite-plugin-pwa's
// "injectManifest" strategy (see vite.config.js), which replaces the
// self.__WB_MANIFEST placeholder below with the real list of built
// assets at build time. This keeps our existing hand-written Web Push
// logic (unchanged from before) AND adds offline app-shell caching in
// the same file, instead of vite-plugin-pwa generating a separate
// service worker that would fight this one for the single /sw.js slot.
import { precacheAndRoute } from "workbox-precaching";
import { NetworkFirst } from "workbox-strategies";
import { registerRoute } from "workbox-routing";

precacheAndRoute(self.__WB_MANIFEST);

// Study kits and note lists: try the network first (so a logged-in student
// always sees fresh data when online), but fall back to whatever was last
// cached when there's no connection — a hostel wifi dead zone or a metro
// commute shouldn't mean flashcards/quizzes already viewed become
// unreachable. Generation endpoints (POST /process, /chat, etc.) are left
// alone — those genuinely need a live connection.
registerRoute(
  ({ url, request }) =>
    request.method === "GET" &&
    (url.pathname.startsWith("/api/notes/list") ||
      url.pathname.startsWith("/api/notes/") && !url.pathname.includes("stream")),
  new NetworkFirst({ cacheName: "notebuddy-api-cache", networkTimeoutSeconds: 4 })
);

// --- Web Push (due-flashcard reminders) — unchanged from the original sw.js ---
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "NoteBuddy", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "NoteBuddy";
  const options = {
    body: data.body || "",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.skipWaiting();
clients.claim();
