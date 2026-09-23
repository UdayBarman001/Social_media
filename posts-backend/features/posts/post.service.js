// Business logic for posts: feed pagination, creation (with image upload),
// editing (author-only, with image diffing), and deletion (with ImageKit
// cleanup). Controllers stay thin; this is where authorization rules live.

const postRepository = require("./post.repository");
const userRepository = require("../users/user.repository");
const commentRepository = require("../comments/comment.repository");
const likeRepository = require("../likes/like.repository");
const bookmarkRepository = require("../bookmarks/bookmark.repository");
const reportRepository = require("../reports/report.repository");
const notificationService = require("../notifications/notification.service");
const { TARGET_TYPE } = require("../../constants");
const ApiError = require("../../utils/ApiError");
const cache = require("../../utils/cache");
const config = require("../../config/env");
const { uploadImage, deleteImage } = require("../../utils/imageHelper");
const { getPagination, buildMeta } = require("../../utils/pagination");
const { encodeCursor, decodeCursor } = require("../../utils/cursor");
const { withTransaction } = require("../../utils/transaction");

// Only the single hottest query — the unfiltered, first-page, default-limit
// feed a freshly opened app always requests — is cached. Every other feed
// request (later pages, authorId/tag filters, non-default limit) skips the
// cache entirely: they're far less frequently repeated across users, so
// caching them would mostly just burn Redis memory on one-time keys.
const FEED_CACHE_KEY = "cache:feed:page1";

// Single-post reads: shared across every viewer (feed tap, notification
// tap, deep link all hit the same post), so unlike bookmarks/likes-list
// this is a genuine many-readers-one-value cache, not a cache of one.
const postCacheKey = (id) => `cache:post:${id}`;

/** Invalidates one post's cache entry. Exported so other features whose
 *  writes change a post's cached fields without going through this file's
 *  own mutators can invalidate it too:
 *   - like.service.js#likeTarget/unlikeTarget (POST target) changes likeCount
 *   - comment.service.js#addComment/deleteComment changes commentCount
 *  Both call this directly rather than post.service.js reaching into their
 *  business logic, so ownership of "what changed" stays with the writer. */
async function invalidatePostCache(postId) {
  await cache.del(postCacheKey(postId));
}

/** Invalidates the cached feed page 1. Exported for the same reason as
 *  invalidatePostCache above: like.service.js#likeTarget/unlikeTarget
 *  changes a post's likeCount, which is embedded in the cached feed
 *  response, not just the single-post cache. */
async function invalidateFeedCache() {
  await cache.del(FEED_CACHE_KEY);
}

// Duplicated (not imported) from comment.service.js's commentsCacheKey to
// avoid a circular require (comment.service.js already requires this file
// for invalidatePostCache). Keep this format in sync with that file if it
// ever changes.
const postCommentsCacheKey = (postId) => `cache:comments:${postId}:page1`;

/** Shapes a lean Mongo post into the flat object the frontend expects.
 *  `author` may come in either populated (an object with .name, from a
 *  query that used AUTHOR_POPULATE) or unpopulated (just an ObjectId) —
 *  toClientPost handles both so callers never need to know which. The
 *  client always gets `author` back as the plain id string (for identity/
 *  ownership checks) plus separate authorName/authorAvatar/authorVerified
 *  fields for display. */
