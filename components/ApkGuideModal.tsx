import React from 'react';

interface ApkGuideModalProps { isOpen: boolean; onClose: () => void; isAdmin: boolean; }

const ApkGuideModal: React.FC<ApkGuideModalProps> = ({ isOpen, onClose, isAdmin }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-6 animate-fade-in">
      <div className="app-panel rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto relative shadow-panel-glow flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-[rgba(var(--color-panel-border-rgb),1)]">
          <h2 className="text-xl font-bold text-[var(--color-text-base)]">APK Conversion</h2>
          <button onClick={onClose} className="p-2 bg-[var(--color-input-bg)] rounded-full hover:opacity-80 text-[var(--color-text-muted)] border border-transparent hover:border-[rgba(var(--theme-primary-rgb),0.3)] hover:shadow-neon-sm transition-all duration-150 ease-in-out">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="p-6 rounded-2xl bg-[var(--color-input-bg)] border border-[rgba(var(--color-panel-border-rgb),0.5)]">
            <h3 className="font-bold text-lg mb-2 text-[var(--color-text-base)]">Method 1: PWABuilder (Recommended)</h3>
            <p className="text-sm opacity-70 mb-4 text-[var(--color-text-muted)]">Best for turning the web version into a store-ready APK.</p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-[var(--color-text-base)]">
              <li>Deploy this app (Vercel/Netlify).</li>
              <li>Visit <strong><a href="https://www.pwabuilder.com" target="_blank" rel="noopener noreferrer" className="text-[rgb(var(--theme-primary-rgb))] hover:underline">pwabuilder.com</a></strong>.</li>
              <li>Enter your URL and download the Android package.</li>
            </ol>
          </div>
          
          <div className="p-6 rounded-2xl bg-[var(--color-input-bg)] border border-[rgba(var(--color-panel-border-rgb),0.5)]">
            <h3 className="font-bold text-lg mb-2 text-[var(--color-text-base)]">Method 2: Admin Mode Export</h3>
            <p className="text-sm opacity-70 mb-4 text-[var(--color-text-muted)]">Generate raw Android Studio source code directly.</p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-[var(--color-text-base)]">
               <li>Enable Admin Mode {isAdmin ? '✅' : '😈'}.</li>
               <li>Type <code>/build android app for...</code></li>
               <li>Download the generated ZIP.</li>
               <li>Open in Android Studio and compile.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApkGuideModal;