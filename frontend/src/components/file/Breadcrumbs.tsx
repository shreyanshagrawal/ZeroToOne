import { useNavigate } from 'react-router-dom'
import { useRepoStore } from '../../store/useRepoStore'

export default function Breadcrumbs() {
  const navigate = useNavigate()
  const { activeRepo, selectedFileId, history, historyIndex, goBack, goForward, selectFile } = useRepoStore((state) => ({
    activeRepo: state.activeRepo,
    selectedFileId: state.selectedFileId,
    history: state.history,
    historyIndex: state.historyIndex,
    goBack: state.goBack,
    goForward: state.goForward,
    selectFile: state.selectFile
  }))

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const pathSegments = selectedFileId ? selectedFileId.split('/') : [];
  
  const crumbs = [
    { label: activeRepo?.fullName ?? 'Repository', onClick: () => navigate('/') },
    ...pathSegments.map((segment, i) => {
        const pathSoFar = pathSegments.slice(0, i + 1).join('/');
        return {
            label: segment,
            onClick: i === pathSegments.length - 1 ? undefined : () => selectFile(pathSoFar)
        };
    })
  ]

  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-[#1e1e24] text-[12px] text-[#5a5a6e] shrink-0">
      <div className="flex items-center gap-1">
          <button 
             onClick={goBack}
             disabled={!canGoBack} 
             className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${canGoBack ? 'hover:bg-[#1a1a24] text-[#c8c8d4]' : 'opacity-40 cursor-not-allowed text-[#5a5a6e]'}`}
          >
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button 
             onClick={goForward}
             disabled={!canGoForward} 
             className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${canGoForward ? 'hover:bg-[#1a1a24] text-[#c8c8d4]' : 'opacity-40 cursor-not-allowed text-[#5a5a6e]'}`}
          >
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
      </div>
      
      <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {crumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5 shrink-0">
              {i > 0 && <span className="text-[#3a3a48]">/</span>}
              {crumb.onClick !== undefined ? (
                <button
                  onClick={crumb.onClick}
                  className="hover:text-[#c8c8d4] transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-[#9898b0] font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
      </div>
    </div>
  )
}
