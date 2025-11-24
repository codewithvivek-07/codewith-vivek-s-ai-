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
     bg: 'bg-black',
     border: 'border-gray-800',
     text: isAdmin ? 'text-red-500' : 'text-primary-500',
     activeItem: isAdmin 
        ? 'bg-red-500/10 text-red-500 border-red-500/20' 
        : 'bg-primary-500/10 text-primary-400 border-primary-500/20',
     hoverItem: 'hover:bg-gray-800/50 hover:text-gray-200',
     button: isAdmin 
        ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/30' 
        : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700',
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={toggleSidebar}
      />

      {/* Sidebar Container */}
      <aside 
        className={`fixed md:relative z-40 h-full transform transition-all duration-300 ease-in-out flex flex-col ${themeColors.bg} border-r ${themeColors.border}
          ${isOpen ? 'translate-x-0 w-80' : '-translate-x-full md:translate-x-0 w-80 md:w-0 overflow-hidden'}`}
      >
        <div className="p-4 space-y-4 min-w-[20rem]">
          <div className="flex justify-between items-center md:hidden">
            <span className={`font-bold text-lg text-white`}>History</span>
            <button onClick={toggleSidebar} className="p-2 hover:bg-white/10 rounded-lg text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <button
            onClick={onNewChat}
            className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm border transition-all shadow-sm ${themeColors.button}`}
          >
            <span className="text-lg leading-none">+</span>
            New Chat
          </button>
          
          <div className="relative">
             <input 
               type="text" 
               placeholder="Search conversations..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className={`w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-xl focus:ring-1 ${isAdmin ? 'focus:ring-red-500/50' : 'focus:ring-primary-500/50'} focus:border-transparent transition-all text-sm outline-none text-gray-300 placeholder-gray-600`}
             />
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 min-w-[20rem]">
          {filteredSessions.length === 0 && (
            <div className="text-center py-10 opacity-40">
              <p className="text-sm text-gray-500">No conversations found</p>
            </div>
          )}
          
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`group relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                currentSessionId === session.id 
                  ? themeColors.activeItem 
                  : `border-transparent text-gray-500 ${themeColors.hoverItem}`
              }`}
            >
              <div className="flex flex-col truncate pr-8 w-full">
                <span className={`truncate text-sm font-medium ${currentSessionId === session.id ? (isAdmin ? 'text-red-400' : 'text-white') : 'text-gray-400 group-hover:text-gray-200'}`}>
                  {session.title}
                </span>
                <span className="text-[10px] opacity-50 mt-0.5">
                  {new Date(session.timestamp).toLocaleDateString()}
                </span>
              </div>
              
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                    currentSessionId === session.id 
                    ? 'text-gray-400 hover:text-red-400 hover:bg-black/20' 
                    : 'text-gray-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-white/5'
                }`}
                title="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;