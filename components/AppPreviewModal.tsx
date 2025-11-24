import React, { useState, useEffect } from 'react';

declare global {
  interface Window {
    JSZip: any;
  }
}

interface AppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: Record<string, string> | null;
  isAdmin?: boolean;
}

const AppPreviewModal: React.FC<AppPreviewModalProps> = ({ isOpen, onClose, files, isAdmin = false }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const themeColors = {
    border: isAdmin ? 'border-neon-red' : 'border-neon-cyan',
    shadow: isAdmin ? 'shadow-neon-red' : 'shadow-neon-cyan',
    bgIcon: isAdmin ? 'bg-red-900/20' : 'bg-cyan-900/20',
    borderIcon: isAdmin ? 'border-red-500' : 'border-cyan-500',
    textIcon: isAdmin ? 'text-neon-red' : 'text-neon-cyan',
    textTitle: isAdmin ? 'text-neon-red' : 'text-neon-cyan',
    buttonBg: isAdmin ? 'bg-red-900/30' : 'bg-cyan-900/30',
    buttonBorder: isAdmin ? 'border-red-500' : 'border-cyan-500',
    buttonText: isAdmin ? 'text-neon-red' : 'text-neon-cyan',
    buttonHover: isAdmin ? 'hover:bg-red-900/50' : 'hover:bg-cyan-900/50',
    activeDevice: isAdmin ? 'bg-red-900/50 text-white shadow-neon-red' : 'bg-cyan-900/50 text-white shadow-neon-cyan',
    loadingBorder: isAdmin ? 'border-red-900 border-t-red-500' : 'border-cyan-900 border-t-cyan-500',
    loadingText: isAdmin ? 'text-neon-red' : 'text-neon-cyan'
  };

  useEffect(() => {
    if (isOpen && files) {
      createPreview(files);
    } else {
      setPreviewUrl(null);
    }
  }, [isOpen, files]);

  const createPreview = (files: Record<string, string>) => {
    const indexKey = Object.keys(files).find(k => k.toLowerCase() === 'index.html' || k.toLowerCase() === 'index.htm' || k.toLowerCase() === 'main.html') 
                  || Object.keys(files).find(k => k.endsWith('.html'));
    
    let html = indexKey ? files[indexKey] : '';
    
    if (!html) {
        html = `<html><body style="background:#050510;color:${isAdmin ? '#ff003c' : '#00f3ff'};display:flex;align-items:center;justify-content:center;height:100vh;font-family:monospace;text-transform:uppercase;"><h2>ERROR: ENTRY_POINT_MISSING</h2></body></html>`;
    }

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
        if (filename === indexKey) return;
        if (filename.endsWith('.css')) injectResource('style', filename, content);
        if (filename.endsWith('.js')) injectResource('script', filename, content);
    });

    setPreviewUrl(html);
  };

  const handleOpenNewTab = () => {
    if (!previewUrl) return;
    const blob = new Blob([previewUrl], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleDownloadZip = async () => {
    if (!files || !window.JSZip) return;
    const zip = new window.JSZip();
    Object.entries(files).forEach(([filename, content]) => {
      zip.file(filename, content);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "project_bundle.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const iframeStyles = {
    width: device === 'desktop' ? '100%' : device === 'tablet' ? '768px' : '375px',
    height: device === 'desktop' ? '100%' : device === 'tablet' ? '1024px' : '667px',
    border: device === 'desktop' ? 'none' : '4px solid #333',
    borderRadius: device === 'desktop' ? '0' : '20px',
    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    backgroundColor: 'white',
    margin: '0 auto',
    boxShadow: device === 'desktop' ? 'none' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-6 animate-fade-in">
       <div className={`relative w-full h-full sm:max-w-[95vw] sm:max-h-[95vh] bg-black border ${themeColors.border} flex flex-col overflow-hidden ${themeColors.shadow} rounded-xl`}>
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
             <div className="flex items-center gap-4">
               <div className={`w-10 h-10 border ${themeColors.borderIcon} ${themeColors.bgIcon} flex items-center justify-center ${themeColors.textIcon} font-bold rounded shadow-inner`}>
                  APP
               </div>
               <div className="hidden sm:block">
                 <h2 className={`text-lg font-bold ${themeColors.textTitle} uppercase tracking-[0.2em]`}>Live_Environment</h2>
                 <p className="text-[10px] text-gray-500 font-mono uppercase">Status: ACTIVE_SANDBOX</p>
               </div>
             </div>

             <div className="flex items-center gap-4">
                {/* Device Toggle */}
                <div className="flex bg-black border border-gray-800 p-1 gap-1 rounded">
                   {(['desktop', 'tablet', 'mobile'] as const).map(d => (
                     <button 
                       key={d}
                       onClick={() => setDevice(d)}
                       className={`p-2 transition-all rounded ${device === d ? themeColors.activeDevice : 'text-gray-600 hover:text-gray-300'}`}
                       title={d}
                     >
                       {d === 'desktop' && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                       {d === 'tablet' && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                       {d === 'mobile' && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                     </button>
                   ))}
                </div>

                <button 
                  onClick={handleOpenNewTab}
                  className="hidden sm:flex px-4 py-2 border border-gray-700 text-gray-400 hover:border-white hover:text-white font-bold text-xs uppercase tracking-wider transition-colors items-center gap-2 rounded"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                   EXPAND
                </button>

                <button 
                  onClick={handleDownloadZip}
                  className={`px-5 py-2 ${themeColors.buttonBg} ${themeColors.buttonBorder} border ${themeColors.buttonText} ${themeColors.buttonHover} font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 rounded shadow-lg`}
                >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                   </svg>
                   SAVE
                </button>

                <button onClick={onClose} className="p-2 hover:bg-white/10 text-gray-500 transition-colors rounded">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
             </div>
          </div>

          {/* Iframe Area */}
          <div className="flex-1 bg-black/80 relative overflow-auto p-4 sm:p-8 flex items-center justify-center">
             {previewUrl ? (
                <iframe 
                  srcDoc={previewUrl}
                  title="App Preview"
                  style={iframeStyles}
                  sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
                />
             ) : (
                <div className="flex flex-col items-center justify-center opacity-50">
                   <div className={`animate-spin h-12 w-12 border-4 ${themeColors.loadingBorder} mb-4 rounded-full`}></div>
                   <p className={`${themeColors.loadingText} font-mono text-xs uppercase tracking-[0.2em] animate-pulse`}>INITIALIZING_RUNTIME...</p>
                </div>
             )}
          </div>
       </div>
    </div>
  );
};

export default AppPreviewModal;