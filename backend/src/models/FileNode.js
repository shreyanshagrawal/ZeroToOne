const mongoose = require('mongoose');

const fileNodeSchema = new mongoose.Schema({
  file_id: { type: String, required: true, index: true }, // Usually repo_id + file_path
  repo_id: { type: String, required: true, index: true },
  file_path: { type: String, required: true, index: true },
  summary: { type: mongoose.Schema.Types.Mixed, required: true }, // basic summary
  deep_summary: { type: mongoose.Schema.Types.Mixed }, // tech deep dive
  content: { type: String }, // raw source code for search
  imports: [{ type: String }],
  used_by: [{ type: String }],
  tags: [{ type: String }],
  metrics: {
    lines: Number,
    functions: Number,
    complexity: Number
  }
});

// Index for full-text search
fileNodeSchema.index({ file_path: 'text', content: 'text', 'tags': 'text' });

module.exports = mongoose.model('FileNode', fileNodeSchema);
