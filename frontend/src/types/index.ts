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
