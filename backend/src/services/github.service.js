const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const util = require('util');
const AppError = require('../utils/AppError');
const { asyncPool } = require('../utils/concurrency');
const { generateFileTree } = require('./tree.service');
const { summarizeFile, getDeepSummary } = require('./summary.service');
const { search } = require('./search.service');
const store = require('../utils/store');

const Repository = require('../models/Repository');
const FileNode = require('../models/FileNode');
const GraphData = require('../models/GraphData');

const execAsync = util.promisify(exec);

const PARSABLE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue', '.py']);

const isValidGithubUrl = (url) => {
  const pattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
  return pattern.test(url);
};

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

// ── Helpers ─────────────────────────────────────────────────────────────

const inferGroup = (filePath) => {
  const segments = filePath.split('/');
  if (segments.length <= 1) return '(root)';
  const base = segments[0] === 'src' ? segments[1] : segments[0];
  return base || '(root)';
};

const getExt = (filePath) => {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

const PATH_TAG_RULES = [
  [/\/controllers?\//i,  'controller'],
  [/\/services?\//i,     'service'],
  [/\/models?\//i,       'model'],
  [/\/routes?\//i,       'route'],
  [/\/middlewares?\//i,  'middleware'],
  [/\/utils?\/|helpers?\/|lib\//i, 'util'],
  [/\/configs?\//i,      'config'],
  [/\/hooks?\//i,        'hook'],
  [/\/store\//i,         'store'],
  [/\/types?\//i,        'types'],
  [/\/pages?\//i,        'page'],
  [/\/components?\//i,   'component'],
  [/\/tests?\//i,        'test'],
  [/\/migrations?\//i,   'migration'],
  [/\/schemas?\//i,      'schema'],
  [/\/seeds?\//i,        'seed'],
  [/\/auth\//i,          'auth'],
  [/\/frontend\//i,      'frontend'],
  [/\/backend\//i,       'backend'],
];

const NAME_TAG_RULES = [
  [/\.service\./i,        'service'],
  [/\.controller\./i,     'controller'],
  [/\.model\./i,          'model'],
  [/\.route\./i,          'route'],
  [/\.middleware\./i,     'middleware'],
  [/\.hook\./i,           'hook'],
  [/\.util\./i,           'util'],
  [/\.spec\.|\.test\./i,  'test'],
  [/\.schema\./i,         'schema'],
  [/(^|\/)(index|main|app|server)\.[jt]sx?$/i, 'entry'],
  [/(^|[/.])(auth|login|logout|signup|session)[./]/i,  'auth'],
  [/(^|[/.])(user|account|profile|member)[./]/i,       'user'],
  [/(^|[/.])(project|task|ticket|issue)[./]/i,         'project'],
  [/(^|[/.])(payment|billing|invoice|stripe)[./]/i,    'payment'],
  [/(^|[/.])(email|mail|smtp|notification)[./]/i,      'notification'],
  [/(^|[/.])(upload|file|storage|s3|blob)[./]/i,       'storage'],
  [/(^|[/.])(dashboard|analytics|report)[./]/i,        'analytics'],
  [/(^|[/.])(admin|management)[./]/i,                  'admin'],
  [/(^|[/.])(db|database|mongo|postgres|sql|prisma|sequelize)[./]/i, 'database'],
  [/(^|[/.])(socket|ws|websocket|realtime)[./]/i,      'realtime'],
  [/(^|[/.])(cache|redis)[./]/i,                       'cache'],
  [/(^|[/.])(test|spec|mock)[./]/i,                    'test'],
];

const IMPORT_DOMAIN_RULES = [
  [/auth|passport|jwt|bcrypt/i,     'auth'],
  [/user|account|profile/i,         'user'],
  [/project|task|ticket/i,          'project'],
  [/payment|stripe|billing/i,       'payment'],
  [/mail|email|nodemailer/i,        'notification'],
  [/multer|s3|cloudinary|upload/i,  'storage'],
  [/socket\.io|ws\b|websocket/i,    'realtime'],
  [/redis|cache/i,                  'cache'],
  [/mongoose|sequelize|prisma|knex|typeorm/i, 'database'],
  [/express|fastify|koa|hapi/i,     'http'],
  [/react|vue|svelte|angular/i,     'frontend'],
  [/jest|mocha|vitest|chai/i,       'test'],
];

const inferTags = (filePath, imports = []) => {
  const found = new Set();
  for (const [rx, tag] of PATH_TAG_RULES) if (rx.test(filePath)) found.add(tag);
  for (const [rx, tag] of NAME_TAG_RULES) if (rx.test(filePath)) found.add(tag);
  for (const imp of imports)
    for (const [rx, tag] of IMPORT_DOMAIN_RULES) if (rx.test(imp)) found.add(tag);
  
  const seg = filePath.split('/');
  const top = seg[0] === 'src' ? seg[1] : seg[0];
  if (top && !top.includes('.')) found.add(top.toLowerCase());

  return Array.from(found).slice(0, 5);
};

// ── Graph Data Generator ────────────────────────────────────────────────

const generateRawGraph = (summaries) => {
  const nodeMap = new Map();
  for (const summary of summaries) {
    const { file, used_by = [], imports = [] } = summary;
    if (!nodeMap.has(file)) {
      nodeMap.set(file, {
        id:     file,
        name:   file.split('/').pop() || file,
        group:  inferGroup(file),
        weight: used_by.length,
        ext:    getExt(file),
        tags:   inferTags(file, imports),
      });
    } else {
      const existing = nodeMap.get(file);
      existing.weight = Math.max(existing.weight, used_by.length);
    }
  }

  const nodes = Array.from(nodeMap.values());
  const visibleIds = new Set(nodes.map(n => n.id));

  const linkSet = new Set();
  const links   = [];
  for (const summary of summaries) {
    const { file: source, imports = [] } = summary;
    if (!visibleIds.has(source)) continue;
    for (const target of imports) {
      if (!visibleIds.has(target)) continue;
      if (source === target) continue;

      const key = `${source}||${target}`;
      if (!linkSet.has(key)) {
        linkSet.add(key);
        links.push({ source, target });
      }
    }
  }
  return { nodes, links };
};

// ── Core Service Methods ────────────────────────────────────────────────────

const analyzeRepo = async (repoUrl) => {
  if (!repoUrl || !isValidGithubUrl(repoUrl)) {
    throw new AppError('Invalid GitHub repository URL. Must be a public https://github.com/owner/repo format.', 400);
  }

  const analysisId = crypto.createHash('md5').update(repoUrl).digest('hex');
  const targetDir = path.join(process.cwd(), 'data', 'repos', analysisId);

  let existingRepo = await Repository.findOne({ repo_id: analysisId });
  if (existingRepo) {
    if (existingRepo.status === 'completed') {
      await Repository.touch(analysisId);
      return { analysisId, message: 'Reused existing cached repository', status: 'completed' };
    } else if (existingRepo.status === 'processing') {
      return { analysisId, message: 'Analysis is currently in progress', status: 'processing' };
    }
  }

  // Create or Update
  await Repository.findOneAndUpdate(
    { repo_id: analysisId },
    { 
      repo_url: repoUrl, 
      name: repoUrl.split('/').pop(), 
      status: 'processing',
      error_message: null
    },
    { upsert: true, new: true }
  );

  fsSync.mkdirSync(targetDir, { recursive: true });

  // Background Processing Closure
  (async () => {
    try {
      // 1. Clone repository
      store.emitProgress(analysisId, { status: 'processing', progress: 'Cloning repository...' });
      const isCloned = fsSync.existsSync(path.join(targetDir, '.git'));
      if (!isCloned) {
        await execAsync(`git clone --depth 1 "${repoUrl}" "${targetDir}"`);
      }

      // 2. Generate file tree
      store.emitProgress(analysisId, { status: 'processing', progress: 'Extracting file tree...' });
      const fileTree = await generateFileTree(targetDir);
      
      // 3. Summaries + content
      store.emitProgress(analysisId, { status: 'processing', progress: 'Generating summaries...' });
      const { summaries, contentMap } = await processFiles(targetDir, fileTree);

      // Save Repository Structure
      await Repository.findOneAndUpdate(
         { repo_id: analysisId },
         { structure: fileTree }
      );

      // 4. Save FileNodes to DB
      await FileNode.deleteMany({ repo_id: analysisId });
      
      const fileNodesToInsert = summaries.map((s) => {
        const fullContent = contentMap.get(s.file) || '';
        // Cap physical cache storage limits per-file
        const safeContent = fullContent.length > 50000 ? fullContent.substring(0, 50000) : fullContent;
        
        return {
          repo_id: analysisId,
          file_id: `${analysisId}_${s.file}`,
          file_path: s.file,
          summary: s,
          content: safeContent,
          imports: s.imports || [],
          used_by: s.used_by || [],
          tags: inferTags(s.file, s.imports || []),
          metrics: s.stats ? {
            lines: parseInt(s.stats.find(m => m.label === 'Lines of Code')?.value || '0', 10),
            functions: parseInt(s.stats.find(m => m.label === 'Functions')?.value || '0', 10),
            complexity: parseInt(s.stats.find(m => m.label === 'Complexity')?.value || '0', 10)
          } : {}
        };
      });
      await FileNode.insertMany(fileNodesToInsert);

      // 5. Generate and Save GraphData
      const { nodes, links } = generateRawGraph(summaries);
      await GraphData.deleteMany({ repo_id: analysisId });
      await GraphData.create({
        repo_id: analysisId,
        nodes,
        links
      });

      // 6. Finalize analysis
      await Repository.findOneAndUpdate({ repo_id: analysisId }, { status: 'completed' });
      store.emitProgress(analysisId, { status: 'completed', progress: 'Done' });

    } catch (error) {
      console.error(`[Background Analysis Failed] ${analysisId}:`, error);
      await Repository.findOneAndUpdate({ repo_id: analysisId }, { 
         status: 'failed', 
         error_message: error.message 
      });
      store.emitProgress(analysisId, { status: 'failed', error: error.message });
    } finally {
      // 7. Cleanup physical files unconditionally to prevent Out of Storage server crashes
      if (fsSync.existsSync(targetDir)) {
         fsSync.rmSync(targetDir, { recursive: true, force: true });
      }
    }
  })();

  return {
    analysisId,
    status: 'processing',
    message: 'Repository analysis queued and executing in the background.',
  };
};

const getJobStatus = async (jobId) => {
  const repo = await Repository.findOne({ repo_id: jobId });
  if (!repo) {
    throw new AppError('Analysis ID not found.', 404);
  }
  return {
    jobId,
    status: repo.status,
    progress: repo.status === 'processing' ? 'Processing repository...' : 'Done',
    error: repo.error_message
  };
};

const getRepoStructure = async (analysisId) => {
  const repo = await Repository.findOne({ repo_id: analysisId });
  if (!repo || !repo.structure) {
    throw new AppError('Analysis not found, expired, or incompletely processed.', 404);
  }
  await Repository.touch(analysisId);
  return {
    repoUrl: repo.repo_url,
    structure: repo.structure,
  };
};

const getFileSummary = async (analysisId, filePath, type = 'basic') => {
  const repo = await Repository.findOne({ repo_id: analysisId });
  if (!repo) {
    throw new AppError('Analysis not found.', 404);
  }
  await Repository.touch(analysisId);

  if (filePath) {
    let fileNode = await FileNode.findOne({ repo_id: analysisId, file_path: filePath });
    if (!fileNode) {
      throw new AppError(`No summary found for file: ${filePath}`, 404);
    }
    
    let summary = fileNode.summary;
    if (type === 'deep') {
      if (!fileNode.deep_summary) {
        // Generate on demand and cache in db
        summary = getDeepSummary(summary, fileNode.content);
        fileNode.deep_summary = summary;
        await fileNode.save();
      } else {
        summary = fileNode.deep_summary;
      }
    }
    return summary;
  }

  // If no filePath, return all basic summaries (backward comp)
  const allNodes = await FileNode.find({ repo_id: analysisId });
  return allNodes.map(n => n.summary);
};

const searchAnalysis = async (analysisId, query, topK = 10) => {
  const repo = await Repository.findOne({ repo_id: analysisId });
  if (!repo) throw new AppError('Analysis ID not found.', 404);
  await Repository.touch(analysisId);

  // We fetch searchable files and pass to our in-memory semsearch
  // OR use MongoDB text search: 
  const results = await FileNode.find(
    { repo_id: analysisId, $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  )
  .sort({ score: { $meta: 'textScore' } })
  .limit(parseInt(topK));
  
  if (results.length > 0) {
    // Return Mongo Text Search results mapped to expected shape
    return results.map(r => ({
      path: r.file_path,
      name: r.file_path.split('/').pop(),
      summary: r.summary.summary || '',
      used_by: r.used_by,
      score: r._doc.score
    }));
  }

  // Fallback to in-memory search for partial matching if Mongo $text found no broad matches
  const allNodes = await FileNode.find({ repo_id: analysisId }, 'file_path content summary used_by');
  const searchableFiles = allNodes.map(n => ({
    path: n.file_path,
    name: n.file_path.split('/').pop(),
    content: n.content,
    summary: n.summary.summary,
    used_by: n.used_by
  }));
  
  return await search(query, searchableFiles, { topK });
};

const getGraphData = async (analysisId, options = {}) => {
  const repo = await Repository.findOne({ repo_id: analysisId });
  if (!repo) throw new AppError('Analysis not found.', 404);
  await Repository.touch(analysisId);

  const graphData = await GraphData.findOne({ repo_id: analysisId });
  if (!graphData) {
    if (repo.status === 'processing') {
       return { pending: true };
    }
    throw new AppError('Graph data not available yet.', 404);
  }

  const {
    maxNodes = 1200,
    excludeExternal = true,
  } = options;

  let sortedNodes = [...graphData.nodes].sort((a, b) => b.weight - a.weight).slice(0, maxNodes);
  const visibleIds = new Set(sortedNodes.map(n => n.id));
  
  // Filter links
  const knownIds = new Set(graphData.nodes.map(n => n.id));
  const validLinks = [];
  
  for (const link of graphData.links) {
     if (!visibleIds.has(link.source)) continue;
     if (!visibleIds.has(link.target)) continue;
     if (excludeExternal && !knownIds.has(link.target)) continue;
     validLinks.push(link);
  }

  return {
    nodes: sortedNodes,
    links: validLinks,
    meta: {
      totalFiles: graphData.nodes.length,
      visibleNodes: sortedNodes.length,
      totalLinks: validLinks.length,
    },
  };
};

module.exports = {
  analyzeRepo,
  getRepoStructure,
  getFileSummary,
  searchAnalysis,
  getJobStatus,
  getGraphData,
};
