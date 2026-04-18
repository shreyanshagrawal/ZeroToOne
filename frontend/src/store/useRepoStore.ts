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

  isRestoring: boolean;
  currentTab: 'explorer' | 'graph';
  setCurrentTab: (tab: 'explorer' | 'graph') => void;
  restoreSession: () => Promise<void>;

  graphFilters: { group: string; minWeight: number; selectedTags: string[] };
  setGraphFilters: (filters: { group: string; minWeight: number; selectedTags: string[] }) => void;

  setActiveRepo: (repo: Repo) => void;
  setSearchedRepo: (repo: Repo | null) => void;
  analyzeRepo: (url: string) => Promise<void>;
  toggleFolder: (id: string) => void;
  selectFile: (id: string, skipHistorySync?: boolean) => Promise<void>;
  toggleDeepView: () => Promise<void>;
  
  setSearchQuery: (q: string) => void;
  setSearchOpen: (open: boolean) => void;
  setAIResult: (result: AISearchResult, query: string) => void;
  clearAIResult: () => void;
  
  history: string[];
  historyIndex: number;
  goBack: () => void;
  goForward: () => void;
}

const API_BASE = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

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

  isRestoring: false,
  currentTab: 'explorer',
  setCurrentTab: (tab) => set({ currentTab: tab }),

  graphFilters: { group: '', minWeight: 0, selectedTags: [] },
  setGraphFilters: (filters) => set({ graphFilters: filters }),

  restoreSession: async () => {
    try {
      const stored = localStorage.getItem('codemap_state');
      if (!stored) return;
      const parsed = JSON.parse(stored);
      
      set({ 
        isRestoring: true, 
        currentTab: parsed.currentTab || 'explorer',
        repos: parsed.repos || [],
        activeRepo: parsed.activeRepo || null,
        searchedRepo: parsed.activeRepo || null,
        graphFilters: parsed.graphFilters || { group: '', minWeight: 0, selectedTags: [] }
      });

      if (parsed.analysisId) {
        set({ analysisId: parsed.analysisId, isAnalyzing: false });
        
        // Fetch structure to resurrect fileTree
        const structRes = await fetch(`${API_BASE}/repo-structure?analysisId=${parsed.analysisId}`);
        const structJson = await structRes.json();
        if (structJson.status === 'success' && structJson.data) {
           const flatTree = flattenTree(structJson.data.structure);
           set({ fileTree: flatTree });
           
           if (parsed.selectedFileId) {
              await get().selectFile(parsed.selectedFileId, true);
           }
        }
      }
    } catch(err) {
      console.warn("Failed restoring local storage session:", err);
    } finally {
      set({ isRestoring: false });
    }
  },

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

            const filteredRepos = get().repos.filter(r => r.url !== url);

            set({
                isAnalyzing: false,
                fileTree: flatTree,
                repos: [resolvedRepo, ...filteredRepos],
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

  history: [],
  historyIndex: -1,

  selectFile: async (id: string, skipHistorySync = false) => {
    const aid = get().analysisId;
    if (!aid) return;

    if (!skipHistorySync) {
        set((state) => {
            const newHistory = state.history.slice(0, state.historyIndex + 1);
            newHistory.push(id);
            return {
                history: newHistory,
                historyIndex: newHistory.length - 1
            };
        });
    }

    // Auto-expand tree folders
    const { fileTree, openFolders } = get();
    const nextOpen = new Set(openFolders);
    let curr = fileTree.find(f => f.id === id);
    while (curr && curr.parent) {
      nextOpen.add(curr.parent);
      curr = fileTree.find(f => f.id === curr!.parent);
    }

    set({ selectedFileId: id, selectedFile: null, openFolders: nextOpen });
    
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
              exports: [],
              stats: [],
              functions: []
          } as any });
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
  
  goBack: () => {
    const { history, historyIndex, selectFile } = get();
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      set({ historyIndex: idx });
      selectFile(history[idx], true);
    }
  },

  goForward: () => {
    const { history, historyIndex, selectFile } = get();
    if (historyIndex < history.length - 1) {
      const idx = historyIndex + 1;
      set({ historyIndex: idx });
      selectFile(history[idx], true);
    }
  }
}));

useRepoStore.subscribe((state, prevState) => {
   if (
     state.analysisId !== prevState.analysisId ||
     state.selectedFileId !== prevState.selectedFileId ||
     state.currentTab !== prevState.currentTab ||
     state.activeRepo !== prevState.activeRepo ||
     state.repos !== prevState.repos ||
     state.graphFilters !== prevState.graphFilters
   ) {
     const payload = {
       analysisId: state.analysisId,
       selectedFileId: state.selectedFileId,
       currentTab: state.currentTab,
       activeRepo: state.activeRepo,
       repos: state.repos,
       graphFilters: state.graphFilters
     };
     localStorage.setItem('codemap_state', JSON.stringify(payload));
   }
});
