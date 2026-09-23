// Notifications are created by other features (likes, comments, follows)
// via notification.service.create() — see each feature's service for the
// call sites. This keeps the notification schema and fan-out logic in one
// place instead of duplicating "create a notification" everywhere.
//
// recipient/sender are plain userId strings, not Mongo ObjectId refs —
// there is no User collection in this app's no-auth design (see
// follow.service.js), so these must stay String to match what
// like.service.js / follow.service.js / comment.service.js actually pass in.

const mongoose = require("mongoose");
const { NOTIFICATION_TYPE } = require("../../constants");

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: String, required: true, index: true },
    sender: { type: String, required: true },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPE), required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null, index: true },
    comment: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null, index: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
// Powers notification.repository.js#countUnread's { recipient, read }
// query. { recipient: 1, createdAt: -1 } above still lets Mongo use
// `recipient` as an index prefix for this query, but it then has to scan
// every one of that recipient's notifications (read and unread alike) to
// count just the unread ones — fine for a light user, increasingly
// wasteful for an active one with a long notification history. This
// compound index lets the count come from a direct index seek instead.
notificationSchema.index({ recipient: 1, read: 1 });
// post.service.js#deletePost and comment.service.js#deleteComment cascade-
// delete notifications via deleteMany({ post: { $in: postIds } }) /
// deleteMany({ comment: { $in: commentIds } }) (see
// notification.repository.js#deleteByPosts/#deleteByComments). Neither
// field had an index before, so every post/comment deletion triggered a
// full collection scan (COLLSCAN) of the entire notifications collection
// to find rows to remove — the two indexes added above on `post` and
// `comment` (inline, in the schema definition) turn that into a direct
// index lookup.

module.exports = mongoose.model("Notification", notificationSchema);