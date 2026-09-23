// A single polymorphic Like collection (rather than one per feature) backs
// likes for both posts and comments — `targetType` + `targetId` identify
// what was liked. This lets "did I like this" and "who liked this" queries
// work identically for any likeable feature added later, and keeps the
// unique-like-per-user constraint in exactly one place.

const mongoose = require("mongoose");
const { TARGET_TYPE } = require("../../constants");

const likeSchema = new mongoose.Schema(
  {
    // Real ObjectId ref to User — see the same change on Post/Comment for
    // why (device-based identity, not free-text names/ids).
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: Object.values(TARGET_TYPE), required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Reaction kind. Posts only ever use 'like' (no dislike UI exists for
    // posts), so this defaults to 'like' and is a no-op for every existing
    // Post-like row/flow. Comments use both — see like.service.js's
    // reactToComment/removeCommentReaction, which are the only functions
    // that ever write 'dislike' here. Kept on this same polymorphic model
    // (rather than a separate collection) so the existing one-row-per-user-
    // per-target unique index keeps doing its job: a user can have exactly
    // one reaction (like OR dislike) per comment, and switching between
    // them updates this field on that same row instead of creating a
    // second one.
    type: { type: String, enum: ["like", "dislike"], default: "like" },
  },
  { timestamps: true }
);

// A user can only like a given target once.
likeSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });
likeSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model("Like", likeSchema);