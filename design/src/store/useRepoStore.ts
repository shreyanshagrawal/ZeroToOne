import { create } from 'zustand';
import type { Repo, FileSummary, AISearchResult } from '../types';
import { mockRepos, mockFileSummaries } from '../data/mockData';

interface RepoState {
  repos: Repo[];
  activeRepo: Repo | null;
  searchedRepo: Repo | null;

  openFolders: Set<string>;
  selectedFileId: string | null;
  selectedFile: FileSummary | null;

  isAnalyzing: boolean;
  analyzeStep: number;
  analyzeSteps: string[];

  searchQuery: string;
  searchOpen: boolean;

  // AI search
  aiResult: AISearchResult | null;
  aiSearchQuery: string;

  setActiveRepo: (repo: Repo) => void;
  setSearchedRepo: (repo: Repo | null) => void;
  analyzeRepo: (url: string) => Promise<void>;
  toggleFolder: (id: string) => void;
  selectFile: (id: string) => void;
  setSearchQuery: (q: string) => void;
  setSearchOpen: (open: boolean) => void;
  setAIResult: (result: AISearchResult, query: string) => void;
  clearAIResult: () => void;
}

export const useRepoStore = create<RepoState>((set, get) => ({
  repos: mockRepos,
  activeRepo: mockRepos[0],
  searchedRepo: null,
  openFolders: new Set(['src', 'src-components']),
  selectedFileId: 'ReactDOM',
  selectedFile: mockFileSummaries['ReactDOM'],
  isAnalyzing: false,
  analyzeStep: 0,
  analyzeSteps: [
    'Cloning repository...',
    'Parsing file tree...',
    'Analyzing code structure...',
    'Generating AI summaries...',
    'Building search index...',
  ],
  searchQuery: '',
  searchOpen: false,
  aiResult: null,
  aiSearchQuery: '',

  setActiveRepo: (repo) => set({ activeRepo: repo }),
  setSearchedRepo: (repo) => set({ searchedRepo: repo }),

  analyzeRepo: async (url: string) => {
    const repoName = url.replace('https://github.com/', '');
    const steps = get().analyzeSteps;
    set({ isAnalyzing: true, analyzeStep: 0 });
    for (let i = 0; i <= steps.length; i++) {
      await new Promise((r) => setTimeout(r, 700));
      set({ analyzeStep: i });
    }
    const existing = get().repos.find((r) => r.fullName === repoName);
    let resolvedRepo: Repo;
    if (!existing) {
      const parts = repoName.split('/');
      resolvedRepo = {
        id: repoName.replace('/', '-'),
        name: parts[1] || repoName,
        owner: parts[0] || 'unknown',
        fullName: repoName,
        description: 'Repository analyzed by CodeMap AI',
        lastOpened: 'just now',
        language: 'Unknown',
        stars: 0,
        url,
      };
      set((s) => ({ repos: [resolvedRepo, ...s.repos], activeRepo: resolvedRepo }));
    } else {
      resolvedRepo = existing;
      set({ activeRepo: existing });
    }
    set({ isAnalyzing: false, analyzeStep: 0, searchedRepo: resolvedRepo });
  },

  toggleFolder: (id: string) => {
    set((state) => {
      const next = new Set(state.openFolders);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { openFolders: next };
    });
  },

  selectFile: (id: string) => {
    const file = mockFileSummaries[id] ?? null;
    set({ selectedFileId: id, selectedFile: file });
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setAIResult: (result, query) => set({ aiResult: result, aiSearchQuery: query }),
  clearAIResult: () => set({ aiResult: null, aiSearchQuery: '' }),
}));
