import React, { useState, useRef, useEffect } from 'react';
import { streamGeminiResponse, generateImage, generateDocument, generateAppCode } from './services/geminiService';
import { Message, Role, GroundingSource, ChatSession, AppSettings } from './types';
import MarkdownRenderer from './components/MarkdownRenderer';
import ApkGuideModal from './components/ApkGuideModal';
import AppPreviewModal from './components/AppPreviewModal';
import Sidebar from './components/Sidebar';

declare global {
  interface Window {
    jspdf: any;
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
    JSZip: any;
  }
}

const SESSIONS_KEY = 'omniglance_sessions_v3';
const NAME_STORAGE_KEY = 'omniglance_ai_name_v2';
const SETTINGS_KEY = 'omniglance_settings_v3';
const ADMIN_CODE = '000000';

// Expanded Prompt Pool
const MASTER_PROMPTS = [
  { title: "QUANTUM_DATA", prompt: "Explain quantum computing in simple terms:" },
  { title: "STORY_PROTOCOL", prompt: "Write a short sci-fi story about a robot who loves gardening:" },
  { title: "PYTHON_SCRIPT", prompt: "Write a Python script to sort a list of dictionaries by a key:" },
  { title: "COMMS_DRAFT", prompt: "Draft a professional email to reschedule a meeting:" },
  { title: "LEARNING_MATRIX", prompt: "Create a 1-week study plan for learning React basics:" },
  { title: "BIO_FUEL", prompt: "Give me a healthy recipe using chicken and spinach:" },
];

