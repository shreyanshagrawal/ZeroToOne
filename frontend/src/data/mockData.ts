import type { Repo, FileNode, FileSummary, SearchResult, AISearchResult } from '../types';

export const mockRepos: Repo[] = [
  {
    id: 'facebook-react',
    name: 'react',
    owner: 'facebook',
    fullName: 'facebook/react',
    description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
    lastOpened: '2 hours ago',
    language: 'TypeScript',
    stars: 228000,
    url: 'https://github.com/facebook/react',
  },
  {
    id: 'torvalds-linux',
    name: 'linux',
    owner: 'torvalds',
    fullName: 'torvalds/linux',
    description: 'Linux kernel source tree. The core of the Linux operating system.',
    lastOpened: 'yesterday',
    language: 'C',
    stars: 182000,
    url: 'https://github.com/torvalds/linux',
  },
  {
    id: 'pallets-flask',
    name: 'flask',
    owner: 'pallets',
    fullName: 'pallets/flask',
    description: 'The Python micro framework for building web applications.',
    lastOpened: '3 days ago',
    language: 'Python',
    stars: 67000,
    url: 'https://github.com/pallets/flask',
  },
  {
    id: 'mrdoob-threejs',
    name: 'three.js',
    owner: 'mrdoob',
    fullName: 'mrdoob/three.js',
    description: 'JavaScript 3D Library for rendering graphical scenes in the browser.',
    lastOpened: 'last week',
    language: 'JavaScript',
    stars: 101000,
    url: 'https://github.com/mrdoob/three.js',
  },
];

export const mockFileTree: FileNode[] = [
  { id: 'src', name: 'src', type: 'folder', indent: 0 },
  { id: 'src-components', name: 'components', type: 'folder', indent: 1, parent: 'src' },
  { id: 'ReactDOM', name: 'ReactDOM.ts', type: 'file', ext: 'ts', indent: 2, parent: 'src-components' },
  { id: 'ReactHooks', name: 'ReactHooks.ts', type: 'file', ext: 'ts', indent: 2, parent: 'src-components' },
  { id: 'ReactElement', name: 'ReactElement.ts', type: 'file', ext: 'ts', indent: 2, parent: 'src-components' },
  { id: 'ReactFiber', name: 'ReactFiber.ts', type: 'file', ext: 'ts', indent: 2, parent: 'src-components' },
  { id: 'src-utils', name: 'utils', type: 'folder', indent: 1, parent: 'src' },
  { id: 'parseTree', name: 'parseTree.ts', type: 'file', ext: 'ts', indent: 2, parent: 'src-utils' },
  { id: 'reconciler', name: 'reconciler.ts', type: 'file', ext: 'ts', indent: 2, parent: 'src-utils' },
  { id: 'src-store', name: 'store', type: 'folder', indent: 1, parent: 'src' },
  { id: 'useRepoStore', name: 'useRepoStore.ts', type: 'file', ext: 'ts', indent: 2, parent: 'src-store' },
  { id: 'package', name: 'package.json', type: 'file', ext: 'json', indent: 0 },
  { id: 'readme', name: 'README.md', type: 'file', ext: 'md', indent: 0 },
  { id: 'tsconfig', name: 'tsconfig.json', type: 'file', ext: 'json', indent: 0 },
];

export const mockFileSummaries: Record<string, FileSummary> = {
  ReactDOM: {
    file: 'src/components/ReactDOM.ts',
    explanation: 'Entry point for the React DOM renderer. Handles mounting, unmounting, and updating React component trees into the browser DOM.',
    imports: ['./ReactElement', './reconciler/ReactFiber', './ReactDOMRoot'],
    used_by: ['src/index.ts', 'src/main.tsx'],
    related_files: ['src/components/ReactHooks.ts'],
    exports: ['render', 'createRoot', 'hydrate', 'unmountComponentAtNode'],
    name: 'ReactDOM.ts',
    ext: 'ts',
    lines: 842,
    size: '32 KB',
    complexity: 'Medium',
    description: 'Entry point for the React DOM renderer.',
    tags: ['renderer', 'DOM', 'lifecycle', 'hydration'],
    stats: [
      { label: 'Lines of code', value: '842' },
      { label: 'Functions', value: '14' },
      { label: 'Imports', value: '8' },
      { label: 'Complexity', value: 'Medium' },
      { label: 'Last modified', value: '2 days ago' },
    ],
    functions: [
      { name: 'render()', description: 'Mount a React element into the DOM', complexity: 40 },
      { name: 'hydrate()', description: 'Hydrate server-rendered HTML', complexity: 65 },
      { name: 'unmountComponentAtNode()', description: 'Remove a mounted React tree', complexity: 30 },
      { name: 'createRoot()', description: 'Create a root for concurrent mode', complexity: 55 },
      { name: 'findDOMNode()', description: 'Find underlying DOM node', complexity: 25 },
    ],
  },

  ReactHooks: {
    file: 'src/components/ReactHooks.ts',
    explanation: 'Implements all built-in React hooks including useState, useEffect, useContext, useReducer, useMemo, useCallback, and useRef.',
    imports: ['./ReactInternalTypes', './ReactSharedInternals'],
    used_by: ['src/components/ReactDOM.ts'],
    related_files: ['src/components/ReactDOM.ts'],
    exports: ['useState', 'useEffect', 'useContext', 'useReducer'],
    name: 'ReactHooks.ts',
    ext: 'ts',
    lines: 412,
    size: '14 KB',
    complexity: 'Low',
    description: 'Implements all built-in React hooks.',
    tags: ['hooks', 'state', 'effects', 'context'],
    stats: [
      { label: 'Lines of code', value: '412' },
      { label: 'Functions', value: '18' },
      { label: 'Imports', value: '3' },
      { label: 'Complexity', value: 'Low' },
      { label: 'Last modified', value: '5 days ago' },
    ],
    functions: [
      { name: 'useState()', description: 'Returns stateful value + setter', complexity: 30 },
      { name: 'useEffect()', description: 'Runs side effects after render', complexity: 50 },
      { name: 'useContext()', description: 'Subscribes to React context', complexity: 20 },
      { name: 'useReducer()', description: 'Alternative to useState', complexity: 45 },
    ],
  },

  package: {
    file: 'package.json',
    explanation: 'Node.js package manifest. Defines dependencies, scripts, and project metadata for the React repository.',
    imports: [],
    used_by: [],
    related_files: [],
    exports: [],
    name: 'package.json',
    ext: 'json',
    lines: 48,
    size: '1.2 KB',
    complexity: 'Low',
    description: 'Node.js package manifest.',
    tags: ['config', 'npm', 'dependencies'],
    stats: [
      { label: 'Lines', value: '48' },
      { label: 'Dependencies', value: '12' },
      { label: 'Dev dependencies', value: '24' },
      { label: 'Complexity', value: 'Low' },
      { label: 'Last modified', value: '1 week ago' },
    ],
    functions: [],
  },
};

