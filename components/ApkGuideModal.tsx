import React from 'react';

interface ApkGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

const ApkGuideModal: React.FC<ApkGuideModalProps> = ({ isOpen, onClose, isAdmin = false }) => {
  if (!isOpen) return null;

  const themeColors = {
      accent: isAdmin ? 'text-neon-red' : 'text-neon-cyan',
      border: isAdmin ? 'border-red-500' : 'border-cyan-500',
      shadow: isAdmin ? 'shadow-neon-red' : 'shadow-neon-cyan',
      iconBg: isAdmin ? 'bg-red-500/20' : 'bg-cyan-500/20',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
      <div className={`bg-black border ${themeColors.border} rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto ${themeColors.shadow} relative`}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded ${themeColors.iconBg} ${themeColors.accent} border border-current`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className={`text-xl font-bold uppercase tracking-[0.2em] text-white`}>Native_Conversion_Protocol</h2>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 hover:bg-white/10 transition-colors text-gray-500 rounded`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-8 space-y-8">
          <p className="text-gray-400 leading-relaxed text-sm font-mono border-l-2 border-gray-700 pl-4">
             INITIATING PROTOCOL: TRANSFORMATION OF WEB ASSETS TO ANDROID PACKAGE KIT (APK).
          </p>

          <div className="space-y-6">
            <div className={`p-6 rounded border border-gray-800 bg-[#0a0a10] relative group hover:border-gray-600 transition-all`}>
              <h3 className={`text-lg font-bold mb-4 flex items-center gap-3 ${themeColors.accent} uppercase tracking-wider`}>
                <span className={`w-8 h-8 rounded border border-current flex items-center justify-center text-sm font-bold shadow-inner`}>01</span>
                PWABuilder (Optimal)
              </h3>
              <ol className="list-decimal list-inside space-y-3 text-sm text-gray-400 pl-2 font-mono">
                <li>Deploy project via Vercel/Netlify.</li>
                <li>Navigate to <a href="https://www.pwabuilder.com" target="_blank" rel="noreferrer" className={`${themeColors.accent} hover:underline font-bold`}>PWABuilder.com</a>.</li>
                <li>Input Live URL.</li>
                <li>Select <strong>Build</strong> -> <strong>Android</strong>.</li>
              </ol>
            </div>

            <div className={`p-6 rounded border border-gray-800 bg-[#0a0a10] relative group hover:border-gray-600 transition-all`}>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-3 text-gray-300 uppercase tracking-wider">
                 <span className="w-8 h-8 rounded border border-gray-600 flex items-center justify-center text-sm font-bold">02</span>
                Legacy Methods
              </h3>
              <p className="text-sm text-gray-500 mb-4 font-mono">Alternative compilation vectors available:</p>
              <div className="flex gap-2 flex-wrap">
                <span className="px-3 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-gray-400 font-mono uppercase">AppsGeyser</span>
                <span className="px-3 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-gray-400 font-mono uppercase">Web2Apk</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className={`p-6 border-t border-white/10 flex justify-end bg-white/5`}>
          <button 
            onClick={onClose}
            className={`px-8 py-3 rounded border border-gray-600 text-gray-300 hover:bg-white/10 font-bold text-xs uppercase tracking-widest transition-all hover:border-white`}
          >
            Terminate
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApkGuideModal;