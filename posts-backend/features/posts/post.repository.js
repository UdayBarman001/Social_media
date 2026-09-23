// All Mongoose queries for Post. Uses .lean() + projection for read paths
// since the feed is the hottest path in the app — no need for full Mongoose
// documents (with getters/virtuals/change-tracking) just to render a feed.
//
// `author` is a real ObjectId ref to User (see post.model.js) — every read
// path below populates it down to the display fields the frontend needs
// (post.service.js#toClientPost splits that back into `author` (id) +
// `authorName`/`authorAvatar`/`authorVerified` for the client).
const AUTHOR_POPULATE = { path: "author", select: "name avatarUrl verified" };

const Post = require("./post.model");
const escapeRegex = require("../../utils/escapeRegex");
const logger = require("../../config/logger");

// `_id: -1` is a required second sort key, not cosmetic: MongoDB gives no
// ordering guarantee for documents tied on `createdAt` unless the sort
// key is fully unique, and posts created in the same batch/millisecond
// (seed data, or any two real posts landing in the same millisecond) DO
// tie. Without this, two identical page-1 requests could legitimately
// return tied posts in a different relative order — visible as posts
// swapping position between fetches — and, worse, this sort would
// disagree with findFeedAfter's cursor sort (`{ createdAt: -1, _id: -1 }`)
// at a tied boundary, causing a post to fall on the wrong side of the
// cursor filter: silently skipped forever, or re-fetched as a duplicate.
// Matching the tiebreaker here keeps page 1 and every cursor-paginated
// page after it walking one single, stable, gapless order.
function findFeed({ skip, limit, authorId, tag }) {
  const filter = {};
  if (authorId) filter.author = authorId;
  if (tag) filter.tags = tag;

  return Post.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .populate(AUTHOR_POPULATE)
    .lean();
}

function findFeedAfter({ cursor, limit, authorId, tag }) {
  const filter = {};
  if (authorId) filter.author = authorId;
  if (tag) filter.tags = tag;
  if (cursor?.createdAt) {
    filter.$or = [
      { createdAt: { $lt: new Date(cursor.createdAt) } },
      { createdAt: new Date(cursor.createdAt), _id: { $lt: cursor.id } },
    ];
  }

  return Post.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .populate(AUTHOR_POPULATE)
    .lean();
}

function countFeed({ authorId, tag }) {
  const filter = {};
  if (authorId) filter.author = authorId;
  if (tag) filter.tags = tag;
  return Post.countDocuments(filter);
}

function findById(id) {
  return Post.findById(id).populate(AUTHOR_POPULATE).lean();
}

function findByIds(ids) {
  return Post.find({ _id: { $in: ids } }).populate(AUTHOR_POPULATE).lean();
}

function findByIdRaw(id) {
  return Post.findById(id);
}

async function create(data) {
  const post = await Post.create(data);
  return post.populate(AUTHOR_POPULATE);
}

function updateById(id, update) {
  return Post.findByIdAndUpdate(id, update, { new: true, runValidators: true })
    .populate(AUTHOR_POPULATE)
    .lean();
}

function addImage(id, image) {
  return Post.findByIdAndUpdate(
    id,
    { $push: { images: image } },
    { new: true, runValidators: true }
  )
    .populate(AUTHOR_POPULATE)
    .lean();
}

function deleteById(id, session) {
  const q = Post.findByIdAndDelete(id);
  if (session) q.session(session);
  return q;
}

function incrementLikeCount(id, delta) {
  return Post.findByIdAndUpdate(
    id,
    [
      {
        $set: {
          likeCount: {
            $max: [0, { $add: [{ $ifNull: ["$likeCount", 0] }, delta] }],
          },
        },
      },
    ],
    { new: true }
  )
    .populate(AUTHOR_POPULATE)
    .lean();
}

function incrementCommentCount(id, delta) {
  return Post.findByIdAndUpdate(
    id,
    [
      {
        $set: {
          commentCount: {
            $max: [0, { $add: [{ $ifNull: ["$commentCount", 0] }, delta] }],
          },
        },
      },
    ],
    { new: true }
  )
    .populate(AUTHOR_POPULATE)
    .lean();
}

const SEARCH_INDEX_NAME = "posts_description_search"; // must match scripts/create-posts-search-index.js
const SEARCH_RESULT_LIMIT = 10; // typeahead box — top matches only, no paging

