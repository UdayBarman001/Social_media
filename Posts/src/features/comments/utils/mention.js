// Longest-match mention detection against the known authors of a thread.
//
// Mentions are encoded as a leading "@<author name> " inside comment.text
// (legacy path — see CommentText.jsx for the newer structural mention,
// which nestComments.js now attaches directly instead of relying on text
// parsing). The naive approach — `/^@([^\s]+)/`, "take the first
// whitespace-delimited token after @" — silently breaks for any
// multi-word author name. This app's own seed data has several
// ("Riya Shah", "Uday Kumar"): a reply to either would only bold/match
// "Riya" or "Uday", leaving the rest of the name as plain unstyled text
// jammed into the mention, and any tap-to-profile lookup built on that
// partial name is unreliable.
//
// Matching against the real list of authors actually present in the
// thread — longest name first, so "Riya Shah" is preferred over a
// coincidental shorter match like "Riya" — removes the ambiguity
// entirely. `authors` is a list of `{ name, id }` (id is the author's
// real user id, needed to hyperlink the mention to their profile); a
// plain string in the list is treated as a name with no id.
export function matchLeadingMention(text, authors = []) {
  if (!text?.startsWith("@")) return null;

  const withoutAt = text.slice(1);
  const normalized = authors
    .map((a) => (typeof a === "string" ? { name: a, id: undefined } : a))
    .filter((a) => a?.name);

  const byName = new Map();
  for (const a of normalized) if (!byName.has(a.name)) byName.set(a.name, a.id);
  const known = [...byName.keys()].sort((a, b) => b.length - a.length);

  for (const author of known) {
    if (withoutAt === author || withoutAt.startsWith(`${author} `) || withoutAt.startsWith(`${author}\n`)) {
      return {
        author,
        authorId: byName.get(author),
        mentionText: `@${author}`,
        rest: withoutAt.slice(author.length),
      };
    }
  }

  // Fallback for an author no longer present in `authors` (e.g. deleted /
  // renamed) — degrade to the old single-word heuristic rather than
  // rendering no mention at all. No id is resolvable here, so the
  // mention renders but isn't tappable (see CommentText.jsx).
  const fallback = withoutAt.match(/^([^\s]+)(\s[\s\S]*)?$/);
  if (!fallback) return null;
  return { author: fallback[1], authorId: undefined, mentionText: `@${fallback[1]}`, rest: fallback[2] || "" };
}