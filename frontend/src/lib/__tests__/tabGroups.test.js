import { describe, it, expect } from "vitest";
import { TAB_GROUPS, groupForTab } from "../tabGroups";

describe("tabGroups", () => {
  it("assigns every tab in TAB_GROUPS to exactly one group", () => {
    const allTabIds = TAB_GROUPS.flatMap((g) => g.tabs);
    const uniqueTabIds = new Set(allTabIds);
    expect(uniqueTabIds.size).toBe(allTabIds.length);
  });

  it("maps a known tab id to its group", () => {
    expect(groupForTab("flashcards")).toBe("practice");
    expect(groupForTab("summary")).toBe("learn");
    expect(groupForTab("chat")).toBe("chat");
  });

  it("falls back to 'learn' for an unrecognized tab id", () => {
    expect(groupForTab("not-a-real-tab")).toBe("learn");
  });

  it("keeps Practice as the active-recall group (the group most likely to grow)", () => {
    const practice = TAB_GROUPS.find((g) => g.id === "practice");
    expect(practice.tabs).toEqual(
      expect.arrayContaining(["flashcards", "practice", "quiz", "teachback", "debate", "exam"])
    );
  });
});
