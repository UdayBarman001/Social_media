// Enterprise Transaction Helper
// Executes multi-document operations atomically inside a MongoDB Replica Set Transaction.
// If run against a standalone MongoDB instance (e.g. local dev without replica set),
// it transparently and gracefully falls back to non-transactional execution.

const mongoose = require("mongoose");
const logger = require("../config/logger");

let isReplicaSetCached = null;

async function checkSupportsTransactions() {
  if (isReplicaSetCached !== null) return isReplicaSetCached;

  try {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return false;
    }
    const adminDb = mongoose.connection.db.admin();
    const status = await adminDb.command({ isMaster: 1 }).catch(() => null);
    // Replica set members have setName defined
    isReplicaSetCached = Boolean(status && (status.setName || status.msg === "isdbgrid"));
    return isReplicaSetCached;
  } catch {
    isReplicaSetCached = false;
    return false;
  }
}

/**
 * Runs the given workFn inside a MongoDB transaction if supported.
 * @param {Function} workFn - (session) => Promise<T>
 * @returns {Promise<T>}
 */
async function withTransaction(workFn) {
  const supportsTransactions = await checkSupportsTransactions();

  if (!supportsTransactions) {
    // Standalone Mongo or fallback: execute directly without session
    return workFn(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await workFn(session);
    });
    return result;
  } catch (err) {
    logger.error("Transaction aborted due to error:", err.message);
    throw err;
  } finally {
    await session.endSession();
  }
}

module.exports = { withTransaction, checkSupportsTransactions };
