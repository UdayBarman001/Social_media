const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const app = require("../app");
const { withTransaction, checkSupportsTransactions } = require("../utils/transaction");

describe("Sprint 3: Enterprise Hardening & Reliability Tests", () => {
  let server;
  let baseUrl;

  before((_, done) => {
    // Start ephemeral server on random available port
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  after((_, done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  it("1. GET /health/live returns 200 with uptime and process info", async () => {
    const res = await fetch(`${baseUrl}/health/live`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.status, "alive");
    assert.strictEqual(typeof json.data.uptimeSeconds, "number");
    assert.strictEqual(typeof json.data.pid, "number");
  });

  it("2. GET /health/ready checks backing dependencies", async () => {
    const res = await fetch(`${baseUrl}/health/ready`);
    // Depending on whether Mongo is currently connected or in standalone test mode,
    // status is either 200 or 503 (proper readiness response)
    assert.ok(res.status === 200 || res.status === 503);

    const json = await res.json();
    assert.ok("dependencies" in json.data);
    assert.ok("mongo" in json.data.dependencies);
    assert.ok("redis" in json.data.dependencies);
  });

  it("3. Middleware auto-assigns X-Request-Id header if none provided", async () => {
    const res = await fetch(`${baseUrl}/health/live`);
    const requestId = res.headers.get("x-request-id");

    assert.ok(requestId, "X-Request-Id header must be present");
    // Standard UUIDv4 length is 36 chars
    assert.strictEqual(requestId.length, 36);
  });

  it("4. Middleware preserves existing client-provided X-Request-Id header", async () => {
    const customId = "client-trace-abc-12345";
    const res = await fetch(`${baseUrl}/health/live`, {
      headers: { "X-Request-Id": customId },
    });
    const requestId = res.headers.get("x-request-id");

    assert.strictEqual(requestId, customId);
  });

  it("5. 404 Route preserves X-Request-Id and attaches to error payload", async () => {
    const customId = "trace-err-999";
    const res = await fetch(`${baseUrl}/api/v1/nonexistent-route`, {
      headers: { "X-Request-Id": customId },
    });
    assert.strictEqual(res.status, 404);

    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.requestId, customId);
  });

  it("6. withTransaction helper executes without throwing on standalone/replica environments", async () => {
    let executed = false;
    const result = await withTransaction(async (session) => {
      executed = true;
      return "transaction-or-fallback-success";
    });

    assert.strictEqual(executed, true);
    assert.strictEqual(result, "transaction-or-fallback-success");
  });
});
