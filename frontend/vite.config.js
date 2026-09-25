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
      injectManifest: {
        // The offline-AI model runtime (@mlc-ai/web-llm) is a large,
        // lazily-imported chunk only ever loaded if a student explicitly
        // opts into Offline AI from the account menu — it must NOT be part
        // of the app-shell precache every visitor downloads just to open
        // the site. The model weights it fetches afterward are cached by
        // web-llm itself (via the Cache API), completely separately from
        // this service worker's precache list.
        globIgnores: ['**/lib-*.js'],
      },
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