function toClientPost(post) {
  if (!post) return null;
  const authorPopulated = post.author && typeof post.author === "object" && post.author.name !== undefined;
  return {
    id: post._id.toString(),
    image: post.images?.[0]?.url || null,
    images: (post.images || []).map((img) => img.url),
    description: post.description,
    author: authorPopulated ? post.author._id.toString() : (post.author ? post.author.toString() : ""),
    authorName: authorPopulated ? post.author.name : undefined,
    authorAvatar: authorPopulated ? post.author.avatarUrl : undefined,
    authorVerified: authorPopulated ? post.author.verified : undefined,
    location: post.location,
    audience: post.audience,
    tags: post.tags,
    verified: post.verified,
    likeCount: Math.max(0, post.likeCount ?? 0),
    commentCount: Math.max(0, post.commentCount ?? 0),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

async function getFeed(query) {
  const pagination = getPagination(query);
  const filter = { authorId: query.authorId, tag: query.tag };

  // Cursor mode: every "load more" request from the client past page 1.
  // Bypasses skip/limit (and the page-1 cache, which doesn't apply here
  // anyway) so results are anchored to the last post the client actually
  // saw, immune to drift from posts created in between requests. See
  // post.repository.js#findFeedAfter for why this replaces skip-based
  // paging for anything past the first page.
  if (query.cursor) {
    let cursor;
    try {
      // decodeCursor verifies the HMAC tag before returning the payload —
      // a hand-edited/forged {createdAt, id} pair is rejected here instead
      // of being trusted straight into the Mongo range filter below (see
      // utils/cursor.js for why this can't just be JSON.parse anymore).
      cursor = decodeCursor(query.cursor);
    } catch {
      throw ApiError.badRequest("Invalid cursor");
    }
    const posts = await postRepository.findFeedAfter({ cursor, limit: pagination.limit, ...filter });
    const last = posts[posts.length - 1];
    const nextCursor = last ? encodeCursor({ createdAt: last.createdAt, id: last._id.toString() }) : null;
    return {
      posts: posts.map(toClientPost),
      meta: { limit: pagination.limit, nextCursor, hasNextPage: posts.length === pagination.limit },
    };
  }

  const isCacheableRequest = pagination.page === 1 && !filter.authorId && !filter.tag;

  const loadFromMongo = async () => {
    const [posts, total] = await Promise.all([
      postRepository.findFeed({ ...pagination, ...filter }),
      postRepository.countFeed(filter),
    ]);
    const last = posts[posts.length - 1];
    // Issue a signed nextCursor here too, not just from the cursor branch
    // above — the client's very first "load more" after a (possibly
    // cached) page-1 response needs a real cursor to hand back, and it
    // has no way to sign one itself. Without this, FeedContext.jsx used
    // to build a raw {createdAt, id} cursor locally as a fallback, which
    // is exactly the unsigned/forgeable shape this signing was added to
    // close off — so the server must supply it instead.
    const nextCursor = last ? encodeCursor({ createdAt: last.createdAt, id: last._id.toString() }) : null;
    return {
      posts: posts.map(toClientPost),
      meta: { ...buildMeta({ ...pagination, total }), nextCursor },
    };
  };

  if (isCacheableRequest) {
    // getOrLoad coalesces concurrent misses on this one hot key (right
    // after TTL expiry or an invalidation) into a single Mongo fetch
    // instead of every simultaneous request stampeding Mongo at once —
    // see utils/cache.js#getOrLoad.
    return cache.getOrLoad(FEED_CACHE_KEY, config.redis.feedTtlSeconds, loadFromMongo);
  }

  return loadFromMongo();
}

async function getPostById(id) {
  const cacheKey = postCacheKey(id);
  const result = await cache.getOrLoad(cacheKey, config.redis.postTtlSeconds, async () => {
    const post = await postRepository.findById(id);
    if (!post) throw ApiError.notFound("Post not found");
    return toClientPost(post);
  });
  return result;
}

async function createPost(userId, { description, location, audience, tags }, files = []) {
  if (!description?.trim() && files.length === 0) {
    throw ApiError.badRequest("A post needs either text or an image");
  }

  // Images were previously uploaded one at a time in a `for` loop with
  // `await` on each iteration — every image serialized behind the last,
  // so N images cost N round trips to ImageKit back-to-back instead of
  // running concurrently. That's the actual source of the 10+ second
  // create-post time: it's not Atlas latency, it's this loop. Promise.all
  // fires every upload at once; total time becomes the slowest single
  // upload instead of the sum of all of them.
  const images = await Promise.all(
    files.map(async (file) => {
      const uploaded = await uploadImage(
        file.buffer,
        `post_${userId}_${Date.now()}_${file.originalname}`,
        "/posts",
      );
      return { url: uploaded.url, fileId: uploaded.fileId };
    }),
  );

  // FIX (orphaned ImageKit files on DB write failure): the images above
  // are already sitting in ImageKit by the time postRepository.create()
  // runs. If that Mongo write throws (validation error, network blip,
  // whatever), this function used to just propagate the error — the
  // uploaded files stayed in ImageKit forever with nothing in Mongo
  // pointing at them, silently burning storage quota. Same
  // upload-then-roll-back-on-failure pattern already used in updatePost()
  // below: only clean up if there's actually something to clean up
  // (files.length > 0), since the no-image path never uploaded anything.
  let post;
  try {
    post = await postRepository.create({
      author: userId,
      description: description?.trim() || "",
      images,
      location: location || null,
      audience,
      tags: Array.isArray(tags) ? tags : [],
      verified: false,
    });
  } catch (err) {
    if (images.length > 0) {
      await Promise.all(images.map((img) => deleteImage(img.fileId)));
    }
    throw err;
  }

  await cache.del(FEED_CACHE_KEY);
  await userRepository.incrementCounts(userId, { postCount: 1 });

  // postRepository.create() already returns the full created document —
  // the previous extra `findById(post._id)` round-tripped to Mongo again
  // just to re-fetch the exact same data that's already sitting in `post`.
  // toClientPost only reads plain fields (_id, images, author, etc.), all
  // of which are present on the Mongoose document `create()` returns, so
  // this is safe to drop.
  return toClientPost(post);
}

async function updatePost(userId, postId, fields, files = []) {
  const post = await postRepository.findByIdRaw(postId);
  if (!post) throw ApiError.notFound("Post not found");
  if (post.author.toString() !== userId) throw ApiError.forbidden("You can only edit your own posts");

  const allowed = ["description", "location", "audience", "tags"];
  const update = {};
  allowed.forEach((key) => {
    if (fields[key] !== undefined) update[key] = fields[key];
  });

  // fields.removeImage arrives as the string "true" over multipart form-data,
  // or a real boolean over the plain-JSON path — accept either.
  const wantsRemoveImage = fields.removeImage === "true" || fields.removeImage === true;

  // keepImageUrls: JSON array (multipart) or real array (JSON body) of
  // existing image URLs the client wants to retain. Lets the multi-image
  // edit UI keep a subset of existing images while dropping others and/or
  // adding new ones in the same request — mirrors createPost's multi-image
  // flow instead of the old all-or-nothing single-image replace below.
  let keepImageUrls = fields.keepImageUrls;
  if (typeof keepImageUrls === "string") {
    try {
      keepImageUrls = JSON.parse(keepImageUrls);
    } catch {
      keepImageUrls = undefined;
    }
  }
  const hasKeepList = Array.isArray(keepImageUrls);

  // Images that should be removed from ImageKit once the DB write below
  // has actually succeeded. Collected but NOT deleted yet in any branch —
  // deleting them up front (as this used to) meant a failed DB write could
  // leave the saved post pointing at image URLs that no longer exist,
  // since Mongo has no way to "undo" an ImageKit deletion. Newly uploaded
  // images are tracked the same way, but for the opposite reason: if the
  // DB write fails, they need to be deleted so a failed edit doesn't leave
  // orphaned uploads sitting in ImageKit forever.
  let imagesToDeleteAfterCommit = [];
  let uploadedImagesToRollbackOnFailure = [];

  if (hasKeepList) {
    const keepSet = new Set(keepImageUrls);
    const kept = (post.images || []).filter((img) => keepSet.has(img.url));
    const dropped = (post.images || []).filter((img) => !keepSet.has(img.url));

    const uploaded = await Promise.all(
      files.map(async (file) => {
        const result = await uploadImage(
          file.buffer,
          `post_${userId}_${Date.now()}_${file.originalname}`,
          "/posts",
        );
        return { url: result.url, fileId: result.fileId };
      }),
    );

    if (kept.length + uploaded.length > 6) {
      // New uploads already happened at this point — roll them back
      // immediately rather than leaving them stranded in ImageKit just
      // because the final count check failed.
      await Promise.all(uploaded.map((img) => deleteImage(img.fileId)));
      throw ApiError.badRequest("A post can have at most 6 images");
    }

    imagesToDeleteAfterCommit = dropped;
    uploadedImagesToRollbackOnFailure = uploaded;
    update.images = [...kept, ...uploaded];
  } else if (files.length > 0) {
    // Legacy single-image replace path (no keepImageUrls sent): new
    // image(s) replace the post's entire images array.
    const newImages = await Promise.all(
      files.map(async (file) => {
        const uploaded = await uploadImage(
          file.buffer,
          `post_${userId}_${Date.now()}_${file.originalname}`,
          "/posts",
        );
        return { url: uploaded.url, fileId: uploaded.fileId };
      }),
    );
    imagesToDeleteAfterCommit = post.images || [];
    uploadedImagesToRollbackOnFailure = newImages;
    update.images = newImages;
  } else if (wantsRemoveImage) {
    // Image explicitly removed with no replacement picked.
    imagesToDeleteAfterCommit = post.images || [];
    update.images = [];
  }
  // Otherwise: images untouched, don't include them in the update at all.

  let updated;
  try {
    updated = await postRepository.updateById(postId, update);
  } catch (err) {
    // DB write failed — roll back any newly uploaded images so this
    // failed edit doesn't leave orphaned files in ImageKit. The old
    // images were never touched (see above), so the post's existing
    // state is untouched too — a clean, fully-failed edit either way.
    await Promise.all(uploadedImagesToRollbackOnFailure.map((img) => deleteImage(img.fileId)));
    throw err;
  }

  // DB write succeeded — now, and only now, is it safe to delete the old/
  // dropped images from ImageKit. The saved post already reflects the new
  // image set at this point, so this cleanup can never leave the post
  // referencing a deleted image.
  await Promise.all(imagesToDeleteAfterCommit.map((img) => deleteImage(img.fileId)));

  await cache.del(FEED_CACHE_KEY);
  await invalidatePostCache(postId);
  return toClientPost(updated);
}

// Appends one more image to an existing post (author-only, max 6 images
// total). Used to build up a multi-image post: the client creates the post
// with its first image via createPost, then calls this once per additional
// image — Expo's FileSystem.uploadAsync only supports one file per request,
// so multi-image upload has to happen as several sequential calls instead
// of one multipart request with several files.
async function addImage(userId, postId, file) {
  if (!file) throw ApiError.badRequest("Image file is required");

  const post = await postRepository.findByIdRaw(postId);
  if (!post) throw ApiError.notFound("Post not found");
  if (post.author.toString() !== userId) throw ApiError.forbidden("You can only edit your own posts");
  if ((post.images || []).length >= 6) throw ApiError.badRequest("A post can have at most 6 images");

  const uploaded = await uploadImage(
    file.buffer,
    `post_${userId}_${Date.now()}_${file.originalname}`,
    "/posts",
  );

  // FIX (orphaned ImageKit files on DB write failure): same pattern as
  // createPost/updatePost above — the image is already uploaded to
  // ImageKit by this point, so if the Mongo write below fails, roll it
  // back instead of leaving an orphaned file with nothing in Mongo
  // referencing it.
  let updated;
  try {
    updated = await postRepository.addImage(postId, { url: uploaded.url, fileId: uploaded.fileId });
  } catch (err) {
    await deleteImage(uploaded.fileId);
    throw err;
  }

  await cache.del(FEED_CACHE_KEY);
  await invalidatePostCache(postId);
  return toClientPost(updated);
}

async function deletePost(userId, postId) {
  const post = await postRepository.findByIdRaw(postId);
  if (!post) throw ApiError.notFound("Post not found");
  if (post.author.toString() !== userId) throw ApiError.forbidden("You can only delete your own posts");

  // Gather comment IDs for cascading
  const commentDocs = await commentRepository.findIdsByPost(postId);
  const commentIds = commentDocs.map((c) => c._id);

  // Execute all database cascades inside an atomic transaction (with standalone fallback)
  await withTransaction(async (session) => {
    await Promise.all([
      commentRepository.deleteByPost(postId, session),
      likeRepository.deleteByTargets(TARGET_TYPE.POST, [postId], session),
      commentIds.length > 0
        ? likeRepository.deleteByTargets(TARGET_TYPE.COMMENT, commentIds, session)
        : Promise.resolve(),
      bookmarkRepository.deleteByPost(postId, session),
      reportRepository.deleteByTargets(TARGET_TYPE.POST, [postId], session),
      commentIds.length > 0
        ? reportRepository.deleteByTargets(TARGET_TYPE.COMMENT, commentIds, session)
        : Promise.resolve(),
      notificationService.deleteForPosts([postId], session),
      commentIds.length > 0 ? notificationService.deleteForComments(commentIds, session) : Promise.resolve(),
    ]);

    await postRepository.deleteById(postId, session);
    await userRepository.incrementCounts(post.author, { postCount: -1 }, session);
  });

  // Best-effort image cleanup after DB commit; doesn't block or corrupt DB if ImageKit is slow/down.
  await Promise.all((post.images || []).map((img) => deleteImage(img.fileId)));

  await cache.del(FEED_CACHE_KEY);
  await invalidatePostCache(postId);
  // Without this, a cache HIT on comment.service.js#listComments skips its
  // post-existence check entirely (that check only runs on a miss) — so a
  // deleted post's comments page would keep 200'ing from cache instead of
  // 404ing, until TTL expiry.
  await cache.del(postCommentsCacheKey(postId));
}

async function searchPosts(query) {
  if (!query || query.trim().length < 2) return [];
  const posts = await postRepository.searchPosts(query.trim());
  return posts.map(toClientPost);
}

module.exports = {
  getFeed,
  getPostById,
  createPost,
  updatePost,
  addImage,
  deletePost,
  searchPosts,
  toClientPost,
  invalidatePostCache,
  invalidateFeedCache,
};