export const mockSearchResults: SearchResult[] = [
  { type: 'file', name: 'ReactDOM.ts', path: 'src/components/ReactDOM.ts' },
  { type: 'file', name: 'useRepoStore.ts', path: 'src/store/useRepoStore.ts' },
  { type: 'file', name: 'ReactHooks.ts', path: 'src/components/ReactHooks.ts' },
  { type: 'function', name: 'parseFileTree()', path: 'src/utils/parseTree.ts', lineNumber: 24 },
  { type: 'function', name: 'createRoot()', path: 'src/components/ReactDOM.ts', lineNumber: 118 },
  { type: 'symbol', name: 'FiberRoot', path: 'src/reconciler/ReactFiber.ts', lineNumber: 56 },
];

export const suggestedRepos = [
  { label: 'vercel/next.js', url: 'https://github.com/vercel/next.js' },
  { label: 'tailwindlabs/tailwindcss', url: 'https://github.com/tailwindlabs/tailwindcss' },
  { label: 'mrdoob/three.js', url: 'https://github.com/mrdoob/three.js' },
];

export const mockAISearchResults: Record<string, AISearchResult> = {
  reconciler: {
    query: 'How does the reconciler work?',
    answer: 'The React reconciler uses a **fiber architecture** to enable incremental rendering. Each fiber node represents a unit of work — React processes fibers in a loop, pausing when the browser needs to handle higher-priority tasks.\n\nThe `createRoot()` function initializes a fiber root. When state changes, React schedules a re-render by marking fibers as dirty and walks the tree via `beginWork()` and `completeWork()` phases.',
    sources: [
      { file: 'ReactFiber.ts', path: 'src/components/ReactFiber.ts', ext: 'ts', relevance: 97, excerpt: 'export function createFiber(tag: WorkTag, pendingProps: mixed, key: null | string, mode: TypeOfMode): Fiber {\n  return new FiberNode(tag, pendingProps, key, mode);\n}', lineStart: 42, lineEnd: 58 },
      { file: 'ReactDOM.ts', path: 'src/components/ReactDOM.ts', ext: 'ts', relevance: 91, excerpt: 'export function createRoot(\n  container: Element | DocumentFragment\n): RootType {\n  return new ReactDOMRoot(createFiberRoot(container, ConcurrentMode));\n}', lineStart: 118, lineEnd: 132 },
      { file: 'reconciler.ts', path: 'src/utils/reconciler.ts', ext: 'ts', relevance: 88, excerpt: 'function beginWork(current: Fiber | null, workInProgress: Fiber, renderLanes: Lanes): Fiber | null {\n  const updateLanes = workInProgress.lanes;\n}', lineStart: 201, lineEnd: 240 },
      { file: 'ReactHooks.ts', path: 'src/components/ReactHooks.ts', ext: 'ts', relevance: 72, excerpt: 'export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {\n  const dispatcher = resolveDispatcher();\n  return dispatcher.useState(initialState);\n}', lineStart: 68, lineEnd: 80 },
    ],
  },
};

export function getAIResult(query: string): AISearchResult {
  const lower = query.toLowerCase();
  const key = Object.keys(mockAISearchResults).find(k => lower.includes(k));
  const base = mockAISearchResults[key ?? 'reconciler'];
  return { ...base, query };
}
