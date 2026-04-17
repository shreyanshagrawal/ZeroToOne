import { Routes, Route } from 'react-router-dom'
import SidebarLayout from './components/layout/SidebarLayout'
import Topbar from './components/layout/Topbar'
import LandingPage from './pages/LandingPage'
import RepoExplorer from './pages/RepoExplorer'
import RepoResultPage from './pages/RepoResultPage'
import AISearchResultPage from './pages/AISearchResultPage'
import LoadingOverlay from './components/ui/LoadingOverlay'

export default function App() {
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
