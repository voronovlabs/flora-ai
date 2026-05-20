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

export function createLogger(scope) {
  return {
    trace: (...args) => shouldLog(LEVELS.TRACE) && console.debug(tag(scope), STYLE, ...args),
    debug: (...args) => shouldLog(LEVELS.DEBUG) && console.debug(tag(scope), STYLE, ...args),
    info:  (...args) => shouldLog(LEVELS.INFO)  && console.info(tag(scope), STYLE, ...args),
    warn:  (...args) => shouldLog(LEVELS.WARN)  && console.warn(tag(scope), STYLE, ...args),
    error: (...args) => shouldLog(LEVELS.ERROR) && console.error(tag(scope), STYLE, ...args),
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
