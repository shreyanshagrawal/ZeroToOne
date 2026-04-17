import { useRepoStore } from '../../store/useRepoStore'
import { Cpu, Maximize2, PackageOpen, LayoutTemplate, Activity } from 'lucide-react'
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

export default function FileSummaryPanel() {
  const { selectedFile, toggleDeepView, selectFile } = useRepoStore()

  if (!selectedFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#5a5a6e] text-[14px]">
        Select a file to view its developer explanation
      </div>
    )
  }

  const f: FileSummary = selectedFile
  
  // Extract extension for the badge styling
  const extParts = f.file.split('.')
  const ext = extParts.length > 1 ? extParts.pop() || 'txt' : 'txt'
  const isDeep = !!f.deep_explanation

  const badgeCls = BADGE[ext] ?? 'bg-[#1a1a20] text-[#808090]'

  const handleLinkClick = (path: string) => {
    selectFile(path);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
      {/* Header card */}
      <div className="bg-[#111118] border border-[#1e1e28] rounded-xl p-5 mb-5 relative">
        <div className="flex items-center gap-3 mb-3.5">
          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${badgeCls}`}>
            .{ext}
          </span>
          <span className="text-[15px] font-semibold text-[#d8d8e8]">{f.file.split('/').pop()}</span>
          <span className="text-[12px] text-[#5a5a6e] ml-4 font-mono">{f.file}</span>
          
          <button 
             onClick={toggleDeepView}
             className={`ml-auto px-4 py-1.5 rounded-lg text-[12px] font-semibold border transition-all flex items-center gap-2 ${
               isDeep 
                 ? 'bg-[#6b4fd8] border-[#8165e3] text-white hover:bg-[#5a42b5]' 
                 : 'bg-[#1a1a22] border-[#2a2a35] text-[#9090a8] hover:text-[#d8d8e8] hover:border-[#4a4a5c]'
             }`}>
             <Cpu className="w-3.5 h-3.5" />
             {isDeep ? 'Deep View Active' : 'Enable Deep Technical View'}
          </button>
        </div>
        
        <h3 className="text-[11px] font-bold tracking-widest text-[#5a5a6e] uppercase mb-2 mt-4">Developer Explanation</h3>
        <p className="text-[14px] text-[#b0a8f0] leading-relaxed mb-6 bg-[#161622] p-4 rounded-lg border border-[#2a2a35] shadow-inner font-medium">
          {f.explanation}
        </p>
        
        {/* Connection Matrices */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {/* Imports */}
           <div className="bg-[#0f0f14] p-4 rounded-lg border border-[#1e1e28]">
             <h4 className="text-[10px] uppercase font-bold text-[#40b0d0] mb-3">Imports</h4>
             {f.imports && f.imports.length > 0 ? (
               <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                 {f.imports.map(path => (
                   <div key={path} onClick={() => handleLinkClick(path)} className="text-[11px] font-mono text-[#70a0c0] bg-[#162030] px-2 py-1 rounded truncate cursor-pointer hover:bg-[#1f2d42] transition-colors" title={path}>
                     {path.split('/').pop()}
                   </div>
                 ))}
               </div>
             ) : <p className="text-[10px] text-[#5a5a6e]">No local imports mapped.</p>}
           </div>

           {/* Used By */}
           <div className="bg-[#0f0f14] p-4 rounded-lg border border-[#1e1e28]">
             <h4 className="text-[10px] uppercase font-bold text-[#f59e0b] mb-3">Used By</h4>
             {f.used_by && f.used_by.length > 0 ? (
               <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                 {f.used_by.map(path => (
                   <div key={path} onClick={() => handleLinkClick(path)} className="text-[11px] font-mono text-[#d0a060] bg-[#2a2010] px-2 py-1 rounded truncate cursor-pointer hover:bg-[#3a2c16] transition-colors" title={path}>
                     {path.split('/').pop()}
                   </div>
                 ))}
               </div>
             ) : <p className="text-[10px] text-[#5a5a6e]">No reverse dependencies.</p>}
           </div>
           
           {/* Exports */}
           <div className="bg-[#0f0f14] p-4 rounded-lg border border-[#1e1e28]">
             <h4 className="text-[10px] uppercase font-bold text-[#22c55e] mb-3">Exposed Logistics</h4>
             {f.exports && f.exports.length > 0 ? (
               <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2">
                 {f.exports.map(exp => (
                   <span key={exp} className="text-[11px] font-mono text-[#60c080] bg-[#102a18] px-2 py-1 rounded border border-[#1a3a20]">
                     {exp}
                   </span>
                 ))}
               </div>
             ) : <p className="text-[10px] text-[#5a5a6e]">No public exposed logic.</p>}
           </div>
        </div>
      </div>

      {/* Terminal View */}
      {isDeep && (
        <div className="bg-[#0a0a0e] border border-[#1a1a24] rounded-xl overflow-hidden mt-6 animate-in slide-in-from-top-4">
          <div className="px-4 py-2.5 border-b border-[#1a1a24] flex items-center justify-between bg-[#0e0e14]">
            <span className="text-[11px] text-[#5a5a6e] font-mono tracking-widest uppercase flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#6b4fd8]"/> Deep Technical Diagnostics
            </span>
            <span className="flex items-center gap-1.5">
              {['#ef4444','#f59e0b','#22c55e'].map((c) => (
                <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />
              ))}
            </span>
          </div>
          <div className="p-5 font-mono text-[13px] leading-relaxed text-[#9898b8] whitespace-pre-wrap selection:bg-[#6b4fd8] selection:text-white">
             {f.deep_explanation}
          </div>
        </div>
      )}
    </div>
  )
}
