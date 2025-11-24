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
}

const AppPreviewModal: React.FC<AppPreviewModalProps> = ({ isOpen, onClose, files }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

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
        html = `<html><body style="background:#000;color:#0f0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h2>ERROR: INDEX_MISSING</h2></body></html>`;
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
    border: device === 'desktop' ? 'none' : '2px solid #333',
    borderRadius: device === 'desktop' ? '0' : '20px',
    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    backgroundColor: 'white',
    margin: '0 auto',
    boxShadow: device === 'desktop' ? 'none' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 sm:p-6 animate-fade-in">
       <div className="relative w-full h-full sm:max-w-[90vw] sm:max-h-[90vh] bg-black border border-primary-500/50 flex flex-col overflow-hidden shadow-glow-green rounded-3xl">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-black">
             <div className="flex items-center gap-4">
               <div className="w-10 h-10 border border-primary-500 bg-primary-900/20 flex items-center justify-center text-primary-500 font-bold rounded-xl">
                  EXE
               </div>
               <div className="hidden sm:block">
                 <h2 className="text-lg font-bold text-primary-500 uppercase tracking-widest">Live_Env</h2>
                 <p className="text-xs text-gray-500 font-sans">SANDBOX_ACTIVE</p>
               </div>
             </div>

             <div className="flex items-center gap-4">
                {/* Device Toggle */}
                <div className="flex bg-gray-900 border border-gray-700 p-1 gap-1 rounded-xl">
                   {(['desktop', 'tablet', 'mobile'] as const).map(d => (
                     <button 
                       key={d}
                       onClick={() => setDevice(d)}
                       className={`p-2 transition-all rounded-lg ${device === d ? 'bg-primary-900/30 text-primary-500' : 'text-gray-600 hover:text-gray-300'}`}
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
                  className="hidden sm:flex px-4 py-2 border border-gray-700 text-gray-400 hover:border-white hover:text-white font-bold text-xs uppercase tracking-wider transition-colors items-center gap-2 rounded-xl"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                   EXPAND
                </button>

                <button 
                  onClick={handleDownloadZip}
                  className="px-5 py-2 bg-primary-900/30 border border-primary-500 text-primary-500 hover:bg-primary-900/50 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 rounded-xl"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                   </svg>
                   SAVE
                </button>

                <button onClick={onClose} className="p-2 hover:bg-white/10 text-gray-500 transition-colors rounded-xl">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
             </div>
          </div>

          {/* Iframe Area */}
          <div className="flex-1 bg-black relative overflow-auto p-4 sm:p-8 flex items-center justify-center">
             {previewUrl ? (
                <iframe 
                  srcDoc={previewUrl}
                  title="App Preview"
                  style={iframeStyles}
                  sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
                />
             ) : (
                <div className="flex flex-col items-center justify-center opacity-50">
                   <div className="animate-spin h-10 w-10 border-4 border-primary-900 border-t-primary-500 mb-4 rounded-full"></div>
                   <p className="text-primary-500 font-sans text-xs uppercase">INITIALIZING_RUNTIME...</p>
                </div>
             )}
          </div>
       </div>
    </div>
  );
};

export default AppPreviewModal;