// Full-text + fuzzy search on description via Atlas Search ($search).
// description is a full caption, not an identifier — users expect "farm"
// to match "farming" anywhere in the text, not just at the start, so a
// B-tree prefix index (what user.repository.js#search uses) can't serve
// this well. Atlas Search's Lucene index (an inverted index, built for
// exactly this) can, and adds real typo tolerance as a bonus.
//
// $search is an Atlas-only aggregation stage: it does not exist at all on
// a self-hosted/local `mongod` (config/env.js's own MONGO_URI fallback is
// `mongodb://127.0.0.1:27017/...`, i.e. exactly that case), and even on a
// real Atlas cluster it only works once someone has separately run
// scripts/create-posts-search-index.js and that index has finished
// building. None of that is enforced anywhere, so on any deployment that
// hasn't done both of those things, every search request either throws
// ("Unrecognized pipeline stage name: '$search'" against local Mongo) or
// silently returns zero results (index missing/still building on Atlas) —
// which is exactly "posts search doesn't work" from the outside.
//
// searchPostsAtlas/searchPostsRegex below are kept as two separate,
// independently callable functions (rather than inlined) so each is easy
// to unit test and so the fallback below stays a one-line try/catch.
//
// compound.should with two DIFFERENT operators, not the same `text`
// operator twice — this is the fix for "agri" not matching a post tagged
// "agriculture":
//   - description uses `text` + fuzzy: description is prose, so "agri"
//     is genuinely a different (shorter) word than "agriculture" — text
//     matching whole tokens (with 1-typo tolerance) is the right
//     behavior there, same as before.
//   - tags uses `autocomplete`, NOT `text`: a tag is an identifier the
//     user is typing the start of, not a sentence — Atlas's `text`
//     operator matches whole tokens (± edit-distance for typos), it does
//     NOT do prefix matching, so "agri" vs. the token "agriculture" was
//     never going to match no matter how `fuzzy` was tuned. `autocomplete`
//     is Atlas's purpose-built prefix/typeahead operator: "agri" matches
//     "agriculture" from the very first keystroke, the same prefix
//     behavior the {tags:1} regex fallback below already had all along.
//     Requires the index's `tags` field to be mapped as type
//     "autocomplete" (see ensureSearchIndex.js) instead of type "string".
function searchPostsAtlas(query) {
  return Post.aggregate([
    {
      $search: {
        index: SEARCH_INDEX_NAME,
        compound: {
          should: [
            {
              text: {
                query,
                path: "description",
                fuzzy: { maxEdits: 1 }, // tolerates 1 typo, e.g. "farmign" still finds "farming"
              },
            },
            {
              autocomplete: {
                query,
                path: "tags",
              },
            },
          ],
          minimumShouldMatch: 1,
        },
      },
    },
    { $limit: SEARCH_RESULT_LIMIT },
    {
      $lookup: {
        from: "users",
        localField: "author",
        foreignField: "_id",
        as: "author",
        pipeline: [{ $project: { name: 1, avatarUrl: 1, verified: 1 } }],
      },
    },
    { $unwind: "$author" }, // shapes author the same way AUTHOR_POPULATE does, so toClientPost() needs no changes
  ]);
}

// Portable fallback: matches on EITHER description OR tags, same $or
// shape as user.repository.js#search now uses for name/handle:
//   - description: case-insensitive substring $regex (same technique
//     user.repository.js used before it moved to a prefix index, and the
//     same escapeRegex guard against ReDoS / regex metacharacters in user
//     input). No typo tolerance, no relevance ranking (falls back to
//     newest-first) — this branch can't use the {tags:1} index and is a
//     COLLSCAN, but it's the best available without Atlas Search.
//   - tags: anchored ^prefix regex, which — unlike the description
//     branch — DOES ride the {tags:1} multikey index (IXSCAN), the same
//     way nameLower/handle prefix search does in user.repository.js.
//     Tags are stored normalized lowercase (post.model.js), so the query
//     is lowercased to match, same convention as nameLower there.
// This is what actually works everywhere Mongo runs, with zero setup —
// Atlas Search (above) still runs first whenever it's available.
function searchPostsRegex(query) {
  const safe = escapeRegex(query);
  const tagPrefix = new RegExp(`^${safe}`, "i");
  return Post.find({
    $or: [{ description: { $regex: safe, $options: "i" } }, { tags: tagPrefix }],
  })
    .sort({ createdAt: -1 })
    .limit(SEARCH_RESULT_LIMIT)
    .populate(AUTHOR_POPULATE)
    .lean();
}

// Tries Atlas Search first (best relevance + typo tolerance when it's
// actually available); on ANY failure — no $search support, index not
// created yet, index still building, wrong index name, etc. — falls back
// to the regex search instead of surfacing a 500 or silently returning
// nothing. This is what actually makes search work out of the box on a
// local/self-hosted Mongo, and keeps working on Atlas even mid-index-build.
async function searchPosts(query) {
  try {
    return await searchPostsAtlas(query);
  } catch (err) {
    logger.warn(`Atlas $search unavailable, falling back to regex search: ${err.message}`);
    return searchPostsRegex(query);
  }
}

module.exports = {
  findFeed,
  findFeedAfter,
  countFeed,
  findById,
  findByIds,
  findByIdRaw,
  create,
  updateById,
  addImage,
  deleteById,
  incrementLikeCount,
  incrementCommentCount,
  searchPosts,
};