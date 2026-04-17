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

    const result = githubService.getRepoStructure(analysisId);

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
    const { analysisId, file } = req.query;

    if (!analysisId) {
      return next(new AppError('analysisId query parameter is required.', 400));
    }

    const result = githubService.getFileSummary(analysisId, file);

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
 * GET /stream-status/:jobId
 * Server-Sent Events (SSE) endpoint to stream backend execution logs natively 
 * without websockets or client polling.
 */
const streamAnalysisStatus = (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Helper inside stream closure
  const onUpdate = (data) => {
    res.write(`data: ${JSON.stringify({ jobId, ...data })}\n\n`);
    if (data.status === 'completed' || data.status === 'failed') {
      res.end();
    }
  };

  const store = require('../utils/store');
  // 1. Subscribe to Live Events
  store.on(`update:${jobId}`, onUpdate);

  // 2. Clear listener on client disconnect to prevent ghost memory leaks
  req.on('close', () => {
    store.off(`update:${jobId}`, onUpdate);
  });

  // 3. Immediately Dispatch initial state if cache already has it processing
  const initial = store.get(jobId);
  if (initial) {
    onUpdate(initial);
  } else {
    res.write(`data: ${JSON.stringify({ status: 'failed', error: 'Job not found' })}\n\n`);
    res.end();
  }
};

module.exports = {
  analyzeRepo,
  getRepoStructure,
  getFileSummary,
  searchRepo,
  checkAnalysisStatus,
  streamAnalysisStatus
};
