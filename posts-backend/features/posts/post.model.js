// A post's images are stored as an array of {url, fileId} so the frontend
// can render multiple photos per post, and the app can clean up ImageKit
// files on delete/edit without extra lookups.
//
// likeCount / commentCount are denormalized counters kept in sync by the
// likes/comments services (see features/likes, features/comments). Reading
// them here is O(1) instead of a COUNT aggregation on every feed load.

const mongoose = require("mongoose");
const { AUDIENCE } = require("../../constants");

const imageSchema = new mongoose.Schema(
  { url: { type: String, required: true }, fileId: { type: String, required: true } },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    description: { type: String, required: true, trim: true, maxlength: 2000 },

    images: { type: [imageSchema], default: [] },

    location: { type: String, default: null },
    audience: { type: String, enum: Object.values(AUDIENCE), default: AUDIENCE.PUBLIC },
    tags: { type: [String], default: [] },

    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },

    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Feed queries: newest-first, optionally filtered by author or tag.
postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
// Multikey index — one entry per array element, so a tag-equality or
// anchored-prefix lookup (see post.repository.js#findFeed's `tag` filter,
// and #searchPostsRegex's tag branch) is an index seek, not a collection
// scan. Depends on tags being stored in a single normalized
// case (see the two hooks below) — a mixed-case "Agriculture"/"agriculture"
// index would silently split one logical tag into two index entries.
postSchema.index({ tags: 1 });
// Compound index for the actual query shape a tag feed runs:
// find({ tags }).sort({ createdAt: -1, _id: -1 }) (see
// post.repository.js#findFeed / #findFeedAfter). The plain { tags: 1 }
// index above lets Mongo seek straight to matching documents, but with no
// createdAt in the index it still has to pull every matching doc into
// memory to satisfy the sort — for a popular tag that's an in-memory sort
// over a growing result set, which risks hitting Mongo's 32MB sort-memory
// limit and erroring the query outright once a tag gets popular enough.
// This compound index lets the same query be answered by walking a single
// index in the already-sorted order, with no separate sort step.
postSchema.index({ tags: 1, createdAt: -1, _id: -1 });
// Old `{ description: "text" }` index removed — searchPosts() never used
// $text (see its comment for why), so it was pure write overhead. Full-text
// search on description now runs through Atlas Search — see
// scripts/create-posts-search-index.js for the index it depends on.

// Normalizes tags to trimmed lowercase on document.save() (create() /
// post.save()). Without this, "Agriculture", "agriculture", and " agriculture "
// land as three distinct entries in the {tags:1} index, and a search for
// one silently misses the others — same failure mode the nameLower hooks
// in user.model.js exist to prevent for names.
function normalizeTags(tags) {
  if (!Array.isArray(tags)) return tags;
  const seen = new Set();
  const out = [];
  for (const t of tags) {
    if (typeof t !== "string") continue;
    const clean = t.trim().toLowerCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

postSchema.pre("save", function (next) {
  if (this.isModified("tags")) {
    this.tags = normalizeTags(this.tags);
  }
  next();
});

// findByIdAndUpdate (post.repository.js#updateById) bypasses document
// middleware, same as user.model.js's nameLower hook — this is what keeps
// tags normalized on edits, not just on create.
postSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const nextTags = update.tags ?? update.$set?.tags;
  if (nextTags !== undefined) {
    this.setUpdate({
      ...update,
      $set: { ...(update.$set || {}), tags: normalizeTags(nextTags) },
    });
  }
  next();
});

module.exports = mongoose.model("Post", postSchema);