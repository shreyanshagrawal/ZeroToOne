import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRepoStore } from '../store/useRepoStore'
import type { AISource } from '../types'

/* ── helpers ─────────────────────────────────────────────── */
function highlightCode(code: string): string {
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/'([^'\\]|\\.)*'/g, m => `<span class="code-str">${m}</span>`)
    .replace(/"([^"\\]|\\.)*"/g, m => `<span class="code-str">${m}</span>`)
    .replace(/(\/\/.*$)/gm, m => `<span class="code-cmt">${m}</span>`)
    .replace(/\b(import|export|from|const|let|var|function|return|if|else|throw|new|type|interface|class|extends|async|await|default|null|undefined|true|false|void)\b/g,
      m => `<span class="code-kw">${m}</span>`)
    .replace(/: ([A-Z][A-Za-z&lt;&gt;\[\]|]+)/g, (_, t) => `: <span class="code-type">${t}</span>`)
    .replace(/\b([a-z][a-zA-Z]+)(\()/g, (_, fn, p) => `<span class="code-fn">${fn}</span>${p}`)
}

const EXT_COLOR: Record<string, string> = {
  ts: '#3178c6', tsx: '#61dafb', js: '#f0db4f', jsx: '#f59e0b',
  py: '#3572a5', json: '#40c080', md: '#808090', css: '#c060b0',
}
const EXT_BG: Record<string, string> = {
  ts: '#0a1628', tsx: '#041820', js: '#1a1200', jsx: '#1a1000',
  py: '#051220', json: '#001a10', md: '#0d0d0d', css: '#1a0020',
}

function renderAnswer(text: string) {
  return text.split('\n').map((line, i) => {
    // Bold **text**
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    return (
      <p key={i} className={line === '' ? 'mb-2' : 'mb-1'}>
        {parts.map((p, j) => {
          if (p.startsWith('**') && p.endsWith('**'))
            return <strong key={j} className="text-[#d8d0f8] font-semibold">{p.slice(2, -2)}</strong>
          if (p.startsWith('`') && p.endsWith('`'))
            return <code key={j} className="bg-[#1a1a2e] border border-[#2a2a42] rounded px-1.5 py-0.5 text-[#a78bfa] font-mono text-[12px]">{p.slice(1, -1)}</code>
          return <span key={j}>{p}</span>
        })}
      </p>
    )
  })
}

/* ── source card ─────────────────────────────────────────── */
function SourceCard({ source, active, onClick }: {
  source: AISource
  active: boolean
  onClick: () => void
}) {
  const color = EXT_COLOR[source.ext] ?? '#6b4fd8'
  const bg    = EXT_BG[source.ext]   ?? '#0d0d18'
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border transition-all duration-150 overflow-hidden"
      style={{
        background: active ? '#141420' : '#0f0f18',
        borderColor: active ? '#4a3a90' : '#1e1e2c',
        boxShadow: active ? '0 0 0 1px #4a3a9040' : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b" style={{ borderColor: active ? '#2a2a3e' : '#161622' }}>
        <span className="text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded border font-mono"
          style={{ color, background: bg, borderColor: color + '40' }}>
          .{source.ext}
        </span>
        <span className="text-[13px] font-medium text-[#c8c8d8] truncate flex-1">{source.file}</span>
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          <span className="text-[11px] font-medium" style={{ color }}>{source.relevance}%</span>
        </div>
      </div>
      {/* Path + lines */}
      <div className="flex items-center justify-between px-3.5 py-1.5">
        <span className="text-[11px] text-[#3a3a54] font-mono truncate">{source.path}</span>
        <span className="text-[10px] text-[#2a2a42] shrink-0 ml-2">L{source.lineStart}–{source.lineEnd}</span>
      </div>
    </button>
  )
}

/* ── typing animation hook ───────────────────────────────── */
function useTyping(text: string, speed = 8) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const idx = useRef(0)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    idx.current = 0
    const interval = setInterval(() => {
      idx.current += speed
      if (idx.current >= text.length) {
        setDisplayed(text)
        setDone(true)
        clearInterval(interval)
      } else {
        setDisplayed(text.slice(0, idx.current))
      }
    }, 16)
    return () => clearInterval(interval)
  }, [text])

  return { displayed, done }
}

