import { create } from 'zustand';
import type { Repo, FileSummary, AISearchResult, FileNode, FileExt } from '../types';

interface RepoState {
  repos: Repo[];
  activeRepo: Repo | null;
  searchedRepo: Repo | null;

  analysisId: string | null;
  fileTree: FileNode[];
  isAnalyzing: boolean;
  analyzeStep: number;
  analyzeSteps: string[];

  openFolders: Set<string>;
  selectedFileId: string | null;
  selectedFile: FileSummary | null;

  searchQuery: string;
  searchOpen: boolean;

  aiResult: AISearchResult | null;
  aiSearchQuery: string;

  setActiveRepo: (repo: Repo) => void;
  setSearchedRepo: (repo: Repo | null) => void;
  analyzeRepo: (url: string) => Promise<void>;
  toggleFolder: (id: string) => void;
  selectFile: (id: string) => void;
  toggleDeepView: () => Promise<void>;
  
  setSearchQuery: (q: string) => void;
  setSearchOpen: (open: boolean) => void;
  setAIResult: (result: AISearchResult, query: string) => void;
  clearAIResult: () => void;
}

const API_BASE = 'http://localhost:3000/api';

// Helper to flatten nested backend tree into flat FileNode array
const flattenTree = (nodes: any[], indent = 0, parent?: string): FileNode[] => {
  let flat: FileNode[] = [];
  nodes.forEach(node => {
     const extParts = node.name.split('.');
     const ext = node.type === 'file' && extParts.length > 1 ? extParts.pop() : undefined;
     const id = node.path;
     
     flat.push({
       id,
       name: node.name,
       type: node.type === 'directory' ? 'folder' : 'file',
       ext: ext as FileExt,
       indent,
       parent,
     });
     
     if (node.children) {
       flat = flat.concat(flattenTree(node.children, indent + 1, id));
     }
  });
  return flat;
};

export const useRepoStore = create<RepoState>((set, get) => ({
  repos: [],
  activeRepo: null,
  searchedRepo: null,

  analysisId: null,
  fileTree: [],
  isAnalyzing: false,
  analyzeStep: 0,
  analyzeSteps: ['Initializing...'],

  openFolders: new Set(),
  selectedFileId: null,
  selectedFile: null,

  searchQuery: '',
  searchOpen: false,
  aiResult: null,
  aiSearchQuery: '',

  setActiveRepo: (repo) => set({ activeRepo: repo }),
  setSearchedRepo: (repo) => set({ searchedRepo: repo }),

  analyzeRepo: async (url: string) => {
    set({ isAnalyzing: true, analysisId: null, fileTree: [], selectedFile: null, selectedFileId: null });

    try {
      const res = await fetch(`${API_BASE}/analyze-repo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: url }),
      });
      const json = await res.json();
      
      if (json.status !== 'success') throw new Error(json.message);
      const analysisId = json.data.analysisId;
      set({ analysisId });

      // Subscribe to SSE for live progress
      return new Promise<void>((resolve, reject) => {
        const evtSource = new EventSource(`${API_BASE}/stream-status/${analysisId}`);
        
        evtSource.onmessage = async (e) => {
          const data = JSON.parse(e.data);
          if (data.progress) set({ analyzeSteps: [data.progress] });

          if (data.status === 'completed') {
            evtSource.close();
            
            // Fetch structure
            const structRes = await fetch(`${API_BASE}/repo-structure?analysisId=${analysisId}`);
            const structJson = await structRes.json();
            const flatTree = flattenTree(structJson.data.structure);

            const parts = url.split('/');
            const resolvedRepo: Repo = {
                id: analysisId,
                name: parts.pop() || 'repo',
                owner: parts.pop() || 'unknown',
                fullName: url.replace('https://github.com/', ''),
                description: 'Analyzed repository',
                lastOpened: 'Just now',
                language: 'Mixed',
                stars: 0,
                url,
            };

            set({
                isAnalyzing: false,
                fileTree: flatTree,
                repos: [resolvedRepo, ...get().repos],
                activeRepo: resolvedRepo,
                searchedRepo: resolvedRepo
            });
            resolve();
          } else if (data.status === 'failed') {
            evtSource.close();
            set({ isAnalyzing: false, analyzeSteps: ['Analysis Failed'] });
            reject(data.error);
          }
        };
      });
    } catch (err) {
      set({ isAnalyzing: false, analyzeSteps: ['Failed to initiate'] });
      console.error(err);
    }
  },

  toggleFolder: (id: string) => {
    set((state) => {
      const next = new Set(state.openFolders);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { openFolders: next };
    });
  },

  selectFile: async (id: string) => {
    const aid = get().analysisId;
    if (!aid) return;

    set({ selectedFileId: id, selectedFile: null });
    
    try {
       const res = await fetch(`${API_BASE}/file-summary?analysisId=${aid}&file=${encodeURIComponent(id)}`);
       const json = await res.json();
       
       if (json.status !== 'success' || !json.data) {
          // File was excluded from AST parsing (e.g., .md, .json, .gitignore)
          set({ selectedFile: {
              file: id,
              explanation: "Developer Note: This is an unparsed static file, documentation, or configuration. It is excluded from the AST semantic analysis engine to preserve performance.",
              imports: [],
              used_by: [],
              related_files: [],
              exports: []
          } });
          return;
       }
       
       const fileObj = Array.isArray(json.data) ? json.data.find((f: any) => f.file === id) : json.data;
       set({ selectedFile: fileObj });
    } catch (err) {
       console.error("Failed to load summary", err);
    }
  },

  toggleDeepView: async () => {
    const aid = get().analysisId;
    const currentId = get().selectedFileId;
    const currentFile = get().selectedFile;
    if (!aid || !currentId || !currentFile) return;

    // Toggle logic: if deep_explanation exists, go basic, else go deep
    const isDeep = !!currentFile.deep_explanation;
    const targetType = isDeep ? 'basic' : 'deep';
    
    set({ selectedFile: null }); // pulse

    try {
       const res = await fetch(`${API_BASE}/file-summary?analysisId=${aid}&file=${encodeURIComponent(currentId)}&type=${targetType}`);
       const json = await res.json();
       const fileObj = Array.isArray(json.data) ? json.data.find((f: any) => f.file === currentId) : json.data;
       set({ selectedFile: fileObj });
    } catch (err) {
       console.error("Failed to swap deep view", err);
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  
  setAIResult: async (result, query) => {
      set({ aiResult: result, aiSearchQuery: query });
  },
  
  clearAIResult: () => set({ aiResult: null, aiSearchQuery: '' }),
}));
