const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const reportService = require("./report.service");

const createReport = asyncHandler(async (req, res) => {
  await reportService.createReport(req.body.userId, req.body);
  ApiResponse.success(res, { statusCode: 201, message: "Report submitted", data: {} });
});

const listPending = asyncHandler(async (req, res) => {
  const { reports, meta } = await reportService.listPending(req.query);
  ApiResponse.success(res, { message: "Pending reports fetched", data: { reports }, meta });
});

const resolveReport = asyncHandler(async (req, res) => {
  const report = await reportService.resolveReport(req.params.id, req.body.status);
  ApiResponse.success(res, { message: "Report resolved", data: { report } });
});

module.exports = { createReport, listPending, resolveReport };
