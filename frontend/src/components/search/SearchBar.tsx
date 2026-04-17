import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRepoStore } from '../../store/useRepoStore'
import type { SearchResult } from '../../types'

function SparkleIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5L12 2Z" fill="url(#spark_sb)"/>
      <defs>
        <linearGradient id="spark_sb" x1="3" y1="2" x2="21" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa"/><stop offset="1" stopColor="#6b4fd8"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function FileResultIcon() {
  return (
    <div className="w-[30px] h-[30px] rounded-lg bg-[#1a1a2e] border border-[#2a2a42] flex items-center justify-center shrink-0">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b4fd8" strokeWidth="1.8">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
      </svg>
    </div>
  )
}
function FnResultIcon() {
  return (
    <div className="w-[30px] h-[30px] rounded-lg bg-[#1a1a30] border border-[#2a2a48] flex items-center justify-center shrink-0">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
        <polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/>
      </svg>
    </div>
  )
}
function SymbolResultIcon() {
  return (
    <div className="w-[30px] h-[30px] rounded-lg bg-[#0d1a30] border border-[#1a2a48] flex items-center justify-center shrink-0">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3"/>
      </svg>
    </div>
  )
}
function ResultIcon({ type }: { type: SearchResult['type'] }) {
  if (type === 'function') return <FnResultIcon />
  if (type === 'symbol')   return <SymbolResultIcon />
  return <FileResultIcon />
}

