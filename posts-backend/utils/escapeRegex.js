// Escapes regex special characters in user-supplied search input before it's
// used inside a MongoDB $regex query. Without this, a search string like
// "a.*" or "(" is interpreted as regex syntax instead of a literal string —
// at best that gives wrong/surprising matches, at worst a crafted input
// (e.g. deeply nested quantifiers) can make the regex pathologically slow
// and tie up a query thread (ReDoS). Every call site that builds a $regex
// from request input must run the query through this first.
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = escapeRegex;