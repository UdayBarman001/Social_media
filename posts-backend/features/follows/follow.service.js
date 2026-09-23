// Business logic for following/unfollowing. follower/following are real
// User ObjectIds (see follow.model.js) — device-based identity, not
// free-text names.

const followRepository = require("./follow.repository");
const userRepository = require("../users/user.repository");
const notificationService = require("../notifications/notification.service");
const ApiError = require("../../utils/ApiError");
const cache = require("../../utils/cache");
const config = require("../../config/env");
const { getPagination } = require("../../utils/pagination");
const { NOTIFICATION_TYPE } = require("../../constants");

// First page only, same reasoning as the feed/comments caches. Shown on
// every profile visit and shared across all viewers of that profile.
const followersCacheKey = (userId) => `cache:follows:${userId}:followers`;
const followingCacheKey = (userId) => `cache:follows:${userId}:following`;
const followersCountCacheKey = (userId) => `cache:follows:${userId}:followersCount`;
const followingCountCacheKey = (userId) => `cache:follows:${userId}:followingCount`;

/** A follow edge changes two people's lists at once: the follower's
 *  "following" list gains/loses followingId, and the followee's
 *  "followers" list gains/loses followerId. Both need invalidating on
 *  every follow/unfollow, not just one side. */
async function invalidateFollowCaches(followerId, followingId) {
  await Promise.all([
    cache.del(followingCacheKey(followerId)),
    cache.del(followersCacheKey(followingId)),
    cache.del(followingCountCacheKey(followerId)),
    cache.del(followersCountCacheKey(followingId)),
  ]);
}

async function follow(followerId, followingId) {
  if (followerId === followingId) throw ApiError.badRequest("You cannot follow yourself");

  const existing = await followRepository.findFollow(followerId, followingId);
  if (existing) return; // already following, no-op

  await followRepository.createFollow(followerId, followingId);
  await Promise.all([
    userRepository.incrementCounts(followerId, { followingCount: 1 }),
    userRepository.incrementCounts(followingId, { followerCount: 1 }),
  ]);
  await invalidateFollowCaches(followerId, followingId);

  notificationService.notify({ recipient: followingId, sender: followerId, type: NOTIFICATION_TYPE.FOLLOW });
}

async function unfollow(followerId, followingId) {
  // deleteFollow returns null if the edge didn't exist — no-op in that case.
  const existing = await followRepository.deleteFollow(followerId, followingId);
  if (existing) {
    await Promise.all([
      userRepository.incrementCounts(followerId, { followingCount: -1 }),
      userRepository.incrementCounts(followingId, { followerCount: -1 }),
    ]);
    await invalidateFollowCaches(followerId, followingId);
  }
}

async function listFollowers(userId, query) {
  const pagination = getPagination(query);
  const isCacheableRequest = pagination.page === 1;
  const cacheKey = followersCacheKey(userId);

  if (isCacheableRequest) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const rows = await followRepository.listFollowers(userId, pagination);
  const result = rows.map((r) => r.follower.toString());

  if (isCacheableRequest) {
    await cache.set(cacheKey, result, config.redis.followsTtlSeconds);
  }

  return result;
}

async function listFollowing(userId, query) {
  const pagination = getPagination(query);
  const isCacheableRequest = pagination.page === 1;
  const cacheKey = followingCacheKey(userId);

  if (isCacheableRequest) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const rows = await followRepository.listFollowing(userId, pagination);
  const result = rows.map((r) => r.following.toString());

  if (isCacheableRequest) {
    await cache.set(cacheKey, result, config.redis.followsTtlSeconds);
  }

  return result;
}

// Lightweight counts for profile headers — no pagination, just the two
// totals, each cached independently so a follow/unfollow only needs to
// invalidate the one side that actually changed (see invalidateFollowCaches).
async function getFollowCounts(userId) {
  const followersKey = followersCountCacheKey(userId);
  const followingKey = followingCountCacheKey(userId);

  const [cachedFollowers, cachedFollowing] = await Promise.all([
    cache.get(followersKey),
    cache.get(followingKey),
  ]);

  const [followers, following] = await Promise.all([
    cachedFollowers != null ? cachedFollowers : followRepository.countFollowers(userId),
    cachedFollowing != null ? cachedFollowing : followRepository.countFollowing(userId),
  ]);

  await Promise.all([
    cachedFollowers == null ? cache.set(followersKey, followers, config.redis.followsTtlSeconds) : null,
    cachedFollowing == null ? cache.set(followingKey, following, config.redis.followsTtlSeconds) : null,
  ]);

  return { followers, following };
}

module.exports = { follow, unfollow, listFollowers, listFollowing, getFollowCounts };