// Centralized logger. Behaves differently in development (verbose, colored)
// vs production (structured, quiet on noise). Swap the implementation here
// (e.g. for pino/winston) without touching any calling code elsewhere.

const config = require("./env");

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = config.isProduction ? LEVELS.info : LEVELS.debug;

function timestamp() {
  return new Date().toISOString();
}

function log(level, ...args) {
  if (LEVELS[level] > currentLevel) return;
  const prefix = `[${timestamp()}] [${level.toUpperCase()}]`;
  if (level === "error") console.error(prefix, ...args);
  else if (level === "warn") console.warn(prefix, ...args);
  else console.log(prefix, ...args);
}

module.exports = {
  error: (...args) => log("error", ...args),
  warn: (...args) => log("warn", ...args),
  info: (...args) => log("info", ...args),
  debug: (...args) => log("debug", ...args),
};
