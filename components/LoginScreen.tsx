import React, { useState, useEffect } from 'react';

interface LoginScreenProps {
  onLogin: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  
  useEffect(() => {
     const str = "SYSTEM LOCKED // AUTHENTICATION REQUIRED";
     let i = 0;
     const timer = setInterval(() => {
         if (i < str.length) {
             setText(prev => prev + str.charAt(i));
             i++;
         } else {
             clearInterval(timer);
         }
     }, 50);
     return () => clearInterval(timer);
  }, []);

  const handleLogin = (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setTimeout(() => {
        // Default password is 'admin' or 'xfire'
        if (password.toLowerCase() === 'admin' || password.toLowerCase() === 'xfire') {
            onLogin();
        } else {
            setError(true);
            setLoading(false);
            setPassword('');
        }
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white font-mono flex flex-col items-center justify-center p-4">
       <div className="max-w-md w-full space-y-8 animate-fade-in">
          <div className="text-center">
             <div className="w-24 h-24 mx-auto border-2 border-blue-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(0,122,255,0.5)] animate-pulse mb-6">
                <span className="text-5xl">🔥</span>
             </div>
             <h1 className="text-sm sm:text-lg font-bold tracking-[0.2em] text-blue-500 h-8 flex items-center justify-center">{text}</h1>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
             <div className="relative group">
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(false); }}
                  placeholder="ENTER ACCESS CODE"
                  className="w-full bg-black border-b-2 border-gray-800 focus:border-blue-500 outline-none py-3 text-center text-xl tracking-widest transition-colors group-hover:border-gray-600 placeholder-gray-800"
                  autoFocus
                />
             </div>
             
             {error && <div className="text-red-500 text-center text-xs tracking-widest animate-shake">ACCESS DENIED</div>}
             
             <button 
               type="submit" 
               disabled={loading}
               className={`w-full py-4 border border-blue-900 hover:bg-blue-900/20 text-blue-400 font-bold tracking-widest uppercase transition-all duration-300 ${loading ? 'opacity-50 cursor-wait' : 'hover:shadow-[0_0_20px_rgba(0,122,255,0.3)]'}`}
             >
               {loading ? 'DECRYPTING...' : 'INITIALIZE'}
             </button>
          </form>
          
          <div className="text-center text-[10px] text-gray-600 mt-8">
             DEFAULT ACCESS: admin
             <br/>
             SECURE CONNECTION v4.0.2
          </div>
       </div>
    </div>
  );
};

export default LoginScreen;