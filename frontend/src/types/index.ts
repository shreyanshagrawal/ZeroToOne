export interface Repo {
  id: string;
  name: string;
  owner: string;
  fullName: string;
  description: string;
  lastOpened: string;
  language: string;
  stars: number;
  url: string;
}

export type FileExt = 'ts' | 'tsx' | 'js' | 'jsx' | 'py' | 'json' | 'md' | 'css' | 'html';

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  ext?: FileExt;
  indent: number;
  parent?: string;
  children?: string[];
}

export interface FileSummary {
  file: string;
  explanation: string;
  deep_explanation?: string;
  imports: string[];
  used_by: string[];
  related_files: string[];
  exports: string[];
  stats: { label: string; value: string }[];
  functions: { name: string; description: string; complexity: number }[];
  // Optional fields returned by backend / used in mock data
  name?: string;
  ext?: string;
  tags?: string[];
  lines?: number;
  size?: string;
  complexity?: string;
  description?: string;
  codeSnippet?: string;
}


export interface SearchResult {
  type: 'file' | 'function' | 'symbol';
  name: string;
  path: string;
  lineNumber?: number;
}

export interface AISource {
  file: string;
  path: string;
  ext: string;
  relevance: number;
  excerpt: string;
  lineStart: number;
  lineEnd: number;
}

export interface AISearchResult {
  query: string;
  answer: string;
  sources: AISource[];
}

export interface GraphNode {
  id: string;          // file path (unique key)
  name: string;        // basename (e.g. "auth.js")
  group: string;       // top-level folder (e.g. "src/services")
  weight: number;      // used_by count — drives node size
  ext?: string;        // extension for color mapping
  tags: string[];      // semantic tags: ["controller", "auth", "backend"]
}

export interface GraphLink {
  source: string;      // importer file path
  target: string;      // imported file path
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
