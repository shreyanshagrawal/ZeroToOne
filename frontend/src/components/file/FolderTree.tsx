import { useRepoStore } from '../../store/useRepoStore'
import type { FileNode } from '../../types'

const EXT_COLORS: Record<string, string> = {
  ts:   '#6b4fd8',
  tsx:  '#60a5fa',
  js:   '#d4a020',
  jsx:  '#f59e0b',
  py:   '#40b0d0',
  json: '#40c080',
  md:   '#808090',
  css:  '#c060b0',
  html: '#e47c4b',
}

function FileIcon({ ext }: { ext?: string }) {
  const color = EXT_COLORS[ext ?? ''] ?? '#606074'
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
    </svg>
  )
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={open ? '#6b4fd8' : 'none'} stroke={open ? '#6b4fd8' : '#6060748'} strokeWidth="1.5" style={{ stroke: open ? '#6b4fd8' : '#5a5a6e' }}>
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ transition: 'transform 0.15s ease', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
    >
      <polyline points="9,18 15,12 9,6"/>
    </svg>
  )
}

function buildVisible(nodes: FileNode[], openFolders: Set<string>): FileNode[] {
  const visible: FileNode[] = []
  for (const node of nodes) {
    if (!node.parent) { visible.push(node); continue }
    // Walk up parent chain — only show if ALL ancestors are open
    let parentId: string | undefined = node.parent
    let show = true
    while (parentId) {
      if (!openFolders.has(parentId)) { show = false; break }
      const parentNode = nodes.find(n => n.id === parentId)
      parentId = parentNode?.parent
    }
    if (show) visible.push(node)
  }
  return visible
}

export default function FolderTree() {
  const { openFolders, selectedFileId, toggleFolder, selectFile, fileTree } = useRepoStore()
  const visible = buildVisible(fileTree, openFolders)

  const indentPx = [0, 16, 28, 40]

  return (
    <div className="w-[240px] min-w-[240px] bg-[#0f0f14] border-r border-[#1e1e24] overflow-y-auto py-2 shrink-0">
      <div className="px-4 py-2 text-[10px] font-semibold tracking-widest uppercase text-[#5a5a6e]">
        Explorer
      </div>

      {visible.map((node) => {
        const pl = indentPx[node.indent] ?? 0
        const isOpen = openFolders.has(node.id)
        const isActive = node.id === selectedFileId

        if (node.type === 'folder') {
          return (
            <button
              key={node.id}
              onClick={() => toggleFolder(node.id)}
              style={{ paddingLeft: `${pl + 12}px` }}
              className={`w-full flex items-center gap-1.5 pr-3 py-1 text-[13px] transition-colors ${
                isOpen ? 'text-[#c8c8d4]' : 'text-[#9090a8]'
              } hover:bg-[#1a1a22] hover:text-[#c8c8d4]`}
            >
              <ChevronIcon open={isOpen} />
              <FolderIcon open={isOpen} />
              <span>{node.name}</span>
            </button>
          )
        }

        const dotColor = EXT_COLORS[node.ext ?? ''] ?? '#606074'
        return (
          <button
            key={node.id}
            onClick={() => selectFile(node.id)}
            style={{ paddingLeft: `${pl + 12}px` }}
            className={`w-full flex items-center gap-1.5 pr-3 py-1 text-[13px] transition-colors ${
              isActive
                ? 'bg-[#1e1e2e] text-[#b0a8f0]'
                : 'text-[#9090a8] hover:bg-[#1a1a22] hover:text-[#c8c8d4]'
            }`}
          >
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: dotColor, flexShrink: 0, marginRight: 2 }} />
            <FileIcon ext={node.ext} />
            <span className="truncate">{node.name}</span>
          </button>
        )
      })}
    </div>
  )
}
