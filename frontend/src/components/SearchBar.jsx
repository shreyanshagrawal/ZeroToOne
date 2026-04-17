import { Search, GitBranch, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

// Custom Hook inside SearchBar scope to avoid needing external deps
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function SearchBar({ onAnalyze, analysisId, onFileSelect }) {
  const [repoStr, setRepoStr] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleURLSubmit = async (e) => {
    e.preventDefault();
    if (!repoStr.trim()) return;
    setIsAnalyzing(true);
    await onAnalyze(repoStr.trim());
    setIsAnalyzing(false);
  };

  // Trigger search logic
  useEffect(() => {
    const runSearch = async () => {
       if (!debouncedSearch || !analysisId) {
          setSearchResults(null);
          setIsDropdownOpen(false);
          return;
       }
       setIsSearching(true);
       setIsDropdownOpen(true);
       try {
          const res = await fetch(`http://localhost:3000/api/search`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ analysisId, query: debouncedSearch, topK: 5 })
          });
          const json = await res.json();
          if (json.status === 'success') setSearchResults(json.data);
       } catch (e) {
          console.error(e);
       }
       setIsSearching(false);
    };
    runSearch();
  }, [debouncedSearch, analysisId]);

  return (
    <div className="flex items-center h-full px-6 justify-between relative">
      
      {/* 1. Global AI Search Engine */}
      <div className="flex items-center space-x-2 w-1/3 min-w-[250px] relative z-20">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isSearching ? <Loader2 className="h-4 w-4 text-blue-500 animate-spin" /> : <Search className="h-4 w-4 text-slate-400" />}
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={!analysisId}
            onFocus={() => { if (searchQuery && searchResults) setIsDropdownOpen(true); }}
            onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
            className="block w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-text"
            placeholder={analysisId ? "Search semantics or keywords..." : "Awaiting repository analysis..."}
          />
        </div>
        
        {/* Search Results Dropdown Matrix */}
        {isDropdownOpen && searchResults && (
           <div className="absolute top-12 left-0 w-[500px] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-[70vh] flex flex-col z-50 animate-in fade-in slide-in-from-top-2">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between">
                 <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Search Results</span>
              </div>
              <div className="overflow-y-auto">
                 {/* Keyword Matches */}
                 {searchResults.keyword?.length > 0 && (
                    <div className="px-2 py-2">
                       <h4 className="text-xs font-semibold text-blue-500 px-2 py-1">Exact Matches</h4>
                       {searchResults.keyword.map((res, i) => (
                          <div key={`kw-${i}`} onClick={() => { setIsDropdownOpen(false); onFileSelect(res.file); }} className="px-2 py-2 mx-1 rounded hover:bg-slate-100 cursor-pointer transition-colors group">
                             <p className="text-sm font-semibold text-slate-800 truncate">{res.file.split('/').pop()}</p>
                             <p className="text-xs font-mono text-slate-400 truncate mt-0.5">{res.file}</p>
                          </div>
                       ))}
                    </div>
                 )}
                 {/* Semantic Matches */}
                 {searchResults.semantic?.length > 0 && (
                    <div className="px-2 py-2 border-t border-slate-100">
                       <h4 className="text-xs font-semibold text-indigo-500 px-2 py-1">Semantic Matches</h4>
                       {searchResults.semantic.map((res, i) => (
                          <div key={`sem-${i}`} onClick={() => { setIsDropdownOpen(false); onFileSelect(res.file); }} className="px-2 py-2 mx-1 rounded hover:bg-slate-100 cursor-pointer transition-colors group">
                             <p className="text-sm font-semibold text-slate-800 truncate">{res.file.split('/').pop()}</p>
                             <p className="text-xs font-mono text-slate-400 truncate mt-0.5">{res.file}</p>
                          </div>
                       ))}
                    </div>
                 )}
                 {(!searchResults.keyword?.length && !searchResults.semantic?.length) && (
                    <div className="p-6 text-center text-slate-400 text-sm">
                       No results found for "{searchQuery}"
                    </div>
                 )}
              </div>
           </div>
        )}
      </div>

      {/* 2. Target Repo Input */}
      <form onSubmit={handleURLSubmit} className="flex items-center space-x-3 w-1/2 justify-end z-10">
        <div className="relative w-full max-w-sm">
           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
             <GitBranch className="h-4 w-4 text-slate-400" />
           </div>
           <input
             type="url"
             required
             value={repoStr}
             onChange={(e) => setRepoStr(e.target.value)}
             className="block w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200"
             placeholder="https://github.com/owner/repo"
           />
        </div>
        <button
          type="submit"
          disabled={isAnalyzing}
          className="inline-flex items-center px-4 py-1.5 border border-transparent text-sm font-bold rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 min-w-[100px] justify-center transition-colors"
        >
          {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Analyze'}
        </button>
      </form>
    </div>
  );
}
