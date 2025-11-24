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
}

const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  isOpen,
  toggleSidebar,
  isAdmin
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.messages.some(m => m.text.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const themeColors = {
     text: isAdmin ? 'text-neon-red' : 'text-neon-cyan',
     activeItem: isAdmin 
        ? 'bg-red-900/20 text-white border-red-500 shadow-neon-red' 
        : 'bg-cyan-900/20 text-white border-cyan-500 shadow-neon-cyan',
     hoverItem: 'hover:bg-white/5 hover:text-white',
     button: isAdmin 
        ? 'bg-red-600 hover:bg-red-500 text-white shadow-neon-red' 
        : 'bg-primary-600 hover:bg-primary-500 text-white shadow-neon-cyan',
     border: isAdmin ? 'border-red-500/30' : 'border-cyan-500/30'
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black/80 z-30 md:hidden backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={toggleSidebar}
      />

      {/* Sidebar Container */}
      <aside 
        className={`fixed md:relative z-40 h-full transform transition-all duration-300 ease-in-out flex flex-col bg-[#0a0a1a] border-r border-white/10
          ${isOpen ? 'translate-x-0 w-80' : '-translate-x-full md:translate-x-0 w-80 md:w-0 overflow-hidden'}`}
      >
        <div className="p-4 space-y-4 min-w-[20rem]">
          <div className="flex justify-between items-center md:hidden">
            <span className={`font-bold text-lg text-white font-mono uppercase`}>Logs</span>
            <button onClick={toggleSidebar} className="p-2 hover:bg-white/10 rounded text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <button
            onClick={onNewChat}
            className={`w-full py-3 px-4 rounded font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all btn-3d ${themeColors.button}`}
          >
            <span className="text-lg leading-none">+</span>
            Init_Sequence
          </button>
          
          <div className="relative">
             <input 
               type="text" 
               placeholder="SEARCH_LOGS..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className={`w-full pl-9 pr-4 py-2 bg-black border border-gray-800 rounded focus:ring-1 focus:border-transparent transition-all text-xs outline-none text-gray-300 placeholder-gray-700 font-mono ${isAdmin ? 'focus:ring-neon-red' : 'focus:ring-neon-cyan'}`}
             />
             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 absolute left-3 top-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 min-w-[20rem] scrollbar-thin">
          <div className="px-2 pb-2 text-[10px] font-bold text-gray-600 uppercase tracking-widest">Recent Activity</div>
          
          {filteredSessions.length === 0 && (
            <div className="text-center py-10 opacity-30">
              <p className="text-xs text-gray-500 font-mono">NO_DATA_FOUND</p>
            </div>
          )}
          
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`group relative flex items-center justify-between p-3 rounded cursor-pointer transition-all duration-200 border-l-2 ${
                currentSessionId === session.id 
                  ? themeColors.activeItem 
                  : `border-transparent text-gray-500 ${themeColors.hoverItem}`
              }`}
            >
              <div className="flex flex-col truncate pr-6 w-full">
                <span className={`truncate text-xs font-bold font-mono tracking-wide ${currentSessionId === session.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                  {session.title}
                </span>
                <span className="text-[9px] opacity-50 mt-0.5 font-mono">
                  {new Date(session.timestamp).toLocaleDateString()}
                </span>
              </div>
              
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-red-900/50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 text-gray-600`}
                title="Purge"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        
        {/* Sidebar Footer Decor */}
        <div className="p-4 border-t border-white/5 bg-black/50 text-[10px] text-gray-600 font-mono text-center uppercase">
           V3.0.1 // STABLE
        </div>
      </aside>
    </>
  );
};

export default Sidebar;