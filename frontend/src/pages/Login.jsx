import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Sparkles, Wand2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../lib/constants";
import { resetDemoAccount } from "../lib/api";

function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" {...props}>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.6-6 7.9-11.3 7.9-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.1-5.1C33.6 6.1 29 4.4 24 4.4 12.9 4.4 4 13.3 4 24.4s8.9 20 20 20c11.5 0 19.1-8.1 19.1-19.5 0-1.3-.1-2.3-.5-4.4z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l5.9 4.3C13.9 15.3 18.6 12.4 24 12.4c3 0 5.8 1.1 7.9 3l5.1-5.1C33.6 6.1 29 4.4 24 4.4c-7.7 0-14.4 4.4-17.7 10.3z"
      />
      <path
        fill="#4CAF50"
        d="M24 44.4c4.9 0 9.4-1.9 12.8-4.9l-5.9-5c-2 1.4-4.5 2.2-6.9 2.2-5.3 0-9.7-3.4-11.3-8l-6 4.6c3.3 6.5 10 10.9 17.3 10.9z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.2-2.2 4.1-4.1 5.5l5.9 5c-.4.4 6.3-4.6 6.3-13.7 0-1.3-.1-2.3-.5-4.4z"
      />
    </svg>
  );
}

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    const loggedInIsDemo = email.toLowerCase() === DEMO_EMAIL;
    if (loggedInIsDemo && data?.user?.id) {
      // Wipe the demo account's data so every run starts fresh, and make
      // sure the onboarding tour shows again for this demo session.
      try {
        await resetDemoAccount(data.user.id);
      } catch {
        /* non-fatal — demo still works, just may show old data */
      }
      localStorage.removeItem(`notebuddy_tour_seen_${data.user.id}`);
      toast.success("Demo ready — everything's reset for you!");
    } else {
      toast.success("Welcome back!");
    }
    navigate("/dashboard");
  };

  const handleGoogle = async () => {
    const { error } = await signInWithGoogle();
    if (error) toast.error(error.message);
  };

  const fillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    toast.success("Demo details filled — click Log in!");
  };

  return (
    <div className="min-h-screen blob-bg flex items-center justify-center px-6">
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={submit}
        className="bg-white rounded-xl3 shadow-pop p-8 w-full max-w-sm"
      >
        <Link to="/" className="flex items-center gap-2 font-display font-extrabold text-xl mb-6">
          <div className="w-9 h-9 rounded-xl2 bg-primary-500 flex items-center justify-center text-white">
            <Sparkles size={18} />
          </div>
          NoteBuddy
        </Link>
        <h1 className="font-display text-2xl font-bold mb-1">Welcome back</h1>
        <p className="text-ink/50 font-semibold text-sm mb-6">Log in to keep your streak going.</p>

        <button
          type="button"
          onClick={fillDemo}
          className="w-full mb-4 py-2.5 rounded-xl2 border-2 border-sun-300 bg-sun-300/10 text-ink font-bold text-sm flex items-center justify-center gap-2 hover:bg-sun-300/20 transition-colors"
        >
          <Wand2 size={16} className="text-sun-500" /> Try the demo account
        </button>

        <button
          type="button"
          onClick={handleGoogle}
          className="w-full mb-4 py-2.5 rounded-xl2 border-2 border-primary-100 bg-white text-ink font-bold text-sm flex items-center justify-center gap-2 hover:border-primary-300 transition-colors"
        >
          <GoogleIcon /> Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-primary-100" />
          <span className="text-xs font-bold text-ink/30">OR</span>
          <div className="h-px flex-1 bg-primary-100" />
        </div>

        <label className="block text-sm font-bold text-ink/70 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              passwordRef.current?.focus();
            }
          }}
          className="w-full mb-4 px-4 py-2.5 rounded-xl2 bg-primary-50 outline-none font-semibold focus:ring-2 focus:ring-primary-300"
        />

        <label className="block text-sm font-bold text-ink/70 mb-1">Password</label>
        <input
          ref={passwordRef}
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 px-4 py-2.5 rounded-xl2 bg-primary-50 outline-none font-semibold focus:ring-2 focus:ring-primary-300"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft hover:bg-primary-600 disabled:opacity-50 transition-colors"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>

        <p className="text-center text-sm font-semibold text-ink/50 mt-5">
          New here?{" "}
          <Link to="/signup" className="text-primary-600 font-bold">
            Create an account
          </Link>
        </p>
      </motion.form>
    </div>
  );
}
