import { FileCode2, PackageOpen, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { memo } from 'react';

const Badge = ({ children, colorClass }) => (
  <span className={`px-3 py-1.5 border text-sm rounded-lg font-mono shadow-sm ${colorClass}`}>
    {children}
  </span>
);

const MainPanel = memo(({ file, summary, error }) => {
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

  // Edge Case Handling: Normalize data arrays incase backend sends malformed objects
  const exportsList = Array.isArray(summary.exports) ? summary.exports : [];
  const depsList = Array.isArray(summary.used_by) ? summary.used_by : [];

  return (
    <div className="max-w-4xl mx-auto py-6 animate-in fade-in duration-300">
      
      {/* Header section */}
      <div className="mb-8 relative pb-6 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-800 mb-2 truncate" title={file.split('/').pop()}>
           {file.split('/').pop()}
        </h1>
        <p className="text-sm font-mono text-slate-500 bg-slate-50 px-3 py-1 rounded inline-block max-w-full truncate" title={file}>
           {file}
        </p>
        
        {/* Importance Badge */}
        {typeof summary.importance === 'number' && (
          <div className="absolute top-0 right-0 hidden sm:flex flex-col items-end">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Importance</span>
            <div className={`px-3 py-1 rounded-full text-sm font-bold shadow-sm ${
              summary.importance > 7 ? 'bg-red-100 text-red-700 ring-1 ring-red-200' : 
              summary.importance > 4 ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' : 
              'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
            }`}>
              {summary.importance} / 10
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center">
            <PackageOpen className="w-4 h-4 mr-2" />
            Role & Purpose
          </h2>
          <p className="text-slate-700 leading-relaxed text-lg">{summary.summary || summary.role || 'No specific role detected.'}</p>
        </section>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center">
              <ArrowRight className="w-4 h-4 mr-2 text-indigo-400" />
              Exports (Capabilities)
            </h2>
            {exportsList.length > 0 ? (
              <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                {exportsList.map(exp => (
                  <Badge key={exp} colorClass="bg-indigo-100 border-indigo-200 text-indigo-800">{exp}</Badge>
                ))}
              </div>
            ) : (
             <p className="text-slate-400 italic text-sm">No notable exports found.</p>
            )}
          </section>

          <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2 text-rose-400" />
              Used By (Reverse Deps)
            </h2>
            {depsList.length > 0 ? (
              <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {depsList.map((dep, idx) => (
                  <li key={idx} className="text-sm font-mono text-slate-600 truncate bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm" title={dep}>
                    {dep}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400 italic text-sm">Not explicitly imported by any internal files.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
});

MainPanel.displayName = 'MainPanel';

export default MainPanel;
