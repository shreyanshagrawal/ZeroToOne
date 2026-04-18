const mongoose = require('mongoose');

const graphDataSchema = new mongoose.Schema({
  repo_id: { type: String, required: true, unique: true, index: true },
  nodes: [{ type: mongoose.Schema.Types.Mixed }], // Array of graph nodes
  links: [{ type: mongoose.Schema.Types.Mixed }], // Array of graph links
});

module.exports = mongoose.model('GraphData', graphDataSchema);
