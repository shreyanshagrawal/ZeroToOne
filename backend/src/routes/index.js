const express = require('express');
const router = express.Router();
const controller = require('../controllers/github.controller');

// Analyze a GitHub repository (clone + extract + summarize)
router.post('/analyze-repo', controller.analyzeRepo);

// Get cached file tree structure
router.get('/repo-structure', controller.getRepoStructure);

// Get file summary (single file or all)
router.get('/file-summary', controller.getFileSummary);

// Search within analyzed repository
router.post('/search', controller.searchRepo);

// Check status of analysis
router.get('/status/:jobId', controller.checkAnalysisStatus);

// Server-Sent Events stream
router.get('/stream-status/:jobId', controller.streamAnalysisStatus);

module.exports = router;
