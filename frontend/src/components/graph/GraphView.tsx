/**
 * GraphView.tsx — zero external dependencies
 * ─────────────────────────────────────────────────────────────────────────────
 * Obsidian-style force-directed dependency graph rendered directly on a
 * <canvas> element using the native Web Animations + requestAnimationFrame
 * loop.  No react-force-graph-2d or d3 required.
 *
 * Physics: spring-repulsion force simulation (Verlet integration).
 * Zoom/pan: pointer-event matrix transform on the canvas context.
 *
 * State rules:
 *  - onNodeClick  → selectFile(id)  [existing store action]
 *  - selectedFileId changes → node highlight synced automatically
 *  - No hardcoded data — all nodes/links from GET /api/graph-data
 */

import {
  useEffect, useRef, useState, useCallback, useLayoutEffect, useMemo
} from 'react';
import { useRepoStore } from '../../store/useRepoStore';
import type { GraphData, GraphNode, GraphLink } from '../../types';

// ── colour palette ────────────────────────────────────────────────────────────
const PALETTE = [
  '#a78bfa', // violet
  '#60a5fa', // blue
  '#34d399', // emerald
  '#fbbf24', // amber
  '#f87171', // rose
  '#c084fc', // purple
  '#22d3ee', // cyan
  '#a3e635', // lime
  '#fb923c', // orange
  '#f472b6', // pink
];
const groupColorCache = new Map<string, string>();
function groupColor(g: string) {
  if (!groupColorCache.has(g))
    groupColorCache.set(g, PALETTE[groupColorCache.size % PALETTE.length]);
  return groupColorCache.get(g)!;
}

// ── node radius ───────────────────────────────────────────────────────────────────
// Formula:
//   radius = clamp( BASE + √(used_by) × SCALE, MIN, MAX )
//
//   BASE  =  4   — minimum size, always visible even for isolated nodes
//   SCALE =  2.2 — growth rate per additional dependency
//   MIN   =  4   — hard floor (isolated nodes)
//   MAX   = 18   — hard ceiling (prevents one hub from dominating)
//
// √(used_by) gives perceptually proportional growth: a node used by 4 files
// is 2× the base, used by 16 → 3× base, used by 100 → 6×.
// Hard clamp keeps the layout clean regardless of outliers.
const NODE_BASE  = 4;
const NODE_SCALE = 2.2;
const NODE_MIN   = 4;
const NODE_MAX   = 18;

function nodeRadius(weight: number, _maxWeight?: number): number {
  return Math.min(NODE_MAX, Math.max(NODE_MIN, NODE_BASE + Math.sqrt(weight) * NODE_SCALE));
}

