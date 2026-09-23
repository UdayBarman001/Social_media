// Shared pagination helper. Every list endpoint (posts, comments, notifications...)
// should parse query params through this so behavior is consistent.

const { PAGINATION } = require("../constants");

// `defaultLimit`/`maxLimit` overrides exist for the rare endpoint that isn't
// a normal paginated list — e.g. a launch-time "full sync" bulk-id fetch
// (GET /likes/:userId/liked) that the client expects to come back complete
// in one call rather than paged. Every call site that omits the second
// argument keeps the exact previous behavior (DEFAULT_LIMIT/MAX_LIMIT).
function getPagination(
  query,
  { defaultLimit = PAGINATION.DEFAULT_LIMIT, maxLimit = PAGINATION.MAX_LIMIT } = {}
) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isInteger(page) || page < 1) page = PAGINATION.DEFAULT_PAGE;
  if (!Number.isInteger(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasNextPage: page * limit < total,
  };
}

module.exports = { getPagination, buildMeta };