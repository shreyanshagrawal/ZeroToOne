/**
 * Lightweight in-memory store for analysis results.
 * Keeps analyzed repo data searchable without a database.
 * Uses a simple Map with TTL-based expiry to prevent memory leaks on large repos.
 */

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

const EventEmitter = require('events');

class AnalysisStore extends EventEmitter {
  constructor() {
    super();
    this.cache = new Map();
    // Pre-calculate max TTL limit to prevent memory leaks (default 30 mins)
    this.defaultTTL = 30 * 60 * 1000;
  }

  set(key, value, ttlMs = this.defaultTTL) {
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { value, expiresAt });
    
    // Broadcast targeted update for SSE streams
    this.emit(`update:${key}`, value);

    // Auto-cleanup timer for this specific key
    setTimeout(() => {
      this.deleteIfExpired(key);
    }, ttlMs);
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  deleteIfExpired(key) {
    const item = this.cache.get(key);
    if (item && Date.now() >= item.expiresAt) {
      this.cache.delete(key);
      this.removeAllListeners(`update:${key}`); // Prevents ghost memory leaks
    }
  }

  delete(key) {
    this.cache.delete(key);
    this.removeAllListeners(`update:${key}`);
  }
}

// Export singleton instance natively
const store = new AnalysisStore();
module.exports = store;
