/**
 * buildGraphData.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts the backend FileSummary[] (which already carries `imports` and
 * `used_by` for every analysed file) into a standard {nodes, links} graph
 * payload ready for any force-directed renderer.
 *
 * Design decisions
 * ───────────────
 * 1. NO hardcoded data.  Every node comes from a real FileSummary.
 * 2. Deduplication is done with a Map keyed on the canonical file path so
 *    a file that appears as both an importer and an import target is only
 *    ever represented once.
 * 3. Links are also de-duped: "a→b" and another "a→b" are collapsed to one
 *    edge (rare but possible if the backend returns overlapping summaries).
 * 4. "Ghost" nodes — files referenced in an `imports` list but that have no
 *    FileSummary of their own (e.g. node_modules) — are optionally excluded
 *    via the `excludeExternal` flag so the graph stays clean.
 * 5. Group is inferred from the *second* path segment (the top-level folder
 *    inside the repo root), giving natural module clustering.
 */

import type { FileSummary, GraphData, GraphNode, GraphLink } from '../types';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Extract the file extension without the leading dot; returns '' if none. */
function getExt(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Infer a "group" label from the file path.
 * e.g.  "src/services/auth.service.js"  →  "services"
 *       "utils/helpers.ts"              →  "utils"
 *       "index.js"                      →  "(root)"
 */
function inferGroup(path: string): string {
  const segments = path.split('/');
  if (segments.length <= 1) return '(root)';
  // Skip a leading 'src' segment if present so clusters are still meaningful
  const base = segments[0] === 'src' ? segments[1] : segments[0];
  return base ?? '(root)';
}

/** Stable link key — order-independent de-dup. */
function linkKey(source: string, target: string): string {
  return `${source}||${target}`;
}

// ── main transformer ─────────────────────────────────────────────────────────

export interface BuildGraphOptions {
  /**
   * When true (default), links referencing a target whose path does NOT
   * exist as a known FileSummary id are dropped.  Set to false if you want
   * "ghost" external nodes to appear.
   */
  excludeExternal?: boolean;

  /**
   * Hard cap on the number of nodes included.  Nodes are sorted by weight
   * (used_by count) descending before slicing, so the most important files
   * are always preserved.  Helps with very large repos.
   * Default: 400.
   */
  maxNodes?: number;
}

/**
 * buildGraphData
 *
 * @param summaries  Array of FileSummary objects returned by the backend.
 *                   Each item must have at minimum: { file, imports, used_by }
 * @param opts       Optional tuning flags (see BuildGraphOptions).
 * @returns          { nodes: GraphNode[], links: GraphLink[] }
 */
export function buildGraphData(
  summaries: FileSummary[],
  opts: BuildGraphOptions = {}
): GraphData {
  const { excludeExternal = true, maxNodes = 400 } = opts;

  // ── Pass 1: build a Set of known file ids for external-link filtering ──
  const knownIds = new Set<string>(summaries.map(s => s.file));

  // ── Pass 2: build node map (Map deduplicates automatically) ──────────────
  const nodeMap = new Map<string, GraphNode>();

  for (const summary of summaries) {
    const { file, used_by } = summary;

    if (!nodeMap.has(file)) {
      nodeMap.set(file, {
        id:     file,
        name:   file.split('/').pop() ?? file,
        group:  inferGroup(file),
        weight: used_by?.length ?? 0,
        ext:    getExt(file),
        tags:   summary.tags ?? [],
      });
    } else {
      // If somehow the same file appears twice, keep the higher weight
      const existing = nodeMap.get(file)!;
      existing.weight = Math.max(existing.weight, used_by?.length ?? 0);
    }
  }

  // ── Pass 3: apply weight cap and slice to maxNodes ────────────────────────
  let nodes = Array.from(nodeMap.values())
    .sort((a, b) => b.weight - a.weight)   // Most depended-on first
    .slice(0, maxNodes);

  // Rebuild the visible-id set after slicing so we don't emit dangling links
  const visibleIds = new Set<string>(nodes.map(n => n.id));

  // ── Pass 4: build de-duplicated link list ─────────────────────────────────
  const linkSet  = new Set<string>();
  const links: GraphLink[] = [];

  for (const summary of summaries) {
    const { file: source, imports } = summary;

    // Source must be a visible node after slicing
    if (!visibleIds.has(source)) continue;

    for (const target of (imports ?? [])) {
      // Skip external packages (node_modules refs start with a plain name)
      if (excludeExternal && !knownIds.has(target)) continue;
      // Skip if target was pruned by maxNodes
      if (!visibleIds.has(target)) continue;
      // Skip self-loops
      if (source === target) continue;

      const key = linkKey(source, target);
      if (!linkSet.has(key)) {
        linkSet.add(key);
        links.push({ source, target });
      }
    }
  }

  return { nodes, links };
}
