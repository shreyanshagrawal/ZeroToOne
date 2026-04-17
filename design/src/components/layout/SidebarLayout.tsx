import { useNavigate } from 'react-router-dom';
import { useRepoStore } from '../../store/useRepoStore';
import type { Repo } from '../../types';

function RepoItem({ repo, active, onClick }: { repo: Repo; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors mb-0.5 ${
        active ? 'bg-[#1e1e26]' : 'hover:bg-[#1a1a20]'
      }`}
    >
      <svg className="w-4 h-4 mt-0.5 shrink-0 text-[#5a5a6e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10,9 9,9 8,9"/>
      </svg>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[#c8c8d4] truncate">{repo.fullName}</div>
        <div className="text-[11px] text-[#5a5a6e] mt-0.5 truncate">{repo.description.slice(0, 48)}...</div>
        <div className="text-[11px] text-[#6b4fd8] mt-1 font-medium">Last opened {repo.lastOpened}</div>
      </div>
    </div>
  );
}

export default function SidebarLayout() {
  const navigate = useNavigate();
  const { repos, activeRepo, setActiveRepo } = useRepoStore();

  function handleRepoClick(repo: Repo) {
    setActiveRepo(repo);
    navigate('/explore');
  }

  return (
    <aside className="w-[260px] min-w-[260px] bg-[#111115] border-r border-[#1e1e24] flex flex-col h-screen overflow-hidden">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#1e1e24] flex items-center gap-2.5">
        <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="7" fill="#16162a"/>
          <rect x="7" y="7" width="14" height="14" rx="2" stroke="#6b4fd8" strokeWidth="1.5" fill="none"/>
          <rect x="10.5" y="10.5" width="7" height="7" rx="1" fill="#6b4fd8" fillOpacity="0.4"/>
          <rect x="12" y="12" width="4" height="4" rx="0.5" fill="#8b6cf0"/>
        </svg>
        <span className="text-[15px] font-semibold text-[#e8e8ea] tracking-tight">CodeMap AI</span>
      </div>

      {/* Repo list */}
      <div className="px-5 pt-5 pb-2">
        <div className="text-[10px] font-semibold tracking-widest uppercase text-[#5a5a6e] mb-2.5">
          Recent Repositories
        </div>
        {repos.map((repo) => (
          <RepoItem
            key={repo.id}
            repo={repo}
            active={activeRepo?.id === repo.id}
            onClick={() => handleRepoClick(repo)}
          />
        ))}
      </div>

      <div className="flex-1" />

      {/* User profile */}
      <div className="px-4 py-3.5 border-t border-[#1e1e24] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6b4fd8] to-[#8b6cf0] flex items-center justify-center text-[12px] font-semibold text-white shrink-0">
          SD
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-[#c8c8d4]">Sarah Developer</div>
          <div className="text-[11px] text-[#5a5a6e]">Pro Plan</div>
        </div>
        <button className="w-7 h-7 rounded-md flex items-center justify-center text-[#5a5a6e] hover:text-[#9090a0] hover:bg-[#1a1a20] transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