// ── tag inference engine ──────────────────────────────────────────────────────
// Derives human-readable semantic tags from the file path alone.
// Rules are applied in priority order; a file can receive multiple tags.
const TAG_RULES: Array<{ pattern: RegExp; tag: string }> = [
  // Architecture layer (from directory)
  { pattern: /\/controllers?\//i,  tag: 'controller'  },
  { pattern: /\/services?\//i,     tag: 'service'     },
  { pattern: /\/models?\//i,       tag: 'model'       },
  { pattern: /\/routes?\//i,       tag: 'route'       },
  { pattern: /\/middlewares?\//i,  tag: 'middleware'  },
  { pattern: /\/utils?\/|helpers?/i, tag: 'util'      },
  { pattern: /\/configs?\//i,      tag: 'config'      },
  { pattern: /\/hooks?\//i,        tag: 'hook'        },
  { pattern: /\/store\//i,         tag: 'store'       },
  { pattern: /\/types?\//i,        tag: 'types'       },
  { pattern: /\/pages?\//i,        tag: 'page'        },
  { pattern: /\/components?\//i,   tag: 'component'   },
  { pattern: /\/tests?\//i,        tag: 'test'        },
  { pattern: /\/migrations?\//i,   tag: 'migration'   },
  // File name suffixes (e.g. auth.service.js)
  { pattern: /\.service\./i,       tag: 'service'     },
  { pattern: /\.controller\./i,    tag: 'controller'  },
  { pattern: /\.model\./i,         tag: 'model'       },
  { pattern: /\.route\./i,         tag: 'route'       },
  { pattern: /\.middleware\./i,    tag: 'middleware'  },
  { pattern: /\.hook\./i,          tag: 'hook'        },
  { pattern: /\.util\./i,          tag: 'util'        },
  { pattern: /\.spec\.|.test\./i,  tag: 'test'        },
  // Well-known entry files
  { pattern: /\/(index|main|app|server)\.[jt]sx?$/i, tag: 'entry' },
];

const TAG_COLORS: Record<string, string> = {
  controller: '#60a5fa', service: '#a78bfa', model:     '#34d399',
  route:      '#f59e0b', middleware:'#fb923c', util:     '#94a3b8',
  config:     '#e2e8f0', hook:    '#c084fc', store:     '#818cf8',
  types:      '#67e8f9', page:    '#4ade80', component: '#f472b6',
  test:       '#fca5a5', migration:'#fde68a', entry:    '#86efac',
};

function inferTags(filePath: string): string[] {
  const found = new Set<string>();
  for (const rule of TAG_RULES) {
    if (rule.pattern.test(filePath)) found.add(rule.tag);
  }
  // Fallback: use folder name as tag if nothing matched
  if (found.size === 0) {
    const segments = filePath.split('/');
    if (segments.length > 1) found.add(segments[0] === 'src' ? (segments[1] ?? 'misc') : segments[0]);
  }
  return Array.from(found).slice(0, 3); // cap at 3 tags
}

// ── importance label ──────────────────────────────────────────────────────────
// Converts used_by count to a terse human label.
function importanceLabel(weight: number): string {
  if (weight === 0)  return 'Isolated';
  if (weight <= 2)   return 'Low';
  if (weight <= 5)   return 'Medium';
  if (weight <= 10)  return 'High';
  return 'Hub';
}

// ── simulation constants ─────────────────────────────────────────────────────────
const API_BASE       = 'http://localhost:3000/api';
const TICK_PER_FRAME = 3;
const ALPHA_DECAY    = 0.01;
const K_REPEL        = 3000;
const K_ATTRACT      = 0.04;
const K_CENTER       = 0.008;

// ── tooltip data shape ──────────────────────────────────────────────────────────
interface TooltipData {
  name: string;
  path: string;
  tags: string[];
  weight: number;
  group: string;
  x: number;  // canvas-relative px
  y: number;
}

// ── physics node (internal, mutable) ──────────────────────────────────────
interface PhysNode extends GraphNode {
  x: number; y: number;
  vx: number; vy: number;
}

// ── hook: physics simulation ──────────────────────────────────────────────────
// Returns tick(), reheat(), nodesRef, alphaRef, frozenRef
// frozenRef becomes true when alpha falls below STABLE_THRESHOLD.
// After that tick() is a cheap no-op until reheat() is called.
const STABLE_THRESHOLD  = 0.006;
const K_CLUSTER         = 0.012; // intra-cluster: node → group centroid spring
const K_CLUSTER_REPEL   = 18000; // inter-cluster: centroid ↔ centroid repulsion

function useSimulation(graphData: GraphData, width: number, height: number) {
  const nodesRef  = useRef<PhysNode[]>([]);
  const alphaRef  = useRef(1);
  const frozenRef = useRef(false); // true once layout stabilises

  // Re-seed with cluster-aware positions
  // Each unique group gets an evenly-spaced anchor on a circle around the canvas
  // centre; nodes within a group spawn near their group's anchor.
  useEffect(() => {
    const W = width  > 50 ? width  : 1200;
    const H = height > 50 ? height : 800;
    const cx = W / 2, cy = H / 2;

    // Assign a fixed angular slot to each group (sorted for determinism)
    const groups   = Array.from(new Set(graphData.nodes.map(n => n.group))).sort();
    const nGroups  = groups.length || 1;
    // Cluster anchors sit on a ring at 35% of the shorter canvas dimension
    const clusterR = Math.min(W, H) * 0.35;
    const groupAngle: Record<string, number> = {};
    groups.forEach((g, i) => {
      groupAngle[g] = (2 * Math.PI * i) / nGroups - Math.PI / 2; // start at top
    });

    nodesRef.current = graphData.nodes.map(n => {
      const base  = groupAngle[n.group] ?? 0;
      // Scatter within ±30° of group anchor at 40–70% of clusterR
      const angle = base + (Math.random() - 0.5) * (Math.PI / 3);
      const r     = clusterR * (0.4 + Math.random() * 0.3);
      return {
        ...n,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0, vy: 0,
      };
    });
    alphaRef.current  = 1;
    frozenRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData]);

  // One tick of Verlet physics — no-op when frozen
  const tick = useCallback(() => {
    if (frozenRef.current) return;          // layout stable, don't move anything
    const nodes = nodesRef.current;
    if (!nodes.length) return;

    const alpha = alphaRef.current;
    if (alpha < STABLE_THRESHOLD) {
      frozenRef.current = true;             // lock positions
      alphaRef.current  = 0;
      return;
    }

    const cx = width / 2, cy = height / 2;
    const nodeById = new Map<string, PhysNode>();
    nodes.forEach(n => nodeById.set(n.id, n));

    nodes.forEach(n => { n.vx = 0; n.vy = 0; });

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x || 0.1;
        const dy = b.y - a.y || 0.1;
        const dist2 = Math.max(dx * dx + dy * dy, 1);
        const force  = K_REPEL / dist2;
        const d      = Math.sqrt(dist2);
        a.vx -= force * dx / d; a.vy -= force * dy / d;
        b.vx += force * dx / d; b.vy += force * dy / d;
      }
    }

    // Spring attraction along links
    graphData.links.forEach(l => {
      const src = nodeById.get(l.source as string);
      const tgt = nodeById.get(l.target as string);
      if (!src || !tgt) return;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      src.vx += K_ATTRACT * dx; src.vy += K_ATTRACT * dy;
      tgt.vx -= K_ATTRACT * dx; tgt.vy -= K_ATTRACT * dy;
    });

    // ── Cluster forces ──────────────────────────────────────────────────────────
    // Step 1: compute live centroid for each group
    const groupSum  = new Map<string, { sx: number; sy: number; count: number }>();
    nodes.forEach(n => {
      if (!groupSum.has(n.group)) groupSum.set(n.group, { sx: 0, sy: 0, count: 0 });
      const g = groupSum.get(n.group)!;
      g.sx += n.x; g.sy += n.y; g.count++;
    });
    const groupCentroid = new Map<string, { x: number; y: number }>();
    groupSum.forEach((v, k) =>
      groupCentroid.set(k, { x: v.sx / v.count, y: v.sy / v.count })
    );

    // Step 2: intra-cluster — pull each node toward its group centroid
    nodes.forEach(n => {
      const c = groupCentroid.get(n.group);
      if (!c) return;
      n.vx += (c.x - n.x) * K_CLUSTER;
      n.vy += (c.y - n.y) * K_CLUSTER;
    });

    // Step 3: inter-cluster — repel group centroids from each other
    // This spaces clusters apart into distinct regions
    const centroidList = Array.from(groupCentroid.entries());
    for (let i = 0; i < centroidList.length; i++) {
      for (let j = i + 1; j < centroidList.length; j++) {
        const [, ca] = centroidList[i];
        const [, cb] = centroidList[j];
        const dx    = cb.x - ca.x || 0.1;
        const dy    = cb.y - ca.y || 0.1;
        const dist2 = Math.max(dx * dx + dy * dy, 1);
        const force = K_CLUSTER_REPEL / dist2;
        const d     = Math.sqrt(dist2);
        const fx    = force * dx / d;
        const fy    = force * dy / d;
        // Apply the inter-cluster force to every node in the two clusters
        nodes.forEach(n => {
          if (n.group === centroidList[i][0]) { n.vx -= fx; n.vy -= fy; }
          if (n.group === centroidList[j][0]) { n.vx += fx; n.vy += fy; }
        });
      }
    }

    // Weak gravity toward canvas centre (prevents clusters drifting off-screen)
    nodes.forEach(n => {
      n.vx += (cx - n.x) * K_CENTER;
      n.vy += (cy - n.y) * K_CENTER;
    });

    // Integrate
    nodes.forEach(n => {
      n.x += n.vx * alpha;
      n.y += n.vy * alpha;
    });

    alphaRef.current *= (1 - ALPHA_DECAY);
  }, [graphData.links, width, height]);

  // Reheat: restart simulation from current positions (no re-seed)
  const reheat = useCallback(() => {
    frozenRef.current = false;
    alphaRef.current  = 0.4; // partial heat — don't go back to full chaos
  }, []);

  return { nodesRef, alphaRef, frozenRef, tick, reheat };
}

// ── main component ────────────────────────────────────────────────────────────
interface Filters {
  group:        string;
  minWeight:    number;
  selectedTags: string[];   // multi-select — empty = all
}

export default function GraphView() {
  const { analysisId, selectedFileId, selectFile } = useRepoStore(s => ({
    analysisId:     s.analysisId,
    selectedFileId: s.selectedFileId,
    selectFile:     s.selectFile,
  }));

  const [rawData,  setRawData]  = useState<GraphData>({ nodes: [], links: [] });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [hoverId,  setHoverId]  = useState<string | null>(null);
  const [filters,  setFilters]  = useState<Filters>({ group: '', minWeight: 0, selectedTags: [] });
  const [tooltip,  setTooltip]  = useState<TooltipData | null>(null);
  const mousePosRef            = useRef({ x: 0, y: 0 });  // screen-space px

  // ── Hover debounce refs (no state — avoids re-renders on every mouse move) ─
  const hoverActivateTimerRef  = useRef<number | null>(null); // 100ms enter delay
  const hoverClearTimerRef     = useRef<number | null>(null); // 70ms  leave delay
  const lastHitIdRef           = useRef<string | null>(null); // last node under cursor

  // Clean up timers on unmount
  useEffect(() => () => {
    if (hoverActivateTimerRef.current) clearTimeout(hoverActivateTimerRef.current);
    if (hoverClearTimerRef.current)    clearTimeout(hoverClearTimerRef.current);
  }, []);

  // canvas size — never allow 0×0 (happens when panel is display:none)
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 1200, h: 800 });

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      // Skip zero — happens when the panel is hidden via display:none
      if (width < 10 || height < 10) return;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // ── DATA FETCH ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!analysisId) return;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/graph-data?analysisId=${analysisId}&maxNodes=400`)
      .then(r => r.json())
      .then(json => {
        if (json.status === 'success') setRawData(json.data);
        else setError('Graph data unavailable.');
      })
      .catch(() => setError('Network error.'))
      .finally(() => setLoading(false));
  }, [analysisId]);

  // ── FILTER (memoised to prevent re-seeding the simulation on every render) ──
  const filteredNodes = useMemo(() => rawData.nodes.filter(n => {
    if (filters.group && n.group !== filters.group) return false;
    if (n.weight < filters.minWeight) return false;
    if (filters.selectedTags.length > 0) {
      // Node must have at least one of the selected tags
      const nodeTags = n.tags ?? [];
      if (!filters.selectedTags.some(t => nodeTags.includes(t))) return false;
    }
    return true;
  }) as GraphNode[], [rawData.nodes, filters.group, filters.minWeight, filters.selectedTags]);

  const filteredIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  const filteredLinks = useMemo(() => rawData.links.filter(
    l => filteredIds.has(l.source as string) && filteredIds.has(l.target as string)
  ), [rawData.links, filteredIds]);

  // graphData reference is stable between renders unless filters or rawData change
  const graphData = useMemo<GraphData>(
    () => ({ nodes: filteredNodes, links: filteredLinks }),
    [filteredNodes, filteredLinks]
  );

  // ── PHYSICS ──────────────────────────────────────────────────────────────────
  const { nodesRef, alphaRef, frozenRef, tick, reheat } = useSimulation(graphData, dims.w, dims.h);

  // ── Frozen state for toolbar indicator (poll alphaRef) ───────────────────────
  const [isStable, setIsStable] = useState(false);
  useEffect(() => {
    // Poll alphaRef every 500ms to update the toolbar without re-renders during sim
    const id = window.setInterval(() => {
      const stable = frozenRef.current;
      setIsStable(prev => prev !== stable ? stable : prev);
    }, 500);
    return () => clearInterval(id);
  }, [frozenRef]);

  // ── ZOOM / PAN state ────────────────────────────────────────────────────────
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });

  // Track whether the pointer has moved enough to be a drag (not a click).
  // Threshold: 6px of total movement.
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const dragging       = useRef<{ ox: number; oy: number } | null>(null);
  const isDrag            = useRef(false);
  const draggedNodeRef    = useRef<PhysNode | null>(null); // node being dragged manually

  // ── ADJACENCY — precomputed whenever filteredLinks changes ──────────────────
  // neighboursOf[id] = Set of directly connected node ids (both directions)
  const neighboursOf = useRef<Map<string, Set<string>>>(new Map());
  useEffect(() => {
    const adj = new Map<string, Set<string>>();
    filteredLinks.forEach(l => {
      const s = l.source as string;
      const t = l.target as string;
      if (!adj.has(s)) adj.set(s, new Set());
      if (!adj.has(t)) adj.set(t, new Set());
      adj.get(s)!.add(t);
      adj.get(t)!.add(s);
    });
    neighboursOf.current = adj;
  }, [filteredLinks]);

  // ── FOCUS MODE ─────────────────────────────────────────────────────────────────
  // focusRef:      the node id that is the focal point (unchanged — also drives
  //                the "selected" purple glow from the file explorer)
  // focusModeRef:  boolean — controls whether the FADING effect is active.
  //
  // Transitions:
  //   click node A (not in focus)       → focusMode ON,  focusRef = A
  //   click node A (already focused)    → focusMode OFF (toggle)
  //   click node B (while A focused)    → focusMode ON,  focusRef = B
  //   click empty canvas                → focusMode OFF
  //   press Escape                      → focusMode OFF
  //   file selected from explorer       → focusRef = id, focusMode unchanged
  const focusRef     = useRef<string | null>(null);
  const focusModeRef = useRef(false);

  // [isInFocusMode] is a React state so the toolbar can react to changes.
  // We poll focusModeRef every 200ms instead of calling setState inside the
  // RAF loop (which would cause constant re-renders).
  const [isInFocusMode, setIsInFocusMode] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => {
      setIsInFocusMode(prev => (focusModeRef.current !== prev ? focusModeRef.current : prev));
    }, 200);
    return () => clearInterval(id);
  }, []);

  // Sync focusRef with the store selection ONLY when there's an active focus mode.
  // We do NOT auto-enable focus mode from external selection — only graph clicks do that.
  // focusRef is updated directly in the click handler and exitFocusMode().
  // The purple selection ring for selectedFileId is drawn via isSelected in the draw loop
  // regardless of focusModeRef, so the file explorer → graph highlight always works.

  const exitFocusMode = () => {
    focusModeRef.current = false;
    focusRef.current = null;
    setIsInFocusMode(false);
  };

  // ── CANVAS DRAW LOOP ────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    for (let t = 0; t < TICK_PER_FRAME; t++) tick();

    const { x: tx, y: ty, scale } = transformRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);

    const nodes    = nodesRef.current;
    const nodeById = new Map<string, PhysNode>();
    nodes.forEach(n => nodeById.set(n.id, n));

    // Cluster blobs (drawn first, behind everything)
    if (nodes.length > 0) {
      // Compute maxWeight once for the frame — used for normalized radius
      const maxWeight = Math.max(0, ...nodes.map(n => n.weight ?? 0));

      const clusterMap = new Map<string, PhysNode[]>();
      nodes.forEach(n => {
        if (!clusterMap.has(n.group)) clusterMap.set(n.group, []);
        clusterMap.get(n.group)!.push(n);
      });

      clusterMap.forEach((members, group) => {
        if (members.length === 0) return;
        // Centroid
        const cx = members.reduce((s, n) => s + n.x, 0) / members.length;
        const cy = members.reduce((s, n) => s + n.y, 0) / members.length;
        // Bounding radius = max distance from centroid + node padding
        let maxR = 0;
        members.forEach(n => {
          const d = Math.hypot(n.x - cx, n.y - cy);
          const r = nodeRadius(n.weight ?? 0, maxWeight);
          maxR = Math.max(maxR, d + r + 20);
        });
        maxR = Math.max(maxR, 30); // minimum blob size

        const color = groupColor(group);
        // Radial gradient: coloured centre → transparent edge
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
        grad.addColorStop(0,   color + '18'); // ~10% opacity at centre
        grad.addColorStop(0.6, color + '0a'); // ~4% opacity mid
        grad.addColorStop(1,   color + '00'); // fully transparent at edge

        ctx.globalAlpha = 1;
        ctx.fillStyle   = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, maxR, 0, 2 * Math.PI);
        ctx.fill();

        // Cluster label — drawn at centroid, very faint
        const labelSize = Math.max(10, Math.min(14, maxR * 0.08)) / scale;
        ctx.font        = `600 ${labelSize}px Inter, sans-serif`;
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle   = color + '60'; // ~38% opacity
        ctx.shadowBlur  = 0;
        ctx.fillText(group, cx, cy - maxR * 0.72);
      });
    }

    // ── Focus mode: fading uses focusRef only when focusModeRef is active ──────
    // Priority: hover (transient) > persistent focus mode (click-latched)
    const hoverActive = hoverId !== null;
    const focusId: string | null = hoverActive
      ? hoverId
      : (focusModeRef.current ? focusRef.current : null);
    const focusNeighbours: Set<string> = focusId
      ? (neighboursOf.current.get(focusId) ?? new Set())
      : new Set();
    const hasFocus = focusId !== null;

    // ── Draw links (thin + faint — edges are secondary) ──────────────────────
    ctx.shadowBlur = 0;
    filteredLinks.forEach(l => {
      const src = nodeById.get(l.source as string);
      const tgt = nodeById.get(l.target as string);
      if (!src || !tgt) return;

      const isFocusLink = l.source === focusId || l.target === focusId;
      const isNearFocus =
        !hasFocus || isFocusLink ||
        focusNeighbours.has(l.source as string) ||
        focusNeighbours.has(l.target as string);

      ctx.globalAlpha = isNearFocus ? (isFocusLink ? 0.5 : 0.18) : 0.05;
      ctx.strokeStyle = isFocusLink ? '#a78bfa' : '#3a3a58';
      ctx.lineWidth   = isFocusLink ? 1.5 / scale : 0.75 / scale;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.stroke();

      if (isFocusLink) {
        const dx = tgt.x - src.x, dy = tgt.y - src.y;
        const len = Math.hypot(dx, dy) || 1;
        const R   = nodeRadius(tgt.weight ?? 0);
        const ax  = tgt.x - (dx / len) * R;
        const ay  = tgt.y - (dy / len) * R;
        const sz  = 5 / scale, ang = Math.atan2(dy, dx);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle   = '#a78bfa';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - sz * Math.cos(ang - 0.4), ay - sz * Math.sin(ang - 0.4));
        ctx.lineTo(ax - sz * Math.cos(ang + 0.4), ay - sz * Math.sin(ang + 0.4));
        ctx.closePath();
        ctx.fill();
      }
    });

    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;

    // ── Draw nodes (primary visual — on top) ─────────────────────────────────
    nodes.forEach(n => {
      const id          = n.id;
      const weight      = n.weight ?? 0;
      const baseRadius  = nodeRadius(weight);
      const isSelected  = id === selectedFileId;
      const isHovered   = id === hoverId;
      const isNeighbour = focusNeighbours.has(id);   // used for both hover and click-focus
      const isFocused   = id === focusId;

      // Hover expands the drawn radius — hitTest radius is unchanged (baseRadius)
      const radius = isHovered ? baseRadius + 4 : baseRadius;

      // ── Fading logic ──────────────────────────────────────────────────────
      // Two independent triggers for fading:
      //   A. Pure hover: hovering a node → fade everything not connected to it
      //   B. Click-focus: focusModeRef active → same fade, persists after mouse leaves
      const hoverFade = hoverId !== null && !isHovered && !isNeighbour && !isSelected;
      const focusFade = hasFocus && !isFocused && !isNeighbour && !isSelected;
      const faded = hoverFade || focusFade;

      ctx.globalAlpha = faded ? 0.12 : 1;

      // ── Colour ────────────────────────────────────────────────────────────
      const baseColor = groupColor(n.group);
      const color = isSelected              ? '#c4b5fd'    // bright violet
                  : isFocused               ? '#a78bfa'    // violet
                  : isNeighbour && hasFocus ? '#93c5fd'    // blue (focus neighbours)
                  : isNeighbour             ? baseColor    // same color, ring added below
                  : isHovered               ? '#ffffff'    // pure white on hover
                  : baseColor;

      // ── Glow intensity ────────────────────────────────────────────────────
      const glowColor = isHovered ? '#ffffff'
                      : isSelected || isFocused ? '#c4b5fd'
                      : isNeighbour ? baseColor
                      : baseColor;
      const glowSize  = isHovered               ? 26
                      : isSelected || isFocused ? 22
                      : isNeighbour && (hasFocus || hoverId !== null) ? 10
                      : Math.max(4, radius * 0.6);
      ctx.shadowColor = glowColor;
      ctx.shadowBlur  = glowSize / scale;

      // Base circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Hovered node: paint a semi-transparent white overlay to brighten it
      // (instead of flat white — preserves the group-color hue underneath)
      if (isHovered) {
        ctx.shadowBlur = 0;
        const bright = ctx.createRadialGradient(
          n.x - radius * 0.2, n.y - radius * 0.2, 0,
          n.x, n.y, radius
        );
        bright.addColorStop(0,    'rgba(255,255,255,0.9)');
        bright.addColorStop(0.4,  'rgba(255,255,255,0.6)');
        bright.addColorStop(1,    'rgba(255,255,255,0.15)');
        ctx.fillStyle = bright;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
        ctx.fill();
      } else if (!faded) {
        // Subtle depth highlight for all non-faded nodes
        const hl = ctx.createRadialGradient(
          n.x - radius * 0.28, n.y - radius * 0.28, 0,
          n.x, n.y, radius
        );
        hl.addColorStop(0,    'rgba(255,255,255,0.22)');
        hl.addColorStop(0.55, 'rgba(255,255,255,0.05)');
        hl.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.fillStyle = hl;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
        ctx.fill();
      }

      ctx.shadowBlur = 0;

      // Neighbour ring — colored outline when a neighbour is under hover or focus
      if (isNeighbour && (hoverId !== null || hasFocus) && !isHovered && !isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius + 2 / scale, 0, 2 * Math.PI);
        ctx.strokeStyle = baseColor;
        ctx.lineWidth   = 1.5 / scale;
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        ctx.globalAlpha = faded ? 0.12 : 1;
      }

      // Selection ring
      if (isSelected) {
        ctx.strokeStyle = '#e9d5ff';
        ctx.lineWidth   = 2 / scale;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius + 5 / scale, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(196,181,253,0.22)';
        ctx.lineWidth   = 1.5 / scale;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 0;

      // Labels: hover (with size) or selected only
      if (isHovered || isSelected) {
        const fs = Math.max(10, Math.min(14, radius + 2)) / scale;
        ctx.font         = `700 ${fs}px Inter, sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor  = 'rgba(0,0,0,0.95)';
        ctx.shadowBlur   = 6 / scale;
        ctx.fillStyle    = isSelected ? '#e9d5ff' : '#ffffff';
        ctx.globalAlpha  = 1;
        ctx.fillText(n.name, n.x, n.y + radius + 4 / scale);
        ctx.shadowBlur   = 0;
        ctx.globalAlpha  = 1;
      }
    });

    ctx.restore();
    rafRef.current = requestAnimationFrame(draw);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, selectedFileId, hoverId, filteredLinks]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ── POINTER EVENTS ──────────────────────────────────────────────────────────
  const toWorldCoords = (cx: number, cy: number) => {
    const { x, y, scale } = transformRef.current;
    return { wx: (cx - x) / scale, wy: (cy - y) / scale };
  };

  const hitTest = (wx: number, wy: number): PhysNode | null => {
    let closest: PhysNode | null = null;
    let minDist = Infinity;
    const maxW = Math.max(0, ...nodesRef.current.map(n => n.weight ?? 0));
    nodesRef.current.forEach(n => {
      // Hit target = visual radius + 6px generous hit padding
      const radius = nodeRadius(n.weight ?? 0, maxW) + 6;
      const d = Math.hypot(n.x - wx, n.y - wy);
      if (d < radius && d < minDist) { minDist = d; closest = n; }
    });
    return closest;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    isDrag.current  = false;

    const rect = canvasRef.current!.getBoundingClientRect();
    const { wx, wy } = toWorldCoords(e.clientX - rect.left, e.clientY - rect.top);
    const hitNode = hitTest(wx, wy);

    if (hitNode) {
      // Start node drag — don't start canvas pan
      draggedNodeRef.current = hitNode;
    } else {
      // Start canvas pan
      dragging.current = {
        ox: e.clientX - transformRef.current.x,
        oy: e.clientY - transformRef.current.y,
      };
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    // ── Node drag (overrides canvas pan) ─────────────────────────────────────
    if (draggedNodeRef.current) {
      const { wx, wy } = toWorldCoords(mousePosRef.current.x, mousePosRef.current.y);
      draggedNodeRef.current.x = wx;
      draggedNodeRef.current.y = wy;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
      isDrag.current = true;
      setTooltip(null);
      return;
    }

    if (dragging.current) {
      const dx = e.clientX - (pointerDownPos.current?.x ?? e.clientX);
      const dy = e.clientY - (pointerDownPos.current?.y ?? e.clientY);
      if (Math.hypot(dx, dy) > 6) isDrag.current = true;

      transformRef.current = {
        ...transformRef.current,
        x: e.clientX - dragging.current.ox,
        y: e.clientY - dragging.current.oy,
      };
      setTooltip(null); // hide tooltip while panning
      return;
    }

    // ── Debounced hover ──────────────────────────────────────────────────────
    // hoverActivateTimer: 100ms delay before setting hoverId (enter debounce)
    // hoverClearTimer:     70ms delay before clearing hoverId (leave debounce)
    // lastHitId:          tracks the last node id surfaced by hitTest
    //
    // Rules:
    //  1. If mouse is over the SAME node → do nothing (no state update)
    //  2. If mouse moves to a NEW node   → cancel pending clear, schedule activate
    //  3. If mouse leaves a node         → cancel pending activate, schedule clear
    const { wx, wy } = toWorldCoords(mousePosRef.current.x, mousePosRef.current.y);
    const hit = hitTest(wx, wy);
    const hitId = hit?.id ?? null;

    // Cursor style is instant — no debounce needed here
    if (canvasRef.current) {
      (canvasRef.current as HTMLElement).style.cursor = hit ? 'pointer' : 'grab';
    }

    // Same node — nothing changed, skip all state updates
    if (hitId === lastHitIdRef.current) return;
    lastHitIdRef.current = hitId;

    if (hitId !== null) {
      // Entering a node: cancel any pending clear, schedule activate after 100ms
      if (hoverClearTimerRef.current !== null) {
        clearTimeout(hoverClearTimerRef.current);
        hoverClearTimerRef.current = null;
      }
      if (hoverActivateTimerRef.current !== null) {
        clearTimeout(hoverActivateTimerRef.current);
      }
      hoverActivateTimerRef.current = window.setTimeout(() => {
        hoverActivateTimerRef.current = null;
        // Re-read the latest hit in case mouse moved during timer
        setHoverId(lastHitIdRef.current);
        if (lastHitIdRef.current) {
          // Build tooltip from the node stored in nodesRef (always fresh)
          const node = nodesRef.current.find(n => n.id === lastHitIdRef.current);
          if (node) {
            setTooltip({
              name:   node.name,
              path:   node.id,
              tags:   inferTags(node.id),
              weight: node.weight ?? 0,
              group:  node.group,
              x: mousePosRef.current.x,
              y: mousePosRef.current.y,
            });
          }
        }
      }, 100);
    } else {
      // Leaving a node: cancel pending activate, schedule clear after 70ms
      if (hoverActivateTimerRef.current !== null) {
        clearTimeout(hoverActivateTimerRef.current);
        hoverActivateTimerRef.current = null;
      }
      if (hoverClearTimerRef.current !== null) {
        clearTimeout(hoverClearTimerRef.current);
      }
      hoverClearTimerRef.current = window.setTimeout(() => {
        hoverClearTimerRef.current = null;
        setHoverId(null);
        setTooltip(null);
      }, 70);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    // Release dragged node — keep it frozen where the user dropped it
    draggedNodeRef.current = null;

    const wasDrag = isDrag.current;
    dragging.current = null;
    isDrag.current   = false;
    pointerDownPos.current = null;

    // Only fire selectFile on a genuine click (not a drag/pan)
    if (!wasDrag) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const { wx, wy } = toWorldCoords(e.clientX - rect.left, e.clientY - rect.top);
      const hit = hitTest(wx, wy);

      if (hit) {
        if (focusModeRef.current && focusRef.current === hit.id) {
          // Clicking the already-focused node — toggle focus mode OFF
          focusModeRef.current = false;
          focusRef.current = null;
        } else {
          // Click a new node — enter/switch focus mode
          focusModeRef.current = true;
          focusRef.current = hit.id;
          selectFile(hit.id);  // also syncs explorer sidebar
        }
      } else {
        // Click empty canvas — exit focus mode
        focusModeRef.current = false;
        focusRef.current = null;
      }
    }
  };

  // Escape key exits focus mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        focusModeRef.current = false;
        focusRef.current     = null;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect    = canvasRef.current!.getBoundingClientRect();
    const mx      = e.clientX - rect.left;
    const my      = e.clientY - rect.top;
    const factor  = e.deltaY < 0 ? 1.12 : 0.89;
    const { x, y, scale } = transformRef.current;
    const newScale = Math.max(0.15, Math.min(6, scale * factor));
    transformRef.current = {
      scale: newScale,
      x: mx - (mx - x) * (newScale / scale),
      y: my - (my - y) * (newScale / scale),
    };
  };

  // ── auto-pan to selected node ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFileId) return;
    const node = nodesRef.current.find(n => n.id === selectedFileId);
    if (!node) return;
    // Wait for simulation to settle
    setTimeout(() => {
      const { w, h } = { w: dims.w, h: dims.h };
      const scale = 2.5;
      transformRef.current = {
        scale,
        x: w / 2 - node.x * scale,
        y: h / 2 - node.y * scale,
      };
    }, 300);
  }, [selectedFileId, dims.w, dims.h]);

  // ── GROUPS + TAGS for filter controls ─────────────────────────────────────
  const groups = Array.from(new Set(rawData.nodes.map(n => n.group))).sort();
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    rawData.nodes.forEach(n => (n.tags ?? []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [rawData.nodes]);

  const toggleTag = (tag: string) => {
    setFilters(f => ({
      ...f,
      selectedTags: f.selectedTags.includes(tag)
        ? f.selectedTags.filter(t => t !== tag)
        : [...f.selectedTags, tag],
    }));
  };

  // ── RENDER guards ──────────────────────────────────────────────────────────
  if (!analysisId) return (
    <div className="flex-1 flex items-center justify-center text-[#5a5a6e] text-[14px]">
      Analyze a repository to view its dependency graph.
    </div>
  );

  if (loading) return (
    <div className="flex-1 flex items-center justify-center gap-3 text-[#5a5a6e] text-[13px]">
      <svg className="animate-spin w-5 h-5 text-[#6b4fd8]" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10"/>
      </svg>
      Building dependency graph…
    </div>
  );

  if (error) return (
    <div className="flex-1 flex items-center justify-center text-[#ef4444] text-[13px]">{error}</div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0f]">

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="border-b border-[#1e1e24] bg-[#0d0d12] shrink-0">

        {/* Row 1: folder + min-connections + status + reheat */}
        <div className="flex items-center gap-3 px-4 py-2">

          <select
            value={filters.group}
            onChange={e => setFilters(f => ({ ...f, group: e.target.value }))}
            className="bg-[#111118] border border-[#2a2a35] text-[#9090a8] text-[12px] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#6b4fd8]"
          >
            <option value="">All folders</option>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <label className="flex items-center gap-2 text-[12px] text-[#5a5a6e]">
            Min connections
            <input
              type="range" min={0} max={10} step={1}
              value={filters.minWeight}
              onChange={e => setFilters(f => ({ ...f, minWeight: +e.target.value }))}
              className="accent-[#6b4fd8] w-24"
            />
            <span className="font-mono text-[#9090a8] w-4">{filters.minWeight}</span>
          </label>

          <span className="ml-auto flex items-center gap-2 text-[11px] font-mono">
            <span className="text-[#3a3a52]">
              {filteredNodes.length} nodes · {filteredLinks.length} links
            </span>

            {/* Focus mode badge */}
            {isInFocusMode && (
              <span className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-[#a78bfa] bg-[#1e1a30] border border-[#3d2e6e] px-2 py-0.5 rounded-full text-[10px] font-semibold">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#a78bfa]" />
                  Focus
                </span>
                <button
                  onClick={exitFocusMode}
                  title="Exit focus mode (Esc)"
                  className="text-[#5a5a6e] hover:text-[#c8c8d4] hover:bg-[#1e1e2a] px-1.5 py-0.5 rounded text-[10px] transition-colors"
                >
                  ✕ Exit
                </button>
              </span>
            )}

            {isStable ? (
              <span className="flex items-center gap-1 text-[#10b981]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                Stable
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[#6b4fd8]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#6b4fd8] animate-pulse" />
                Simulating
              </span>
            )}
          </span>

          <button
            onClick={() => setFilters({ group: '', minWeight: 0, selectedTags: [] })}
            className="text-[11px] text-[#5a5a6e] hover:text-[#c8c8d4] px-2 py-1 rounded-md hover:bg-[#1a1a24] transition-colors"
          >
            Reset
          </button>

          <button
            onClick={reheat}
            title="Reheat simulation"
            className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md border transition-all ${
              isStable
                ? 'border-[#2a2a3a] text-[#6b4fd8] hover:bg-[#1a1a30] hover:border-[#6b4fd8]'
                : 'border-transparent text-[#3a3a52] cursor-default'
            }`}
            disabled={!isStable}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Reheat
          </button>
        </div>

        {/* Row 2: tag pill multi-select — only shown when tags exist */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-none">
            <span className="text-[10px] text-[#3a3a52] shrink-0 mr-1">Tags:</span>
            {allTags.map(tag => {
              const active = filters.selectedTags.includes(tag);
              const color  = TAG_COLORS[tag] ?? '#6b4fd8';
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all"
                  style={active ? {
                    background: color + '28',
                    color,
                    borderColor: color + '90',
                    boxShadow: `0 0 6px ${color}44`,
                  } : {
                    background: 'transparent',
                    color: '#5a5a6e',
                    borderColor: '#2a2a3a',
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Canvas ────────────────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        <canvas
          ref={canvasRef}
          width={dims.w}
          height={dims.h}
          style={{ display: 'block', cursor: 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => {
            // Use the clear debounce — don't instantly wipe hoverId
            // This prevents flicker when the cursor clips the node edge briefly
            lastHitIdRef.current = null;
            if (hoverActivateTimerRef.current !== null) {
              clearTimeout(hoverActivateTimerRef.current);
              hoverActivateTimerRef.current = null;
            }
            if (hoverClearTimerRef.current !== null) clearTimeout(hoverClearTimerRef.current);
            hoverClearTimerRef.current = window.setTimeout(() => {
              hoverClearTimerRef.current = null;
              setHoverId(null);
              setTooltip(null);
            }, 70);
          }}
          onWheel={onWheel}
        />

        {/* ── Hover Tooltip ───────────────────────────────────────────────── */}
        {tooltip && (
          <NodeTooltip tooltip={tooltip} canvasW={dims.w} canvasH={dims.h} />
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 pointer-events-none">
          {groups.slice(0, 8).map(g => (
            <div key={g} className="flex items-center gap-2">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: groupColor(g), display: 'inline-block', flexShrink: 0 }} />
              <span className="text-[10px] text-[#5a5a6e]">{g}</span>
            </div>
          ))}
        </div>

        {/* Hint */}
        <div className="absolute bottom-4 right-4 text-[10px] text-[#3a3a52] text-right pointer-events-none">
          scroll to zoom · drag to pan · click node to open
        </div>
      </div>
    </div>
  );
}

// ── NodeTooltip component (HTML overlay, not canvas) ────────────────────────────
// Positioned absolutely inside the canvas container. Flips left/up when near
// the right or bottom edges so it never overflows.
function NodeTooltip({ tooltip, canvasW, canvasH }: {
  tooltip: TooltipData;
  canvasW: number;
  canvasH: number;
}) {
  const OFFSET = 16; // px gap from cursor
  const W = 220;     // tooltip width estimate
  const H = 120;     // tooltip height estimate

  const flipX = tooltip.x + W + OFFSET > canvasW;
  const flipY = tooltip.y + H + OFFSET > canvasH;

  const style: React.CSSProperties = {
    position: 'absolute',
    top:    flipY ? tooltip.y - H - OFFSET : tooltip.y + OFFSET,
    left:   flipX ? tooltip.x - W - OFFSET : tooltip.x + OFFSET,
    width:  W,
    pointerEvents: 'none',
    zIndex: 50,
  };

  return (
    <div style={style}
      className="bg-[#111118] border border-[#2a2a3a] rounded-xl shadow-2xl p-3 flex flex-col gap-2"
    >
      {/* File name */}
      <div className="text-[13px] font-semibold text-[#e0e0f0] truncate">{tooltip.name}</div>

      {/* Path */}
      <div className="text-[10px] font-mono text-[#4a4a60] truncate" title={tooltip.path}>
        {tooltip.path}
      </div>

      {/* Tags */}
      {tooltip.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tooltip.tags.map(tag => (
            <span
              key={tag}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{
                background: (TAG_COLORS[tag] ?? '#6b4fd8') + '22',
                color:       TAG_COLORS[tag] ?? '#6b4fd8',
                border:     `1px solid ${TAG_COLORS[tag] ?? '#6b4fd8'}55`,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Importance */}
      <div className="flex items-center justify-between pt-1 border-t border-[#1e1e2c]">
        <span className="text-[10px] text-[#5a5a6e]">Importance</span>
        <span className="text-[11px] font-semibold" style={{
          color: tooltip.weight === 0 ? '#5a5a6e'
               : tooltip.weight <= 2  ? '#94a3b8'
               : tooltip.weight <= 5  ? '#f59e0b'
               : tooltip.weight <= 10 ? '#10b981'
               : '#a78bfa'
        }}>
          {importanceLabel(tooltip.weight)}
          <span className="text-[#3a3a52] font-normal ml-1">({tooltip.weight} deps)</span>
        </span>
      </div>
    </div>
  );
}
