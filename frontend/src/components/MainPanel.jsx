import { FileCode2, PackageOpen, ArrowRight, ArrowLeft, AlertCircle, Link, KeyRound, ShieldAlert, Cpu, Activity } from 'lucide-react';
import { memo, useState } from 'react';

const Badge = ({ children, colorClass, onClick, interactive }) => (
  <span 
    onClick={onClick}
    className={`px-3 py-1.5 border text-sm rounded-lg font-mono shadow-sm ${colorClass} ${interactive ? 'cursor-pointer hover:opacity-80' : ''}`}>
    {children}
  </span>
);

const MainPanel = memo(({ file, summary, error, onSelectFile }) => {
  const [isToggling, setIsToggling] = useState(false);

  // Edge Case: Fetch Error Network Failures
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-red-400">
        <AlertCircle className="w-12 h-12 mb-4 text-red-300" />
        <p className="text-lg font-medium text-slate-800">Failed to load analysis for file</p>
        <p className="text-sm text-red-500 mt-2">{error}</p>
      </div>
    );
  }

  // Edge Case: Nothing Selected
  if (!file) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400">
        <div className="bg-slate-50 p-6 rounded-full mb-4 ring-1 ring-slate-200 shadow-inner">
          <FileCode2 className="w-12 h-12 text-slate-300" />
        </div>
        <p className="text-lg font-medium text-slate-500">Select a file to view its analysis</p>
      </div>
    );
  }

  // Edge Case: Loading State / Data not yet processed
  if (!summary) {
    return (
      <div className="max-w-4xl mx-auto py-6 animate-pulse flex flex-col space-y-6 w-full">
         <div className="h-24 bg-slate-100 rounded-2xl w-3/4 mb-4"></div>
         <div className="h-32 bg-slate-100 rounded-2xl w-full"></div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            <div className="h-48 bg-slate-100 rounded-2xl w-full"></div>
            <div className="h-48 bg-slate-100 rounded-2xl w-full"></div>
         </div>
      </div>
    );
  }

  const isDeep = !!summary.deep_explanation;

  const toggleDeepView = async () => {
     setIsToggling(true);
     await onSelectFile(file, null, isDeep ? 'basic' : 'deep');
     setIsToggling(false);
  };

  const handleLinkClick = (targetFile) => {
     onSelectFile(targetFile);
  };

  const importsList = Array.isArray(summary.imports) ? summary.imports : [];
  const depsList = Array.isArray(summary.used_by) ? summary.used_by : [];
  const relatedList = Array.isArray(summary.related_files) ? summary.related_files : [];

  return (
    <div className={`max-w-4xl mx-auto py-6 animate-in fade-in duration-300 ${isToggling ? 'opacity-50 pointer-events-none' : ''}`}>
      
      {/* Header section */}
      <div className="mb-8 relative pb-6 border-b border-slate-200">
        <div className="flex justify-between items-start">
           <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2 truncate" title={file.split('/').pop()}>
                 {file.split('/').pop()}
              </h1>
              <div className="flex items-center space-x-3">
                 <p className="text-sm font-mono text-slate-500 bg-slate-50 px-3 py-1 rounded inline-block truncate" title={file}>
                    {file}
                 </p>
                 <button onClick={toggleDeepView} className={`px-3 py-1 text-xs font-bold rounded shadow-sm border transition-colors ${isDeep ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                    {isDeep ? 'Deep View Active' : 'Enable Deep Technical View'}
                 </button>
              </div>
           </div>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Core Heuristics */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center">
            <PackageOpen className="w-4 h-4 mr-2" /> Developer Explanation
          </h2>
          <p className="text-slate-700 leading-relaxed font-medium">{summary.explanation || 'No explicit logic mapped to this node.'}</p>
        </section>

        {/* Deep Technical View Expansion */}
        {isDeep && summary.deep_explanation && (
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg text-slate-300 animate-in slide-in-from-top-4 space-y-4">
             <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center border-b border-slate-700 pb-3">
               <Cpu className="w-4 h-4 mr-2 text-blue-400" /> Deep Technical Breakdown
             </h2>
             <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-blue-100">
                {summary.deep_explanation}
             </pre>
          </div>
        )}
        
        {/* Connection Matrices */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="bg-slate-50 p-5 rounded-xl border border-slate-200 h-64 flex flex-col">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center">
              <ArrowRight className="w-3 h-3 mr-2 text-sky-500" /> Imports
            </h2>
            {importsList.length > 0 ? (
              <ul className="space-y-2 overflow-y-auto pr-2 flex-1 scrollbar-thin">
                {importsList.map((dep, idx) => (
                  <li key={idx} onClick={() => handleLinkClick(dep)} className="text-xs font-mono text-sky-700 truncate bg-sky-50 hover:bg-sky-100 cursor-pointer transition-colors px-2 py-1.5 rounded border border-sky-100 shadow-sm" title={dep}>
                    {dep.split('/').pop()}
                  </li>
                ))}
              </ul>
            ) : (
             <p className="text-slate-400 italic text-xs">No local module dependencies.</p>
            )}
          </section>

          <section className="bg-slate-50 p-5 rounded-xl border border-slate-200 h-64 flex flex-col">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center">
              <ArrowLeft className="w-3 h-3 mr-2 text-rose-500" /> Used By
            </h2>
            {depsList.length > 0 ? (
              <ul className="space-y-2 overflow-y-auto pr-2 flex-1 scrollbar-thin">
                {depsList.map((dep, idx) => (
                  <li key={idx} onClick={() => handleLinkClick(dep)} className="text-xs font-mono text-rose-700 truncate bg-rose-50 hover:bg-rose-100 cursor-pointer transition-colors px-2 py-1.5 rounded border border-rose-100 shadow-sm" title={dep}>
                    {dep.split('/').pop()}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400 italic text-xs">No files depend on this.</p>
            )}
          </section>
          
          <section className="bg-slate-50 p-5 rounded-xl border border-slate-200 h-64 flex flex-col">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center">
              <Link className="w-3 h-3 mr-2 text-emerald-500" /> Related Files
            </h2>
            {relatedList.length > 0 ? (
              <ul className="space-y-2 overflow-y-auto pr-2 flex-1 scrollbar-thin">
                {relatedList.map((dep, idx) => (
                  <li key={idx} onClick={() => handleLinkClick(dep)} className="text-xs font-mono text-emerald-700 truncate bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors px-2 py-1.5 rounded border border-emerald-100 shadow-sm" title={dep}>
                    {dep.split('/').pop()}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400 italic text-xs">No relative network mapped.</p>
            )}
          </section>
        </div>

      </div>
    </div>
  );
});

MainPanel.displayName = 'MainPanel';

export default MainPanel;
