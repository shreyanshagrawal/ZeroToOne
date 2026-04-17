import { useState, useCallback, useEffect, useRef } from 'react';
import SearchBar from './components/SearchBar';
import Sidebar from './components/Sidebar';
import MainPanel from './components/MainPanel';

const API_BASE = 'http://localhost:3000/api';

export default function App() {
  const [activeFile, setActiveFile] = useState(null);
  const [analysisId, setAnalysisId] = useState(null);
  
  const [treeData, setTreeData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState(null);

  // Initialize from deep-links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const aid = params.get('analysisId');
    const f = params.get('file');
    if (aid) fetchTree(aid); // Automatically load tree on reload
    if (f) handleSelectFile(f, aid);
  }, []);

  // Sync URL State
  useEffect(() => {
    const url = new URL(window.location);
    if (analysisId) url.searchParams.set('analysisId', analysisId);
    if (activeFile) url.searchParams.set('file', activeFile);
    window.history.replaceState({}, '', url);
  }, [analysisId, activeFile]);

  // Fetch Tree
  const fetchTree = async (id) => {
    setAnalysisId(id);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/repo-structure?analysisId=${id}`);
      const json = await res.json();
      if (json.status === 'success') setTreeData(json.data.structure);
    } catch (e) {
      setError('Failed to render file tree structure.');
    }
    setIsLoading(false);
  };

  // Process Repo & Stream SSE Updates
  const handleAnalyzeRepo = async (repoUrl) => {
    setIsLoading(true);
    setTreeData([]);
    setError(null);
    setSummaryData(null);
    setActiveFile(null);
    
    try {
      const res = await fetch(`${API_BASE}/analyze-repo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl })
      });
      const data = await res.json();
      
      if (data.status !== 'success') {
         setError(data.message);
         setIsLoading(false);
         return;
      }
      
      const jobId = data.data.analysisId;
      setAnalysisId(jobId);
      
      // Connect to SSE
      const eventSource = new EventSource(`${API_BASE}/stream-status/${jobId}`);
      eventSource.onmessage = (event) => {
         const d = JSON.parse(event.data);
         setStatusMsg(d.progress || `Status: ${d.status}`);
         
         if (d.status === 'completed') {
            eventSource.close();
            fetchTree(jobId);
            setStatusMsg('');
         } else if (d.status === 'failed') {
            eventSource.close();
            setError(d.error || 'Failed to analyze repository');
            setIsLoading(false);
         }
      };
      
    } catch (err) {
      setError('Could not connect to backend server.');
      setIsLoading(false);
    }
  };

  const handleSelectFile = useCallback(async (filePath, customAid = null) => {
    const aidToUse = customAid || analysisId;
    if (!aidToUse) return;
    
    setActiveFile(filePath);
    setSummaryData(null); // Clear previous to trigger loading pulse
    
    try {
      const res = await fetch(`${API_BASE}/file-summary?analysisId=${aidToUse}&file=${encodeURIComponent(filePath)}`);
      const json = await res.json();
      if (json.status === 'success') {
        // Backend now securely returns a single object if file query is passed
        const fileObj = Array.isArray(json.data) 
            ? json.data.find(f => f.file === filePath) 
            : json.data;
            
        setSummaryData(fileObj || { error: 'No summary generated for this file explicitly.' });
      } else {
        setError(json.message);
      }
    } catch (e) {
      console.error(e);
      setError('Network failure grabbing summary.');
    }
  }, [analysisId]);

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 text-slate-900 font-sans">
      <div className="h-16 border-b border-slate-200 bg-white shadow-sm z-10">
        <SearchBar onAnalyze={handleAnalyzeRepo} analysisId={analysisId} onFileSelect={handleSelectFile} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 border-r border-slate-200 bg-slate-50 flex flex-col overflow-y-auto relative">
          
          {/* SSE Progress Overlay */}
          {isLoading && statusMsg && (
            <div className="absolute top-0 inset-x-0 p-3 bg-blue-100 text-blue-800 text-xs font-bold text-center border-b border-blue-200 flex items-center justify-center animate-pulse shadow-sm">
               {statusMsg}
            </div>
          )}

          <Sidebar 
            treeData={treeData} 
            activeFile={activeFile} 
            onSelectFile={handleSelectFile} 
            isLoading={isLoading && !statusMsg}
          />
        </div>

        <div className="flex-1 bg-white overflow-y-auto p-8 shadow-inner">
          <MainPanel 
            file={activeFile} 
            summary={summaryData} 
            error={error} 
          />
        </div>
      </div>
    </div>
  );
}
