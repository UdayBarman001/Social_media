// All Mongoose queries for User live here. Services call these functions
// instead of touching the User model directly — keeps query shape/indexes
// centralized and swappable.

const User = require("./user.model");
const escapeRegex = require("../../utils/escapeRegex");

const publicFields = "-password -refreshTokenHash -emailVerificationTokenHash -emailVerificationExpires -passwordResetTokenHash -passwordResetExpires";

function findById(id) {
  return User.findById(id).select(publicFields).lean();
}

function findByIdWithSecrets(id) {
  return User.findById(id).select("+password +refreshTokenHash");
}

function findByEmail(email) {
  return User.findOne({ email: email.toLowerCase() }).select("+password");
}

function findByHandle(handle) {
  return User.findOne({ handle: handle.toLowerCase() }).select(publicFields).lean();
}

function findByDeviceId(deviceId) {
  return User.findOne({ deviceId }).select(publicFields).lean();
}

function findByEmailVerificationHash(hash) {
  return User.findOne({
    emailVerificationTokenHash: hash,
    emailVerificationExpires: { $gt: new Date() },
  }).select("+emailVerificationTokenHash +emailVerificationExpires");
}

function findByPasswordResetHash(hash) {
  return User.findOne({
    passwordResetTokenHash: hash,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpires +password");
}

function create(data) {
  return User.create(data);
}

function updateById(id, update) {
  return User.findByIdAndUpdate(id, update, { new: true, runValidators: true }).select(publicFields);
}

function incrementCounts(id, deltas, session) {
  const q = User.findByIdAndUpdate(id, { $inc: deltas }, { new: true });
  if (session) q.session(session);
  return q;
}

// Anchored prefix match on handle (already lowercase) and nameLower, both
// index-backed (IXSCAN). Replaces the old unanchored case-insensitive
// regex on name/handle, which forced a COLLSCAN on every keystroke.
// Trade-off: this only matches from the START of each field — "kumar"
// no longer matches "Uday Kumar" the way the old substring search did.
// If that regresses your UX, name needs Atlas Search instead of a B-tree
// index — see post.repository.js#searchPosts for what that looks like.
//
// People search is name/handle only — it used to also $unionWith the
// posts collection and return every author of a matching tag (so
// searching a tag like "agriculture" would surface *people* in the
// People tab). That's been removed: a tag is a property of a post, not
// of a person, so tag queries now only ever surface posts (see
// post.repository.js#searchPosts, which matches description AND tags).
// Dropping the union also drops the $unionWith/$lookup/$group aggregation
// entirely — this is now a single index-backed find(), which is both
// simpler and cheaper to run at scale (no unbounded fan-out through the
// posts collection on every keystroke).
function search(query, { skip, limit }) {
  const q = query.trim().toLowerCase();
  const safe = escapeRegex(q);
  const prefix = new RegExp(`^${safe}`); // no "i" flag — both sides already lowercase

  // $or across nameLower and handle: each side is served by its own
  // B-tree index (nameLower's own index, handle's unique index), so Mongo
  // resolves this as an index-only OR (no COLLSCAN) regardless of
  // collection size.
  return User.find({ $or: [{ nameLower: prefix }, { handle: prefix }] })
    .select(publicFields)
    .sort({ followerCount: -1, _id: 1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

module.exports = {
  findById,
  findByIdWithSecrets,
  findByEmail,
  findByHandle,
  findByDeviceId,
  findByEmailVerificationHash,
  findByPasswordResetHash,
  create,
  updateById,
  incrementCounts,
  search,
  publicFields,
};