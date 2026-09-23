// Reporting is intentionally simple for launch: create a report, let an
// admin review the pending queue and mark it reviewed/dismissed. Actually
// *acting* on a report (removing content, banning a user) is a deliberate
// manual step done via the admin panel/future tooling, not automated here.

const reportRepository = require("./report.repository");
const ApiError = require("../../utils/ApiError");
const { getPagination, buildMeta } = require("../../utils/pagination");
const { REPORT_STATUS } = require("../../constants");

async function createReport(reporterId, { targetType, targetId, reason }) {
  return reportRepository.create({ reporter: reporterId, targetType, targetId, reason });
}

async function listPending(query) {
  const pagination = getPagination(query);
  const [reports, total] = await Promise.all([
    reportRepository.findPending(pagination),
    reportRepository.countPending(),
  ]);
  return { reports, meta: buildMeta({ ...pagination, total }) };
}

async function resolveReport(reportId, status) {
  if (!Object.values(REPORT_STATUS).includes(status)) throw ApiError.badRequest("Invalid status");
  const report = await reportRepository.updateStatus(reportId, status);
  if (!report) throw ApiError.notFound("Report not found");
  return report;
}

module.exports = { createReport, listPending, resolveReport };
