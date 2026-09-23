// Users are the single identity collection shared by auth, posts, comments,
// follows, etc. Auth-specific secrets (password hash, refresh/reset tokens)
// live here rather than a separate collection because they are 1:1 with the
// user and always needed together during login/refresh — splitting them out
// would just add a join for no benefit at this scale.

const mongoose = require("mongoose");
const { ROLES } = require("../../constants");

const userSchema = new mongoose.Schema(
  {
    deviceId: { type: String, unique: true, sparse: true, index: true },

    name: { type: String, required: true, trim: true, maxlength: 80 },

    // Lowercase mirror of `name`, kept in sync by the pre-save/pre-
    // findOneAndUpdate hooks below. Exists purely so
    // user.repository.js#search() can run an anchored ^prefix regex
    // against it (index-backed, IXSCAN) instead of the old unanchored
    // /i regex (COLLSCAN). Never returned in API responses (select: false).
    nameLower: { type: String, index: true, select: false },

    handle: {
      type: String,
      required: true,
      unique: true, // already gives us a B-tree index for free
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_]{3,20}$/, "Handle must be 3-20 chars: letters, numbers, underscore"],
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
    },
    password: { type: String, select: false, minlength: 8 },

    avatarUrl: { type: String, default: null },
    avatarFileId: { type: String, default: null, select: false },

    bio: { type: String, default: "", maxlength: 300 },
    location: { type: String, default: null },

    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER },
    verified: { type: Boolean, default: false },

    isEmailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false, default: null },
    emailVerificationExpires: { type: Date, select: false, default: null },

    passwordResetTokenHash: { type: String, select: false, default: null },
    passwordResetExpires: { type: Date, select: false, default: null },

    refreshTokenHash: { type: String, select: false, default: null },

    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    postCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Keeps nameLower in sync on document.save() — covers create() (the
// new-user path in user.service.js#getOrCreateByDevice).
userSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.nameLower = this.name.toLowerCase();
  }
  next();
});

// findByIdAndUpdate (user.repository.js#updateById — every profile edit,
// plus the rename path in getOrCreateByDevice) bypasses document
// middleware entirely, so pre('save') above never fires for it. This hook
// is what actually keeps nameLower correct on updates.
userSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const newName = update.name ?? update.$set?.name;
  if (newName !== undefined) {
    this.setUpdate({
      ...update,
      $set: { ...(update.$set || {}), nameLower: newName.toLowerCase() },
    });
  }
  next();
});

// The old `{ name: "text", handle: "text" }` index was removed — it was
// never actually queried (search() below runs $regex, not $text) and just
// cost write overhead on every insert/update. handle's prefix search rides
// on its existing unique index above; nameLower's index is declared inline.

module.exports = mongoose.model("User", userSchema);