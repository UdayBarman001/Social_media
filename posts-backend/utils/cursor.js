// Signed pagination cursor. Previously the feed cursor was a raw, client-
// editable JSON blob (`{ createdAt, id }`) round-tripped through the query
// string with nothing stopping a client from hand-editing it to walk an
// arbitrary range of the feed. This wraps that same payload with an HMAC
// tag so the server can trust a cursor it's handed came from a response it
// actually issued, without needing any server-side session/state for it
// (still fully stateless — just tamper-evident).

const crypto = require("crypto");
const config = require("../config/env");

function sign(payloadStr) {
  return crypto
    .createHmac("sha256", config.cursorSecret)
    .update(payloadStr)
    .digest("hex")
    .slice(0, 16); // 16 hex chars (64 bits) is plenty for tamper-evidence on a non-secret payload; keeps the cursor short
}

/** Builds the opaque cursor string returned to the client as meta.nextCursor. */
function encodeCursor({ createdAt, id }) {
  const payloadStr = JSON.stringify({ createdAt, id });
  const payloadB64 = Buffer.from(payloadStr, "utf8").toString("base64url");
  return `${payloadB64}.${sign(payloadStr)}`;
}

/** Parses and verifies a cursor string from the client. Throws on any
 *  malformed or tampered input — callers should treat that as a bad
 *  request, same as the old JSON.parse failure case did. */
function decodeCursor(cursorStr) {
  const [payloadB64, tag] = String(cursorStr).split(".");
  if (!payloadB64 || !tag) throw new Error("Malformed cursor");

  const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf8");
  const expectedTag = sign(payloadStr);

  const a = Buffer.from(tag);
  const b = Buffer.from(expectedTag);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Invalid cursor signature");
  }

  const payload = JSON.parse(payloadStr);
  if (!payload || typeof payload.createdAt !== "string" || typeof payload.id !== "string") {
    throw new Error("Invalid cursor payload");
  }
  return payload;
}

module.exports = { encodeCursor, decodeCursor };