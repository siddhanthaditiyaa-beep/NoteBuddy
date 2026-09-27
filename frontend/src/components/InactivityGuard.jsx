import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

// Auto-logs out anyone who leaves a NoteBuddy tab open and idle — mainly
// so a shared/public machine (a college lab computer, someone's demo
// laptop passed around at a competition) doesn't stay signed in to a real
// account indefinitely. 30 minutes of no mouse/keyboard/touch/scroll
// activity anywhere in the tab signs the person out and sends them back
// to the login page with an explanation, rather than silently dropping
// them mid-action.
const IDLE_LIMIT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];

export default function InactivityGuard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const timerRef = useRef(null);

  useEffect(() => {
    if (!user) {
      clearTimeout(timerRef.current);
      return;
    }

    const logOutForInactivity = async () => {
      await signOut();
      toast("You were signed out after 30 minutes of inactivity.", { icon: "\u{1F4A4}" });
      navigate("/login");
    };

    const resetTimer = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(logOutForInactivity, IDLE_LIMIT_MS);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    return () => {
      clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return null;
}
