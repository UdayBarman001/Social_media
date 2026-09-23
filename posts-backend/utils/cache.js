// Thin JSON get/set/del wrapper around the Redis client from config/redis.js.
// Every function here is safe to call unconditionally from a service, the
// same way notification.service.js#notify() is safe to call without
// checking anything first: a missing client, a connection error, or bad
// JSON in the cache is always treated as a cache miss (get returns null,
// set/del resolve without throwing) and logged at "warn", never thrown —
// so a Redis outage degrades the app to "no caching", not "500s".

const { getRedis } = require("../config/redis");
const logger = require("../config/logger");

async function get(key) {
  const client = getRedis();
  if (!client || client.status !== "ready") return null;
  try {
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn(`cache.get(${key}) failed:`, err.message);
    return null;
  }
}

async function set(key, value, ttlSeconds) {
  const client = getRedis();
  if (!client || client.status !== "ready") return;
  try {
    const raw = JSON.stringify(value);
    if (ttlSeconds) await client.set(key, raw, "EX", ttlSeconds);
    else await client.set(key, raw);
  } catch (err) {
    logger.warn(`cache.set(${key}) failed:`, err.message);
  }
}

// Redis SET NX EX as a short-lived lock, used purely to coalesce a cold-
// cache stampede: when a hot key (e.g. FEED_CACHE_KEY) expires or gets
// invalidated under concurrent traffic, every in-flight request would
// otherwise miss at the same instant and all hit Mongo simultaneously.
// This lets exactly one caller "win" the lock and do the real fetch,
// while the rest either wait-and-retry the cache a few times or, if the
// lock holder still hasn't finished, just fall through to Mongo
// themselves rather than blocking indefinitely — never a hard dependency,
// same fail-open philosophy as the rest of this file.
// Lua script for a "delete key only if its value still matches mine"
// compare-and-delete — the standard safe-unlock pattern for Redis SET NX
// locks (see the Redlock docs). Runs as one atomic operation server-side,
// so there's no gap between the GET check and the DEL.
const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

// acquireLock previously stored a fixed "1" as the lock value and
// releaseLock did a bare `del(key)`. That meant: if the lock holder's
// fetchFn ran longer than the lock's own TTL (a slow/uncached Mongo query
// under load — exactly the condition this lock exists to protect
// against), the key would expire, a second caller would acquire a NEW
// lock for the same key, and then the FIRST caller's delayed `finally`
// block would blindly delete it — releasing a lock it no longer owned
// while the second caller still thought it was mid-fetch. A third caller
// could then acquire the same key again while #2 was still working,
// and the stampede-prevention this lock exists for would be defeated.
//
// Fix: give each acquireLock() call a unique token and only ever delete
// the key if it still holds that exact token (via the Lua script above).
// A stale/expired lock this caller no longer owns is left alone — at
// worst it expires on its own TTL, which is the safe failure mode.
function randomToken() {
  return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function acquireLock(key, ttlSeconds) {
  const client = getRedis();
  if (!client || client.status !== "ready") return { acquired: true, token: null }; // no Redis: treat as "always acquired" so callers proceed straight to Mongo
  try {
    const token = randomToken();
    const res = await client.set(`lock:${key}`, token, "EX", ttlSeconds, "NX");
    return { acquired: res === "OK", token: res === "OK" ? token : null };
  } catch (err) {
    logger.warn(`cache.acquireLock(${key}) failed:`, err.message);
    return { acquired: true, token: null }; // fail open — proceed as if we got the lock rather than deadlock callers
  }
}

async function releaseLock(key, token) {
  const client = getRedis();
  if (!client || client.status !== "ready" || !token) return;
  try {
    await client.eval(RELEASE_LOCK_SCRIPT, 1, `lock:${key}`, token);
  } catch (err) {
    logger.warn(`cache.releaseLock(${key}) failed:`, err.message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Coalesces concurrent cache misses for the same key into one fetch.
 *  Callers that don't win the lock briefly poll the cache (fetcher may
 *  finish and populate it) and fall back to calling fetchFn themselves
 *  if it still hasn't shown up after a short bound — so a slow/stuck
 *  lock holder never blocks anyone indefinitely. */
async function getOrLoad(key, ttlSeconds, fetchFn) {
  // `!= null`, not a truthy check: a legitimately cached falsy value (0,
  // "", false, []) must still count as a hit. A truthy check here would
  // wrongly treat those as a miss and re-hit Mongo on every read of that
  // key — this file's own get()/JSON.parse only ever produces `null` for
  // an actual miss, so `!= null` is the correct "did we get something" test.
  const cached = await get(key);
  if (cached != null) return cached;

  const { acquired, token } = await acquireLock(key, Math.min(ttlSeconds || 10, 10));
  if (acquired) {
    try {
      const fresh = await fetchFn();
      await set(key, fresh, ttlSeconds);
      return fresh;
    } finally {
      await releaseLock(key, token);
    }
  }

  // Didn't win the lock — someone else is populating this key. Poll
  // briefly instead of hitting Mongo ourselves.
  for (let i = 0; i < 5; i++) {
    await sleep(50);
    const retried = await get(key);
    if (retried != null) return retried;
  }
  // Lock holder still hasn't finished (slow query, crashed, whatever) —
  // don't wait forever, just do the work ourselves.
  return fetchFn();
}

async function del(keyOrPattern) {
  const client = getRedis();
  if (!client || client.status !== "ready") return;
  try {
    // No wildcard: delete the single key directly.
    if (!keyOrPattern.includes("*")) {
      await client.del(keyOrPattern);
      return;
    }
    // Wildcard: SCAN instead of KEYS so a large keyspace never blocks
    // Redis's single event loop the way KEYS * would.
    const stream = client.scanStream({ match: keyOrPattern, count: 100 });
    const keysToDelete = [];
    for await (const keys of stream) {
      keysToDelete.push(...keys);
    }
    if (keysToDelete.length > 0) await client.del(...keysToDelete);
  } catch (err) {
    logger.warn(`cache.del(${keyOrPattern}) failed:`, err.message);
  }
}

module.exports = { get, set, del, getOrLoad };