const TYPE_LABEL: Record<SearchResult['type'], string> = { file: 'FILE', function: 'FN', symbol: 'SYM' }
const TYPE_BADGE: Record<SearchResult['type'], string> = {
  file:     'bg-[#1a1a2e] text-[#6b4fd8] border-[#2a2a42]',
  function: 'bg-[#1a0a2e] text-[#a78bfa] border-[#2a1a48]',
  symbol:   'bg-[#0a1020] text-[#60a5fa] border-[#1a2a48]',
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-transparent text-[#a78bfa] font-semibold">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function AISearchBar() {
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [liveResults, setLiveResults] = useState<SearchResult[]>([])
  
  const { searchQuery, setSearchQuery, analysisId, selectFile } = useRepoStore()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Debounce semantic search
    const timer = setTimeout(async () => {
       if (!searchQuery.trim() || !analysisId) {
          setLiveResults([]);
          return;
       }
       try {
          const res = await fetch(`http://localhost:3000/api/search`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ analysisId, query: searchQuery, topK: 5 })
          });
          const json = await res.json();
          if (json.status === 'success' && json.data) {
             const exact = (json.data.keyword || []).map((m: any) => ({
                 type: 'file' as const,
                 name: m.file.split('/').pop(),
                 path: m.file
             }));
             const sem = (json.data.semantic || []).map((m: any) => ({
                 type: 'symbol' as const,
                 name: m.file.split('/').pop(),
                 path: m.file
             }));
             
             // Deduplicate by path
             const valid = [...exact, ...sem];
             const uniqueMap = new Map();
             valid.forEach(v => {
                if (!uniqueMap.has(v.path)) uniqueMap.set(v.path, v);
             });
             setLiveResults(Array.from(uniqueMap.values()));
          }
       } catch (err) { console.error('Search failed', err) }
    }, 300);
    return () => clearTimeout(timer)
  }, [searchQuery, analysisId]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false); setActiveIdx(-1)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); inputRef.current?.focus(); setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Action executed on pressing Enter on AI Query
  function submitSearch(query: string) {
    if (!query.trim()) return
    setSearchQuery('')
    setOpen(false)
    navigate('/ai-result')
  }

  function handleSelect(result: SearchResult) {
    selectFile(result.path);
    setSearchQuery('');
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, liveResults.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') {
      if (activeIdx >= 0) handleSelect(liveResults[activeIdx])
      else submitSearch(searchQuery)
    }
    if (e.key === 'Escape') { setOpen(false); setActiveIdx(-1); inputRef.current?.blur() }
  }

  const files = liveResults.filter(r => r.type === 'file')
  const fns   = liveResults.filter(r => r.type === 'function')
  const syms  = liveResults.filter(r => r.type === 'symbol')

  return (
    <div ref={wrapRef} className="relative w-full max-w-[600px]">
      {/* Input bar */}
      <div
        className="flex items-center gap-2.5 px-3.5 h-9 rounded-xl transition-all cursor-text"
        style={{
          background: open ? '#13131c' : '#111117',
          border: open ? '1px solid #4a3a90' : '1px solid #222230',
          boxShadow: open ? '0 0 0 3px rgba(107,79,216,0.12)' : 'none',
        }}
        onClick={() => { inputRef.current?.focus(); setOpen(true) }}
      >
        <span className="shrink-0"><SparkleIcon /></span>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setOpen(true); setActiveIdx(-1) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI or search files, functions, symbols…"
          className="flex-1 bg-transparent border-none outline-none text-[13px] text-[#d0d0e0] placeholder-[#3a3a52] font-sans min-w-0"
        />
        <div className="flex items-center gap-2 shrink-0">
          {searchQuery ? (
            <button onClick={e => { e.stopPropagation(); setSearchQuery(''); setActiveIdx(-1) }}
              className="text-[#5a5a6e] hover:text-[#9090a0] transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          ) : (
            <kbd className="flex items-center px-1.5 py-0.5 bg-[#1a1a28] border border-[#2a2a3a] rounded-md text-[10px] text-[#4a4a62] font-mono leading-none">⌘K</kbd>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 rounded-2xl overflow-hidden animate-fade-in z-50"
          style={{ background: '#0f0f18', border: '1px solid #222232', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>

          {/* AI ask row */}
          <button
            onClick={() => submitSearch(searchQuery || 'How does the reconciler work?')}
            className="w-full flex items-center gap-3 px-4 py-3 border-b border-[#1a1a28] hover:bg-[#141420] transition-colors text-left"
          >
            <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,#2a1a4e,#1a1230)', border: '1px solid #3a2a58' }}>
              <SparkleIcon size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-[#a090d8]">
                {searchQuery ? `Ask AI: "${searchQuery}"` : 'Ask AI about this codebase'}
              </div>
              <div className="text-[11px] text-[#3a3a52] mt-0.5">Get an AI-generated answer with source references</div>
            </div>
            <kbd className="text-[10px] text-[#3a3a52] font-mono bg-[#141420] border border-[#222232] px-1.5 py-0.5 rounded-md shrink-0">↵</kbd>
          </button>

          {liveResults.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-[#3a3a52]">No results for "{searchQuery}"</div>
          )}

          {files.length > 0 && <>
            <SectionLabel label="Files" />
            {files.map(r => (
              <ResultRow key={r.path} result={r} active={liveResults.indexOf(r) === activeIdx}
                onHover={() => setActiveIdx(liveResults.indexOf(r))} onClick={() => handleSelect(r)} query={searchQuery} />
            ))}
          </>}

          {fns.length > 0 && <>
            <SectionLabel label="Functions" />
            {fns.map(r => (
              <ResultRow key={r.path+r.name} result={r} active={liveResults.indexOf(r) === activeIdx}
                onHover={() => setActiveIdx(liveResults.indexOf(r))} onClick={() => handleSelect(r)} query={searchQuery} />
            ))}
          </>}

          {syms.length > 0 && <>
            <SectionLabel label="Symbols" />
            {syms.map(r => (
              <ResultRow key={r.path+r.name} result={r} active={liveResults.indexOf(r) === activeIdx}
                onHover={() => setActiveIdx(liveResults.indexOf(r))} onClick={() => handleSelect(r)} query={searchQuery} />
            ))}
          </>}

          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#161622]">
            <div className="flex items-center gap-3 text-[11px] text-[#2a2a42]">
              <span><kbd className="font-mono bg-[#141420] border border-[#1e1e2e] px-1 py-0.5 rounded text-[10px]">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono bg-[#141420] border border-[#1e1e2e] px-1 py-0.5 rounded text-[10px]">↵</kbd> open</span>
              <span><kbd className="font-mono bg-[#141420] border border-[#1e1e2e] px-1 py-0.5 rounded text-[10px]">esc</kbd> close</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#2a2a42]">
              <SparkleIcon size={11} /><span>AI-powered</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ label }: { label: string }) {
  return <div className="px-4 pt-3 pb-1.5 text-[10px] font-semibold tracking-widest uppercase text-[#2e2e48]">{label}</div>
}

function ResultRow({ result, active, onHover, onClick, query }: {
  result: SearchResult; active: boolean; onHover: () => void; onClick: () => void; query: string
}) {
  return (
    <button onMouseEnter={onHover} onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
      style={{ background: active ? '#18182a' : 'transparent' }}>
      <ResultIcon type={result.type} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[#c0c0d8] truncate">{highlight(result.name, query)}</div>
        <div className="text-[11px] text-[#3a3a54] mt-0.5 truncate font-mono">
          {highlight(result.path, query)}
          {result.lineNumber && <span className="text-[#2a2a42] ml-1.5">:{result.lineNumber}</span>}
        </div>
      </div>
      <span className={`text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded border ${TYPE_BADGE[result.type]} shrink-0`}>
        {TYPE_LABEL[result.type]}
      </span>
    </button>
  )
}
