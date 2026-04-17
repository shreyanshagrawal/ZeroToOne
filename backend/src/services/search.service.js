const path = require('path');

// ── Text Processing ─────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
  'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than',
  'too', 'very', 'just', 'because', 'as', 'until', 'while', 'of',
  'at', 'by', 'for', 'with', 'about', 'against', 'between', 'through',
  'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up',
  'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again',
  'further', 'then', 'once', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
  'she', 'her', 'it', 'its', 'they', 'them', 'their', 'what', 'which',
  'who', 'whom', 'when', 'where', 'why', 'how', 'if',
  'const', 'let', 'var', 'function', 'return', 'import', 'export',
  'require', 'module', 'exports', 'default', 'from', 'class', 'new',
  'true', 'false', 'null', 'undefined', 'def', 'self', 'none',
]);

/**
 * Tokenize text into lowercase terms, filtering noise.
 */
const tokenize = (text) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
};

// ── Keyword Search ──────────────────────────────────────────────────────────

/**
 * Score a single file against keyword queries.
 * Returns a score breakdown so users understand WHY it matched.
 */
const scoreKeywordMatch = (query, fileNode, content, summary) => {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return null;

  const fileName = fileNode.name.toLowerCase();
  const filePath = fileNode.path.toLowerCase();
  const contentLower = content.toLowerCase();
  const summaryLower = (summary || '').toLowerCase();

  let score = 0;
  const reasons = [];

  for (const term of queryTerms) {
    // 1. Exact filename match (highest signal)
    if (fileName.includes(term)) {
      score += 10;
      reasons.push(`Filename contains "${term}"`);
    }

    // 2. File path match
    if (filePath.includes(term) && !fileName.includes(term)) {
      score += 5;
      reasons.push(`Path contains "${term}"`);
    }

    // 3. Content frequency (capped to avoid giant files dominating)
    const contentMatches = (contentLower.match(new RegExp(term, 'g')) || []).length;
    if (contentMatches > 0) {
      const cappedScore = Math.min(contentMatches, 20); // Cap at 20 occurrences
      score += cappedScore;
      reasons.push(`Content has ${contentMatches} occurrence(s) of "${term}"`);
    }

    // 4. Summary match (role-aware boost)
    if (summaryLower.includes(term)) {
      score += 3;
      reasons.push(`Summary mentions "${term}"`);
    }
  }

  // 5. Importance bonus from dependency analysis
  const importance = fileNode.importance || 0;
  score += importance * 0.5;

  // 6. used_by bonus (files depended on by many are more relevant)
  const usedByCount = (fileNode.used_by || []).length;
  if (usedByCount > 0) {
    score += Math.min(usedByCount * 2, 8);
  }

  if (score === 0) return null;

  return {
    file: fileNode.path,
    score: Math.round(score * 100) / 100,
    reasons,
  };
};

// ── TF-IDF Semantic Search ──────────────────────────────────────────────────
// Lightweight vector similarity without external embeddings.
// Builds TF-IDF vectors per document and compares via cosine similarity.

/**
 * Build a corpus-wide term frequency index.
 * Returns { documents: [{ path, tfVector }], idf: Map<term, idfValue> }
 */
const buildTfIdfIndex = (files) => {
  const docCount = files.length;
  const dfMap = new Map(); // term -> number of documents containing it
  const documents = [];

  // Pass 1: compute TF per document & DF across corpus
  for (const file of files) {
    const tokens = tokenize(file.content);
    const tf = new Map();

    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }

    // Normalize TF by document length
    const docLen = tokens.length || 1;
    for (const [term, count] of tf) {
      tf.set(term, count / docLen);
    }

    // Track document frequency
    for (const term of tf.keys()) {
      dfMap.set(term, (dfMap.get(term) || 0) + 1);
    }

    documents.push({ path: file.path, tf });
  }

  // Pass 2: compute IDF
  const idf = new Map();
  for (const [term, df] of dfMap) {
    idf.set(term, Math.log(docCount / df));
  }

  return { documents, idf };
};

/**
 * Compute cosine similarity between a query vector and a document's TF-IDF vector.
 */
const cosineSimilarity = (queryTerms, docTf, idf) => {
  let dotProduct = 0;
  let queryMag = 0;
  let docMag = 0;

  // Build query TF
  const queryTf = new Map();
  for (const term of queryTerms) {
    queryTf.set(term, (queryTf.get(term) || 0) + 1);
  }
  const queryLen = queryTerms.length || 1;

  // All unique terms from both query and document
  const allTerms = new Set([...queryTf.keys(), ...docTf.keys()]);

  for (const term of allTerms) {
    const idfVal = idf.get(term) || 0;
    const qWeight = ((queryTf.get(term) || 0) / queryLen) * idfVal;
    const dWeight = (docTf.get(term) || 0) * idfVal;

    dotProduct += qWeight * dWeight;
    queryMag += qWeight * qWeight;
    docMag += dWeight * dWeight;
  }

  const magnitude = Math.sqrt(queryMag) * Math.sqrt(docMag);
  if (magnitude === 0) return 0;
  return dotProduct / magnitude;
};

/**
 * Perform semantic search across the file corpus using TF-IDF cosine similarity.
 */
const semanticSearch = async (query, files, topK = 10) => {
  const { documents, idf } = buildTfIdfIndex(files);
  const queryTerms = tokenize(query);

  if (queryTerms.length === 0) return [];

  const results = [];
  
  // Chunking evaluation to prevent CPU Event Loop Blocking
  for (let i = 0; i < documents.length; i++) {
     const doc = documents[i];
     results.push({
      file: doc.path,
      similarity: Math.round(cosineSimilarity(queryTerms, doc.tf, idf) * 10000) / 10000,
    });
    
    // Yield to Node runtime every 500 documents
    if (i % 500 === 0) await new Promise(res => setImmediate(res));
  }

  return results
    .filter((r) => r.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
};

// ── Combined Search ─────────────────────────────────────────────────────────

/**
 * Run both keyword + semantic search and merge results.
 *
 * @param {string} query - User search string
 * @param {Array} files  - Array of { path, name, content, summary, used_by, importance }
 * @param {object} opts  - { topK: number }
 * @returns {{ keyword: Array, semantic: Array }}
 */
const search = async (query, files, opts = {}) => {
  const topK = opts.topK || 15;

  // Keyword search
  const keywordResults = [];
  for (let i = 0; i < files.length; i++) {
     const f = files[i];
     const node = { name: path.basename(f.path), path: f.path, used_by: f.used_by || [], importance: f.importance || 0 };
     const res = scoreKeywordMatch(query, node, f.content, f.summary);
     if (res) keywordResults.push(res);
     if (i % 500 === 0) await new Promise(res => setImmediate(res)); // Yield CPU
  }
  
  keywordResults.sort((a, b) => b.score - a.score).splice(topK);

  // Semantic search
  const semanticResults = await semanticSearch(query, files, topK);

  return {
    keyword: keywordResults,
    semantic: semanticResults,
  };
};

module.exports = {
  search,
  semanticSearch,
  scoreKeywordMatch,
  tokenize,
  buildTfIdfIndex,
};
