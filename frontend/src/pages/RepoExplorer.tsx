import { useEffect } from 'react'
import FolderTree from '../components/file/FolderTree'
import Breadcrumbs from '../components/file/Breadcrumbs'
import FileSummaryPanel from '../components/file/FileSummaryPanel'
import RepoOverview from '../components/repo/RepoOverview'
import GraphView from '../components/graph/GraphView'
import { useRepoStore } from '../store/useRepoStore'

export default function RepoExplorer() {
  const currentTab = useRepoStore(s => s.currentTab)
  const setCurrentTab = useRepoStore(s => s.setCurrentTab)

  // ── Keyboard shortcut: G → Graph, E → Explorer ─────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't steal keypresses when user is typing in a field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'g' || e.key === 'G') setCurrentTab('graph')
      if (e.key === 'e' || e.key === 'E') setCurrentTab('explorer')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCurrentTab])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center px-4 border-b border-[#1c1c22] bg-[#0d0d0f] shrink-0">
        <TabButton
          label="Explorer" icon="explorer"
          active={currentTab === 'explorer'}
          shortcut="E"
          onClick={() => setCurrentTab('explorer')}
        />
        <TabButton
          label="Graph" icon="graph"
          active={currentTab === 'graph'}
          shortcut="G"
          onClick={() => setCurrentTab('graph')}
        />

        {/* Right-side context label */}
        <div className="ml-auto text-[11px] text-[#3a3a52] pr-1 hidden sm:block">
          Press <kbd className="font-mono bg-[#141420] border border-[#1e1e2e] px-1 py-0.5 rounded text-[10px] mx-0.5">E</kbd>
          / <kbd className="font-mono bg-[#141420] border border-[#1e1e2e] px-1 py-0.5 rounded text-[10px] mx-0.5">G</kbd> to switch
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {/*
        BOTH panels stay MOUNTED at all times.
        CSS display:none hides the inactive one — this keeps:
          - Physics simulation alive across tab switches (no position reset)
          - selectedFileId ↔ graph node sync working even when graph is hidden
          - FolderTree scroll position preserved when returning to Explorer
      */}

      {/* Explorer panel */}
      <div style={{ display: currentTab === 'explorer' ? 'flex' : 'none' }} className="flex-1 overflow-hidden">
        <FolderTree />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Breadcrumbs />
          <FileSummaryPanel />
        </div>
        <RepoOverview />
      </div>

      {/* Graph panel */}
      <div style={{ display: currentTab === 'graph' ? 'flex' : 'none' }} className="flex-1 overflow-hidden">
        <GraphView />
      </div>

    </div>
  )
}

// ── Tab button ────────────────────────────────────────────────────────────────
function TabButton({ label, icon, active, shortcut, onClick }: {
  label: string
  icon: 'explorer' | 'graph'
  active: boolean
  shortcut: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={`${label} (${shortcut})`}
      className={`
        flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium
        border-b-2 transition-all duration-150
        ${active
          ? 'border-[#6b4fd8] text-[#c8c8d4]'
          : 'border-transparent text-[#5a5a6e] hover:text-[#9090a8] hover:border-[#3a3a52]'
        }
      `}
    >
      {icon === 'explorer' ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="5"  cy="12" r="2"/><circle cx="19" cy="5"  r="2"/>
          <circle cx="19" cy="19" r="2"/><line x1="7" y1="11" x2="17" y2="6"/>
          <line x1="7" y1="13" x2="17" y2="18"/>
        </svg>
      )}
      {label}
      <kbd className={`
        font-mono text-[9px] px-1 py-0.5 rounded border transition-all
        ${active
          ? 'bg-[#1a1a30] border-[#3a3a5c] text-[#6b4fd8]'
          : 'bg-[#0f0f14] border-[#1e1e24] text-[#3a3a52]'
        }
      `}>
        {shortcut}
      </kbd>
    </button>
  )
}
