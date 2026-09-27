// Groups the Results page's 10 tabs by intent instead of build order — see
// TAB_GROUPS's original inline comment in Results.jsx for why. Pulled out
// into its own module (rather than living inline in the page) so the
// grouping logic is a plain, unit-testable function instead of something
// only reachable by rendering the whole page.
export const TAB_GROUPS = [
  { id: "learn", label: "Learn", tabs: ["summary", "graph", "mindmap"] },
  { id: "practice", label: "Practice", tabs: ["flashcards", "practice", "quiz", "teachback", "debate", "exam"] },
  { id: "chat", label: "Chat", tabs: ["chat"] },
];

export function groupForTab(tabId) {
  return TAB_GROUPS.find((g) => g.tabs.includes(tabId))?.id || "learn";
}
