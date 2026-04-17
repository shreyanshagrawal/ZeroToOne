import { useRepoStore } from '../../store/useRepoStore'
import type { FileSummary } from '../../types'

const BADGE: Record<string, string> = {
  ts:   'bg-[#1a2040] text-[#6080e0]',
  tsx:  'bg-[#0d1a30] text-[#60a5fa]',
  js:   'bg-[#201800] text-[#d4a020]',
  jsx:  'bg-[#201400] text-[#f59e0b]',
  py:   'bg-[#001820] text-[#40b0d0]',
  json: 'bg-[#002010] text-[#40c080]',
  md:   'bg-[#0d0d0d] text-[#808090]',
  css:  'bg-[#200018] text-[#c060b0]',
}

function ComplexityBar({ value }: { value: number }) {
  const color = value < 35 ? '#22c55e' : value < 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="h-1 rounded-full bg-[#1e1e28] mt-1.5">
      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
    </div>
  )
}

function CodeLine({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

function highlightCode(code: string): string {
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // strings
    .replace(/'([^'\\]|\\.)*'/g, (m) => `<span class="code-str">${m}</span>`)
    .replace(/"([^"\\]|\\.)*"/g, (m) => `<span class="code-str">${m}</span>`)
    // comments
    .replace(/(\/\/.*$)/gm, (m) => `<span class="code-cmt">${m}</span>`)
    // keywords
    .replace(/\b(import|export|from|const|let|var|function|return|if|else|throw|new|type|interface|class|extends|implements|async|await|default|null|undefined|true|false|void)\b/g,
      (m) => `<span class="code-kw">${m}</span>`)
    // type annotations
    .replace(/: ([A-Z][A-Za-z&lt;&gt;\[\]|]+)/g,
      (_, t) => `: <span class="code-type">${t}</span>`)
    // function calls
    .replace(/\b([a-z][a-zA-Z]+)(\()/g,
      (_, fn, p) => `<span class="code-fn">${fn}</span>${p}`)
}

export default function FileSummaryPanel() {
  const { selectedFile } = useRepoStore()

  if (!selectedFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#5a5a6e] text-[14px]">
        Select a file to view its analysis
      </div>
    )
  }

  const f: FileSummary = selectedFile
  const badgeCls = BADGE[f.ext] ?? 'bg-[#1a1a20] text-[#808090]'
  const lines = f.codeSnippet.split('\n')

  return (
    <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
      {/* Summary card */}
      <div className="bg-[#111118] border border-[#1e1e28] rounded-xl p-5 mb-5">
        <div className="flex items-center gap-3 mb-3.5">
          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${badgeCls}`}>
            .{f.ext}
          </span>
          <span className="text-[15px] font-semibold text-[#d8d8e8]">{f.name}</span>
          <span className="text-[12px] text-[#5a5a6e] ml-auto">{f.lines} lines · {f.size}</span>
        </div>
        <p className="text-[14px] text-[#9090a8] leading-relaxed mb-4">{f.description}</p>
        <div className="flex gap-1.5 flex-wrap">
          {f.tags.map((tag) => (
            <span key={tag} className="px-2.5 py-1 bg-[#16162a] border border-[#2a2a42] rounded-full text-[11px] text-[#7070a0]">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Code block */}
      <div className="bg-[#0a0a0e] border border-[#1a1a24] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#1a1a24] flex items-center justify-between">
          <span className="text-[12px] text-[#5a5a6e] font-mono">{f.name}</span>
          <span className="flex items-center gap-1.5">
            {['#ef4444','#f59e0b','#22c55e'].map((c) => (
              <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />
            ))}
          </span>
        </div>
        <div className="p-4 overflow-x-auto font-mono text-[12px] leading-7 text-[#9898b8]">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-4">
              <span className="text-[#3a3a52] select-none min-w-[20px] text-right">{i + 1}</span>
              <span dangerouslySetInnerHTML={{ __html: highlightCode(line) || '&nbsp;' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
