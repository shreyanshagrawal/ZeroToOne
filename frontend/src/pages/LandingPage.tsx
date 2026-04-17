import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRepoStore } from '../store/useRepoStore'
import { suggestedRepos } from '../data/mockData'

function GitHubIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { analyzeRepo } = useRepoStore()
  const [url, setUrl] = useState('')

  async function handleAnalyze() {
    const trimmed = url.trim()
    const target = (!trimmed || trimmed === 'https://github.com/')
      ? 'https://github.com/facebook/react'
      : trimmed
    await analyzeRepo(target)
    navigate('/result')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAnalyze()
  }

  return (
    <main className="flex-1 flex items-center justify-center overflow-y-auto px-5 py-10">
      <div className="w-full max-w-[640px] text-center">
        {/* Status badge */}
        <div className="inline-flex items-center gap-2 bg-[#1a1e2a] border border-[#2a3045] rounded-full px-3.5 py-1.5 text-[12px] font-medium text-[#9090b0] mb-7">
          <span className="w-[7px] h-[7px] rounded-full bg-[#4ade80] status-pulse shrink-0" />
          System Operational
        </div>

        {/* CPU Icon */}
        <div className="w-[72px] h-[72px] rounded-[18px] bg-[#16162a] border border-[#2a2a45] flex items-center justify-center mx-auto mb-8">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect x="9" y="9" width="18" height="18" rx="3" stroke="#6b4fd8" strokeWidth="1.5"/>
            <rect x="13" y="13" width="10" height="10" rx="1.5" fill="#6b4fd8" fillOpacity="0.3"/>
            <rect x="15" y="15" width="6" height="6" rx="1" fill="#8b6cf0"/>
            {[13,18,23].map(x => (
              <g key={x}>
                <line x1={x} y1="5" x2={x} y2="9" stroke="#6b4fd8" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1={x} y1="27" x2={x} y2="31" stroke="#6b4fd8" strokeWidth="1.5" strokeLinecap="round"/>
              </g>
            ))}
            {[13,18,23].map(y => (
              <g key={y}>
                <line x1="5" y1={y} x2="9" y2={y} stroke="#6b4fd8" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="27" y1={y} x2="31" y2={y} stroke="#6b4fd8" strokeWidth="1.5" strokeLinecap="round"/>
              </g>
            ))}
          </svg>
        </div>

        {/* Headline */}
        <h1 className="text-[clamp(32px,5vw,52px)] font-bold tracking-[-1.5px] leading-[1.1] text-[#f0f0f5] mb-4">
          Understand any codebase<br/>in seconds
        </h1>
        <p className="text-[16px] text-[#8888a0] leading-relaxed mb-9">
          Paste a GitHub URL to get structured summaries, semantic<br/>
          search, and execution flow tracing.
        </p>

        {/* URL input */}
        <div className="flex bg-[#14141a] border border-[#252530] rounded-xl overflow-hidden mb-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] focus-within:border-[#4a3a90] transition-colors">
          <div className="flex items-center gap-2.5 px-4 flex-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5a5a6e" strokeWidth="2" className="shrink-0">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://github.com/"
              className="flex-1 bg-transparent border-none outline-none text-[14px] text-[#c8c8d4] py-[17px] placeholder-[#4a4a5e] font-mono"
            />
          </div>
          <button
            onClick={handleAnalyze}
            className="bg-[#6b4fd8] hover:bg-[#7c60e8] active:bg-[#5a40c0] text-white font-semibold text-[14px] px-6 flex items-center gap-2 transition-colors shrink-0 rounded-r-[10px] min-h-[54px]"
          >
            Analyze Repository
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        {/* Try these chips */}
        <div className="flex items-center gap-2.5 justify-center flex-wrap">
          <span className="text-[13px] text-[#5a5a6e]">Try these:</span>
          {suggestedRepos.map((r) => (
            <button
              key={r.label}
              onClick={() => setUrl(r.url)}
              className="inline-flex items-center gap-1.5 bg-[#16162a] border border-[#2a2a42] rounded-full px-3 py-1.5 text-[12px] font-medium text-[#8888b0] hover:bg-[#1e1e36] hover:border-[#4a3a80] hover:text-[#b0a8e0] transition-all"
            >
              <GitHubIcon />
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
