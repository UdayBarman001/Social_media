// Comments reference both the post and the author. `parentComment` supports
// threaded replies (one level deep, matching the frontend's reply-by-mention
// UI) without needing a separate "replies" collection.

const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    likeCount: { type: Number, default: 0, min: 0 },
    // Facebook-style thumbs up/down reaction on a comment. A user's
    // reaction is stored once per comment (see Like's unique
    // user+targetType+targetId index) with a `type` field of 'like' or
    // 'dislike' — this counter is the dislike side of that same pair,
    // kept denormalized here for the same reason likeCount already is.
    dislikeCount: { type: Number, default: 0, min: 0 },
    // Set when a comment's text has been changed after creation, so the
    // client can show an "edited" indicator the way Facebook/most comment
    // UIs do — without this there'd be no way to tell an edited comment
    // apart from an untouched one once the edit is saved.
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, createdAt: 1 });

module.exports = mongoose.model("Comment", commentSchema);