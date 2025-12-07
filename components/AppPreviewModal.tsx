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

  useEffect(() => {
    if (isOpen && files) {
      createPreview(files);
    } else {
      setPreviewUrl(null);
    }
  }, [isOpen, files]);

  const createPreview = (files: Record<string, string>) => {
    const isAndroidProject = Object.keys(files).some(key => key.includes('AndroidManifest.xml') || key.includes('.java') || key.includes('.kt'));

    if (isAndroidProject) {
      setPreviewUrl(null); // No direct preview for native projects
      return;
    }

    const indexKey = Object.keys(files).find(k => k.toLowerCase() === 'index.html' || k.toLowerCase() === 'index.htm' || k.toLowerCase() === 'main.html') 
                  || Object.keys(files).find(k => k.endsWith('.html'));
    
    let html = indexKey ? files[indexKey] : '';
    
    if (!html) {
        html = `<html><body style="background:var(--bg-body);color:rgb(${isAdmin ? 'var(--theme-admin-rgb)' : 'var(--theme-primary-rgb)'});display:flex;align-items:center;justify-content:center;height:100vh;font-family:var(--font-sans);text-transform:uppercase;"><h2>ERROR: ENTRY_POINT_MISSING</h2></body></html>`;
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
    const isAndroidProject = Object.keys(files).some(key => key.includes('AndroidManifest.xml') || key.includes('.java') || key.includes('.kt'));
    a.download = isAndroidProject ? "android_project_source.zip" : "web_app_project.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const isAndroidProject = files && Object.keys(files).some(key => key.includes('AndroidManifest.xml') || key.includes('.java') || key.includes('.kt'));
  
  const primaryColorRgb = isAdmin ? 'var(--theme-admin-rgb)' : 'var(--theme-primary-rgb)';
  const panelBorderRgb = 'var(--color-panel-border-rgb)';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-6 animate-fade-in">
       <div className={`relative w-full h-full sm:max-w-[95vw] sm:max-h-[95vh] bg-[var(--bg-body)] app-panel flex flex-col overflow-hidden rounded-3xl shadow-panel-glow`}>
          
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[rgba(var(--color-panel-border-rgb),1)] app-panel">
             <div className="flex items-center gap-4">
               <div className={`w-10 h-10 border border-[rgba(${primaryColorRgb},0.2)] bg-[rgba(${primaryColorRgb},0.1)] flex items-center justify-center text-[rgb(${primaryColorRgb})] font-bold rounded shadow-neon-sm`}>
                  {isAndroidProject ? 'APK' : 'WEB'}
               </div>
               <div className="hidden sm:block">
                 <h2 className={`text-lg font-bold text-[rgb(${primaryColorRgb})] uppercase tracking-[0.2em]`}>Live_Environment</h2>
                 <p className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase">Status: ACTIVE_SANDBOX</p>
               </div>
             </div>

             <div className="flex items-center gap-2">

                <button 
                  onClick={handleOpenNewTab}
                  className={`p-2 bg-[var(--color-input-bg)] border border-[rgba(${panelBorderRgb},0.5)] text-[var(--color-text-muted)] hover:border-[rgba(${primaryColorRgb},0.3)] hover:text-[var(--color-text-base)] hover:shadow-neon-sm transition-all duration-150 ease-in-out flex items-center justify-center rounded-full`}
                  title="Open in New Tab"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </button>

                <button 
                  onClick={handleDownloadZip}
                  className={`p-2 bg-gradient-to-br from-[rgb(var(--theme-button-gradient-start-rgb))] to-[rgb(var(--theme-button-gradient-end-rgb))] border border-[rgb(${primaryColorRgb})] text-white hover:shadow-neon transition-all duration-150 ease-in-out flex items-center justify-center rounded-full shadow-neon-sm`}
                  title="Save Project (ZIP)"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                   </svg>
                </button>

                <button onClick={onClose} className="p-2 hover:bg-[var(--color-input-bg)] text-[var(--color-text-muted)] transition-colors rounded-full border border-transparent hover:border-[rgba(var(--theme-primary-rgb),0.3)] hover:shadow-neon-sm duration-150 ease-in-out">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
             </div>
          </div>

          {/* Iframe Area */}
          <div className="flex-1 bg-[var(--bg-body)] relative overflow-auto p-4 sm:p-8 flex items-center justify-center">
             {previewUrl ? (
                <iframe 
                  srcDoc={previewUrl}
                  title="App Preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    border: `4px solid rgb(${primaryColorRgb})`,
                    borderRadius: '20px',
                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    backgroundColor: 'white',
                    margin: '0 auto',
                    boxShadow: `0 25px 50px -12px rgba(${primaryColorRgb}, 0.5)`
                  }}
                  sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
                />
             ) : (
                <div className="flex flex-col items-center justify-center opacity-50">
                   <div className={`animate-spin h-12 w-12 border-4 border-[rgba(${primaryColorRgb},0.5)] border-t-[rgb(${primaryColorRgb})] mb-4 rounded-full`}></div>
                   <p className={`text-[rgb(${primaryColorRgb})] font-mono text-xs uppercase tracking-[0.2em] animate-pulse`}>
                     {isAndroidProject ? 'ANDROID_PROJECT_NO_RUNTIME' : 'INITIALIZING_RUNTIME...'}
                   </p>
                   {isAndroidProject && (
                     <p className="mt-4 text-[10px] text-[var(--color-text-muted)] text-center max-w-sm">
                       Native Android projects cannot be previewed directly in browser. Download the source ZIP and compile with Android Studio.
                     </p>
                   )}
                </div>
             )}
          </div>
       </div>
    </div>
  );
};

export default AppPreviewModal;