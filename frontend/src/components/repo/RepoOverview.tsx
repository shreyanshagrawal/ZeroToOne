import { useRepoStore } from '../../store/useRepoStore'

function ComplexityBar({ value }: { value: number }) {
  const color = value < 35 ? '#22c55e' : value < 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="h-[3px] rounded-full bg-[#1e1e28] mt-1.5">
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
    </div>
  )
}

export default function RepoOverview() {
  const { selectedFile, fileTree, selectFile } = useRepoStore()

  // Compute "Start Here" files dynamically
  const entryFiles = fileTree.filter(f => 
    f.type === 'file' && 
    (f.name.toLowerCase().includes('index') || 
     f.name.toLowerCase().includes('main') || 
     f.name.toLowerCase().includes('app') || 
     f.name.toLowerCase().includes('server'))
  ).slice(0, 3);
  
  const importantFiles = fileTree
    .filter(f => f.type === 'file' && !entryFiles.includes(f))
    .slice(0, 2);

  const startHereFiles = [...entryFiles, ...importantFiles].slice(0, 5);

  return (
    <aside className="w-[268px] min-w-[268px] border-l border-[#1e1e24] bg-[#0f0f14] overflow-y-auto p-4 shrink-0">
      
      {/* Start Here */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
           <span className="text-[11px] font-bold tracking-widest uppercase text-[#22c55e]">Start Here</span>
        </div>
        <div className="space-y-1.5">
          {startHereFiles.map((f) => (
             <button 
                key={f.id} 
                onClick={() => selectFile(f.id)}
                className="w-full text-left truncate px-3 py-2 rounded-lg bg-[#14141c] hover:bg-[#1e1e28] border border-[#1e1e24] hover:border-[#2a2a35] transition-all text-[12px] text-[#c0c0d8] font-mono shadow-sm"
             >
                {f.name}
             </button>
          ))}
          {startHereFiles.length === 0 && (
             <div className="text-[11px] text-[#5a5a6e]">No clear entry points found.</div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-5">
        <div className="text-[10px] font-semibold tracking-widest uppercase text-[#5a5a6e] mb-2.5">
          File Stats
        </div>
        <div className="space-y-0">
          {(selectedFile?.stats ?? []).map((s) => (
            <div key={s.label} className="flex justify-between items-center py-1.5 border-b border-[#14141c]">
              <span className="text-[12px] text-[#606074]">{s.label}</span>
              <span className="text-[12px] font-medium text-[#c0c0d4]">{s.value}</span>
            </div>
          ))}
          {!selectedFile && (
            <div className="text-[12px] text-[#5a5a6e]">No file selected</div>
          )}
        </div>
      </div>

      {/* Functions */}
      <div>
        <div className="text-[10px] font-semibold tracking-widest uppercase text-[#5a5a6e] mb-2.5">
          Functions
        </div>
        {selectedFile?.functions && selectedFile.functions.length > 0 ? (
          <div className="space-y-1.5">
            {selectedFile.functions.map((fn) => (
              <div key={fn.name} className="p-2.5 rounded-lg bg-[#14141c]">
                <div className="text-[12px] font-medium text-[#8888c8] font-mono">{fn.name}</div>
                <div className="text-[11px] text-[#5a5a6e] mt-0.5">{fn.description}</div>
                <ComplexityBar value={fn.complexity} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-[#5a5a6e]">No functions detected</div>
        )}
      </div>

      {/* Repo info */}
      <div className="mt-5">
        <div className="text-[10px] font-semibold tracking-widest uppercase text-[#5a5a6e] mb-2.5">
          About
        </div>
        <div className="text-[12px] text-[#5a5a6e] leading-relaxed">
          AI-powered analysis. Click any file in the tree to view its structured summary, code preview, and function map.
        </div>
      </div>
    </aside>
  )
}
