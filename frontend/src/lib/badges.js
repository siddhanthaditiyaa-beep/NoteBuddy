// The backend sends each earned badge's id/label/description; this just maps
// an id to a small bit of visual flair (icon + color) since that part is
// presentation-only and doesn't need to round-trip through the API.
import { Sparkles, Flame, Trophy, Rocket, Crown } from "lucide-react";

export const BADGE_ICONS = {
  first_note: { icon: Sparkles, color: "text-primary-500", bg: "bg-primary-50" },
  five_notes: { icon: Rocket, color: "text-mint-500", bg: "bg-mint-50" },
  ten_notes: { icon: Trophy, color: "text-sun-500", bg: "bg-sun-50" },
  three_streak: { icon: Flame, color: "text-coral-500", bg: "bg-coral-50" },
  week_streak: { icon: Crown, color: "text-primary-600", bg: "bg-primary-50" },
};

export function getBadgeVisual(id) {
  return BADGE_ICONS[id] || { icon: Sparkles, color: "text-primary-500", bg: "bg-primary-50" };
}
