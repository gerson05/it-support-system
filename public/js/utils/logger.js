// Simple logging utility
const Logger = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,

  level: (typeof DEBUG !== 'undefined' && DEBUG) ? 0 : 1,

  debug(...args) {
    if (this.level <= this.DEBUG) console.log('[DEBUG]', ...args);
  },

  info(...args) {
    if (this.level <= this.INFO) console.log('[INFO]', ...args);
  },

  warn(...args) {
    if (this.level <= this.WARN) console.warn('[WARN]', ...args);
  },

  error(...args) {
    if (this.level <= this.ERROR) console.error('[ERROR]', ...args);
  },

  table(data) {
    console.table(data);
  }
};
