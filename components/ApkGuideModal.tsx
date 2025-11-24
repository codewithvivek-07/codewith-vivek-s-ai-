import React from 'react';

interface ApkGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

const ApkGuideModal: React.FC<ApkGuideModalProps> = ({ isOpen, onClose, isAdmin = false }) => {
  if (!isOpen) return null;

  const themeColors = {
      accent: isAdmin ? 'text-red-500' : 'text-primary-500',
      bg: 'bg-white/5',
      border: isAdmin ? 'border-red-500/30' : 'border-primary-500/30',
      iconBg: isAdmin ? 'bg-red-500/10' : 'bg-primary-500/10',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className={`bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl relative`}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-xl ${themeColors.iconBg} ${themeColors.accent}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Convert to Android App</h2>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-full hover:bg-white/10 transition-colors text-gray-500`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-8 space-y-8">
          <p className="text-gray-400 leading-relaxed text-sm">
            You can easily turn this website into a real Android APK that installs on your phone.
          </p>

          <div className="space-y-6">
            <div className={`p-6 rounded-2xl border ${themeColors.border} bg-black/20 relative group hover:bg-black/40 transition-colors`}>
              <h3 className={`text-lg font-bold mb-3 flex items-center gap-3 ${themeColors.accent}`}>
                <span className={`w-6 h-6 rounded-full border ${themeColors.border} flex items-center justify-center text-xs font-bold`}>1</span>
                Use PWABuilder (Recommended)
              </h3>
              <ol className="list-decimal list-inside space-y-3 text-sm text-gray-400 pl-2">
                <li>Deploy this project (e.g., via Vercel or Netlify).</li>
                <li>Go to <a href="https://www.pwabuilder.com" target="_blank" rel="noreferrer" className={`${themeColors.accent} hover:underline font-bold`}>PWABuilder.com</a>.</li>
                <li>Enter your live URL.</li>
                <li>Click <strong>Download Store Package</strong> -> <strong>Android</strong>.</li>
              </ol>
            </div>

            <div className={`p-6 rounded-2xl border border-gray-800 bg-black/20 relative group hover:border-gray-700 transition-colors`}>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-3 text-gray-300">
                 <span className="w-6 h-6 rounded-full border border-gray-600 flex items-center justify-center text-xs font-bold">2</span>
                Alternative Tools
              </h3>
              <p className="text-sm text-gray-500 mb-3">If you don't have a live URL, you can use these legacy tools:</p>
              <div className="flex gap-2 flex-wrap">
                <span className="px-3 py-1 bg-gray-800 rounded-lg text-xs text-gray-400 font-medium">AppsGeyser</span>
                <span className="px-3 py-1 bg-gray-800 rounded-lg text-xs text-gray-400 font-medium">Web2Apk</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className={`p-6 border-t border-gray-800 flex justify-end bg-gray-900 rounded-b-2xl`}>
          <button 
            onClick={onClose}
            className={`px-6 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-white/5 font-bold text-xs uppercase tracking-wider`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApkGuideModal;