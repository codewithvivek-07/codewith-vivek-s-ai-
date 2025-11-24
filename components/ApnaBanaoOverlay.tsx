import React, { useState, useEffect, useRef } from 'react';
import { generateAppCode } from '../services/geminiService';

// Declare JSZip for TypeScript since it's loaded via CDN
declare global {
  interface Window {
    JSZip: any;
  }
}

interface PlaygroundOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

const PlaygroundOverlay: React.FC<PlaygroundOverlayProps> = ({ isOpen, onClose, isAdmin }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, string> | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Preview Controls
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Layout Controls
  const [layoutMode, setLayoutMode] = useState<'side' | 'bottom'>('side');
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const layoutDropdownRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Handle click outside for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (layoutDropdownRef.current && !layoutDropdownRef.current.contains(event.target as Node)) {
        setShowLayoutDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // Pass existing files if available for update
      const files = await generateAppCode(prompt, isAdmin, generatedFiles || undefined);
      setGeneratedFiles(files);
      createPreview(files);
      setPrompt(''); // Clear prompt for next instruction
    } catch (err: any) {
      setError(err.message || "Failed to generate app. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const createPreview = (files: Record<string, string>) => {
    // Robustly find index.html (case insensitive)
    const indexKey = Object.keys(files).find(k => k.toLowerCase() === 'index.html' || k.toLowerCase() === 'index.htm' || k.toLowerCase() === 'main.html') 
                  || Object.keys(files).find(k => k.endsWith('.html'));
    
    let html = indexKey ? files[indexKey] : '';
    
    if (!html) {
        // Fallback HTML if missing
        html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              padding: 2rem; 
              color: #333; 
              background: #f0f0f0;
              text-align: center; 
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .card {
              background: white;
              padding: 2rem;
              border-radius: 1rem;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              max-width: 400px;
            }
            h2 { color: #8b5cf6; margin-top: 0; }
            .file-list { text-align: left; background: #eee; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem; font-family: monospace; font-size: 0.9rem; }
          </style>
        </head>
        <body>
            <div class="card">
              <h2>Preview Unavailable</h2>
              <p>The AI generated code but no <strong>index.html</strong> entry point was found.</p>
              <div class="file-list">
                 <strong>Files Generated:</strong><br/>
                 ${Object.keys(files).join('<br/>')}
              </div>
            </div>
        </body>
        </html>`;
    }

    // Helper to inject content
    const injectResource = (tagType: 'style' | 'script', filename: string, content: string) => {
       // Escape special regex characters in filename
       const escapedName = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
       
       if (tagType === 'style') {
           // Try to find <link href="..."> with optional ./ prefix and either quote type
           const linkRegex = new RegExp(`<link[^>]+href=["'](\\./)?${escapedName}["'][^>]*>`, 'i');
           if (linkRegex.test(html)) {
               html = html.replace(linkRegex, `<style>${content}</style>`);
           } else {
               // Fallback: append to head
               if (html.includes('</head>')) {
                   html = html.replace('</head>', `<style>${content}</style></head>`);
               } else {
                   html += `<style>${content}</style>`;
               }
           }
       } else {
           // Try to find <script src="..."> with optional ./ prefix and either quote type
           const scriptRegex = new RegExp(`<script[^>]+src=["'](\\./)?${escapedName}["'][^>]*>\\s*<\\/script>`, 'i');
           if (scriptRegex.test(html)) {
               html = html.replace(scriptRegex, `<script>${content}</script>`);
           } else {
                // Fallback: append to body
               if (html.includes('</body>')) {
                   html = html.replace('</body>', `<script>${content}</script></body>`);
               } else {
                   html += `<script>${content}</script>`;
               }
           }
       }
    };

    Object.entries(files).forEach(([filename, content]) => {
        if (filename === indexKey) return; // Skip main html
        if (filename.endsWith('.css')) injectResource('style', filename, content);
        if (filename.endsWith('.js')) injectResource('script', filename, content);
    });

    setPreviewUrl(html);
  };

  const handleDownloadZip = async () => {
    if (!generatedFiles || !window.JSZip) return;

    const zip = new window.JSZip();
    
    Object.entries(generatedFiles).forEach(([filename, content]) => {
      zip.file(filename, content);
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = "playground_project.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShareApp = async () => {
    if (!previewUrl) return;

    // Create a Blob from the bundled HTML (previewUrl is the full HTML string)
    const blob = new Blob([previewUrl], { type: 'text/html' });
    const file = new File([blob], "playground-app.html", { type: 'text/html' });

    // Use Web Share API if available and supports files
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'My AI Playground App',
          text: 'Here is an app I built with the Playground AI Builder. Open this file in your browser to use it!',
        });
      } catch (err) {
        console.warn("Share cancelled or failed", err);
      }
    } else {
      // Fallback: Download the single HTML file
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "playground-app.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert("App saved as 'playground-app.html'. You can send this file to anyone!");
    }
  };

  const handleClose = () => {
    if (confirm("Close Playground? Unsaved work will be lost.")) {
      setPrompt('');
      setGeneratedFiles(null);
      setPreviewUrl(null);
      setDevice('desktop');
      setIsFullScreen(false);
      setLayoutMode('side');
      onClose();
    }
  };

  // Styles for responsive preview
  const iframeStyles = {
    width: device === 'desktop' ? '100%' : device === 'tablet' ? '768px' : '375px',
    height: device === 'desktop' ? '100%' : device === 'tablet' ? '1024px' : '667px',
    border: device === 'desktop' ? 'none' : '12px solid #1f2937',
    borderRadius: device === 'desktop' ? '0' : '24px',
    transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
    backgroundColor: 'white' // Ensure white background always
  };

  // Layout Dynamic Classes
  const containerClasses = layoutMode === 'side'
    ? "flex-1 flex flex-col md:flex-row h-full overflow-hidden relative"
    : "flex-1 flex flex-col h-full overflow-hidden relative";

  const leftPanelClasses = layoutMode === 'side'
    ? `w-full md:w-1/3 lg:w-1/4 bg-gray-800/50 border-r border-gray-700 flex flex-col p-6 overflow-y-auto ${isFullScreen ? 'hidden' : 'block'}`
    : `w-full h-1/2 bg-gray-800/50 border-b border-gray-700 flex flex-col p-6 overflow-y-auto ${isFullScreen ? 'hidden' : 'block'}`;

  const rightPanelClasses = isFullScreen 
    ? "fixed inset-0 z-[110] bg-black flex flex-col" 
    : "flex-1 bg-black relative flex flex-col transition-all duration-300";

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900 text-white flex flex-col animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700 flex-none z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-purple-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Playground</h2>
            <p className="text-xs text-gray-400">Interactive App Builder</p>
          </div>
        </div>
        <button 
          onClick={handleClose}
          className="p-2 hover:bg-gray-700 rounded-full transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className={containerClasses}>
        {/* Left Panel: Controls */}
        <div className={leftPanelClasses}>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                {generatedFiles ? "Change Request / Update" : "What can I build?"}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={generatedFiles 
                  ? "Describe what you want to change (e.g. 'Make the background blue', 'Add a login form')..."
                  : "E.g., A flappy bird clone, a weather app using APIs, a portfolio website..."}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none h-40 font-mono text-sm"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                ${isGenerating 
                  ? 'bg-gray-700 cursor-not-allowed opacity-70' 
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-indigo-900/20'}`}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {generatedFiles ? "Updating..." : "Building..."}
                </>
              ) : (
                <>
                  {generatedFiles ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  )}
                  {generatedFiles ? "Update App" : "Generate App"}
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm">
                Error: {error}
              </div>
            )}

            {generatedFiles && (
              <div className="animate-fade-in space-y-3 pt-4 border-t border-gray-700">
                 <div className="flex items-center justify-between">
                   <span className="text-sm font-medium text-green-400">Build Successful</span>
                   <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
                     {Object.keys(generatedFiles).length} Files
                   </span>
                 </div>
                 
                 <div className="flex gap-2">
                   <button
                     onClick={handleDownloadZip}
                     className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                     title="Download source code"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                     </svg>
                     ZIP
                   </button>
                   <button
                     onClick={handleShareApp}
                     className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-500/20"
                     title="Share or Download Single File App"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                     </svg>
                     Share
                   </button>
                 </div>
                 
                 <div className="text-xs text-gray-500 text-center">
                   Use 'Share' to send a playable app file.
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Preview */}
        <div className={rightPanelClasses}>
          {previewUrl ? (
            <>
               {/* Preview Toolbar */}
               <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700 flex-none z-20">
                 <div className="flex items-center gap-4">
                   <span className="text-xs uppercase font-bold text-gray-500 hidden sm:block">Preview Mode</span>
                   
                   {/* Device Toggles */}
                   <div className="flex bg-gray-900 rounded-lg p-1 gap-1">
                     <button 
                       onClick={() => setDevice('desktop')}
                       className={`p-1.5 rounded transition-colors ${device === 'desktop' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                       title="Desktop View"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                       </svg>
                     </button>
                     <button 
                       onClick={() => setDevice('tablet')}
                       className={`p-1.5 rounded transition-colors ${device === 'tablet' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                       title="Tablet View"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                       </svg>
                     </button>
                     <button 
                       onClick={() => setDevice('mobile')}
                       className={`p-1.5 rounded transition-colors ${device === 'mobile' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                       title="Mobile View"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                       </svg>
                     </button>
                   </div>
                 </div>

                 <div className="flex gap-2 relative">
                    {/* Layout Dropdown */}
                    <div ref={layoutDropdownRef} className="relative">
                      <button
                        onClick={() => setShowLayoutDropdown(!showLayoutDropdown)}
                        className="p-1.5 px-3 rounded text-xs font-bold transition-colors border border-gray-600 hover:bg-gray-700 flex items-center gap-2 bg-gray-800"
                        title="Change Layout"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                         </svg>
                         <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${showLayoutDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                         </svg>
                      </button>

                      {showLayoutDropdown && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 rounded-xl shadow-xl border border-gray-700 overflow-hidden animate-fade-in z-50">
                          <button
                            onClick={() => { setLayoutMode('side'); setShowLayoutDropdown(false); }}
                            className={`w-full text-left px-4 py-3 text-xs font-medium hover:bg-gray-700 flex items-center gap-2 ${layoutMode === 'side' ? 'bg-gray-700/50 text-white' : 'text-gray-300'}`}
                          >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                             </svg>
                             Split View (Side)
                          </button>
                          <button
                            onClick={() => { setLayoutMode('bottom'); setShowLayoutDropdown(false); }}
                            className={`w-full text-left px-4 py-3 text-xs font-medium hover:bg-gray-700 flex items-center gap-2 ${layoutMode === 'bottom' ? 'bg-gray-700/50 text-white' : 'text-gray-300'}`}
                          >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                             </svg>
                             Vertical View (Bottom)
                          </button>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => setIsFullScreen(!isFullScreen)}
                      className={`p-1.5 px-3 rounded text-xs font-bold transition-colors border border-gray-600 hover:bg-gray-700 flex items-center gap-2 ${isFullScreen ? 'bg-red-600 border-red-500' : ''}`}
                    >
                      {isFullScreen ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Exit
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                          Full
                        </>
                      )}
                    </button>
                 </div>
               </div>
               
               {/* Iframe Container */}
               <div className="flex-1 w-full h-full bg-gray-900 flex items-center justify-center overflow-auto p-4 relative">
                 {isGenerating && (
                    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                        <svg className="animate-spin h-10 w-10 mb-4 text-purple-500" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="font-bold tracking-wider">BUILDING PLAYGROUND...</p>
                    </div>
                 )}
                 <iframe 
                   srcDoc={previewUrl}
                   title="App Preview" 
                   style={iframeStyles}
                   className="bg-white shadow-2xl"
                   sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
                 />
               </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-30 p-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
              </svg>
              <h3 className="text-xl font-bold">Waiting to Build</h3>
              <p className="max-w-md mt-2">Enter a description on the left and hit "Generate App" to see your ideas come to life instantly.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaygroundOverlay;