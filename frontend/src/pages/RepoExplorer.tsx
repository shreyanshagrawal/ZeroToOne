import FolderTree from '../components/file/FolderTree'
import Breadcrumbs from '../components/file/Breadcrumbs'
import FileSummaryPanel from '../components/file/FileSummaryPanel'
import RepoOverview from '../components/repo/RepoOverview'

export default function RepoExplorer() {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* File tree sidebar */}
      <FolderTree />

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Breadcrumbs />
        <FileSummaryPanel />
      </div>

      {/* Right panel */}
      <RepoOverview />
    </div>
  )
}
