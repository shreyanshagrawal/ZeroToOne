/**
 * Lightweight in-memory event emitter for SSE notifications.
 * Passes progress logs to clients without heavy memory storage.
 */
const EventEmitter = require('events');

class AnalysisEvents extends EventEmitter {
  constructor() {
    super();
  }

  emitProgress(jobId, data) {
    this.emit(`update:${jobId}`, data);
  }
}

const store = new AnalysisEvents();
module.exports = store;
