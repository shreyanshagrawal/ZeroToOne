const fs = require('fs/promises');
const path = require('path');
const { asyncPool, stripComments } = require('../utils/concurrency');

const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '__pycache__', 'venv', 'env']);
const PARSABLE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue', '.py']);

/**
 * Extracts dependency strings from Javascript/Typescript and Python code.
 * Uses RegEx to maintain high performance without building ASTs.
 */
const extractDependencies = (rawContent, fileExt) => {
  const deps = [];
  const content = stripComments(rawContent, fileExt);
  
  if (['.js', '.jsx', '.ts', '.tsx', '.vue'].includes(fileExt)) {
    const importRegex = /import\s+(?:.*?\s+from\s+)?['"](.*?)['"]/g;
    const requireRegex = /(?:const|let|var)\s+.*?\s*=\s*require\(['"](.*?)['"]\)/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) deps.push(match[1]);
    while ((match = requireRegex.exec(content)) !== null) deps.push(match[1]);
    
  } else if (fileExt === '.py') {
    // Matches multi-module imports like: import os, sys
    const pyImportRegex = /^import\s+([^\n#]+)/gm;
    // Matches from-imports like: from .utils import helper
    const pyFromRegex = /^from\s+([^\s]+)\s+import/gm;
    
    let match;
    while ((match = pyImportRegex.exec(content)) !== null) {
      const modules = match[1].split(',').map(m => m.trim());
      deps.push(...modules);
    }
    while ((match = pyFromRegex.exec(content)) !== null) {
      deps.push(match[1]);
    }
  }

  // Deduplicate results
  return [...new Set(deps)].filter(Boolean);
};

/**
 * Maps extracted import strings to absolute repository paths.
 */
const resolveDependencyPath = (currentFilePath, importStr, allFilesMap) => {
  const dir = path.dirname(currentFilePath);
  const ext = path.extname(currentFilePath);

  let possiblePaths = [];

  if (ext === '.py') {
    // Python relative (from .models import _)
    if (importStr.startsWith('.')) {
      const match = importStr.match(/^(\.+)(.*)$/);
      if (!match) return null;
      const dots = match[1];
      const rest = match[2].replace(/\./g, '/');
      
      // Compute relative directory:
      // '.' means current directory, '..' means parent dir
      let relativeDir = dir;
      for (let i = 1; i < dots.length; i++) {
        relativeDir = path.dirname(relativeDir);
      }
      
      const resolvedBase = path.normalize(path.join(relativeDir, rest));
      possiblePaths.push(`${resolvedBase}.py`);
      possiblePaths.push(path.join(resolvedBase, '__init__.py'));
      if (!rest) {
          // If it was just "from . import x"
          possiblePaths.push(path.join(relativeDir, '__init__.py'));
      }
    } else {
      // Python absolute module (from myapp.models import _)
      const projectPath = importStr.replace(/\./g, '/');
      possiblePaths.push(`${projectPath}.py`);
      possiblePaths.push(path.join(projectPath, '__init__.py'));
    }
  } else {
    // JS/TS modules (ignore node_modules by enforcing prefix)
    if (!importStr.startsWith('.')) return null; 
    
    let resolvedBase = path.normalize(path.join(dir, importStr));
    possiblePaths = [
      resolvedBase,
      `${resolvedBase}.js`, `${resolvedBase}.ts`, `${resolvedBase}.jsx`, `${resolvedBase}.tsx`,
      path.join(resolvedBase, 'index.js'), path.join(resolvedBase, 'index.ts')
    ];
  }

  // Return the first path that physically exists in the repository
  for (const possible of possiblePaths) {
    if (allFilesMap.has(possible)) return possible;
  }
  
  return null;
};

/**
 * Recursively generates a file tree & reverse dependencies.
 * Uses asyncPool to maximize disk I/O concurrency while respecting system limits.
 */
const generateFileTree = async (rootDir) => {
  const fileNodesMap = new Map(); // Flat map of repo files for quick O(1) lookups
  
  // PASS 1: Build structural tree
  const buildTree = async (currentPath, relativePath = '') => {
    const items = await fs.readdir(currentPath, { withFileTypes: true });

    const childrenList = await asyncPool(50, items, async (item) => {
      if (EXCLUDE_DIRS.has(item.name)) return null;

      const itemPath = path.join(currentPath, item.name);
      const itemRelativePath = relativePath ? path.posix.join(relativePath, item.name) : item.name;

      if (item.isDirectory()) {
        const children = await buildTree(itemPath, itemRelativePath);
        return { name: item.name, type: 'directory', path: itemRelativePath, children: children.filter(Boolean) };
      } else {
        const fileNode = { name: item.name, type: 'file', path: itemRelativePath, used_by: [], dependencies: [] };
        fileNodesMap.set(itemRelativePath, fileNode);
        return fileNode;
      }
    });

    return childrenList;
  };

  const tree = (await buildTree(rootDir)).filter(Boolean);

  // PASS 2: Map reverse & forward dependencies mapping asynchronously
  const allNodes = Array.from(fileNodesMap.values());
  await asyncPool(50, allNodes, async (fileNode) => {
    const ext = path.extname(fileNode.name);
    if (!PARSABLE_EXTENSIONS.has(ext)) return;

    try {
      const rawContent = await fs.readFile(path.join(rootDir, fileNode.path), 'utf8');
      const importStrings = extractDependencies(rawContent, ext);
      
      importStrings.forEach((importStr) => {
        const resolvedPath = resolveDependencyPath(fileNode.path, importStr, fileNodesMap);
        if (resolvedPath) {
          // Track forward dependencies (what this file depends on)
          if (!fileNode.dependencies.includes(resolvedPath)) {
             fileNode.dependencies.push(resolvedPath);
          }
          
          // Track reverse dependencies (used_by)
          const targetNode = fileNodesMap.get(resolvedPath);
          if (targetNode && !targetNode.used_by.includes(fileNode.path)) {
            targetNode.used_by.push(fileNode.path);
          }
        }
      });
    } catch (err) {
      console.warn(`[Parse Warning] failed for ${fileNode.path}`);
    }
  });

  return tree;
};

module.exports = { generateFileTree, extractDependencies };
