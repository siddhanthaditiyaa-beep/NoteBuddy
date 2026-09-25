import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Users, Loader2 } from "lucide-react";
import { getStudyBuddyStatus, setStudyBuddyOptIn, getStudyBuddyMatches } from "../lib/api";

// Study-buddy matching — opt-in only. A student picks their own display
// name (never their real email) and NoteBuddy matches them with other
// opted-in students studying the same subjects, based on the notes
// they've actually saved.
export default function StudyBuddyPanel() {
  const [status, setStatus] = useState(null); // { opt_in, display_name, note } | null
  const [displayName, setDisplayName] = useState("");
  const [note, setNote] = useState("");
  const [matches, setMatches] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getStudyBuddyStatus()
      .then((s) => {
        setStatus(s);
        setDisplayName(s.display_name || "");
        setNote(s.note || "");
        if (s.opt_in) {
          getStudyBuddyMatches()
            .then((r) => setMatches(r.matches || []))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const optIn = async () => {
    if (!displayName.trim()) {
      toast.error("Pick a display name first.");
      return;
    }
    setSaving(true);
    try {
      await setStudyBuddyOptIn({ optIn: true, displayName, note });
      setStatus({ opt_in: true, display_name: displayName, note });
      const res = await getStudyBuddyMatches();
      setMatches(res.matches || []);
      toast.success("You're discoverable to other students studying similar subjects!");
    } catch (e) {
      toast.error(e.message || "Couldn't save that right now.");
    } finally {
      setSaving(false);
    }
  };

  const optOut = async () => {
    setSaving(true);
    try {
      await setStudyBuddyOptIn({ optIn: false, displayName, note });
      setStatus({ opt_in: false, display_name: displayName, note });
      setMatches(null);
    } catch (e) {
      toast.error(e.message || "Couldn't save that right now.");
    } finally {
      setSaving(false);
    }
  };

  if (!status) return null;

  return (
    <div className="bg-white rounded-xl2 shadow-card p-5">
      <h2 className="font-display text-sm font-bold text-ink/50 mb-3 flex items-center gap-2">
        <Users size={16} className="text-primary-500" /> Find a study buddy
      </h2>

      {!status.opt_in ? (
        <>
          <p className="text-sm font-semibold text-ink/50 mb-3">
            Opt in to be matched with other students studying the same subjects as you — only your display name
            (never your email) is ever shown.
          </p>
          <div className="space-y-2 mb-3">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name (e.g. a nickname)"
              maxLength={40}
              className="w-full px-3 py-2 rounded-xl2 bg-primary-50/40 shadow-card outline-none font-semibold text-sm focus:ring-2 focus:ring-primary-300"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (e.g. 'free most evenings')"
              maxLength={200}
              className="w-full px-3 py-2 rounded-xl2 bg-primary-50/40 shadow-card outline-none font-semibold text-sm focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <button
            onClick={optIn}
            disabled={saving}
            className="px-4 py-2 rounded-xl2 bg-primary-500 text-white font-bold text-sm shadow-soft hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
            Opt in
          </button>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold text-mint-700 mb-3">
            You're discoverable as "{status.display_name}" to students in your subjects.
          </p>
          {matches === null ? (
            <p className="text-sm font-semibold text-ink/40">Finding matches...</p>
          ) : matches.length === 0 ? (
            <p className="text-sm font-semibold text-ink/40">
              No matches yet — check back once more students opt in with overlapping subjects.
            </p>
          ) : (
            <div className="space-y-2 mb-3">
              {matches.map((m, i) => (
                <div key={i} className="p-3 rounded-xl2 bg-primary-50/50">
                  <p className="font-bold text-sm text-primary-700">{m.display_name}</p>
                  <p className="text-xs font-semibold text-ink/50 mb-1">Shared: {m.shared_subjects.join(", ")}</p>
                  {m.note && <p className="text-xs font-semibold text-ink/60">"{m.note}"</p>}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={optOut}
            disabled={saving}
            className="text-xs font-bold text-ink/40 hover:text-coral-500 transition-colors"
          >
            Opt out
          </button>
        </>
      )}
    </div>
  );
}
