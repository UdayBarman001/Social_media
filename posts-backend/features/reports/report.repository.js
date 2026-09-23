const Report = require("./report.model");

function create(data) {
  return Report.create(data);
}
function findPending({ skip, limit }) {
  return Report.find({ status: "pending" })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("reporter", "name handle")
    .lean();
}
function countPending() {
  return Report.countDocuments({ status: "pending" });
}
function updateStatus(id, status) {
  return Report.findByIdAndUpdate(id, { status }, { new: true });
}

// Removes every report filed against any of the given target ids — used
// to cascade-delete reports when their target (post or comment) is
// deleted, so a moderator never sees a pending report for content that no
// longer exists.
function deleteByTargets(targetType, targetIds, session) {
  const q = Report.deleteMany({ targetType, targetId: { $in: targetIds } });
  if (session) q.session(session);
  return q;
}

module.exports = { create, findPending, countPending, updateStatus, deleteByTargets };