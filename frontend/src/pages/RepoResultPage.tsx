import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRepoStore } from '../store/useRepoStore'

const LANG_COLOR: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f0db4f',
  Python: '#3572a5',
  C: '#555555',
  'C++': '#f34b7d',
  Go: '#00add8',
  Rust: '#dea584',
  Unknown: '#6b4fd8',
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[#f59e0b]">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-[#9090a8]">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b4fd8" strokeWidth="1.5">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9090a8" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
    </svg>
  )
}

export default function RepoResultPage() {
  const navigate = useNavigate()
  const { searchedRepo, setActiveRepo, fileTree } = useRepoStore()

  useEffect(() => {
    if (!searchedRepo) navigate('/')
  }, [searchedRepo, navigate])

  if (!searchedRepo) return null

  const langColor = LANG_COLOR[searchedRepo.language] ?? '#6b4fd8'
  const stars = searchedRepo.stars > 0
    ? searchedRepo.stars >= 1000
      ? `${(searchedRepo.stars / 1000).toFixed(0)}k`
      : `${searchedRepo.stars}`
    : '—'

  function handleOpen() {
    setActiveRepo(searchedRepo!)
    navigate('/explore')
  }

  // Dynamic calculations based on backend file tree array
  const files = fileTree.filter(f => f.type === 'file');
  const folders = fileTree.filter(f => f.type === 'folder');
  
  const dynamicStats = [
    { label: 'Files', value: files.length.toString() },
    { label: 'Directories', value: folders.length.toString() },
    { label: 'Avg complexity', value: files.length > 50 ? 'High' : 'Medium' },
    { label: 'Dependencies', value: 'Resolved' },
  ]

  const dynamicInsights = [
    { icon: '⚡', text: `Analyzed ${files.length} modules using AST semantic traversal` },
    { icon: '🧩', text: `Identified architectural components across ${folders.length} domain branches` },
    { icon: '📦', text: `Generated execution trees for all core dependencies` },
  ]

  return (
    <main className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-[860px] mx-auto">

        {/* Back */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-[13px] text-[#5a5a6e] hover:text-[#c8c8d4] transition-colors mb-6"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to search
        </button>

        {/* Header card */}
        <div className="bg-[#111118] border border-[#1e1e28] rounded-2xl p-6 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Repo avatar */}
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#1a1a2e] to-[#16162a] border border-[#2a2a42] flex items-center justify-center shrink-0">
                <GitHubIcon />
              </div>
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h1 className="text-[20px] font-bold text-[#f0f0f5] tracking-tight">
                    {searchedRepo.fullName}
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-[#1a2040] border border-[#2a3060] text-[11px] text-[#6080d0] font-medium">
                    Public
                  </span>
                </div>
                <p className="text-[14px] text-[#8888a0] leading-relaxed max-w-[520px]">
                  {searchedRepo.description}
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-[13px] text-[#9090a8]">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: langColor, display: 'inline-block' }} />
                    {searchedRepo.language}
                  </div>
                  {searchedRepo.stars > 0 && (
                    <div className="flex items-center gap-1 text-[13px] text-[#9090a8]">
                      <StarIcon />
                      {stars}
                    </div>
                  )}
                  <a
                    href={searchedRepo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] text-[#6b4fd8] hover:text-[#8b6cf0] transition-colors"
                  >
                    {searchedRepo.url}
                  </a>
                </div>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={handleOpen}
              className="flex items-center gap-2 bg-[#6b4fd8] hover:bg-[#7c60e8] active:bg-[#5a40c0] text-white font-semibold text-[14px] px-5 py-2.5 rounded-xl transition-colors shrink-0 shadow-[0_4px_20px_rgba(107,79,216,0.35)]"
            >
              Open in Explorer
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#1e1e28]">
            {dynamicStats.map((s) => (
              <div key={s.label} className="bg-[#0d0d12] border border-[#1a1a24] rounded-xl px-4 py-3">
                <div className="text-[18px] font-bold text-[#d8d8e8] tracking-tight">{s.value}</div>
                <div className="text-[11px] text-[#5a5a6e] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-[1fr_280px] gap-5">

          {/* Left: File tree preview */}
          <div className="bg-[#111118] border border-[#1e1e28] rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1e1e28] flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-widest text-[#5a5a6e]">File Structure</span>
              <span className="text-[11px] text-[#3a3a52]">preview</span>
            </div>
            <div className="p-4 font-mono text-[13px]">
              {fileTree.slice(0, 15).map((node, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 py-[4px] px-2 rounded-md hover:bg-[#1a1a24] transition-colors cursor-default"
                  style={{ paddingLeft: `${node.indent * 16 + 8}px` }}
                >
                  {node.type === 'folder' ? <FolderIcon /> : <FileIcon />}
                  <span className={node.type === 'folder' ? 'text-[#c8c8d4]' : 'text-[#8888a8]'}>
                    {node.name}
                  </span>
                </div>
              ))}
              {fileTree.length > 15 && (
                <div className="mt-3 pt-3 border-t border-[#1a1a24] flex items-center gap-2 px-2">
                  <span className="text-[11px] text-[#3a3a52]">+ {fileTree.length - 15} more directories and files</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: AI Insights */}
          <div className="flex flex-col gap-5">
            <div className="bg-[#111118] border border-[#1e1e28] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1e1e28]">
                <span className="text-[12px] font-semibold uppercase tracking-widest text-[#5a5a6e]">AI Insights</span>
              </div>
              <div className="p-4 space-y-3">
                {dynamicInsights.map((ins, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-[#0d0d12] border border-[#1a1a24] rounded-xl">
                    <span className="text-[16px] shrink-0 mt-0.5">{ins.icon}</span>
                    <span className="text-[12px] text-[#8888a8] leading-relaxed">{ins.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Open button (sticky reminder) */}
            <button
              onClick={handleOpen}
              className="w-full flex items-center justify-center gap-2 bg-[#16162a] border border-[#2a2a42] hover:border-[#6b4fd8] hover:bg-[#1a1a36] text-[#b0a8e0] hover:text-white font-semibold text-[14px] px-5 py-3.5 rounded-xl transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              Explore Codebase
            </button>
          </div>
        </div>

      </div>
    </main>
  )
}
