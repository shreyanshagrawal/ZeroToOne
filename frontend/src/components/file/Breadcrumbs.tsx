import { useNavigate } from 'react-router-dom'
import { useRepoStore } from '../../store/useRepoStore'

export default function Breadcrumbs() {
  const navigate = useNavigate()
  const { activeRepo, selectedFile } = useRepoStore()

  const crumbs = [
    { label: activeRepo?.fullName ?? 'Repository', onClick: () => navigate('/') },
    { label: 'src', onClick: () => {} },
    ...(selectedFile ? [{ label: selectedFile.name, onClick: undefined }] : []),
  ]

  return (
    <div className="flex items-center gap-1.5 px-6 py-3 border-b border-[#1e1e24] text-[12px] text-[#5a5a6e] shrink-0">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-[#3a3a48]">/</span>}
          {crumb.onClick !== undefined ? (
            <button
              onClick={crumb.onClick}
              className="hover:text-[#c8c8d4] transition-colors"
            >
              {crumb.label}
            </button>
          ) : (
            <span className="text-[#9898b0]">{crumb.label}</span>
          )}
        </span>
      ))}
    </div>
  )
}
