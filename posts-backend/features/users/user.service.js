// Business logic for reading/updating user profiles. Auth-specific logic
// (register/login/tokens) lives in features/auth — this file is about the
// profile itself: viewing, editing, avatar management.

const userRepository = require("./user.repository");
const ApiError = require("../../utils/ApiError");
const cache = require("../../utils/cache");
const config = require("../../config/env");
const logger = require("../../config/logger");
const { uploadImage, deleteImage } = require("../../utils/imageHelper");

// Keyed two ways since the frontend reads profiles both by Mongo _id
// (profile screen, via a post/comment author id) and by @handle. The
// handle is assigned once at account creation and never editable (not in
// updateProfile's allowed list), so the handle->id mapping itself never
// goes stale — only the profile *contents* behind each key can, which is
// why both keys need invalidating on every profile write below.
const userCacheKeyById = (id) => `cache:user:${id}`;
const userCacheKeyByHandle = (handle) => `cache:user:handle:${handle}`;

/** Invalidates both cache entries for a user. Takes the user object (not
 *  just an id) because the handle key needs `handle`, which callers with
 *  only a userId (updateProfile, updateAvatar) get from the write's own
 *  result rather than a second lookup. */
async function invalidateUserCache(user) {
  if (!user) return;
  await Promise.all([
    cache.del(userCacheKeyById(user._id ? user._id.toString() : user.id)),
    user.handle ? cache.del(userCacheKeyByHandle(user.handle)) : Promise.resolve(),
  ]);
}

// Posts/comments embed populated author display fields in their cached API
// responses. Because those Mongo documents reference the stable User _id
// rather than copying profile data, we do not rewrite every post/comment.
// Instead, a successful profile change invalidates the small set of shared
// read caches so the next request repopulates the author's canonical data.
// Profile edits are intentionally rare, so correctness is worth the cache
// invalidation cost here.
async function invalidateProfileDependentCaches() {
  await Promise.all([
    // The feed cache is a single fixed key (post.service.js's
    // FEED_CACHE_KEY = "cache:feed:page1"), never a family of keys — there
    // has only ever been one page-1 feed cache entry. Wildcard-deleting
    // "cache:feed:*" made cache.del() run a SCAN over the whole Redis
    // keyspace to find... the one key it could have deleted directly. Now
    // it does.
    cache.del("cache:feed:page1"),
    // post/comments caches genuinely are per-id key families (one entry
    // per post), so these two still need the wildcard SCAN — there's no
    // reverse index here from "this author" to "every cache key that
    // embeds their name/avatar" to target a narrower delete. cache.del()
    // already uses Redis's non-blocking SCAN (not KEYS) for these, so this
    // doesn't stall Redis's event loop; it's still real keyspace-wide work
    // per profile edit, which is acceptable because profile edits are rare
    // (see comment above) — just not something to also pay for on the
    // feed's single key.
    cache.del("cache:post:*"),
    cache.del("cache:comments:*"),
  ]);
}

async function getProfile(userId) {
  const cacheKey = userCacheKeyById(userId);
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound("User not found");

  await cache.set(cacheKey, user, config.redis.userTtlSeconds);
  return user;
}

async function getProfileByHandle(handle) {
  const cacheKey = userCacheKeyByHandle(handle);
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const user = await userRepository.findByHandle(handle);
  if (!user) throw ApiError.notFound("User not found");

  await cache.set(cacheKey, user, config.redis.userTtlSeconds);
  return user;
}

