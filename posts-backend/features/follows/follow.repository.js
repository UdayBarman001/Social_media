const Follow = require("./follow.model");

// follower/following are real ObjectId refs to User (see follow.model.js).

function findFollow(followerId, followingId) {
  return Follow.findOne({ follower: followerId, following: followingId });
}
function createFollow(followerId, followingId) {
  return Follow.create({ follower: followerId, following: followingId });
}
function deleteFollow(followerId, followingId) {
  return Follow.findOneAndDelete({ follower: followerId, following: followingId });
}
function listFollowers(userId, { skip, limit }) {
  return Follow.find({ following: userId }).skip(skip).limit(limit).lean();
}
function listFollowing(userId, { skip, limit }) {
  return Follow.find({ follower: userId }).skip(skip).limit(limit).lean();
}
function countFollowers(userId) {
  return Follow.countDocuments({ following: userId });
}
function countFollowing(userId) {
  return Follow.countDocuments({ follower: userId });
}

module.exports = {
  findFollow,
  createFollow,
  deleteFollow,
  listFollowers,
  listFollowing,
  countFollowers,
  countFollowing,
};