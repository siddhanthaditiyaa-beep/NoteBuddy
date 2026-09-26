import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "injectManifest" (not the default "generateSW") because we already
      // have a hand-written service worker (src/sw.js) handling Web Push —
      // this strategy precaches the app shell INTO that file instead of
      // generating a separate one that would compete for the /sw.js slot.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: 'auto',
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      // The offline-AI runtime (@mlc-ai/web-llm, the "lib-*.js" chunk) used
      // to be excluded from the precache manifest via globIgnores, on the
      // theory that a several-MB chunk shouldn't be forced on every visitor
      // who never touches Offline AI. In practice that made "download once,
      // then it works offline" unreliable: it depended on a runtime
      // CacheFirst route (still below, as a second layer of defense) racing
      // against page load, and on ordinary browser HTTP caching surviving
      // until the actual offline test — neither held up in testing. Letting
      // precacheAndRoute grab it at install time, the same guaranteed way it
      // grabs every other core asset, is the only version of this that has
      // actually proven reliable: no globIgnores here means nothing is
      // excluded. The one-time cost is worth it for a headline feature that
      // needs to work the moment someone tests it offline.
      // Workbox refuses to precache anything over 2 MiB by default — and the
      // web-llm runtime chunk is ~6 MB minified. Raising the ceiling here is
      // what actually lets precacheAndRoute grab it instead of silently
      // skipping it (which build output made obvious: "won't be precached").
      injectManifest: { maximumFileSizeToCacheInBytes: 8 * 1024 * 1024 },
      manifest: {
        name: 'NoteBuddy — AI Study Companion',
        short_name: 'NoteBuddy',
        description: 'Turn your notes into summaries, flashcards, and quizzes with AI.',
        theme_color: '#7C5CFC',
        background_color: '#F7F6FB',
        display: 'standalone',
        start_url: '/dashboard',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
