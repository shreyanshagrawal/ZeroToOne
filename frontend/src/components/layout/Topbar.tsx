import { useNavigate, useLocation } from 'react-router-dom'
import AISearchBar from '../search/SearchBar'

export default function Topbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const isLanding = location.pathname === '/'

  return (
    <header className="h-[54px] border-b border-[#1c1c22] flex items-center bg-[#0d0d0f] shrink-0 z-10 px-4 gap-3">


      {/* Center: AI Search — only on non-landing pages */}
      {!isLanding ? (
        <div className="flex-1 flex items-center justify-center">
          <AISearchBar />
        </div>
      ) : (
        <div className="flex-1" />
      )}

    </header>
  )
}
