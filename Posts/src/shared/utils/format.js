export function timeAgo(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Deterministic accent color per author name — same person, same color,
// every time, without needing to store it anywhere.
const ACCENTS = ["#3F6C51", "#C98A3B", "#7B5EA7", "#B4544A", "#2E7D8C"];

export function accentFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ACCENTS[Math.abs(hash) % ACCENTS.length];
}

// Compact number formatting for like/comment counts: 1000 -> "1k" (clamped to non-negative).
export function count(v = 0) {
  const n = Math.max(0, Number(v) || 0);
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);
}
