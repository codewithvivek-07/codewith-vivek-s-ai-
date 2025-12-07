import React from 'react';
import { SavedApp } from '../types';

interface SavedAppsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedApps: SavedApp[];
  onLoadApp: (app: SavedApp) => void;
  onDeleteApp: (id: string) => void;
  themeColors: any;
  isAdmin: boolean;
}

const SavedAppsModal: React.FC<SavedAppsModalProps> = ({
  isOpen,
  onClose,
  savedApps,
  onLoadApp,
  onDeleteApp,
  themeColors,
  isAdmin,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-6 animate-fade-in">
      <div className="app-panel rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto relative shadow-panel-glow flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-[rgba(var(--color-panel-border-rgb),1)]">
          <h2 className="text-xl font-bold text-[var(--color-text-base)]">Your Saved Apps</h2>
          <button onClick={onClose} className="p-2 bg-[var(--color-input-bg)] rounded-full hover:opacity-80 text-[var(--color-text-muted)] border border-transparent hover:border-[rgba(var(--theme-primary-rgb),0.3)] hover:shadow-neon-sm transition-all duration-150 ease-in-out">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>
        
        <div className="p-8 space-y-4 flex-1 overflow-y-auto">
          {savedApps.length === 0 ? (
            <div className="text-center py-12 opacity-50 text-[var(--color-text-muted)]">
              No apps saved yet. Generate an app in the Playground and click "Save App"!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedApps.map(app => (
                <div key={app.id} className="p-4 rounded-2xl bg-[var(--color-input-bg)] border border-[rgba(var(--color-panel-border-rgb),0.5)] flex flex-col justify-between group">
                  <div>
                    <h3 className="font-bold text-lg mb-1 text-[var(--color-text-base)]">{app.title}</h3>
                    <p className="text-xs opacity-70 text-[var(--color-text-muted)]">Saved: {new Date(app.timestamp).toLocaleDateString()} {new Date(app.timestamp).toLocaleTimeString()}</p>
                    <p className="text-xs opacity-70 text-[var(--color-text-muted)] mt-2">Files: {Object.keys(app.files).join(', ')}</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={() => onLoadApp(app)} 
                      className={`flex-1 py-2 rounded-xl font-bold text-sm ${themeColors.button}`}
                    >
                      Load
                    </button>
                    <button 
                      onClick={() => onDeleteApp(app.id)} 
                      className="flex-1 py-2 rounded-xl font-bold text-sm text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SavedAppsModal;