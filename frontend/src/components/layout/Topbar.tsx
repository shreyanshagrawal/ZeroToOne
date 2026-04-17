import { useNavigate, useLocation } from 'react-router-dom'
import AISearchBar from '../search/SearchBar'

export default function Topbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const isLanding = location.pathname === '/'

  return (
    <header className="h-[54px] border-b border-[#1c1c22] flex items-center bg-[#0d0d0f] shrink-0 z-10 px-4 gap-3">
      {/* Left: repo breadcrumb pill — only on non-landing */}
      {!isLanding && (
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-[#141418] border border-[#222230] rounded-lg px-3 py-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b4fd8" strokeWidth="1.8">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            <span className="text-[12px] text-[#9090a8] font-mono">facebook/react</span>
          </div>
        </div>
      )}

      {/* Center: AI Search — only on non-landing pages */}
      {!isLanding ? (
        <div className="flex-1 flex items-center justify-center">
          <AISearchBar />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Right: nav */}
      <nav className="flex items-center gap-1 shrink-0">
        <button className="text-[12px] text-[#5a5a6e] px-2.5 py-1.5 rounded-md hover:text-[#c8c8d4] hover:bg-[#1a1a20] transition-colors">
          Docs
        </button>
        <button className="text-[12px] text-[#5a5a6e] px-2.5 py-1.5 rounded-md hover:text-[#c8c8d4] hover:bg-[#1a1a20] transition-colors">
          API
        </button>
        <button
          onClick={() => navigate('/')}
          className="text-[12px] font-medium text-[#c8c8d4] px-3 py-1.5 border border-[#252532] rounded-lg hover:bg-[#1a1a20] hover:border-[#3a3a46] transition-all ml-1"
        >
          Sign In
        </button>
      </nav>
    </header>
  )
}
