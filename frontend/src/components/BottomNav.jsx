import { NavLink } from "react-router-dom";
import { LayoutDashboard, UploadCloud, Brain, Layers } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const TABS = [
  { icon: LayoutDashboard, label: "Home", to: "/dashboard" },
  { icon: UploadCloud, label: "Upload", to: "/upload" },
  { icon: Brain, label: "Review", to: "/review" },
  { icon: Layers, label: "Combine", to: "/combine" },
];

// Shown only on mobile (md:hidden) and only when logged in — the desktop
// NavBar stays exactly as it is; the two are mutually exclusive by
// breakpoint, not a replacement of one another.
export default function BottomNav() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 md:hidden bg-white dark:bg-[#1c1b2e] border-t border-primary-100 dark:border-white/10 flex justify-around py-2 z-40 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-bold transition-colors ${
              isActive ? "text-primary-600" : "text-ink/40"
            }`
          }
        >
          <t.icon size={20} />
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
