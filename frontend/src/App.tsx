import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import SidebarLayout from './components/layout/SidebarLayout'
import Topbar from './components/layout/Topbar'
import LandingPage from './pages/LandingPage'
import RepoExplorer from './pages/RepoExplorer'
import RepoResultPage from './pages/RepoResultPage'
import AISearchResultPage from './pages/AISearchResultPage'
import LoadingOverlay from './components/ui/LoadingOverlay'
import { useRepoStore } from './store/useRepoStore'

export default function App() {
  const restoreSession = useRepoStore(s => s.restoreSession);
  const isRestoring = useRepoStore(s => s.isRestoring);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (isRestoring) {
    return (
      <div className="flex h-screen bg-[#0d0d0f] items-center justify-center text-[#c8c8d4]">
         <div className="flex flex-col items-center gap-4">
             <div className="w-6 h-6 border-2 border-[#6b4fd8] border-t-transparent rounded-full animate-spin"></div>
             <p className="text-sm font-medium">Restoring session...</p>
         </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0d0d0f] overflow-hidden">
      <SidebarLayout />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <Routes>
          <Route path="/"          element={<LandingPage />} />
          <Route path="/result"    element={<RepoResultPage />} />
          <Route path="/explore"   element={<RepoExplorer />} />
          <Route path="/ai-result" element={<AISearchResultPage />} />
        </Routes>
      </div>
      <LoadingOverlay />
    </div>
  )
}
