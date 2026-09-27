import { describe, it, expect } from "vitest";
import { getBadgeVisual, BADGE_ICONS } from "../badges";

describe("getBadgeVisual", () => {
  it("returns the matching visual for a known badge id", () => {
    const visual = getBadgeVisual("week_streak");
    expect(visual).toBe(BADGE_ICONS.week_streak);
    expect(visual.color).toBe("text-primary-600");
  });

  it("falls back to a default visual for an unknown badge id instead of throwing", () => {
    const visual = getBadgeVisual("some_future_badge_the_ui_hasnt_shipped_yet");
    // lucide-react icons are React.forwardRef objects, not plain functions,
    // so this just confirms an icon component came back at all, then checks
    // the presentation fields explicitly.
    expect(visual.icon).toBeTruthy();
    expect(visual.color).toBe("text-primary-500");
    expect(visual.bg).toBe("bg-primary-50");
  });
});
