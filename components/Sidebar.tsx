import React, { useState } from 'react';
import { ChatSession } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  isAdmin: boolean;
  themeColors: any;
  onResetApp: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  isOpen,
  toggleSidebar,
  isAdmin,
  themeColors,
  onResetApp
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.messages.some(m => m.text.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/30 z-30 md:hidden backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={toggleSidebar}
      />

      <aside 
        className={`fixed md:relative z-40 h-full transform transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] flex flex-col glass-panel border-r border-[var(--color-border-glass)] rounded-2xl md:rounded-r-none
          ${isOpen ? 'translate-x-0 w-80' : '-translate-x-full md:translate-x-0 w-80 md:w-0 overflow-hidden'}`}
      >
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center md:hidden mb-2">
            <span className="font-bold text-xl tracking-tight">Chats</span>
            <button onClick={toggleSidebar} className="p-2 bg-[var(--color-input-bg)] rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <button onClick={onNewChat} className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm shadow-ios transition-all flex items-center justify-center gap-2 ${themeColors.button}`}>
            <span className="text-xl leading-none font-light">+</span> New Chat
          </button>
          
          <div className="relative">
             <input type="text" placeholder="Search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
               className={`w-full pl-10 pr-4 py-2.5 bg-[var(--color-input-bg)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--theme-primary-rgb))] transition-all placeholder-[var(--color-text-muted)]`} />
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-3 opacity-50 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
          {filteredSessions.length === 0 && (
            <div className="text-center py-12 opacity-40 text-sm text-[var(--color-text-muted)]">No conversations found</div>
          )}
          
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`group relative flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all duration-200 border ${
                currentSessionId === session.id 
                  ? `bg-[rgb(var(--theme-primary-rgb),0.1)] border-[rgb(var(--theme-primary-rgb),0.2)]` 
                  : `border-transparent hover:bg-[var(--color-input-bg)]`
              }`}
            >
              <div className="flex flex-col truncate pr-6 w-full">
                <span className={`truncate text-sm font-medium ${currentSessionId === session.id ? themeColors.accent : ''}`}>
                  {session.title}
                </span>
                <span className="text-[10px] opacity-40 mt-0.5 text-[var(--color-text-muted)]">{new Date(session.timestamp).toLocaleDateString()}</span>
              </div>
              
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                className="absolute right-2 p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-[var(--color-border-glass)]">
           <button onClick={onResetApp} className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-red-500 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 transition-colors`}>
             Reset App
           </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;