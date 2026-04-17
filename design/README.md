# CodeMap AI

A developer tool for understanding any GitHub codebase in seconds — built with React, TypeScript, Tailwind CSS, Zustand, and React Router.

## Getting Started

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** — blazing fast dev server
- **Tailwind CSS** — utility-first styling
- **Zustand** — lightweight state management
- **React Router v6** — client-side routing

## Project Structure

```
src/
  components/
    layout/       # SidebarLayout, Topbar
    repo/         # RepoOverview (right panel)
    file/         # FolderTree, FileSummaryPanel, Breadcrumbs
    search/       # SearchBar with dropdown
    ui/           # LoadingOverlay
  pages/
    LandingPage.tsx     # Hero + URL input
    RepoExplorer.tsx    # File tree + content + right panel
  store/
    useRepoStore.ts     # Zustand global state
  data/
    mockData.ts         # Repos, file tree, summaries, search results
  hooks/
    useAnalyze.ts       # Analyze + navigate hook
  types/
    index.ts            # TypeScript interfaces
  utils/
    cn.ts               # className helper
```

## Features

- **Landing page** — GitHub URL input, "Analyze Repository" CTA, suggested repos
- **Animated loading overlay** — step-by-step analysis progress
- **File tree** — collapsible folders, file selection with color-coded extensions
- **File summary panel** — AI-generated description, tags, syntax-highlighted code preview
- **Right panel** — file stats, function list with complexity bars
- **Search** — dropdown with file and function results
- **Sidebar** — recent repos, user profile

## API Integration

All data lives in `src/data/mockData.ts`. To connect a real API, replace the mock data in `useRepoStore.ts` with your fetch calls — the types in `src/types/index.ts` define the expected shapes.
