// Pulls #hashtags out of free-typed caption text so they become real,
// searchable post `tags` — not just green-colored text (see
// RichCaption.jsx, which only styles #words, never stores them anywhere).
//
// This is now the ONLY source of a post's `tags`, matching Facebook: there
// is no separate picker anymore (TagSheet / POST_TAGS presets were
// removed), so whatever the user types as "#word" in the caption is
// exactly what search matches against (post.repository.js: autocomplete
// on `tags`). A caption like "#Krishiverse is growing" makes
// "Krishiverse" findable with nothing else required.
//
// Kept intentionally simple and dependency-free: Unicode letters/digits/
// combining marks/underscore (\p{L}\p{N}\p{M}_ property escapes, requires
// the "u" flag), same "#" trigger RichCaption already uses, deduped, "#"
// stripped so the stored form is a plain word with no leading #.
//
// NOTE: plain \w is ALWAYS ASCII-only in JS regex ([A-Za-z0-9_]) — the
// "u" flag does not extend it to other scripts, it only changes
// surrogate-pair handling. An earlier version of this function used \w
// and (wrongly) called that "unicode-aware", which would have silently
// dropped any hashtag typed in Hindi/regional scripts — a real gap for
// this app's farmer userbase. \p{L}\p{N} are the actual Unicode-aware
// escapes for letters/digits — but Devanagari and most Indic scripts
// also rely on combining vowel signs (matras, e.g. े/ी in "खेती") that
// fall under Unicode category Mark (\p{M}), not Letter/Number. Without
// \p{M}, "#खेती" was truncating to just "#ख" at the first matra — \p{M}
// is included below specifically to keep those tags intact.
export function extractHashtags(text) {
  if (!text) return [];

  const matches = text.match(/#([\p{L}\p{N}\p{M}_]+)/gu) ?? [];
  const seen = new Set();
  const tags = [];

  for (const raw of matches) {
    const tag = raw.slice(1); // drop leading "#"
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }

  return tags;
}

// Caps a post's tags at the backend's hard limit (see
// create-post/constants.js MAX_TAGS — must match
// `body("tags").optional().isArray({ max: 10 })` in post.validation.js).
// With no picker anymore, this is just extractHashtags + a length cap;
// kept as its own helper so call sites don't repeat the `.slice(...)`.
export function tagsFromCaption(captionText, maxTags = 10) {
  return extractHashtags(captionText).slice(0, maxTags);
}
