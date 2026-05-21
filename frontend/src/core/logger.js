// Tiny leveled logger with a debug-mode toggle.
//
// Debug mode is enabled if EITHER:
//   • the URL contains ?debug=1 (sticky: stored in localStorage)
//   • localStorage.flora_debug === '1'
//
// In production builds (no flag set) DEBUG and TRACE are silent; WARN /
// ERROR always log. INFO logs in debug mode only.

const LEVELS = { TRACE: 10, DEBUG: 20, INFO: 30, WARN: 40, ERROR: 50 };
const LS_KEY = 'flora_debug';

function readDebugFlag() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('debug') === '1') {
      localStorage.setItem(LS_KEY, '1');
      return true;
    }
    if (url.searchParams.get('debug') === '0') {
      localStorage.removeItem(LS_KEY);
      return false;
    }
    return localStorage.getItem(LS_KEY) === '1';
  } catch (_) {
    return false;
  }
}

let debugMode = readDebugFlag();

function shouldLog(level) {
  if (level >= LEVELS.WARN) return true;
  if (debugMode) return level >= LEVELS.DEBUG;
  return false;
}

function tag(scope) { return `%c[${scope}]`; }
const STYLE = 'color:#059669;font-weight:600';

// Browser-compat: factory uses `arguments` + `.apply()` instead of
// rest/spread so the file parses in older engines that don't accept
// the `...` token.
function makeLogMethod(scope, gate, consoleFn) {
  return function () {
    if (!gate()) return;
    var args = Array.prototype.slice.call(arguments);
    var prefix = [tag(scope), STYLE];
    consoleFn.apply(console, prefix.concat(args));
  };
}

export function createLogger(scope) {
  return {
    trace: makeLogMethod(scope, function () { return shouldLog(LEVELS.TRACE); }, console.debug),
    debug: makeLogMethod(scope, function () { return shouldLog(LEVELS.DEBUG); }, console.debug),
    info:  makeLogMethod(scope, function () { return shouldLog(LEVELS.INFO);  }, console.info),
    warn:  makeLogMethod(scope, function () { return shouldLog(LEVELS.WARN);  }, console.warn),
    error: makeLogMethod(scope, function () { return shouldLog(LEVELS.ERROR); }, console.error),
  };
}

export function isDebugMode() { return debugMode; }

export function setDebugMode(on) {
  debugMode = !!on;
  try {
    if (debugMode) localStorage.setItem(LS_KEY, '1');
    else localStorage.removeItem(LS_KEY);
  } catch (_) { /* private mode etc. */ }
}

// Convenient default logger.
export const log = createLogger('flora');
