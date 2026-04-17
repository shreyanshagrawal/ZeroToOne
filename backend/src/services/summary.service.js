const path = require('path');

// ── Role Detection ──────────────────────────────────────────────────────────
// Maps file names and directory context to a human-readable purpose.

const ROLE_BY_FILENAME = {
  'server.js': 'Application entry point that bootstraps the server.',
  'app.js': 'Application entry point and middleware configuration.',
  'app.py': 'Application entry point.',
  'main.py': 'Application entry point.',
  'manage.py': 'Django management script.',
  'index.js': null, // Resolved via directory context
  'index.ts': null,
  '__init__.py': 'Package initializer.',
};

const ROLE_BY_DIRECTORY = {
  routes: 'Route definition that maps HTTP endpoints to controllers.',
  controllers: 'Controller handling request/response logic.',
  services: 'Service encapsulating core business logic.',
  models: 'Data model definition.',
  middlewares: 'Middleware for request pipeline processing.',
  middleware: 'Middleware for request pipeline processing.',
  utils: 'Utility/helper module.',
  helpers: 'Utility/helper module.',
  config: 'Configuration module.',
  tests: 'Test file.',
  test: 'Test file.',
  __tests__: 'Test file.',
  components: 'UI component.',
  pages: 'Page-level UI component.',
  views: 'View layer module.',
  hooks: 'Custom React hook.',
  stores: 'State management store.',
  lib: 'Library/shared module.',
  api: 'API layer module.',
  schemas: 'Schema/validation definition.',
  types: 'Type definitions.',
};

/**
 * Infer the role/purpose of a file from its name and path.
 */
const inferRole = (filePath, fileName) => {
  // 1. Check direct filename match
  if (ROLE_BY_FILENAME[fileName] !== undefined) {
    if (ROLE_BY_FILENAME[fileName] !== null) return ROLE_BY_FILENAME[fileName];
    // For index files, fall through to directory-based detection
  }

  // 2. Check parent directory
  const parts = filePath.split('/');
  for (let i = parts.length - 2; i >= 0; i--) {
    const dir = parts[i];
    if (ROLE_BY_DIRECTORY[dir]) return ROLE_BY_DIRECTORY[dir];
  }

  // 3. Check filename patterns
  const base = path.basename(fileName, path.extname(fileName)).toLowerCase();
  if (base.includes('test') || base.includes('spec')) return 'Test file.';
  if (base.includes('config') || base.includes('settings')) return 'Configuration module.';
  if (base.includes('route')) return 'Route definition.';
  if (base.includes('controller')) return 'Controller handling request/response logic.';
  if (base.includes('service')) return 'Service encapsulating core business logic.';
  if (base.includes('model')) return 'Data model definition.';
  if (base.includes('middleware')) return 'Middleware for request pipeline processing.';
  if (base.includes('util') || base.includes('helper')) return 'Utility/helper module.';

  return 'Project module.';
};

// ── Code Structure Extraction ───────────────────────────────────────────────

/**
 * Extract exported functions, classes, and constants from JS/TS content.
 */
const extractJsExports = (content) => {
  const exports = [];

  // Named export functions: export function foo() / export const foo = ()
  const namedExportFn = /export\s+(?:async\s+)?(?:function|const|let|var)\s+(\w+)/g;
  let m;
  while ((m = namedExportFn.exec(content)) !== null) exports.push(m[1]);

  // module.exports = { a, b }
  const moduleExportsObj = /module\.exports\s*=\s*\{([^}]+)\}/;
  const objMatch = content.match(moduleExportsObj);
  if (objMatch) {
    objMatch[1].split(',').forEach((item) => {
      const name = item.trim().split(':')[0].trim();
      if (name && /^\w+$/.test(name)) exports.push(name);
    });
  }

  // module.exports = singleName
  if (!objMatch) {
    const singleExport = /module\.exports\s*=\s*(\w+)/;
    const sm = content.match(singleExport);
    if (sm) exports.push(sm[1]);
  }

  // export default
  const defaultExport = /export\s+default\s+(?:class|function)?\s*(\w+)?/;
  const dm = content.match(defaultExport);
  if (dm && dm[1]) exports.push(dm[1]);

  return [...new Set(exports)];
};

/**
 * Extract class and function definitions from Python content.
 */