// Generates a handle guaranteed to satisfy the User model's
// `^[a-z0-9_]{3,20}$` pattern from an arbitrary display name, falling back
// to a random suffix on collision. Device-identity users never picked a
// handle themselves, so this just needs to be valid and (with the retry
// loop in getOrCreateByDevice) unique — not meaningful.
function slugifyHandle(name) {
  const base = (name || "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 14) || "user";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}_${suffix}`.slice(0, 20);
}

/**
 * Finds (or, on first launch, creates) the User document tied to this
 * device. This is the app's whole identity model in the absence of real
 * login: `deviceId` is generated once on-device and never changes, so it —
 * not the freely-editable display name — is what every post/comment/like/
 * follow actually references. See the migration note in
 * scripts/migrate-legacy-identities.js for how pre-existing plain-text-name
 * data gets folded into this.
 */
async function getOrCreateByDevice(deviceId, name) {
  const existing = await userRepository.findByDeviceId(deviceId);
  if (existing) {
    const trimmedName = name?.trim();
    if (trimmedName && trimmedName !== existing.name) {
      const updated = await userRepository.updateById(existing._id, { name: trimmedName.slice(0, 80) });
      // Renaming here bypasses updateProfile — same staleness risk, so it
      // needs the same invalidation (cached profile would keep showing
      // the pre-rename name for up to userTtlSeconds otherwise).
      await invalidateUserCache(updated);
      await invalidateProfileDependentCaches();
      return updated;
    }
    return existing;
  }

  // Handle collisions are vanishingly unlikely (random suffix) but not
  // impossible — retry a few times rather than letting a user-facing
  // request fail on a coin-flip collision.
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await userRepository.create({
        deviceId,
        name: (name || "New User").trim().slice(0, 80),
        handle: slugifyHandle(name),
      });
      return userRepository.findById(created._id);
    } catch (err) {
      if (err?.code === 11000 && err?.keyPattern?.handle) {
        lastErr = err;
        continue; // handle collision — retry with a fresh random suffix
      }
      throw err;
    }
  }
  throw lastErr || ApiError.internal("Could not create user");
}

async function updateProfile(userId, fields) {
  const allowed = ["name", "handle", "bio", "location"];
  const update = {};
  allowed.forEach((key) => {
    if (fields[key] !== undefined) {
      update[key] = key === "handle" ? fields[key].trim().toLowerCase() : fields[key];
    }
  });

  if (Object.keys(update).length === 0) {
    const existing = await userRepository.findById(userId);
    if (!existing) throw ApiError.notFound("User not found");
    return existing;
  }

  // A handle change needs the old cache key invalidated as well as the new
  // one. No post/comment documents are rewritten because they reference the
  // stable User ObjectId and populate display fields at read time.
  const previous = update.handle !== undefined
    ? await userRepository.findById(userId)
    : null;

  let user;
  try {
    user = await userRepository.updateById(userId, update);
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.handle) {
      throw ApiError.conflict("That username is already taken");
    }
    throw err;
  }

  if (!user) throw ApiError.notFound("User not found");

  if (previous?.handle && previous.handle !== user.handle) {
    await cache.del(userCacheKeyByHandle(previous.handle));
  }
  await invalidateUserCache(user);
  await invalidateProfileDependentCaches();
  return user;
}

async function updateAvatar(userId, file) {
  const current = await userRepository.findByIdWithSecrets(userId);
  if (!current) throw ApiError.notFound("User not found");

  const uploaded = await uploadImage(file.buffer, `avatar_${userId}_${Date.now()}`, "/avatars");
  const previousFileId = current.avatarFileId;

  try {
    // Commit the new DB state first. If Mongo rejects the write, remove the
    // newly uploaded asset so the frontend/database cannot report a partial
    // success.
    current.avatarUrl = uploaded.url;
    current.avatarFileId = uploaded.fileId;
    await current.save();
  } catch (err) {
    await deleteImage(uploaded.fileId).catch(() => {});
    throw err;
  }

  const updated = await userRepository.findById(userId);
  await invalidateUserCache(updated);
  await invalidateProfileDependentCaches();

  // The database and every cache/read path already point at the new
  // avatar by this point — deleting the *old* file from ImageKit is pure
  // cleanup with no user-visible effect either way. Awaiting it here was
  // adding a full extra CDN round-trip to the response the client is
  // sitting there waiting on for no reason: the response can go out now,
  // and the old asset gets cleaned up right after, off the request path.
  if (previousFileId) {
    deleteImage(previousFileId).catch((err) =>
      logger.warn(`Failed to delete previous avatar ${previousFileId}: ${err.message}`),
    );
  }

  return updated;
}

async function searchUsers(query, pagination) {
  if (!query || query.trim().length < 2) return [];
  return userRepository.search(query.trim(), pagination);
}

module.exports = {
  getProfile,
  getProfileByHandle,
  getOrCreateByDevice,
  updateProfile,
  updateAvatar,
  searchUsers,
  invalidateUserCache,
  invalidateProfileDependentCaches,
};