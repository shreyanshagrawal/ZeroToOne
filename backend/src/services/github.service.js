const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');
const util = require('util');
const AppError = require('../utils/AppError');
const store = require('../utils/store');
const { asyncPool } = require('../utils/concurrency');
const { generateFileTree } = require('./tree.service');
const { summarizeFile, getDeepSummary } = require('./summary.service');
const { search } = require('./search.service');

const execAsync = util.promisify(exec);

const PARSABLE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue', '.py']);

/**
 * Validates public GitHub repository URL format
 */
const isValidGithubUrl = (url) => {
  const pattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
  return pattern.test(url);
};

/**
 * Walks a file tree and collects all file nodes into a flat array.
 */
const collectFileNodes = (tree, result = []) => {
  for (const node of tree) {
    if (node.type === 'file') {
      result.push(node);
    } else if (node.children) {
      collectFileNodes(node.children, result);
    }
  }
  return result;
};

/**
 * Reads file content and generates summaries for all parsable files concurrently.
 * Returns both summaries and a content map for search indexing.
 */
const processFiles = async (rootDir, fileTree) => {
  const fileNodes = collectFileNodes(fileTree);
  const contentMap = new Map();

  const parsableNodes = fileNodes.filter((node) => PARSABLE_EXTENSIONS.has(path.extname(node.name)));

  const summariesList = await asyncPool(50, parsableNodes, async (node) => {
    try {
      const content = await fs.readFile(path.join(rootDir, node.path), 'utf8');
      contentMap.set(node.path, content);
      return summarizeFile(node, content);
    } catch {
      return null;
    }
  });

  const summaries = summariesList.filter(Boolean);
  return { summaries, contentMap };
};

// ── Core Service Methods ────────────────────────────────────────────────────

/**
 * Clone, extract tree, generate summaries, and cache asynchronously.
 * Offloads heavy I/O scanning to the background so the Express route resolves instantly.
 */
const analyzeRepo = async (repoUrl) => {
  if (!repoUrl || !isValidGithubUrl(repoUrl)) {
    throw new AppError('Invalid GitHub repository URL. Must be a public https://github.com/owner/repo format.', 400);
  }

  const analysisId = `analysis_${Date.now()}`;
  const tempId = crypto.randomUUID();
  const targetDir = path.join(os.tmpdir(), `codemap_repo_${tempId}`);

  // Initialize store entry into pending state immediately 
  store.set(analysisId, {
    status: 'processing',
    repoUrl,
    structure: [],
    summaries: [],
    searchableFiles: [],
    progress: 'Cloning repository...'
  });

  // Background Processing Closure
  (async () => {
    try {
      // 1. Shallow clone
      await execAsync(`git clone --depth 1 "${repoUrl}" "${targetDir}"`);
      store.set(analysisId, { ...store.get(analysisId), progress: 'Extracting file tree...' });

      // 2. Generate file tree with dependency mapping
      const fileTree = await generateFileTree(targetDir);
      store.set(analysisId, { ...store.get(analysisId), progress: 'Generating summaries...', structure: fileTree });

      // 3. Summaries + content for search
      const { summaries, contentMap } = await processFiles(targetDir, fileTree);

      // 4. Build searchable file index securely without breaching V8 1.4GB Memory Heap on massive files
      const searchableFiles = summaries.map((s) => {
        const fullContent = contentMap.get(s.file) || '';
        // Cap physical cache storage limits per-file 
        const safeContent = fullContent.length > 50000 ? fullContent.substring(0, 50000) : fullContent;
        
        return {
          path: s.file,
          name: path.basename(s.file),
          content: safeContent,
          summary: s.summary,
          used_by: s.used_by,
          importance: s.importance,
        };
      });

      // 5. Finalize analysis cache
      store.set(analysisId, {
        status: 'completed',
        repoUrl,
        structure: fileTree,
        summaries,
        searchableFiles,
      }, 60 * 60 * 1000); // Bump TTL to 1 hour after successful compilation

    } catch (error) {
      console.error(`[Background Analysis Failed] ${analysisId}:`, error);
      store.set(analysisId, {
        status: 'failed',
        error: error.message,
        repoUrl
      }, 15 * 60 * 1000); // Retain error logs for 15 mins
    } finally {
      // Mandatory cleanup
      try {
        await fs.rm(targetDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error(`[Cleanup] Failed to remove ${targetDir}:`, cleanupError);
      }
    }
  })();

  return {
    analysisId,
    status: 'processing',
    message: 'Repository analysis queued and executing in the background.',
  };
};

/**
 * Endpoint to explicitly poll for the job status.
 */
const getJobStatus = async (jobId) => {
  const cached = store.get(jobId);
  if (!cached) {
    throw new AppError('Analysis ID not found or expired.', 404);
  }
  return {
    jobId,
    status: cached.status,
    progress: cached.progress,
    error: cached.error
  };
};

/**
 * Return cached file tree structure for a given analysis.
 */
const getRepoStructure = (analysisId) => {
  const cached = store.get(analysisId);
  if (!cached) {
    throw new AppError('Analysis not found or expired. Please re-analyze the repository.', 404);
  }
  return {
    repoUrl: cached.repoUrl,
    structure: cached.structure,
  };
};

/**
 * Return summary for a specific file, or all summaries if no filePath given.
 */
const getFileSummary = (analysisId, filePath, type = 'basic') => {
  const cached = store.get(analysisId);
  if (!cached) {
    throw new AppError('Analysis not found or expired. Please re-analyze the repository.', 404);
  }

  if (filePath) {
    let summary = cached.summaries.find((s) => s.file === filePath);
    if (!summary) {
      throw new AppError(`No summary found for file: ${filePath}`, 404);
    }
    
    // Inject Deep Technical View on demand
    if (type === 'deep') {
      const rawContent = cached.searchableFiles.find((f) => f.path === filePath)?.content || '';
      summary = getDeepSummary(summary, rawContent);
    }
    
    return summary;
  }

  return cached.summaries;
};

/**
 * Perform combined keyword + semantic search against a cached repository.
 */
const searchAnalysis = async (analysisId, query, topK = 10) => {
  const cached = store.get(analysisId);
  if (!cached) {
    throw new AppError('Analysis ID not found or expired.', 404);
  }

  // Uses the extracted content mapping stored safely in searchableFiles
  return await search(query, cached.searchableFiles, { topK });
};

module.exports = {
  analyzeRepo,
  getRepoStructure,
  getFileSummary,
  searchAnalysis,
  getJobStatus
};
