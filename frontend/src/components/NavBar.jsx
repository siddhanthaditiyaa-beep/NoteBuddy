import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, LogOut, ChevronDown, Menu, X, LayoutDashboard, Brain, Layers, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";

function AccountMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

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
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-coral-500 hover:bg-coral-50 transition-colors"
            >
              <LogOut size={16} /> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
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
    <nav className="sticky top-0 z-40 backdrop-blur-md bg-white/70 border-b border-primary-100 relative">
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
                to="/upload"
                data-tour="new-note-btn"
                className="hidden sm:inline-flex text-sm font-bold px-4 py-2 rounded-xl2 bg-primary-500 text-white shadow-soft hover:bg-primary-600 transition-colors"
              >
                + New Note
              </Link>
              <AccountMenu />
              <button
                onClick={() => setMobileOpen((o) => !o)}
                className="sm:hidden w-9 h-9 rounded-xl2 bg-white shadow-card flex items-center justify-center text-ink/70 shrink-0"
                title="Menu"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
            </>
          ) : (
            <>
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
