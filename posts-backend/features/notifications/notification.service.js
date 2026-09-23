// `notify()` is the single entry point other features call to fan out a
// notification (e.g. like.service calls notify() after a post is liked).
// Kept fire-and-forget-safe: never throws, so a notification failure never
// breaks the primary action (liking/commenting/following) that triggered it.

const notificationRepository = require("./notification.repository");
const User = require("../users/user.model");
const Post = require("../posts/post.model");
const logger = require("../../config/logger");
const { getPagination, buildMeta } = require("../../utils/pagination");

async function notify({ recipient, sender, type, post, comment }) {
  if (!recipient || !sender) return;
  if (recipient.toString() === sender.toString()) return; // don't notify yourself
  try {
    await notificationRepository.create({ recipient, sender, type, post, comment });
  } catch (err) {
    logger.warn("Failed to create notification", err.message);
  }
}

function toClientNotification(n, userMap, postMap) {
  const senderId = n.sender ? n.sender.toString() : null;
  const senderUser = senderId && userMap ? userMap.get(senderId) : null;
  const postId = n.post ? n.post.toString() : null;
  const postDoc = postId && postMap ? postMap.get(postId) : null;

  return {
    id: n._id.toString(),
    type: n.type,
    sender: senderUser
      ? {
          id: senderUser._id.toString(),
          name: senderUser.name,
          handle: senderUser.handle,
          avatarUrl: senderUser.avatarUrl,
          verified: !!senderUser.verified,
        }
      : senderId
      ? { id: senderId, name: "Someone", handle: "", avatarUrl: null, verified: false }
      : null,
    post: postDoc
      ? {
          id: postDoc._id.toString(),
          description: postDoc.description || "",
          image:
            postDoc.images?.[0]?.url ||
            (typeof postDoc.image === "string" ? postDoc.image : postDoc.image?.url) ||
            null,
        }
      : postId
      ? { id: postId, description: "", image: null }
      : null,
    comment: n.comment ? n.comment.toString() : null,
    read: !!n.read,
    createdAt: n.createdAt,
  };
}

async function listNotifications(userId, query) {
  if (!userId) {
    return {
      notifications: [],
      meta: { page: 1, limit: 20, total: 0, hasNextPage: false, unreadCount: 0 },
    };
  }

  const pagination = getPagination(query);
  const [rows, total, unreadCount] = await Promise.all([
    notificationRepository.findByRecipient(userId, pagination),
    notificationRepository.countByRecipient(userId),
    notificationRepository.countUnread(userId),
  ]);

  const senderIds = [...new Set(rows.map((r) => r.sender).filter(Boolean))];
  const postIds = [...new Set(rows.map((r) => r.post).filter(Boolean))];

  const [users, posts] = await Promise.all([
    senderIds.length > 0
      ? User.find({ _id: { $in: senderIds } }).select("name handle avatarUrl verified").lean()
      : [],
    postIds.length > 0
      ? Post.find({ _id: { $in: postIds } }).select("description image images").lean()
      : [],
  ]);

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));
  const postMap = new Map(posts.map((p) => [p._id.toString(), p]));

  return {
    notifications: rows.map((n) => toClientNotification(n, userMap, postMap)),
    meta: { ...buildMeta({ ...pagination, total }), unreadCount },
  };
}

async function markAllRead(userId) {
  await notificationRepository.markAllRead(userId);
}

async function markOneRead(userId, notificationId) {
  await notificationRepository.markOneRead(notificationId, userId);
}

// Cascade helpers — called by post.service.js#deletePost and
// comment.service.js#deleteComment so a deleted post/comment's like or
// comment notifications don't keep pointing at content that's gone.
async function deleteForPosts(postIds, session) {
  await notificationRepository.deleteByPosts(postIds, session);
}

async function deleteForComments(commentIds, session) {
  await notificationRepository.deleteByComments(commentIds, session);
}

module.exports = { notify, listNotifications, markAllRead, markOneRead, deleteForPosts, deleteForComments };