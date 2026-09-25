// Hand-maintained "what's new" list — a small trust/credibility signal for
// a demo: showing that NoteBuddy is actively built and shipped, not a
// one-off submission. Newest entry first; bump the top "version" (any
// string works, it's just compared for equality) whenever a new entry is
// added so returning users see the "new" dot again.
export const CHANGELOG = [
  {
    version: "2026-09-26",
    date: "26 Sep 2026",
    items: [
      "Async group-quiz leaderboard on shared study kits — take the quiz whenever you like and see how you stack up",
      "Delete-my-account flow — a real one, not a support email",
      "Semantic search across all your notes",
      "\"Explain it differently\" button on flashcards",
      "Short-answer practice mode",
      "Study podcast mode — listen to a note's summary, terms, and flashcards hands-free",
      "Pomodoro focus timer on the Review page",
    ],
  },
  {
    version: "2026-09-20",
    date: "20 Sep 2026",
    items: [
      "Public, searchable gallery of shared study kits",
      "Dashboard \"time saved\" estimate",
      "Shareable achievement cards for badges and streaks",
      "Board/exam context (CBSE, ICSE, JEE, NEET, IB, and more) baked into generation",
    ],
  },
  {
    version: "2026-09-14",
    date: "14 Sep 2026",
    items: [
      "Offline installable app (PWA) with cached notes",
      "Sharper OCR for handwritten photos",
      "Import a YouTube lecture's transcript directly",
    ],
  },
];

export const LATEST_VERSION = CHANGELOG[0].version;
