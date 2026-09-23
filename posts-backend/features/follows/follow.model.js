// Follow is a directed edge: follower -> following. Kept as its own
// collection (not embedded arrays on User) so follow/unfollow is O(1) and
// doesn't require rewriting a growing array on the user document.

const mongoose = require("mongoose");

const followSchema = new mongoose.Schema(
  {
    // Real ObjectId refs to User — see the same change on Post/Comment for
    // why (device-based identity, not free-text names/ids).
    follower: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    following: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

followSchema.index({ follower: 1, following: 1 }, { unique: true });
followSchema.index({ following: 1 });

module.exports = mongoose.model("Follow", followSchema);