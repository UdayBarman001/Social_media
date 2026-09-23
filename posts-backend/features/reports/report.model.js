// Reports flag a Post or Comment (see constants.TARGET_TYPE) for moderator
// review. Kept polymorphic like the Like model, for the same reason: one
// collection handles reports for any reportable feature added later.

const mongoose = require("mongoose");
const { TARGET_TYPE, REPORT_STATUS } = require("../../constants");

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: Object.values(TARGET_TYPE), required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
    status: { type: String, enum: Object.values(REPORT_STATUS), default: REPORT_STATUS.PENDING },
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model("Report", reportSchema);
