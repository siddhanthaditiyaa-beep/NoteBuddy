import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Sparkles, LogOut, ChevronDown, Menu, X, LayoutDashboard, Brain, Layers, Plus, Sun, Moon, CalendarDays, Bell, BellOff, Gift, ShieldAlert, WifiOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useFontSize } from "../context/FontSizeContext";
import { isPushSupported, getPushSubscriptionStatus, enablePushReminders, disablePushReminders } from "../lib/push";
import { deleteAccount } from "../lib/api";
import { LATEST_VERSION } from "../lib/changelog";
import ChangelogPanel from "./ChangelogPanel";
import OfflineAIModal from "./OfflineAIModal";

const CHANGELOG_SEEN_KEY = "notebuddy_changelog_seen";

function WhatsNewButton() {
  const [open, setOpen] = useState(false);
  const [hasUnseen, setHasUnseen] = useState(false);

  useEffect(() => {
    setHasUnseen(localStorage.getItem(CHANGELOG_SEEN_KEY) !== LATEST_VERSION);
  }, []);

  const openPanel = () => {
    setOpen(true);
    setHasUnseen(false);
    localStorage.setItem(CHANGELOG_SEEN_KEY, LATEST_VERSION);
  };

  return (
    <>
      <button
        onClick={openPanel}
        title="What's new"
        aria-label="What's new in NoteBuddy"
        className="relative w-9 h-9 rounded-xl2 bg-white dark:bg-[#1c1b2e] shadow-card flex items-center justify-center text-ink/70 shrink-0 hover:text-primary-600 transition-colors"
      >
        <Gift size={16} />
        {hasUnseen && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-coral-500" />}
      </button>
      <ChangelogPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// Requires typing DELETE to confirm — this is irreversible (wipes every
// note and the auth account itself), so a single click isn't enough.
function DeleteAccountModal({ open, onClose }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const confirmDisabled = confirmText.trim().toUpperCase() !== "DELETE" || deleting;

  const handleDelete = async () => {
    if (confirmDisabled) return;
    setDeleting(true);
    try {
      await deleteAccount();
      toast.success("Your account and all its data have been deleted.");
      await signOut();
      navigate("/");
    } catch (e) {
      toast.error(e.message || "Couldn't delete your account right now — please try again.");
      setDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/30 z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-label="Delete your account"
            className="fixed z-[61] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-sm bg-white rounded-xl2 shadow-pop p-6"
          >
            <div className="w-11 h-11 rounded-xl2 bg-coral-50 flex items-center justify-center text-coral-500 mb-4">
              <ShieldAlert size={22} />
            </div>
            <h2 className="font-display text-lg font-bold mb-2">Delete your account?</h2>
            <p className="text-sm font-semibold text-ink/60 mb-4">
              This permanently deletes every note, flashcard, and badge you've made, and can't be undone.
              Type <span className="font-black text-coral-600">DELETE</span> to confirm.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl2 bg-coral-50/50 shadow-card outline-none font-bold text-sm mb-4 focus:ring-2 focus:ring-coral-300"
            />
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl2 bg-primary-50 text-ink/60 font-bold text-sm hover:bg-primary-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmDisabled}
                className="flex-1 py-2.5 rounded-xl2 bg-coral-500 text-white font-bold text-sm hover:bg-coral-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting..." : "Delete forever"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="w-9 h-9 rounded-xl2 bg-white dark:bg-[#1c1b2e] shadow-card flex items-center justify-center text-ink/70 shrink-0 hover:text-primary-600 transition-colors"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

// A-/A+ text-size control — scales the whole app via a root CSS variable
// (see FontSizeContext) since a study app gets heavy use during long,
// tired late-night sessions where readability matters most.
function FontSizeToggle() {
  const fontSize = useFontSize();
  if (!fontSize) return null;
  const { decrease, increase, atMin, atMax } = fontSize;
  return (
    <div className="hidden sm:flex items-center rounded-xl2 bg-white dark:bg-[#1c1b2e] shadow-card overflow-hidden shrink-0">
      <button
        onClick={decrease}
        disabled={atMin}
        title="Decrease text size"
        aria-label="Decrease text size"
        className="w-8 h-9 flex items-center justify-center text-xs font-black text-ink/60 hover:text-primary-600 disabled:opacity-30 transition-colors"
      >
        A-
      </button>
      <div className="w-px h-4 bg-primary-100 dark:bg-white/10" />
      <button
        onClick={increase}
        disabled={atMax}
        title="Increase text size"
        aria-label="Increase text size"
        className="w-8 h-9 flex items-center justify-center text-sm font-black text-ink/60 hover:text-primary-600 disabled:opacity-30 transition-colors"
      >
        A+
      </button>
    </div>
  );
}

function AccountMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const [pushStatus, setPushStatus] = useState("checking"); // checking | unsupported | enabled | disabled
  const [pushBusy, setPushBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [offlineAIOpen, setOfflineAIOpen] = useState(false);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (open) getPushSubscriptionStatus().then(setPushStatus);
  }, [open]);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushStatus === "enabled") {
        await disablePushReminders();
        setPushStatus("disabled");
        toast.success("Flashcard reminders turned off.");
      } else {
        await enablePushReminders();
        setPushStatus("enabled");
        toast.success("You'll get a reminder when flashcards are due!");
      }
    } catch (e) {
      toast.error(e.message || "Couldn't change reminder settings.");
    } finally {
      setPushBusy(false);
    }
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate("/");
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Account";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl2 bg-white shadow-card hover:shadow-soft transition-all"
      >
        <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {initial}
        </div>
        <span className="hidden sm:inline text-sm font-bold text-ink/70 max-w-[120px] truncate">
          {displayName}
        </span>
        <ChevronDown size={14} className={`text-ink/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-60 bg-white rounded-xl2 shadow-pop border border-primary-50 py-2 z-50 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-primary-50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{displayName}</p>
                <p className="text-xs text-ink/40 truncate">{user?.email}</p>
              </div>
            </div>
            {pushStatus !== "unsupported" && (
              <button
                onClick={togglePush}
                disabled={pushBusy || pushStatus === "checking"}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-ink/70 hover:bg-primary-50 transition-colors disabled:opacity-50"
              >
                {pushStatus === "enabled" ? <BellOff size={16} /> : <Bell size={16} />}
                {pushStatus === "enabled" ? "Turn off flashcard reminders" : "Remind me about due flashcards"}
              </button>
            )}
            <button
              onClick={() => {
                setOpen(false);
                setOfflineAIOpen(true);
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-ink/70 hover:bg-primary-50 transition-colors"
            >
              <WifiOff size={16} /> Offline AI
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-coral-500 hover:bg-coral-50 transition-colors"
            >
              <LogOut size={16} /> Log out
            </button>
            <div className="border-t border-primary-50 mt-1 pt-1">
              <button
                onClick={() => {
                  setOpen(false);
                  setDeleteOpen(true);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-ink/30 hover:text-coral-500 hover:bg-coral-50 transition-colors"
              >
                <ShieldAlert size={14} /> Delete my account
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
      <OfflineAIModal open={offlineAIOpen} onClose={() => setOfflineAIOpen(false)} />
    </div>
  );
}

function MobileMenu({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/30 z-40 sm:hidden"
          />
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 right-0 top-full mx-4 mt-2 bg-white rounded-xl2 shadow-pop border border-primary-50 py-2 z-50 sm:hidden"
          >
            <Link
              onClick={onClose}
              to="/dashboard"
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-ink/70 hover:bg-primary-50 transition-colors"
            >
              <LayoutDashboard size={17} /> Dashboard
            </Link>
            <Link
              onClick={onClose}
              to="/review"
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-ink/70 hover:bg-primary-50 transition-colors"
            >
              <Brain size={17} /> Review
            </Link>
            <Link
              onClick={onClose}
              to="/combine"
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-ink/70 hover:bg-primary-50 transition-colors"
            >
              <Layers size={17} /> Combine
            </Link>
            <Link
              onClick={onClose}
              to="/planner"
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-ink/70 hover:bg-primary-50 transition-colors"
            >
              <CalendarDays size={17} /> Study Planner
            </Link>
            <Link
              onClick={onClose}
              to="/upload"
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-primary-600 hover:bg-primary-50 transition-colors"
            >
              <Plus size={17} /> New Note
            </Link>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function NavBar() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 backdrop-blur-md bg-white/70 dark:bg-[#0f0f17]/80 border-b border-primary-100 dark:border-white/10 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link
          to={user ? "/dashboard" : "/"}
          className="flex items-center gap-2 font-display font-extrabold text-lg sm:text-xl text-ink shrink-0"
        >
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl2 bg-primary-500 flex items-center justify-center text-white shadow-soft shrink-0"
          >
            <Sparkles size={16} />
          </motion.div>
          NoteBuddy
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="hidden sm:inline text-sm font-bold text-ink/70 hover:text-primary-600 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/review"
                className="hidden sm:inline text-sm font-bold text-ink/70 hover:text-primary-600 transition-colors"
              >
                Review
              </Link>
              <Link
                to="/combine"
                className="hidden sm:inline text-sm font-bold text-ink/70 hover:text-primary-600 transition-colors"
              >
                Combine
              </Link>
              <Link
                to="/planner"
                className="hidden sm:inline text-sm font-bold text-ink/70 hover:text-primary-600 transition-colors"
              >
                Planner
              </Link>
              <Link
                to="/upload"
                data-tour="new-note-btn"
                className="hidden sm:inline-flex text-sm font-bold px-4 py-2 rounded-xl2 bg-primary-500 text-white shadow-soft hover:bg-primary-600 transition-colors"
              >
                + New Note
              </Link>
              <FontSizeToggle />
              <ThemeToggle />
              <WhatsNewButton />
              <AccountMenu />
              <button
                onClick={() => setMobileOpen((o) => !o)}
                className="sm:hidden w-9 h-9 rounded-xl2 bg-white shadow-card flex items-center justify-center text-ink/70 shrink-0"
                title="Menu"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
            </>
          ) : (
            <>
              <FontSizeToggle />
              <ThemeToggle />
              <Link to="/login" className="text-sm font-bold text-ink/70 hover:text-primary-600">
                Log in
              </Link>
              <Link
                to="/signup"
                className="text-sm font-bold px-3 sm:px-4 py-2 rounded-xl2 bg-primary-500 text-white shadow-soft hover:bg-primary-600 transition-colors whitespace-nowrap"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
