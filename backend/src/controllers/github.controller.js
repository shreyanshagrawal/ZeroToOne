const githubService = require('../services/github.service');
const AppError = require('../utils/AppError');

/**
 * POST /analyze-repo
 * Clone and analyze a GitHub repository.
 */
const analyzeRepo = async (req, res, next) => {
  try {
    const { repoUrl } = req.body;

    if (!repoUrl) {
      return next(new AppError('repoUrl is required.', 400));
    }

    const result = await githubService.analyzeRepo(repoUrl);

    return res.status(200).json({
      status: 'success',
      message: 'Repository analyzed successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /repo-structure?analysisId=xxx
 * Return the cached file tree for a previously analyzed repo.
 */
const getRepoStructure = async (req, res, next) => {
  try {
    const { analysisId } = req.query;

    if (!analysisId) {
      return next(new AppError('analysisId query parameter is required.', 400));
    }

    const result = await githubService.getRepoStructure(analysisId);

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /file-summary?analysisId=xxx&file=path/to/file.js
 * Return summary for a specific file, or all summaries if file is omitted.
 */
const getFileSummary = async (req, res, next) => {
  try {
    const { analysisId, file, type } = req.query;

    if (!analysisId) {
      return next(new AppError('analysisId query parameter is required.', 400));
    }

    const result = await githubService.getFileSummary(analysisId, file, type);

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /search
 * Search within an analyzed repository using keyword + semantic search.
 */
const searchRepo = async (req, res, next) => {
  try {
    const { analysisId, query, topK } = req.body;

    if (!analysisId) {
      return next(new AppError('analysisId is required.', 400));
    }
    if (!query) {
      return next(new AppError('Search query is required.', 400));
    }

    const results = await githubService.searchAnalysis(analysisId, query, topK || 10);

    return res.status(200).json({
      status: 'success',
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /status/:jobId
 * Explicitly poll for the status of a background job.
 */
const checkAnalysisStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return next(new AppError('Job ID is required to check status.', 400));
    }

    const status = await githubService.getJobStatus(jobId);
    
    return res.status(200).json({
      status: 'success',
      data: status
    });
  } catch (error) {
    next(error);
  }
};
/**
 * GET /graph-data?analysisId=xxx[&maxNodes=400][&excludeExternal=true]
 * Return a {nodes, links, meta} payload for force-directed graph rendering.
 *
 * Query params:
 *   analysisId      (required) — id returned by POST /analyze-repo
 *   maxNodes        (optional, default 400) — hard cap on node count
 *   excludeExternal (optional, default true) — hide npm-package nodes
 */
const getGraphData = async (req, res, next) => {
  try {
    const { analysisId, maxNodes, excludeExternal } = req.query;

    if (!analysisId) {
      return next(new AppError('analysisId query parameter is required.', 400));
    }

    const options = {};
    if (maxNodes !== undefined) {
      const parsed = parseInt(maxNodes, 10);
      if (!isNaN(parsed) && parsed > 0) options.maxNodes = parsed;
    }
    if (excludeExternal !== undefined) {
      // Accept "false" as the only falsy string value
      options.excludeExternal = excludeExternal !== 'false';
    }

    const data = await githubService.getGraphData(analysisId, options);
    
    if (data.pending) {
       return res.status(200).json({ status: 'pending', message: 'Graph data is generating' });
    }

    return res.status(200).json({
      status: 'success',
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /stream-status/:jobId
 * Server-Sent Events (SSE) endpoint to stream backend execution logs natively 
 * without websockets or client polling.
 */
const streamAnalysisStatus = async (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const onUpdate = (data) => {
    res.write(`data: ${JSON.stringify({ jobId, ...data })}\n\n`);
    if (data.status === 'completed' || data.status === 'failed') {
      res.end();
    }
  };

  const store = require('../utils/store');
  store.on(`update:${jobId}`, onUpdate);

  req.on('close', () => {
    store.off(`update:${jobId}`, onUpdate);
  });

  try {
    const Repository = require('../models/Repository');
    const initial = await Repository.findOne({ repo_id: jobId });
    if (initial) {
      onUpdate({ status: initial.status, progress: initial.status === 'processing' ? 'Processing...' : 'Done', error: initial.error_message });
    } else {
      res.write(`data: ${JSON.stringify({ status: 'failed', error: 'Job not found' })}\n\n`);
      res.end();
    }
  } catch(e) {
    res.end();
  }
};

module.exports = {
  analyzeRepo,
  getRepoStructure,
  getFileSummary,
  searchRepo,
  checkAnalysisStatus,
  streamAnalysisStatus,
  getGraphData,
};