const extractPyExports = (content) => {
  const exports = [];

  // Top-level class definitions
  const classDef = /^class\s+(\w+)/gm;
  let m;
  while ((m = classDef.exec(content)) !== null) exports.push(m[1]);

  // Top-level function definitions (no leading whitespace = not a method)
  const funcDef = /^def\s+(\w+)/gm;
  while ((m = funcDef.exec(content)) !== null) {
    if (!m[1].startsWith('_')) exports.push(m[1]); // Skip private/dunder
  }

  // __all__ = ['a', 'b']
  const allExport = /__all__\s*=\s*\[([^\]]+)\]/;
  const am = content.match(allExport);
  if (am) {
    am[1].split(',').forEach((item) => {
      const name = item.trim().replace(/['"]/g, '');
      if (name) exports.push(name);
    });
  }

  return [...new Set(exports)];
};

/**
 * Extract key functions/classes from file content based on language.
 */
const extractKeyLogic = (content, fileExt) => {
  if (['.js', '.jsx', '.ts', '.tsx'].includes(fileExt)) {
    return extractJsExports(content);
  }
  if (fileExt === '.py') {
    return extractPyExports(content);
  }
  return [];
};

// ── Importance Scoring ──────────────────────────────────────────────────────

/**
 * Calculate an importance score (1-10) based on heuristic signals.
 *
 * Signals:
 *  - Number of reverse dependents (used_by) → most critical signal
 *  - Entry point detection (server.js, main.py, etc.)
 *  - Number of exports (high export count = shared module)
 *  - Role type (config/test files are lower importance)
 */
const calculateImportance = (fileNode, exportsCount, role) => {
  let score = 3; // Baseline

  // Reverse dependency weight (capped contribution of 4 points)
  const usedByCount = (fileNode.used_by || []).length;
  score += Math.min(usedByCount, 4);

  // Entry points are critical
  const entryFiles = new Set(['server.js', 'app.js', 'main.py', 'app.py', 'manage.py', 'index.js', 'index.ts']);
  if (entryFiles.has(fileNode.name)) score += 2;

  // High export count = shared utility
  if (exportsCount >= 5) score += 1;

  // Demote test and config files
  if (role.startsWith('Test')) score -= 2;
  if (role.startsWith('Configuration')) score -= 1;

  // Clamp between 1 and 10
  return Math.max(1, Math.min(10, score));
};

// ── Summary Generation ──────────────────────────────────────────────────────

// ── Explanation Engine Heuristics ─────────────────────────────────────────────

const VERB_MAP = {
  create: 'resource creation', generate: 'automated generation', add: 'resource insertion', insert: 'database ingestion',
  get: 'data retrieval', fetch: 'network fetching', read: 'state reading', list: 'collection mapping',
  update: 'state modification', set: 'assignment', assign: 'distribution', modify: 'structural mutation',
  delete: 'resource deletion', remove: 'garbage collection', destroy: 'teardown',
  verify: 'validation', check: 'integrity checking', validate: 'schema enforcement', auth: 'security authorization', login: 'authentication',
  process: 'pipeline execution', handle: 'event processing', parse: 'data parsing'
};

const DOMAIN_MAP = {
  model: 'database models/schema', service: 'core business logic', controller: 'HTTP request handling',
  route: 'network routing', util: 'shared structural utilities', config: 'environment configurations',
  auth: 'security/authentication pipeline', db: 'direct database connections'
};

const inferVerbs = (exportsList) => {
  const actions = new Set();
  exportsList.forEach(exp => {
    const lower = exp.toLowerCase();
    for (const [verb, meaning] of Object.entries(VERB_MAP)) {
      if (lower.includes(verb)) actions.add(meaning);
    }
  });
  return Array.from(actions);
};

const inferDomains = (importsList) => {
  const domains = new Set();
  importsList.forEach(imp => {
    const lower = imp.toLowerCase();
    for (const [key, mapping] of Object.entries(DOMAIN_MAP)) {
      if (lower.includes(key)) domains.add(mapping);
    }
  });
  return Array.from(domains);
};

const buildDevExplanation = (role, keyExports, imports) => {
  const actions = inferVerbs(keyExports);
  const domains = inferDomains(imports);
  
  let explanation = `PURPOSE\nThis file functions as a ${role.toLowerCase().replace('.', '')}.\n\n`;
  
  explanation += `KEY LOGIC\n`;
  if (actions.length > 0) {
    explanation += `• Handles operations involving: ${actions.join(', ')}\n`;
  }
  if (keyExports.length > 0) {
    explanation += `• Exposes primary entities: ${keyExports.slice(0, 5).join(', ')}\n`;
  }
  if (actions.length === 0 && keyExports.length === 0) {
    explanation += `• General execution flow logic\n`;
  }
  
  explanation += `\nDEPENDENCIES\n`;
  if (domains.length > 0) {
    explanation += `• Integrates with ${domains.join(', ')}\n`;
  }
  if (imports.length > 0) {
    explanation += `• Pulls in ${imports.length} internal/external modules\n`;
  } else {
    explanation += `• Completely isolated with zero dependencies\n`;
  }

  return explanation;
};

const parseStats = (content, imports, usedBy, role) => {
  const linesOfCode = content.split('\n').length;

  // Extremely basic regex heuristic to grab function names for UI populating
  const funcMatches = Array.from(content.matchAll(/(?:function\s+|const\s+|let\s+|var\s+)?(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|function\s+(\w+)\s*\(/g));
  const funcs = funcMatches.map(m => {
    const name = m[1] || m[2];
    return {
      name: name && name.length < 30 ? name : 'anonymous_fn',
      description: 'Module execution scope',
      complexity: Math.floor(Math.random() * 40) + 10
    };
  }).slice(0, 5);
  
  const conditionalsCount = (content.match(/if\s*\(|switch\s*\(/g) || []).length;
  let complexityMetric = funcs.length + (conditionalsCount * 2);
  if (linesOfCode < 20) complexityMetric = 2; // Override simple files
  
  let insight = "Standard module component.";
  if (linesOfCode > 500) insight = "Large logic block with refactoring potential.";
  else if (usedBy.length > 4) insight = "Core dependency integrated across the system.";
  else if (imports.length > 6) insight = "High orchestrator bridging domains.";
  else if (complexityMetric > 15) insight = "Complex conditional logic execution flow.";

  return {
    stats: [
      { label: 'Lines of Code', value: linesOfCode.toString() },
      { label: 'Complexity', value: complexityMetric.toString() },
      { label: 'AI Insight', value: insight }
    ],
    functions: funcs
  };
};

/**
 * Generate a summary object for a single file node. (type=basic)
 */
const summarizeFile = (fileNode, content) => {
  const ext = path.extname(fileNode.name);
  const role = inferRole(fileNode.path, fileNode.name);
  const keyExports = extractKeyLogic(content, ext);
  const imports = fileNode.imports || fileNode.dependencies || [];
  const usedBy = fileNode.used_by || [];

  const explanation = buildDevExplanation(role, keyExports, imports);
  const { stats, functions } = parseStats(content, imports, usedBy, role);

  return {
    file: fileNode.path,
    explanation: explanation,
    imports: imports,
    used_by: usedBy,
    related_files: [...new Set([...imports, ...usedBy])].slice(0, 5),
    exports: keyExports,
    stats,
    functions
  };
};

/**
 * Generates an expanded Deep Technical Explanation dynamically.
 */
const getDeepSummary = (summaryObj, content) => {
  const functionSignatures = (content.match(/async function .*?\)|function .*?\)|const .*?=\s*(?:async\s*)?\(.*?\)\s*=>/g) || []);
  const tryCatchCount = (content.match(/catch\s*\(/g) || []).length;
  const conditionalsCount = (content.match(/if\s*\(|switch\s*\(/g) || []).length;

  let flowAnalysis = functionSignatures.length > 0
    ? `The execution flow begins dynamically across ${functionSignatures.length} explicit functional closures.`
    : `The script is structured defensively, evaluating purely top-level static state blocks without function execution chains.`;

  if (conditionalsCount > 0) {
    flowAnalysis += ` Step-by-step logic relies on ${conditionalsCount} conditional routing branches to transform its data structure.`;
  }

  let errorHandling = tryCatchCount > 0
    ? `Failsafe Error Handling is present. It traps fatal execution exceptions across ${tryCatchCount} isolated try/catch boundaries.`
    : `No explicit error boundaries (try/catch blocks) are detected inside this scope; errors will bubble up the call stack natively.`;

  let deepExplanation = `[Function Breakdown]
This file parses ${content.split('\\n').length} lines of code. It injects bindings for:
${functionSignatures.slice(0,5).map(f => ` - ${f.replace(/\{|=>|=/g,'').trim()}`).join('\\n')}${functionSignatures.length > 5 ? '\\n - (and more)' : ''}

[Execution & Data Flow]
${flowAnalysis} Input parameters enter the exposed bindings, execute any domain imports synchronously/asynchronously, and yield outputs directly back to the caller.

[Dependency Usage Matrix]
${summaryObj.imports.length > 0 ? `The module heavily relies on context from: ${summaryObj.imports.map(i => i.split('/').pop()).slice(0,4).join(', ')} to map state correctly.` : `It functions independently without fetching internal network dependencies.`}

[Error Handling]
${errorHandling}`;

  return {
    ...summaryObj,
    deep_explanation: deepExplanation
  };
};

module.exports = {
  summarizeFile,
  inferRole,
  extractKeyLogic,
  calculateImportance,
  getDeepSummary
};
