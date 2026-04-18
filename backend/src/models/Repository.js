const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema({
  repo_id: { type: String, required: true, unique: true, index: true },
  repo_url: { type: String, required: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
  error_message: { type: String },
  structure: { type: mongoose.Schema.Types.Mixed }, // Full file tree
  created_at: { type: Date, default: Date.now },
  last_accessed: { type: Date, default: Date.now }
});

// Update last accessed when queried
repositorySchema.statics.touch = async function(repo_id) {
  return this.findOneAndUpdate(
    { repo_id },
    { last_accessed: new Date() },
    { new: true }
  );
};

module.exports = mongoose.model('Repository', repositorySchema);
