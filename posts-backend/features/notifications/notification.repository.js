const Notification = require("./notification.model");

function create(data) {
  return Notification.create(data);
}
function findByRecipient(recipientId, { skip, limit }) {
  return Notification.find({ recipient: recipientId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
}
function countByRecipient(recipientId) {
  return Notification.countDocuments({ recipient: recipientId });
}
function countUnread(recipientId) {
  return Notification.countDocuments({ recipient: recipientId, read: false });
}
function markAllRead(recipientId) {
  return Notification.updateMany({ recipient: recipientId, read: false }, { read: true });
}
function markOneRead(id, recipientId) {
  return Notification.findOneAndUpdate({ _id: id, recipient: recipientId }, { read: true }, { new: true });
}

// Bulk-removes every notification referencing any of the given post ids —
// used to cascade-delete when a post is deleted, so a like/comment
// notification never points at content that no longer exists.
function deleteByPosts(postIds, session) {
  const q = Notification.deleteMany({ post: { $in: postIds } });
  if (session) q.session(session);
  return q;
}

// Same, for comment ids — used when a comment (and its replies) is deleted.
function deleteByComments(commentIds, session) {
  const q = Notification.deleteMany({ comment: { $in: commentIds } });
  if (session) q.session(session);
  return q;
}

module.exports = {
  create,
  findByRecipient,
  countByRecipient,
  countUnread,
  markAllRead,
  markOneRead,
  deleteByPosts,
  deleteByComments,
};