export default function App() {
  // --- STATE ---
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showPromptMenu, setShowPromptMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // App Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<Record<string, string> | null>(null);

  // Prompt Management
  const [visiblePrompts, setVisiblePrompts] = useState(MASTER_PROMPTS.slice(0, 6));

  // Advanced Features
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [adminInputCode, setAdminInputCode] = useState('');
  const [isIncognito, setIsIncognito] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // Track TTS state

  // Settings
  const [settings, setSettings] = useState<AppSettings>({
    customPersona: "You are a helpful, smart assistant.",
    voiceEnabled: true,
    autoRead: false,
    theme: 'dark'
  });
  
  // Attachments
  const [attachment, setAttachment] = useState<{data: string, mimeType: string} | null>(null);
  const [fileContext, setFileContext] = useState<{content: string, name: string} | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandMenuRef = useRef<HTMLDivElement>(null);
  const promptMenuRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLElement>(null);
  const recognitionRef = useRef<any>(null);

  const [aiName, setAiName] = useState("codewith-vivek's ai");
  const [isNaming, setIsNaming] = useState(false);
  const [tempNameInput, setTempNameInput] = useState('');

  // --- INITIALIZATION ---

  useEffect(() => {
    // Theme Initialization
    document.documentElement.classList.add('dark'); // Force dark mode

    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }

    shufflePrompts();

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
       const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
       recognitionRef.current = new SpeechRecognition();
       recognitionRef.current.continuous = false;
       recognitionRef.current.interimResults = false;
       recognitionRef.current.lang = 'en-US';

       recognitionRef.current.onresult = (event: any) => {
         const transcript = event.results[0][0].transcript;
         setInput(prev => prev + (prev ? ' ' : '') + transcript);
         setIsRecording(false);
       };

       recognitionRef.current.onerror = () => setIsRecording(false);
       recognitionRef.current.onend = () => setIsRecording(false);
    }

    const storedName = localStorage.getItem(NAME_STORAGE_KEY);
    if (storedName) setAiName(storedName);
    
    const storedSettings = localStorage.getItem(SETTINGS_KEY);
    if (storedSettings) {
      const parsed = JSON.parse(storedSettings);
      setSettings(parsed);
    }

    try {
      const storedSessions = localStorage.getItem(SESSIONS_KEY);
      if (storedSessions) {
        const parsed: ChatSession[] = JSON.parse(storedSessions);
        setSessions(parsed);
        if (parsed.length > 0) {
          const last = parsed[0];
          setCurrentSessionId(last.id);
          setMessages(last.messages);
        } else {
          startNewChat(storedName || "codewith-vivek's ai");
        }
      } else {
        startNewChat(storedName || "codewith-vivek's ai");
      }
    } catch (e) {
      console.warn("Failed to load sessions", e);
      startNewChat(storedName || "codewith-vivek's ai");
    }

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (commandMenuRef.current && !commandMenuRef.current.contains(event.target as Node)) {
        setShowCommandMenu(false);
      }
      if (promptMenuRef.current && !promptMenuRef.current.contains(event.target as Node)) {
        setShowPromptMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isIncognito && sessions.length > 0) {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    }
  }, [sessions, isIncognito]);

  useEffect(() => {
    if (currentSessionId && messages.length > 0 && !isIncognito) {
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, messages: messages, title: s.title === 'New Chat' && messages.length > 1 ? generateTitle(messages[0].text) : s.title } 
          : s
      ));
    }
  }, [messages, currentSessionId, isIncognito]);

  const generateTitle = (text: string) => {
    if (!text) return "New Conversation";
    return text.length > 30 ? text.substring(0, 30) + '...' : text;
  };

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isAtBottom);
    }
  };

  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, shouldAutoScroll]);

  const shufflePrompts = () => {
    const shuffled = [...MASTER_PROMPTS].sort(() => 0.5 - Math.random());
    setVisiblePrompts(shuffled.slice(0, 6));
  };

  // --- ACTIONS ---

  const startNewChat = (nameOverride?: string) => {
    const newId = Date.now().toString();
    const welcomeMsg: Message = {
      id: 'boot',
      role: Role.MODEL,
      text: `SYSTEM ONLINE. I am ${nameOverride || aiName}. Awaiting directives.`,
      timestamp: Date.now()
    };
    
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat',
      messages: [welcomeMsg],
      timestamp: Date.now()
    };

    if (!isIncognito) {
      setSessions(prev => [newSession, ...prev]);
    }
    setCurrentSessionId(newId);
    setMessages([welcomeMsg]);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
    setShouldAutoScroll(true);
  };

  const deleteSession = (id: string) => {
    if (confirm("PURGE SESSION DATA? This action is irreversible.")) {
      const newSessions = sessions.filter(s => s.id !== id);
      setSessions(newSessions);
      if (currentSessionId === id) {
        if (newSessions.length > 0) {
          setCurrentSessionId(newSessions[0].id);
          setMessages(newSessions[0].messages);
        } else {
          startNewChat();
        }
      }
    }
  };

  const selectSession = (id: string) => {
    const sess = sessions.find(s => s.id === id);
    if (sess) {
      setCurrentSessionId(id);
      setMessages(sess.messages);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
      setShouldAutoScroll(true);
    }
  };

  const toggleAdmin = () => {
    if (isAdmin) {
      setIsAdmin(false);
      setAdminInputCode('');
    } else {
      setShowAdminInput(true);
    }
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminInputCode === ADMIN_CODE) {
      setIsAdmin(true);
      setShowAdminInput(false);
      setAdminInputCode('');
    } else {
      alert("ACCESS DENIED");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        setAttachment({
          data: base64Data,
          mimeType: file.type
        });
        setFileContext(null);
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setFileContext({
          content: text,
          name: file.name
        });
        setAttachment(null);
      };
      reader.readAsText(file);
    }
  };

  // --- VOICE ---
  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // --- APP HANDLING ---
  
  // Helper to identify if the generated content is a web app
  const isWebApp = (files: Record<string, string>) => {
    return Object.keys(files).some(k => 
      k.toLowerCase() === 'index.html' || 
      k.toLowerCase() === 'index.htm' || 
      k.toLowerCase() === 'main.html' || 
      k.endsWith('.html')
    );
  };

  const handlePreviewApp = (files: Record<string, string>) => {
    setPreviewFiles(files);
    setIsPreviewOpen(true);
  };

  const handleOpenInNewTab = (files: Record<string, string>) => {
    const indexKey = Object.keys(files).find(k => k.toLowerCase() === 'index.html' || k.toLowerCase() === 'index.htm') || Object.keys(files).find(k => k.endsWith('.html'));
    if (!indexKey) { alert("ERROR: index.html missing"); return; }

    let html = files[indexKey];
    
    // Inject CSS/JS logic
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

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleDownloadZip = async (files: Record<string, string>) => {
    if (!window.JSZip) return;
    const zip = new window.JSZip();
    Object.entries(files).forEach(([filename, content]) => {
      zip.file(filename, content);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isWebApp(files) ? "web_app.zip" : "android_project_source.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleEditText = (text: string) => {
    setInput(text);
    if(fileInputRef.current) fileInputRef.current.focus();
  };

  // --- SEND LOGIC ---
  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride !== undefined ? textOverride : input;
    
    if ((!textToSend.trim() && !attachment && !fileContext) || isLoading) return;

    const userText = textToSend.trim();
    const currentAttachment = attachment;
    const currentFileContext = fileContext;
    
    // Only clear input if we are not regenerating from an override
    if (!textOverride) {
        setInput('');
        setAttachment(null);
        setFileContext(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
    
    setShouldAutoScroll(true);
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: userText,
      attachment: currentAttachment?.data,
      attachmentMimeType: currentAttachment?.mimeType,
      fileContent: currentFileContext?.content,
      fileName: currentFileContext?.name,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
        if (userText.toLowerCase().startsWith('/build') || userText.toLowerCase().startsWith('/app')) {
          const prompt = userText.replace(/^\/?(build|app)\s*/i, '');
          if (!prompt) { setIsLoading(false); return; }

          const aiMsgId = (Date.now() + 1).toString();
          setMessages(prev => [...prev, {
            id: aiMsgId,
            role: Role.MODEL,
            text: `INITIATING BUILD SEQUENCE: "${prompt}"...`,
            isStreaming: true,
            timestamp: Date.now()
          }]);
          
          try {
            const files = await generateAppCode(prompt, isAdmin);
            setMessages(prev => prev.map(msg => 
              msg.id === aiMsgId ? { 
                ...msg, 
                text: `BUILD COMPLETE. ARTIFACTS READY.`, 
                appContent: files,
                isStreaming: false 
              } : msg
            ));
          } catch (err: any) {
            setMessages(prev => prev.map(msg => 
              msg.id === aiMsgId ? { ...msg, text: `BUILD FAILED: ${err.message}`, isStreaming: false } : msg
            ));
          }
          setIsLoading(false);
          return;
        }

        if (userText.toLowerCase().startsWith('/make')) {
          const parts = userText.split(' ');
          const format = parts[1] ? parts[1].toLowerCase() : 'txt';
          const prompt = parts.slice(2).join(' ');
          if (!prompt) { setIsLoading(false); return; }

          const aiMsgId = (Date.now() + 1).toString();
          setMessages(prev => [...prev, {
            id: aiMsgId,
            role: Role.MODEL,
            text: `GENERATING DATA STREAM (${format})...`,
            isStreaming: true,
            timestamp: Date.now()
          }]);
          
          await generateDocument(prompt, format, isAdmin);
          setMessages(prev => prev.map(m => m.id === aiMsgId ? {...m, text: `DATA GENERATION COMPLETE.`, isStreaming: false} : m));
          setIsLoading(false);
          return;
        }

        if (userText.toLowerCase().startsWith('/image') || userText.toLowerCase().startsWith('draw ')) {
          const prompt = userText.replace(/^\/?(image|draw)\s*/i, '');
          const aiMsgId = (Date.now() + 1).toString();
          
          setMessages(prev => [...prev, {
            id: aiMsgId,
            role: Role.MODEL,
            text: `RENDERING VISUAL ASSETS: "${prompt}"...`,
            isStreaming: true,
            timestamp: Date.now()
          }]);

          try {
            const base64Images = await generateImage(prompt, isAdmin);
            setMessages(prev => prev.map(msg => 
              msg.id === aiMsgId 
                ? { 
                    ...msg, 
                    text: `VISUALS RENDERED.`, 
                    images: base64Images,
                    image: base64Images[0], 
                    isStreaming: false 
                  } 
                : msg
            ));
          } catch (err: any) {
            setMessages(prev => prev.map(msg => 
              msg.id === aiMsgId ? { ...msg, text: `RENDER FAILED: ${err.message}`, isStreaming: false } : msg
            ));
          }
          setIsLoading(false);
          return;
        }

        const aiMsgId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, {
          id: aiMsgId,
          role: Role.MODEL,
          text: '',
          isStreaming: true,
          timestamp: Date.now()
        }]);

        await streamGeminiResponse(
          userText,
          [...messages, userMsg],
          isAdmin,
          aiName,
          settings.customPersona,
          (currentText) => {
            setMessages(prev => prev.map(msg => 
              msg.id === aiMsgId ? { ...msg, text: currentText } : msg
            ));
          },
          (finalText, sources) => {
            setMessages(prev => prev.map(msg => 
              msg.id === aiMsgId ? { ...msg, text: finalText, isStreaming: false, groundingSources: sources } : msg
            ));
            setIsLoading(false);
            if(settings.autoRead) speakText(finalText);
          },
          (error) => {
            setMessages(prev => prev.map(msg => 
              msg.id === aiMsgId ? { ...msg, text: "SYSTEM ERROR: " + error.message, isStreaming: false } : msg
            ));
            setIsLoading(false);
          },
          currentAttachment ? { data: currentAttachment.data, mimeType: currentAttachment.mimeType } : undefined,
          currentFileContext ? { content: currentFileContext.content, name: currentFileContext.name } : undefined
        );

    } catch (globalError: any) {
        setIsLoading(false);
    }
  };

  const handleNameSave = () => {
    if (tempNameInput.trim()) {
      setAiName(tempNameInput);
      localStorage.setItem(NAME_STORAGE_KEY, tempNameInput);
    }
    setIsNaming(false);
  };

  const isTyping = input.trim().length > 0;

  // NEON CYBERPUNK PALETTE MAPPING
  const themeColors = {
     bg: 'bg-[#050510]',
     sidebar: 'bg-[#0a0a1a]',
     
     // Dynamic Borders (Glowing)
     border: isAdmin ? 'neon-border-red' : 'neon-border-cyan',
     
     // Text Colors
     text: isAdmin ? 'text-neon-red text-glow-red' : 'text-neon-cyan text-glow-cyan',
     textBold: isAdmin ? 'text-white' : 'text-white',
     
     // Interactions / Buttons
     button: isAdmin 
        ? 'bg-admin-600 hover:bg-admin-500 text-white btn-3d' 
        : 'bg-primary-600 hover:bg-primary-500 text-white btn-3d',
     
     // Chat Bubbles (3D Panels)
     userBubble: isAdmin 
        ? 'bg-gradient-to-r from-red-900 to-gray-900 border border-red-500/50 shadow-neon-red' 
        : 'bg-gradient-to-r from-cyan-900 to-blue-900 border border-cyan-500/50 shadow-neon-cyan',
        
     aiBubble: 'glass-panel text-gray-100', // Unified Glass style for AI

     // Accents
     accent: isAdmin ? 'text-neon-red' : 'text-neon-cyan',
     glow: isAdmin ? 'shadow-neon-red' : 'shadow-neon-cyan',
     ring: isAdmin ? 'focus:ring-neon-red' : 'focus:ring-neon-cyan',
  };

  return (
    <div className={`flex h-screen font-sans overflow-hidden bg-[#050510] text-gray-100 transition-colors duration-300`}>
      
      <Sidebar 
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={selectSession}
        onNewChat={() => startNewChat()}
        onDeleteSession={deleteSession}
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isAdmin={isAdmin}
      />

      <div className={`flex-1 flex flex-col h-full relative z-10 min-w-0 bg-[#050510]/90`}>
        
        {/* Header - Glass Bar */}
        <header className={`flex-none h-16 px-6 flex items-center justify-between z-20 border-b border-white/10 glass-panel`}>
          <div className="flex items-center gap-4">
             {/* Sidebar Toggle Button */}
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${themeColors.text}`}>
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
               </svg>
             </button>
            <div className={`w-10 h-10 rounded border ${isAdmin ? 'border-neon-red shadow-neon-red' : 'border-neon-cyan shadow-neon-cyan'} flex items-center justify-center bg-black`}>
               <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${themeColors.accent}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                 <h1 className={`font-bold text-lg tracking-widest uppercase ${themeColors.text}`}>{aiName}</h1>
                 <button onClick={() => { setTempNameInput(aiName); setIsNaming(true); }} className={`opacity-50 hover:opacity-100 transition-opacity`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                 </button>
              </div>
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-neon-red animate-pulse-fast' : 'bg-neon-cyan animate-pulse-fast'}`}></div>
                 <span className={`text-[10px] font-mono tracking-widest uppercase ${isAdmin ? 'text-neon-red' : 'text-neon-cyan'}`}>
                   {isAdmin ? 'ROOT_ACCESS_GRANTED' : 'SYSTEM_ONLINE'}
                 </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            
            {/* Admin Toggle */}
            <button 
              onClick={toggleAdmin} 
              className={`p-2 rounded transition-all duration-200 border border-transparent ${isAdmin ? 'text-neon-red shadow-neon-red border-neon-red bg-red-900/20' : 'text-gray-500 hover:text-neon-cyan hover:shadow-neon-cyan'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </button>

            <button onClick={() => setShowSettings(true)} className={`p-2 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-all`} title="Settings">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <button onClick={() => setIsModalOpen(true)} className={`p-2 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-all`} title="Info">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <main ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 scroll-smooth relative">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col max-w-4xl mx-auto ${msg.role === Role.USER ? 'items-end' : 'items-start'}`}>
              <div className="flex items-end gap-4 max-w-full group relative">
                
                {msg.role === Role.MODEL && (
                   <div className={`w-10 h-10 rounded border ${isAdmin ? 'border-neon-red shadow-neon-red' : 'border-neon-cyan shadow-neon-cyan'} bg-black flex-shrink-0 flex items-center justify-center`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${themeColors.accent}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" /></svg>
                   </div>
                )}
                
                {/* Message Bubble - 3D Panel */}
                <div className={`relative px-6 py-5 text-sm md:text-base leading-relaxed
                  ${msg.role === Role.USER 
                    ? `${themeColors.userBubble} max-w-[85%] rounded-tl-xl rounded-bl-xl rounded-tr-sm rounded-br-xl transform hover:-translate-y-1 transition-transform duration-300` 
                    : `${themeColors.aiBubble} w-full rounded-tr-xl rounded-br-xl rounded-tl-sm rounded-bl-xl`
                  } group shadow-3d`}>
                  
                  {/* Listen Button - Top Right of Bubble */}
                  {msg.role === Role.MODEL && !msg.isStreaming && (
                    <button 
                      onClick={() => speakText(msg.text)} 
                      className={`absolute -top-3 right-4 p-1 bg-black rounded border border-gray-600 text-gray-400 hover:text-white hover:border-white transition-all shadow-sm`}
                      title="Listen"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0117 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0113 10a3.984 3.984 0 01-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}

                  {/* Attachments */}
                  {msg.attachment && (
                    <div className="mb-4 overflow-hidden rounded border border-white/20">
                      <img src={`data:${msg.attachmentMimeType};base64,${msg.attachment}`} alt="Upload" className="max-h-60 w-auto object-cover opacity-80 hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                  {msg.fileContent && (
                    <div className="mb-4 p-3 bg-black/40 rounded border border-white/20 flex items-center gap-3 font-mono text-xs">
                       <div className="p-2 bg-white/10 rounded">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                       </div>
                       <div className="truncate opacity-90">{msg.fileName}</div>
                    </div>
                  )}

                  {/* Generated Images */}
                  {msg.images && msg.images.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      {msg.images.map((imgSrc, imgIdx) => (
                        <div key={imgIdx} className="relative group/img overflow-hidden rounded border border-white/20 shadow-neon-cyan">
                          <img src={imgSrc} alt="Generated" className="w-full h-auto transition-transform duration-500 group-hover/img:scale-105" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                             <button onClick={() => {const link = document.createElement('a'); link.href = imgSrc; link.download = 'generated_image.png'; link.click();}} className="bg-white text-black text-xs px-4 py-2 rounded font-bold hover:bg-neon-cyan hover:text-black shadow-lg">DOWNLOAD_ASSET</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Generated App Card */}
                  {msg.appContent && (
                    <div className={`my-4 overflow-hidden rounded border bg-[#101015] shadow-lg relative ${isAdmin ? 'border-neon-red' : 'border-neon-cyan'}`}>
                      {/* Decorative Corner */}
                      <div className={`absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 ${isAdmin ? 'border-neon-red' : 'border-neon-cyan'}`}></div>
                      
                      <div className="p-4 flex items-center gap-4 border-b border-white/5 bg-white/5">
                        <div className={`w-12 h-12 rounded flex items-center justify-center bg-black border ${isAdmin ? 'border-neon-red text-neon-red shadow-neon-red' : 'border-neon-cyan text-neon-cyan shadow-neon-cyan'}`}>
                           {/* Icon changes based on App Type (Web vs Native) */}
                           {isWebApp(msg.appContent) ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                              </svg>
                           ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                           )}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-100 text-lg font-mono tracking-wide">
                            {isWebApp(msg.appContent) ? 'WEB_MODULE_READY' : 'ANDROID_PROJECT_READY'}
                          </h3>
                          <p className="text-xs text-gray-500 font-mono">{Object.keys(msg.appContent).length} FILES COMPILED</p>
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-3 gap-3">
                           {isWebApp(msg.appContent) ? (
                                <>
                                  <button onClick={() => handlePreviewApp(msg.appContent!)} className={`py-2 px-3 rounded font-mono text-xs font-bold ${themeColors.button}`}>RUN_APP</button>
                                  <button onClick={() => handleOpenInNewTab(msg.appContent!)} className="py-2 px-3 rounded border border-gray-600 text-gray-400 hover:text-white hover:border-white text-xs font-bold font-mono transition-colors">NEW_TAB</button>
                                  <button onClick={() => handleDownloadZip(msg.appContent!)} className="py-2 px-3 rounded border border-gray-600 text-gray-400 hover:text-white hover:border-white text-xs font-bold font-mono transition-colors">ZIP</button>
                                </>
                           ) : (
                                <>
                                  <div className="col-span-2 flex items-center justify-center text-xs text-gray-500 bg-white/5 rounded border border-white/5 italic font-mono">
                                     NO_PREVIEW_AVAILABLE
                                  </div>
                                  <button onClick={() => handleDownloadZip(msg.appContent!)} className={`py-2 px-3 rounded font-mono text-xs font-bold ${themeColors.button}`}>DOWNLOAD_APK_SRC</button>
                                </>
                           )}
                      </div>
                    </div>
                  )}

                  <div className="markdown-content">
                    {msg.role === Role.MODEL ? (
                       msg.isStreaming && !msg.text ? (
                         <div className="flex items-center gap-2 text-gray-500 font-mono text-xs">
                            <span className="animate-pulse">PROCESSING_DATA</span>
                            <div className="flex space-x-1">
                                <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                         </div>
                       ) : (
                         <MarkdownRenderer content={msg.text} />
                       )
                    ) : (
                       msg.text
                    )}
                  </div>

                  {/* Inline Resources Display - Cyber Cards */}
                  {msg.groundingSources && msg.groundingSources.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-white/10">
                      <h4 className={`text-xs font-bold uppercase tracking-widest mb-3 opacity-70 flex items-center gap-2 ${themeColors.accent}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
                        DATA_SOURCES
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.groundingSources.map((source, idx) => (
                          <a 
                            key={idx} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={`block p-3 rounded bg-black/40 border border-white/10 hover:border-white/40 hover:bg-white/5 transition-all group/link relative overflow-hidden`}
                          >
                            <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${isAdmin ? 'bg-neon-red' : 'bg-neon-cyan'} opacity-50`}></div>
                            <div className={`text-xs font-bold truncate ${themeColors.accent} mb-0.5 group-hover/link:underline`}>
                              {source.title}
                            </div>
                            <div className="text-[10px] text-gray-500 truncate flex items-center gap-1 font-mono">
                              {new URL(source.uri).hostname}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* User Message Action Toolbar */}
                {msg.role === Role.USER && (
                  <div className={`absolute -bottom-8 right-0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1 bg-black border border-gray-700 rounded p-1 z-10 shadow-lg`}>
                    <button 
                      onClick={() => handleEditText(msg.text)} 
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded"
                      title="Edit"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                    </button>
                    <button 
                      onClick={() => handleCopyText(msg.text)} 
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded"
                      title="Copy"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>
                    </button>
                    <button 
                      onClick={() => handleSend(msg.text)} 
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded"
                      title="Regenerate"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v3.25a1 1 0 11-2 0V13.003a7.002 7.002 0 01-11.603-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} className="h-4" />
        </main>

        {/* Input Area - Floating 3D Bar */}
        <footer className={`flex-none p-4 sm:p-6 z-20`}>
          <div className="max-w-4xl mx-auto relative">
            
            {/* Popups */}
            {showCommandMenu && (
              <div ref={commandMenuRef} className={`absolute bottom-full left-0 mb-4 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg w-64 shadow-2xl overflow-hidden animate-fade-in z-50`}>
                 <div className="bg-gray-800/50 px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 font-mono">Available Commands</div>
                 <button onClick={() => {setInput('/make '); setShowCommandMenu(false);}} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-sm text-left text-gray-200 transition-colors">
                   <span className={`font-mono ${themeColors.accent}`}>/make</span>
                   <span>Generate Document</span>
                 </button>
                 <button onClick={() => {setInput('/image '); setShowCommandMenu(false);}} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-sm text-left text-gray-200 transition-colors">
                   <span className={`font-mono ${themeColors.accent}`}>/image</span>
                   <span>Create Image</span>
                 </button>
                 <button onClick={() => {setInput('/build '); setShowCommandMenu(false);}} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-sm text-left text-gray-200 transition-colors">
                   <span className={`font-mono ${themeColors.accent}`}>/build</span>
                   <span>Build Web App / APK</span>
                 </button>
              </div>
            )}

            {showPromptMenu && (
              <div ref={promptMenuRef} className={`absolute bottom-full right-0 mb-4 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg w-72 shadow-2xl overflow-hidden animate-fade-in z-50`}>
                 <div className="flex justify-between items-center px-4 py-2 border-b border-gray-700 bg-gray-800/50">
                   <div className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">Suggested Inputs</div>
                   <button onClick={shufflePrompts} className={`text-gray-400 hover:text-white`}>
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                   </button>
                 </div>
                 <div className="max-h-64 overflow-y-auto">
                   {visiblePrompts.map((p, i) => (
                     <button key={i} onClick={() => {setInput(p.prompt); setShowPromptMenu(false);}} className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-gray-800 last:border-0 group">
                       <div className={`font-bold font-mono text-sm mb-0.5 ${themeColors.accent}`}>{p.title}</div>
                       <div className="text-xs text-gray-400 truncate font-sans">{p.prompt}</div>
                     </button>
                   ))}
                 </div>
              </div>
            )}

            {/* Attachments & Stop Button */}
            <div className="absolute bottom-full left-0 mb-4 flex gap-3 z-30">
               {isSpeaking && (
                 <button onClick={stopSpeaking} className="flex items-center gap-2 px-4 py-2 bg-red-600/80 backdrop-blur border border-red-500 text-white rounded-lg text-xs font-bold shadow-neon-red animate-pulse-fast uppercase tracking-wider">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>
                   HALT_AUDIO
                 </button>
               )}
               {(attachment || fileContext) && (
                  <div className={`p-2 bg-gray-900 border ${themeColors.border} rounded-lg flex items-center gap-3 animate-fade-in shadow-lg`}>
                    {attachment ? (
                      <img src={`data:${attachment.mimeType};base64,${attachment.data}`} className="w-10 h-10 object-cover rounded" alt="preview" />
                    ) : (
                      <div className="w-10 h-10 bg-white/10 rounded flex items-center justify-center text-xs font-bold text-gray-400 font-mono">FILE</div>
                    )}
                    <div className="flex flex-col">
                       <span className={`text-[10px] ${themeColors.accent} font-bold uppercase tracking-wider`}>Attached</span>
                       <span className="text-xs text-gray-300 truncate max-w-[100px] font-mono">{fileContext ? fileContext.name : 'Image'}</span>
                    </div>
                    <button onClick={() => {setAttachment(null); setFileContext(null);}} className="p-1 hover:bg-white/10 rounded-full text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
               )}
            </div>

            {/* Main Input Bar */}
            <div className={`relative flex items-center gap-3 p-2 rounded-xl border transition-all duration-300 shadow-2xl glass-panel ${themeColors.border} ${isTyping ? themeColors.glow : ''}`}>
              
              {/* Command Trigger */}
              <button 
                onClick={() => setShowCommandMenu(!showCommandMenu)}
                className={`p-3 rounded-lg transition-colors flex-shrink-0 ${themeColors.accent} hover:bg-white/10`}
                title="Commands"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>

              {/* File Upload */}
              <div className="relative">
                 <input 
                   type="file" 
                   ref={fileInputRef}
                   className="hidden" 
                   onChange={handleFileUpload}
                   multiple={false}
                 />
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   className={`p-3 rounded-lg transition-colors flex-shrink-0 text-gray-400 hover:text-white hover:bg-white/10`}
                   title="Upload File/Image"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                   </svg>
                 </button>
              </div>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                   if(e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                   }
                }}
                placeholder={isAdmin ? "ENTER ROOT COMMAND..." : "Input directive..."}
                className={`flex-1 bg-transparent border-none focus:ring-0 text-base md:text-lg placeholder-gray-600 font-sans tracking-wide ${themeColors.text}`}
                disabled={isLoading}
              />

              {/* Mic */}
              <button 
                onClick={toggleRecording}
                className={`p-3 rounded-lg transition-colors flex-shrink-0 ${isRecording ? 'bg-red-500 text-white animate-pulse-fast shadow-neon-red' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                 </svg>
              </button>

              {/* Send */}
              <button 
                onClick={() => handleSend()}
                disabled={(!input.trim() && !attachment && !fileContext) || isLoading}
                className={`p-3 rounded-lg transition-all flex-shrink-0 shadow-lg btn-3d
                   ${(!input.trim() && !attachment && !fileContext) || isLoading
                     ? 'bg-gray-800 text-gray-600 cursor-not-allowed shadow-none transform-none' 
                     : `${themeColors.button}`
                   }`}
              >
                {isLoading ? (
                   <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                ) : (
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                   </svg>
                )}
              </button>

            </div>
            <div className="text-center mt-2">
               <button onClick={() => setShowPromptMenu(!showPromptMenu)} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors uppercase tracking-[0.2em] font-semibold">
                 Open_Suggestions
               </button>
            </div>
          </div>
        </footer>

      </div>

      {/* Modals */}
      <ApkGuideModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} isAdmin={isAdmin} />
      <AppPreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} files={previewFiles} isAdmin={isAdmin} />

      {/* Admin Code Modal */}
      {showAdminInput && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-black border border-red-500 rounded-xl p-8 max-w-sm w-full shadow-neon-red relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse-fast"></div>
               <div className="flex justify-center mb-6 text-red-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
               </div>
               <h3 className="text-2xl font-bold text-center text-red-500 mb-6 uppercase tracking-[0.2em] text-glow-red font-mono">Restricted</h3>
               <form onSubmit={handleAdminSubmit} className="space-y-4">
                  <input 
                    type="password" 
                    value={adminInputCode}
                    onChange={(e) => setAdminInputCode(e.target.value)}
                    className="w-full bg-gray-900 border border-red-900 rounded px-4 py-3 text-center text-red-500 placeholder-red-900/50 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none tracking-[0.5em] font-mono shadow-inner"
                    placeholder="••••••"
                    autoFocus
                  />
                  <div className="flex gap-3">
                     <button type="button" onClick={() => setShowAdminInput(false)} className="flex-1 py-3 rounded border border-gray-800 text-gray-500 hover:bg-white/5 uppercase tracking-wider text-xs font-bold font-mono">Abort</button>
                     <button type="submit" className="flex-1 py-3 rounded bg-red-600 text-white hover:bg-red-500 font-bold uppercase tracking-wider text-xs shadow-neon-red">Unlock</button>
                  </div>
               </form>
            </div>
         </div>
      )}
      
      {/* Name Modal */}
      {isNaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className={`bg-gray-900 border ${themeColors.border} rounded-xl p-6 max-w-sm w-full shadow-2xl`}>
            <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wider font-mono">Reconfigure Identity</h3>
            <input 
              type="text" 
              value={tempNameInput}
              onChange={(e) => setTempNameInput(e.target.value)}
              className={`w-full bg-black border border-gray-700 rounded-lg px-4 py-2 text-white mb-4 outline-none ${themeColors.ring} focus:ring-1`}
              placeholder="Enter new designation..."
            />
            <div className="flex justify-end gap-3">
               <button onClick={() => setIsNaming(false)} className="px-4 py-2 rounded text-gray-400 hover:bg-white/5 uppercase text-xs font-bold">Cancel</button>
               <button onClick={handleNameSave} className={`px-4 py-2 rounded ${themeColors.button} uppercase text-xs font-bold`}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
           <div className={`bg-black border ${themeColors.border} rounded-xl max-w-md w-full overflow-hidden shadow-2xl`}>
              <div className="p-6 border-b border-white/10 bg-white/5">
                <h3 className="text-xl font-bold text-white uppercase tracking-widest font-mono">System Config</h3>
              </div>
              <div className="p-6 space-y-6">
                 {/* Persona */}
                 <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Persona Protocol</label>
                    <textarea 
                      value={settings.customPersona}
                      onChange={(e) => setSettings({...settings, customPersona: e.target.value})}
                      className={`w-full bg-gray-900 border border-gray-700 rounded p-3 text-sm text-white outline-none h-24 resize-none font-mono ${themeColors.ring} focus:ring-1`}
                      placeholder="Define AI behavior parameters..."
                    />
                 </div>
                 
                 {/* Toggles */}
                 <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-900 rounded border border-gray-800">
                       <span className="text-gray-300 text-sm font-bold uppercase">Incognito Mode</span>
                       <button 
                         onClick={() => setIsIncognito(!isIncognito)}
                         className={`w-10 h-5 rounded-full p-0.5 transition-colors ${isIncognito ? 'bg-green-500 shadow-neon-cyan' : 'bg-gray-700'}`}
                       >
                         <div className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${isIncognito ? 'translate-x-5' : 'translate-x-0'}`} />
                       </button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-900 rounded border border-gray-800">
                       <span className="text-gray-300 text-sm font-bold uppercase">Auto-Read Output</span>
                       <button 
                         onClick={() => setSettings({...settings, autoRead: !settings.autoRead})}
                         className={`w-10 h-5 rounded-full p-0.5 transition-colors ${settings.autoRead ? 'bg-green-500 shadow-neon-cyan' : 'bg-gray-700'}`}
                       >
                         <div className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${settings.autoRead ? 'translate-x-5' : 'translate-x-0'}`} />
                       </button>
                    </div>
                 </div>
              </div>
              <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
                 <button onClick={() => setShowSettings(false)} className={`px-6 py-2 ${themeColors.button} rounded font-bold uppercase text-xs`}>Confirm</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}