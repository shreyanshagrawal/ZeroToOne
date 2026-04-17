import { ChevronRight, ChevronDown, FileText, Folder } from 'lucide-react';
import { useState, memo, useCallback } from 'react';

// Memoized to prevent re-rendering the entire repository tree 
// when unrelated state changes occur in the parent.
const TreeNode = memo(({ node, activeFile, onSelectFile }) => {
  const isDir = node.type === 'directory';
  const isActive = activeFile === node.path;
  
  // Default to collapsed unless it's a critical root path, to save DOM nodes in large repos
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = useCallback(() => {
    if (isDir) {
      setIsOpen(prev => !prev);
    } else {
      onSelectFile(node.path);
    }
  }, [isDir, node.path, onSelectFile]);

  // Edge case: Safety check if node data is corrupted
  if (!node || !node.name) return null;

  return (
    <div className="select-none">
      <div 
        onClick={handleClick}
        className={`flex items-center py-1.5 px-2 rounded-md cursor-pointer mb-0.5 text-sm transition-colors group
          ${isActive ? 'bg-blue-100 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-200'}
        `}
      >
        <span className="mr-1 min-w-[16px] h-4 flex items-center justify-center text-slate-400 group-hover:text-slate-600">
          {isDir ? (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span className="w-1" /> // Visual spacer for files aligns them with folders
          )}
        </span>
        <span className="mr-2 text-slate-400 group-hover:text-slate-500 shrink-0">
          {isDir ? <Folder size={16} className={isOpen ? 'text-blue-500 fill-blue-50' : ''} /> : <FileText size={16} />}
        </span>
        <span className="truncate" title={node.name}>{node.name}</span>
      </div>

      {/* Conditionally render children ONLY when open to save massive DOM overhead on large repos */}
      {isDir && isOpen && node.children && node.children.length > 0 && (
        <div className="ml-4 border-l border-slate-200 pl-1 mt-0.5">
          {node.children.map((child, idx) => (
            <TreeNode 
              key={child.path || idx} // Prioritize stable path keys for React reconciliation 
              node={child} 
              activeFile={activeFile} 
              onSelectFile={onSelectFile} 
            />
          ))}
        </div>
      )}
    </div>
  );
});

TreeNode.displayName = 'TreeNode';

const Sidebar = memo(({ treeData, activeFile, onSelectFile, isLoading }) => {
  return (
    <div className="p-4 h-full flex flex-col">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Explorer</h3>
      <div className="flex-1 overflow-y-auto pr-2 overflow-x-hidden">
        
        {isLoading ? (
          <div className="px-2 space-y-3">
             <div className="h-4 bg-slate-200 rounded w-3/4 animate-pulse"></div>
             <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse ml-4"></div>
             <div className="h-4 bg-slate-200 rounded w-5/6 animate-pulse"></div>
          </div>
        ) : !treeData || treeData.length === 0 ? (
          <div className="px-2 text-slate-400 text-sm py-4 italic border border-dashed border-slate-300 rounded-lg text-center">
            No repository loaded.
          </div>
        ) : (
          treeData.map((node, i) => (
            <TreeNode 
               key={node.path || i} 
               node={node} 
               activeFile={activeFile} 
               onSelectFile={onSelectFile} 
            />
          ))
        )}

      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;
