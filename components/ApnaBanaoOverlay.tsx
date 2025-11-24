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
  // Fix: Changed 'HTMLDivLement' to 'HTMLDivElement'
  const layoutDropdownRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Theme Definitions
  const themeColors = {
      border: isAdmin ? 'border-neon-red' : 'border-neon-cyan',
      shadow: isAdmin ? 'shadow-neon-red' : 'shadow-neon-cyan',
      text: isAdmin ? 'text-neon-red' : 'text-neon-cyan',
      button: isAdmin 
         ? 'bg-admin-600 hover:bg-admin-500 text-white shadow-neon-red btn-3d' 
         : 'bg-primary-600 hover:bg-primary-500 text-white shadow-neon-cyan btn-3d',
      ring: isAdmin ? 'focus:ring-neon-red' : 'focus:ring-neon-cyan',
      activeDevice: isAdmin ? 'bg-red-900/50 text-white shadow-neon-red' : 'bg-cyan-900/50 text-white shadow-neon-cyan',
      bgPanel: 'glass-panel',
      accent: isAdmin ? 'text-neon-red' : 'text-neon-cyan',
      loadingBorder: isAdmin ? 'border-red-900 border-t-red-500' : 'border-cyan-900 border-t-cyan-500',
      loadingText: isAdmin ? 'text-neon-red' : 'text-neon-cyan',
      inputBorder: isAdmin ? 'border-red-700' : 'border-cyan-700',
  };

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
              font-family: 'Rajdhani', sans-serif; 
              padding: 2rem; 
              color: ${isAdmin ? '#ff003c' : '#00f3ff'}; 
              background: #050510;
              text-align: center; 
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: 2px;
            }
            .card {
              border: 1px solid ${isAdmin ? '#ff003c' : '#00f3ff'};
              padding: 2rem;
              background: rgba(0,0,0,0.5);
              max-width: 400px;
              box-shadow: 0 0 10px ${isAdmin ? '#ff003c' : '#00f3ff'};
            }
            h2 { margin-top: 0; text-shadow: 0 0 10px currentColor; }
          </style>
        </head>
        <body>
            <div class="card">
              <h2>Index Missing</h2>
              <p>The AI generated code but no <strong>index.html</strong> entry point was found.</p>
            </div>
        </body>
        </html>`;
    }

    // Helper to inject content
    const injectResource = (tagType: 'style' | 'script', filename: string, content: string) => {
       const escapedName = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
       if (tagType === 'style') {
           const linkRegex = new RegExp(`<link[^>]+href=["'](\\./)?${escapedName}["'][^>]*>`, 'i');
           if (linkRegex.test(html)) {
               html = html.replace(linkRegex, `<style>${content}</style>`);
           } else {
               if (html.includes('</head>')) html = html.replace('</head>', `<style>${content}</style></head>`);
               else html += `<style>${content}</style>`;
           }
       } else {
           const scriptRegex = new RegExp(`<script[^>]+src=["'](\\./)?${escapedName}["'][^>]*>\\s*<\\/script>`, 'i');
           if (scriptRegex.test(html)) {
               html = html.replace(scriptRegex, `<script>${content}</script>`);
           } else {
               if (html.includes('</body>')) html = html.replace('</body>', `<script>${content}</script></body>`);
               else html += `<script>${content}</script>`;
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
    const blob = new Blob([previewUrl], { type: 'text/html' });
    const file = new File([blob], "playground-app.html", { type: 'text/html' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'My AI Playground App',
          text: 'Here is an app I built with the Playground AI Builder.',
        });
      } catch (err) {
        console.warn("Share cancelled or failed", err);
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "playground-app.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert("App saved as 'playground-app.html'.");
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
    border: device === 'desktop' ? 'none' : `4px solid ${isAdmin ? '#ff003c' : '#00f3ff'}`, // Dynamic border for devices
    borderRadius: device === 'desktop' ? '0' : '20px',
    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    backgroundColor: 'white',
    boxShadow: device === 'desktop' ? 'none' : `0 25px 50px -12px ${isAdmin ? 'rgba(255, 0, 60, 0.5)' : 'rgba(0, 243, 255, 0.5)'}`
  };

  const containerClasses = layoutMode === 'side'
    ? "flex-1 flex flex-col md:flex-row h-full overflow-hidden relative"
    : "flex-1 flex flex-col h-full overflow-hidden relative";

  const leftPanelClasses = layoutMode === 'side'
    ? `w-full md:w-1/3 lg:w-1/4 bg-black/90 border-r ${themeColors.border} flex flex-col p-6 overflow-y-auto ${isFullScreen ? 'hidden' : 'block'}`
    : `w-full h-1/2 bg-black/90 border-b ${themeColors.border} flex flex-col p-6 overflow-y-auto ${isFullScreen ? 'hidden' : 'block'}`;

  const rightPanelClasses = isFullScreen 
    ? "fixed inset-0 z-[110] bg-black flex flex-col" 
    : "flex-1 bg-black/80 relative flex flex-col transition-all duration-300";

  return (
    <div className={`fixed inset-0 z-[100] bg-[#050510] text-gray-100 flex flex-col animate-fade-in overflow-hidden font-sans`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 bg-black/80 border-b ${themeColors.border} flex-none z-10 ${themeColors.bgPanel}`}>
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded border border-current ${themeColors.text} ${themeColors.shadow}`}>
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
             </svg>
          </div>
          <div>
            <h2 className={`text-xl font-bold tracking-widest uppercase ${themeColors.text}`}>Playground_Builder</h2>
            <p className="text-[10px] text-gray-500 font-mono uppercase">Interactive Development Environment</p>
          </div>
        </div>
        <button 
          onClick={handleClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white"
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
              <label className={`block text-xs font-bold ${themeColors.text} mb-2 uppercase tracking-wider`}>
                {generatedFiles ? "Refactor / Update Directive" : "Initial Directive"}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={generatedFiles 
                  ? "Describe changes (e.g. 'Make button red')..."
                  : "Describe the app you want to build..."}
                className={`w-full bg-[#0a0a15] border ${themeColors.inputBorder} rounded-lg p-4 text-white placeholder-gray-600 outline-none resize-none h-40 font-mono text-sm focus:border-opacity-100 transition-colors focus:border-current ${themeColors.ring} focus:ring-1`}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className={`w-full py-4 rounded font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 btn-3d
                ${isGenerating 
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed shadow-none' 
                  : `${themeColors.button}`}`}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {generatedFiles ? "Compiling..." : "Initializing..."}
                </>
              ) : (
                <>
                  {generatedFiles ? "Update_Build" : "Generate_Build"}
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-xs font-mono">
                [ERROR]: {error}
              </div>
            )}

            {generatedFiles && (
              <div className="animate-fade-in space-y-3 pt-4 border-t border-gray-800">
                 <div className="flex items-center justify-between">
                   <span className="text-xs font-bold text-green-400 font-mono uppercase">Build_Success</span>
                   <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400 font-mono border border-gray-700">
                     {Object.keys(generatedFiles).length} Files
                   </span>
                 </div>
                 
                 <div className="flex gap-2">
                   <button
                     onClick={handleDownloadZip}
                     className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-white rounded font-bold transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-gray-300"
                   >
                     ZIP
                   </button>
                   <button
                     onClick={handleShareApp}
                     className={`flex-1 py-3 rounded font-bold transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-wider border bg-black/50 ${themeColors.border} ${themeColors.text}`}
                   >
                     Share
                   </button>
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
               <div className="bg-black/90 px-4 py-2 flex items-center justify-between border-b border-gray-800 flex-none z-20">
                 <div className="flex items-center gap-4">
                   <div className="flex bg-black border border-gray-800 rounded p-1 gap-1">
                     {(['desktop', 'tablet', 'mobile'] as const).map(d => (
                       <button 
                         key={d}
                         onClick={() => setDevice(d)}
                         className={`p-1.5 rounded transition-colors ${device === d ? themeColors.activeDevice : 'text-gray-600 hover:text-gray-300'}`}
                       >
                          {d === 'desktop' && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                          {d === 'tablet' && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                          {d === 'mobile' && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                       </button>
                     ))}
                   </div>
                 </div>

                 <div className="flex gap-2 relative">
                    <div ref={layoutDropdownRef} className="relative">
                      <button
                        onClick={() => setShowLayoutDropdown(!showLayoutDropdown)}
                        className="p-1.5 px-3 rounded text-xs font-bold transition-colors border border-gray-800 hover:border-gray-600 flex items-center gap-2 bg-black text-gray-400 hover:text-white"
                      >
                         Layout
                         <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${showLayoutDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                         </svg>
                      </button>

                      {showLayoutDropdown && (
                        <div className={`absolute right-0 top-full mt-2 w-48 bg-black rounded border ${themeColors.border} overflow-hidden animate-fade-in z-50 shadow-xl`}>
                          <button
                            onClick={() => { setLayoutMode('side'); setShowLayoutDropdown(false); }}
                            className={`w-full text-left px-4 py-3 text-xs font-mono hover:bg-white/10 ${layoutMode === 'side' ? themeColors.accent : 'text-gray-400'}`}
                          >
                             Split (Side)
                          </button>
                          <button
                            onClick={() => { setLayoutMode('bottom'); setShowLayoutDropdown(false); }}
                            className={`w-full text-left px-4 py-3 text-xs font-mono hover:bg-white/10 ${layoutMode === 'bottom' ? themeColors.accent : 'text-gray-400'}`}
                          >
                             Split (Vertical)
                          </button>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => setIsFullScreen(!isFullScreen)}
                      className={`p-1.5 px-3 rounded text-xs font-bold transition-colors border border-gray-800 hover:border-white hover:text-white text-gray-400 flex items-center gap-2 ${isFullScreen ? 'bg-red-900/30 border-red-500 text-red-500' : ''}`}
                    >
                      {isFullScreen ? 'Exit Full' : 'Full Screen'}
                    </button>
                 </div>
               </div>
               
               {/* Iframe Container */}
               <div className="flex-1 w-full h-full bg-[#111] flex items-center justify-center overflow-auto p-4 relative">
                 {isGenerating && (
                    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                        <div className={`animate-spin h-12 w-12 border-4 ${themeColors.loadingBorder} border-t-transparent rounded-full mb-4`}></div>
                        <p className={`font-mono text-xs uppercase tracking-[0.2em] animate-pulse ${themeColors.loadingText}`}>Constructing_Modules...</p>
                    </div>
                 )}
                 <iframe 
                   srcDoc={previewUrl}
                   title="App Preview" 
                   style={iframeStyles}
                   className="shadow-2xl"
                   sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
                 />
               </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-30 p-8 text-center text-gray-500">
              <div className={`w-24 h-24 border-2 border-dashed ${themeColors.inputBorder} rounded-xl flex items-center justify-center mb-6`}>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                 </svg>
              </div>
              <h3 className="text-xl font-bold font-mono uppercase tracking-widest">Awaiting Input</h3>
              <p className="max-w-md mt-2 text-xs font-mono">Define parameters on the left console to initiate build sequence.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaygroundOverlay;