const mongoose = require("mongoose");

const bookmarkSchema = new mongoose.Schema(
  {
    // Auth removed — userId is a plain string, not an ObjectId.
    user: { type: String, required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  },
  { timestamps: true }
);

bookmarkSchema.index({ user: 1, post: 1 }, { unique: true });

module.exports = mongoose.model("Bookmark", bookmarkSchema);