/* ── main page ───────────────────────────────────────────── */
export default function AISearchResultPage() {
  const navigate = useNavigate()
  const { aiResult, aiSearchQuery, clearAIResult, selectFile } = useRepoStore()
  const [activeSource, setActiveSource] = useState(0)
  const { displayed, done } = useTyping(aiResult?.answer ?? '', 12)

  useEffect(() => {
    if (!aiResult) navigate('/explore')
  }, [aiResult])

  if (!aiResult) return null

  const src = aiResult.sources[activeSource]

  function handleOpenFile() {
    // map source file to known file ID
    const map: Record<string, string> = {
      'ReactDOM.ts': 'ReactDOM',
      'ReactHooks.ts': 'ReactHooks',
    }
    const id = map[src.file]
    if (id) selectFile(id)
    clearAIResult()
    navigate('/explore')
  }

  return (
    <div className="flex flex-1 overflow-hidden h-full">

      {/* ── Left panel: AI answer ─────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden border-r border-[#161622]">

        {/* Query header */}
        <div className="px-6 py-4 border-b border-[#161622] shrink-0">
          <div className="flex items-center gap-2.5 mb-1">
            {/* Sparkle */}
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,#2a1a4e,#1a1230)', border: '1px solid #3a2a58' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5L12 2Z" fill="url(#sp2)"/>
                <defs><linearGradient id="sp2" x1="3" y1="2" x2="21" y2="20"><stop stopColor="#a78bfa"/><stop offset="1" stopColor="#6b4fd8"/></linearGradient></defs>
              </svg>
            </div>
            <span className="text-[11px] font-semibold tracking-widest uppercase text-[#4a3a78]">AI Answer</span>
            <div className="flex-1" />
            <button
              onClick={() => { clearAIResult(); navigate('/explore') }}
              className="flex items-center gap-1.5 text-[12px] text-[#3a3a54] hover:text-[#9090a8] transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              Back to Explorer
            </button>
          </div>
          <h2 className="text-[16px] font-semibold text-[#d8d8f0] leading-snug mt-2">
            "{aiSearchQuery}"
          </h2>
        </div>

        {/* Answer body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* AI response card */}
          <div className="rounded-2xl border border-[#1e1e2c] mb-5 overflow-hidden"
            style={{ background: '#0d0d15' }}>
            <div className="px-5 py-4 text-[14px] text-[#9090b0] leading-7 min-h-[120px]">
              {renderAnswer(displayed)}
              {!done && (
                <span className="inline-block w-[2px] h-[15px] bg-[#6b4fd8] ml-0.5 align-middle animate-pulse" />
              )}
            </div>

            {/* Action row */}
            {done && (
              <div className="flex items-center gap-2 px-5 py-3 border-t border-[#161622]">
                <button className="flex items-center gap-1.5 text-[12px] text-[#4a3a72] hover:text-[#a78bfa] transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>
                    <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
                  </svg>
                  Helpful
                </button>
                <button className="flex items-center gap-1.5 text-[12px] text-[#4a3a72] hover:text-[#f87171] transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/>
                    <path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/>
                  </svg>
                  Not helpful
                </button>
                <div className="flex-1"/>
                <button className="flex items-center gap-1.5 text-[12px] text-[#4a3a72] hover:text-[#9090b0] transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                  Follow up
                </button>
              </div>
            )}
          </div>

          {/* Sources label */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-[#2e2e48]">
              Sources
            </span>
            <div className="flex-1 h-px bg-[#161622]" />
            <span className="text-[11px] text-[#2a2a42]">{aiResult.sources.length} files</span>
          </div>

          {/* Source cards */}
          <div className="flex flex-col gap-2">
            {aiResult.sources.map((src, i) => (
              <SourceCard
                key={src.path}
                source={src}
                active={i === activeSource}
                onClick={() => setActiveSource(i)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel: code preview ─────────────────────── */}
      <div className="w-[440px] min-w-[440px] flex flex-col overflow-hidden bg-[#080810]">

        {/* Panel header */}
        <div className="px-4 py-3 border-b border-[#161622] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-bold tracking-widest uppercase"
              style={{ color: EXT_COLOR[src.ext] ?? '#6b4fd8' }}>
              .{src.ext}
            </span>
            <span className="text-[13px] font-medium text-[#c0c0d4]">{src.file}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#2a2a42] font-mono">L{src.lineStart}–{src.lineEnd}</span>
            <button
              onClick={handleOpenFile}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-medium text-white transition-colors"
              style={{ background: '#6b4fd8' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#7c60e8')}
              onMouseLeave={e => (e.currentTarget.style.background = '#6b4fd8')}
            >
              Open file
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Relevance bar */}
        <div className="px-4 py-2 border-b border-[#0f0f18] flex items-center gap-3">
          <span className="text-[11px] text-[#2a2a42]">Relevance</span>
          <div className="flex-1 h-1 rounded-full bg-[#141420]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${src.relevance}%`,
                background: src.relevance > 90 ? '#6b4fd8' : src.relevance > 75 ? '#8b6cf0' : '#a78bfa'
              }}
            />
          </div>
          <span className="text-[11px] font-semibold text-[#6b4fd8]">{src.relevance}%</span>
        </div>

        {/* Code block */}
        <div className="flex-1 overflow-auto p-4 font-mono text-[12px] leading-6">
          {src.excerpt.split('\n').map((line, i) => (
            <div key={i} className="flex gap-4 group">
              <span className="text-[#252538] select-none min-w-[28px] text-right shrink-0 group-hover:text-[#3a3a52]">
                {src.lineStart + i}
              </span>
              <span
                className="text-[#8888b0] flex-1"
                dangerouslySetInnerHTML={{ __html: highlightCode(line) || '&nbsp;' }}
              />
            </div>
          ))}
        </div>

        {/* Bottom: other sources nav */}
        <div className="border-t border-[#161622] px-4 py-3 shrink-0">
          <div className="text-[10px] font-semibold tracking-widest uppercase text-[#2a2a42] mb-2">
            Jump to source
          </div>
          <div className="flex gap-2 flex-wrap">
            {aiResult.sources.map((s, i) => (
              <button
                key={s.path}
                onClick={() => setActiveSource(i)}
                className="text-[11px] px-2.5 py-1 rounded-lg border transition-all font-mono"
                style={{
                  background: i === activeSource ? '#1a1a2e' : '#0f0f18',
                  borderColor: i === activeSource ? '#4a3a90' : '#1e1e2c',
                  color: i === activeSource ? '#a78bfa' : '#3a3a54',
                }}
              >
                {s.file}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
