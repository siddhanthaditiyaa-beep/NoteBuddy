// A single reusable placeholder block — swap the blank/spinner "Loading..."
// text for a shape that hints at what's coming, so the page reads as
// "almost there" instead of "did this freeze?".
export default function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-primary-50 dark:bg-white/10 rounded-xl2 ${className}`} />;
}
