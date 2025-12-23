import React, { useState } from 'react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin' || password === 'godmode' || password === 'root') {
        onSuccess();
        onClose();
        setPassword('');
    } else {
        setError(true);
        setTimeout(() => setError(false), 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
       <div className="w-full max-w-sm bg-gray-900 border border-red-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(255,0,0,0.1)]">
          <div className="text-center mb-6">
            <div className="inline-block p-3 rounded-full bg-red-500/10 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h2 className="text-red-500 font-bold text-xl tracking-widest uppercase">Restricted Access</h2>
            <p className="text-[10px] text-red-400/50 mt-1">AUTHORIZATION REQUIRED FOR ROOT ACCESS</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
             <input 
               type="password" 
               value={password}
               onChange={e => setPassword(e.target.value)}
               placeholder="ENTER ADMIN PASSWORD"
               className="w-full bg-black/50 border border-red-900/50 rounded-lg py-3 px-4 text-center text-red-100 placeholder-red-900/50 focus:outline-none focus:border-red-500 transition-colors"
               autoFocus
             />
             {error && <p className="text-red-500 text-xs text-center font-mono animate-pulse">INVALID CREDENTIALS</p>}
             
             <div className="flex gap-2 pt-2">
                 <button type="button" onClick={onClose} className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-lg text-xs font-bold uppercase hover:bg-gray-700 transition-colors">Cancel</button>
                 <button type="submit" className="flex-1 py-3 bg-red-900/20 text-red-500 border border-red-500/20 rounded-lg text-xs font-bold uppercase hover:bg-red-500 hover:text-white transition-all shadow-[0_0_10px_rgba(255,0,0,0.1)]">Unlock</button>
             </div>
          </form>
          <div className="mt-4 text-center">
             <span className="text-[10px] text-gray-600">Default: admin</span>
          </div>
       </div>
    </div>
  );
};

export default AdminLoginModal;