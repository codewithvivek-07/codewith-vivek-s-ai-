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
  { title: "Quantum Physics", prompt: "Explain quantum computing in simple terms:" },
  { title: "Creative Writing", prompt: "Write a short sci-fi story about a robot who loves gardening:" },
  { title: "Python Script", prompt: "Write a Python script to sort a list of dictionaries by a key:" },
  { title: "Professional Email", prompt: "Draft a professional email to reschedule a meeting:" },
  { title: "Study Plan", prompt: "Create a 1-week study plan for learning React basics:" },
  { title: "Healthy Recipe", prompt: "Give me a healthy recipe using chicken and spinach:" },
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
      text: `Hello! I am ${nameOverride || aiName}. How can I help you today?`,
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
    if (confirm("Are you sure you want to delete this chat?")) {
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
      alert("Incorrect Code");
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
    a.download = "source_code.zip";
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
            text: `Starting build for: "${prompt}"...`,
            isStreaming: true,
            timestamp: Date.now()
          }]);
          
          try {
            const files = await generateAppCode(prompt, isAdmin);
            setMessages(prev => prev.map(msg => 
              msg.id === aiMsgId ? { 
                ...msg, 
                text: `App successfully built.`, 
                appContent: files,
                isStreaming: false 
              } : msg
            ));
          } catch (err: any) {
            setMessages(prev => prev.map(msg => 
              msg.id === aiMsgId ? { ...msg, text: `Build failed: ${err.message}`, isStreaming: false } : msg
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
            text: `Generating document (${format})...`,
            isStreaming: true,
            timestamp: Date.now()
          }]);
          
          await generateDocument(prompt, format, isAdmin);
          setMessages(prev => prev.map(m => m.id === aiMsgId ? {...m, text: `Document generated.`, isStreaming: false} : m));
          setIsLoading(false);
          return;
        }

        if (userText.toLowerCase().startsWith('/image') || userText.toLowerCase().startsWith('draw ')) {
          const prompt = userText.replace(/^\/?(image|draw)\s*/i, '');
          const aiMsgId = (Date.now() + 1).toString();
          
          setMessages(prev => [...prev, {
            id: aiMsgId,
            role: Role.MODEL,
            text: `Creating image: "${prompt}"...`,
            isStreaming: true,
            timestamp: Date.now()
          }]);

          try {
            const base64Images = await generateImage(prompt, isAdmin);
            setMessages(prev => prev.map(msg => 
              msg.id === aiMsgId 
                ? { 
                    ...msg, 
                    text: `Image generated.`, 
                    images: base64Images,
                    image: base64Images[0], 
                    isStreaming: false 
                  } 
                : msg
            ));
          } catch (err: any) {
            setMessages(prev => prev.map(msg => 
              msg.id === aiMsgId ? { ...msg, text: `Image creation failed: ${err.message}`, isStreaming: false } : msg
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
              msg.id === aiMsgId ? { ...msg, text: "Error: " + error.message, isStreaming: false } : msg
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

  // Modern Color Palette (No more hard black/neon terminal)
  const themeColors = {
     bg: 'bg-black',
     sidebar: 'bg-black',
     // Dynamic Borders
     border: isAdmin ? 'border-red-500/30' : 'border-primary-500/30',
     
     // Text Colors
     text: isAdmin ? 'text-red-500' : 'text-primary-400',
     textBold: isAdmin ? 'text-red-400' : 'text-primary-300',
     
     // Interactions
     button: isAdmin 
        ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20' 
        : 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-900/20',
     
     // Chat Bubbles (Rounded, Glassy)
     userBubble: isAdmin 
        ? 'bg-red-600 text-white rounded-2xl rounded-tr-sm' 
        : 'bg-primary-600 text-white rounded-2xl rounded-tr-sm',
        
     aiBubble: isAdmin 
        ? 'bg-gray-900/80 border border-red-500/20 text-gray-100 rounded-2xl rounded-tl-sm backdrop-blur-sm' 
        : 'bg-gray-900/80 border border-primary-500/20 text-gray-100 rounded-2xl rounded-tl-sm backdrop-blur-sm',

     // Accents
     accent: isAdmin ? 'text-red-500' : 'text-primary-500',
     glow: isAdmin ? 'shadow-glow-red' : 'shadow-glow-green',
  };

  return (
    <div className={`flex h-screen font-sans overflow-hidden bg-black text-gray-100 transition-colors duration-300`}>
      
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

      <div className={`flex-1 flex flex-col h-full relative z-10 min-w-0 bg-black overflow-hidden`}>
        
        {/* Header */}
        <header className={`flex-none h-16 px-6 flex items-center justify-between z-20 border-b ${themeColors.border} bg-black/50 backdrop-blur-md`}>
          <div className="flex items-center gap-4">
             {/* Sidebar Toggle Button */}
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400`}>
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
               </svg>
             </button>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAdmin ? 'bg-red-500/20 text-red-500' : 'bg-primary-500/20 text-primary-500'}`}>
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                 <h1 className="font-bold text-lg text-gray-100 tracking-tight">{aiName}</h1>
                 <button onClick={() => { setTempNameInput(aiName); setIsNaming(true); }} className={`opacity-50 hover:opacity-100 transition-opacity`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                 </button>
              </div>
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-red-500' : 'bg-primary-500'}`}></div>
                 <span className={`text-xs font-medium ${isAdmin ? 'text-red-400' : 'text-primary-400'}`}>
                   {isAdmin ? 'Admin Mode' : 'Online'}
                 </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            
            {/* Admin Toggle */}
            <button 
              onClick={toggleAdmin} 
              className={`p-2 rounded-lg transition-all duration-200 ${isAdmin ? 'text-red-500 bg-red-500/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
            >
              {isAdmin ? (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                 </svg>
              ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                 </svg>
              )}
            </button>

            <button onClick={() => setShowSettings(true)} className={`p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all`} title="Settings">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <button onClick={() => setIsModalOpen(true)} className={`p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all`} title="Info">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <main ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth bg-black relative">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col max-w-4xl mx-auto ${msg.role === Role.USER ? 'items-end' : 'items-start'}`}>
              <div className="flex items-end gap-3 max-w-full group relative">
                
                {msg.role === Role.MODEL && (
                   <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${isAdmin ? 'bg-red-500/20 text-red-500' : 'bg-primary-500/20 text-primary-500'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" /></svg>
                   </div>
                )}
                
                {/* Message Bubble */}
                <div className={`relative px-5 py-4 text-sm md:text-base leading-relaxed shadow-md
                  ${msg.role === Role.USER 
                    ? `${themeColors.userBubble} max-w-[85%]` 
                    : `${themeColors.aiBubble} w-full`
                  } group`}>
                  
                  {/* Listen Button - Top Right of Bubble */}
                  {msg.role === Role.MODEL && !msg.isStreaming && (
                    <button 
                      onClick={() => speakText(msg.text)} 
                      className={`absolute -top-3 right-4 p-1.5 bg-gray-800 rounded-full border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all shadow-sm`}
                      title="Listen"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0117 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0113 10a3.984 3.984 0 01-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}

                  {/* Attachments */}
                  {msg.attachment && (
                    <div className="mb-4 overflow-hidden rounded-lg border border-white/10">
                      <img src={`data:${msg.attachmentMimeType};base64,${msg.attachment}`} alt="Upload" className="max-h-60 w-auto object-cover" />
                    </div>
                  )}
                  {msg.fileContent && (
                    <div className="mb-4 p-3 bg-black/20 rounded-lg border border-white/10 flex items-center gap-3">
                       <div className="p-2 bg-white/10 rounded">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                       </div>
                       <div className="truncate text-sm opacity-90">{msg.fileName}</div>
                    </div>
                  )}

                  {/* Generated Images */}
                  {msg.images && msg.images.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      {msg.images.map((imgSrc, imgIdx) => (
                        <div key={imgIdx} className="relative group/img overflow-hidden rounded-xl border border-white/10">
                          <img src={imgSrc} alt="Generated" className="w-full h-auto transition-transform duration-500 group-hover/img:scale-105" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                             <button onClick={() => {const link = document.createElement('a'); link.href = imgSrc; link.download = 'generated_image.png'; link.click();}} className="bg-white text-black text-xs px-4 py-2 rounded-full font-bold hover:bg-gray-200">Download</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Generated App Card */}
                  {msg.appContent && (
                    <div className={`my-4 overflow-hidden rounded-xl border ${themeColors.border} bg-black/30`}>
                      <div className="p-4 flex items-center gap-4 border-b border-white/10">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isAdmin ? 'bg-red-500/20 text-red-500' : 'bg-primary-500/20 text-primary-500'}`}>
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                           </svg>
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-100 text-lg">App Generated</h3>
                          <p className="text-xs text-gray-400">{Object.keys(msg.appContent).length} files ready</p>
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-3 gap-3">
                           <button onClick={() => handlePreviewApp(msg.appContent!)} className={`py-2 px-3 rounded-lg ${themeColors.button} text-xs font-bold`}>Run App</button>
                           <button onClick={() => handleOpenInNewTab(msg.appContent!)} className="py-2 px-3 rounded-lg border border-gray-600 text-gray-300 hover:bg-white/5 text-xs font-bold">New Tab</button>
                           <button onClick={() => handleDownloadZip(msg.appContent!)} className="py-2 px-3 rounded-lg border border-gray-600 text-gray-300 hover:bg-white/5 text-xs font-bold">Download</button>
                      </div>
                    </div>
                  )}

                  <div className="markdown-content">
                    {msg.role === Role.MODEL ? (
                       msg.isStreaming && !msg.text ? (
                         <div className="flex items-center gap-2 text-gray-400">
                            <span className="text-sm">Thinking</span>
                            <div className="flex space-x-1">
                                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                         </div>
                       ) : (
                         <MarkdownRenderer content={msg.text} />
                       )
                    ) : (
                       msg.text
                    )}
                  </div>

                  {/* Inline Resources Display - Modern Cards */}
                  {msg.groundingSources && msg.groundingSources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 opacity-70 flex items-center gap-2 ${isAdmin ? 'text-red-400' : 'text-primary-400'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
                        Sources
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.groundingSources.map((source, idx) => (
                          <a 
                            key={idx} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={`block p-3 rounded-xl bg-black/20 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all group/link`}
                          >
                            <div className={`text-xs font-bold truncate ${themeColors.text} mb-0.5`}>
                              {source.title}
                            </div>
                            <div className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
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
                  <div className={`absolute -bottom-8 right-0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg p-1 z-10 shadow-lg`}>
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

        {/* Input Area */}
        <footer className={`flex-none p-4 sm:p-6 z-20 bg-black/80 backdrop-blur border-t ${themeColors.border}`}>
          <div className="max-w-4xl mx-auto relative">
            
            {/* Popups */}
            {showCommandMenu && (
              <div ref={commandMenuRef} className={`absolute bottom-full left-0 mb-4 bg-gray-900 border border-gray-700 rounded-xl w-64 shadow-2xl overflow-hidden animate-fade-in z-50`}>
                 <div className="bg-gray-800/50 px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700">Commands</div>
                 <button onClick={() => {setInput('/make '); setShowCommandMenu(false);}} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm text-left text-gray-200 transition-colors">
                   <span className={themeColors.text}>/make</span>
                   <span>Generate Document</span>
                 </button>
                 <button onClick={() => {setInput('/image '); setShowCommandMenu(false);}} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm text-left text-gray-200 transition-colors">
                   <span className={themeColors.text}>/image</span>
                   <span>Create Image</span>
                 </button>
                 <button onClick={() => {setInput('/build '); setShowCommandMenu(false);}} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm text-left text-gray-200 transition-colors">
                   <span className={themeColors.text}>/build</span>
                   <span>Build Web App</span>
                 </button>
              </div>
            )}

            {showPromptMenu && (
              <div ref={promptMenuRef} className={`absolute bottom-full right-0 mb-4 bg-gray-900 border border-gray-700 rounded-xl w-72 shadow-2xl overflow-hidden animate-fade-in z-50`}>
                 <div className="flex justify-between items-center px-4 py-2 border-b border-gray-700 bg-gray-800/50">
                   <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ideas</div>
                   <button onClick={shufflePrompts} className={`text-gray-400 hover:text-white`}>
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                   </button>
                 </div>
                 <div className="max-h-64 overflow-y-auto">
                   {visiblePrompts.map((p, i) => (
                     <button key={i} onClick={() => {setInput(p.prompt); setShowPromptMenu(false);}} className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-gray-800 last:border-0 group">
                       <div className={`font-semibold text-gray-200 text-sm mb-0.5 group-hover:${themeColors.accent}`}>{p.title}</div>
                       <div className="text-xs text-gray-500 truncate">{p.prompt}</div>
                     </button>
                   ))}
                 </div>
              </div>
            )}

            {/* Attachments & Stop Button */}
            <div className="absolute bottom-full left-0 mb-4 flex gap-3 z-30">
               {isSpeaking && (
                 <button onClick={stopSpeaking} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-full text-xs font-bold shadow-lg animate-pulse">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>
                   Stop Speaking
                 </button>
               )}
               {(attachment || fileContext) && (
                  <div className="p-2 bg-gray-800 border border-gray-600 rounded-xl flex items-center gap-3 animate-fade-in shadow-lg">
                    {attachment ? (
                      <img src={`data:${attachment.mimeType};base64,${attachment.data}`} className="w-10 h-10 object-cover rounded-lg" alt="preview" />
                    ) : (
                      <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-xs font-bold text-gray-400">FILE</div>
                    )}
                    <div className="flex flex-col">
                       <span className={`text-[10px] ${themeColors.accent} font-bold uppercase`}>Attached</span>
                       <span className="text-xs text-gray-300 truncate max-w-[100px]">{fileContext?.name || "Image"}</span>
                    </div>
                    <button onClick={() => {setAttachment(null); setFileContext(null);}} className="p-1 hover:bg-white/10 rounded-full text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                  </div>
               )}
            </div>

            {/* INPUT BAR */}
            <div className={`bg-gray-900/50 backdrop-blur border ${themeColors.border} rounded-2xl p-2 flex items-end shadow-lg transition-all focus-within:ring-1 ${isAdmin ? 'focus-within:ring-red-500/50' : 'focus-within:ring-primary-500/50'}`}>
              
              {/* Dynamic Option Buttons - Hide when typing */}
              {!isTyping && (
                <>
                  <button onClick={() => setShowCommandMenu(!showCommandMenu)} className="flex-none mb-0.5 mr-1 p-3 rounded-xl text-gray-500 hover:bg-white/10 hover:text-white transition-colors" title="Commands">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  </button>

                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,.txt,.js,.py,.html,.css,.json,.md,.csv" className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="flex-none mb-0.5 ml-1 p-3 rounded-xl text-gray-500 hover:bg-white/10 hover:text-white transition-colors" title="Upload">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  </button>

                  <button onClick={() => setShowPromptMenu(!showPromptMenu)} className="flex-none mb-0.5 ml-1 p-3 rounded-xl text-gray-500 hover:bg-white/10 hover:text-white transition-colors" title="Prompts">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </button>

                  {settings.voiceEnabled && (
                    <button onClick={toggleRecording} className={`flex-none mb-0.5 ml-1 p-3 rounded-xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-gray-500 hover:bg-white/10 hover:text-white'}`}>
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </button>
                  )}
                </>
              )}

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Ask anything..."
                className={`w-full bg-transparent border-none text-base p-3 focus:ring-0 resize-none max-h-40 min-h-[52px] text-gray-100 placeholder-gray-500`}
                rows={1}
                disabled={isLoading}
              />
              
              <button
                onClick={() => handleSend()}
                disabled={(!input.trim() && !attachment && !fileContext) || isLoading}
                className={`flex-none mb-0.5 mr-0.5 p-3 rounded-xl transition-all duration-300
                  ${(!input.trim() && !attachment && !fileContext) || isLoading
                    ? 'opacity-30 cursor-not-allowed text-gray-500' 
                    : `${themeColors.button}`}`}
              >
                {isLoading ? <div className="animate-spin h-6 w-6 border-2 border-transparent border-t-current rounded-full"></div> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>}
              </button>
            </div>
          </div>
        </footer>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className={`bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md w-full shadow-2xl relative`}>
               <h3 className="text-xl font-bold mb-6 text-white">System Configuration</h3>
               <div className="space-y-6">
                 <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">AI Persona</label>
                   <textarea 
                     value={settings.customPersona} 
                     onChange={(e) => setSettings({...settings, customPersona: e.target.value})}
                     className={`w-full p-4 bg-black/50 border border-gray-700 rounded-xl text-sm h-32 focus:ring-1 focus:ring-primary-500 outline-none text-gray-300 placeholder-gray-600 resize-none`}
                     placeholder="Define how the AI behaves..."
                   />
                 </div>
                 <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                   <span className="font-medium text-gray-300">Voice Input</span>
                   <button onClick={() => setSettings({...settings, voiceEnabled: !settings.voiceEnabled})} className={`w-12 h-6 rounded-full p-1 transition-all ${settings.voiceEnabled ? 'bg-primary-600' : 'bg-gray-700'}`}>
                     <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${settings.voiceEnabled ? 'translate-x-6' : ''}`}></div>
                   </button>
                 </div>
                 <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                   <span className="font-medium text-gray-300">Auto Read Aloud</span>
                   <button onClick={() => setSettings({...settings, autoRead: !settings.autoRead})} className={`w-12 h-6 rounded-full p-1 transition-all ${settings.autoRead ? 'bg-primary-600' : 'bg-gray-700'}`}>
                     <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${settings.autoRead ? 'translate-x-6' : ''}`}></div>
                   </button>
                 </div>
               </div>
               <div className="flex gap-4 mt-8">
                  <button onClick={() => setShowSettings(false)} className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-400 hover:bg-white/5 transition-colors font-bold text-xs uppercase">Close</button>
                  <button onClick={() => setShowSettings(false)} className={`flex-1 py-3 rounded-xl ${themeColors.button} font-bold text-xs uppercase`}>Save</button>
               </div>
            </div>
          </div>
        )}

        {/* Naming Modal */}
        {isNaming && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className={`bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-sm w-full shadow-2xl`}>
               <h3 className="text-lg font-bold text-center mb-6 text-white">Rename AI</h3>
               <div className="space-y-6">
                 <input type="text" value={tempNameInput} onChange={(e) => setTempNameInput(e.target.value)} className={`w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-center outline-none focus:border-primary-500 text-white font-bold`} autoFocus />
                 <div className="flex gap-3">
                   <button onClick={() => setIsNaming(false)} className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-400 hover:bg-white/5 text-xs font-bold uppercase">Cancel</button>
                   <button onClick={handleNameSave} className={`flex-1 py-3 rounded-xl ${themeColors.button} font-bold text-xs uppercase`}>Save</button>
                 </div>
               </div>
            </div>
          </div>
        )}

        <ApkGuideModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} isAdmin={isAdmin} />
        <AppPreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} files={previewFiles} />
        
        {/* Admin Login Modal */}
        {showAdminInput && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="bg-gray-900 border border-red-900/50 rounded-2xl p-8 max-w-sm w-full shadow-2xl relative overflow-hidden">
               <div className="text-center mb-8 relative z-10">
                 <div className="w-16 h-16 bg-red-500/10 rounded-full mx-auto mb-4 text-red-500 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                 </div>
                 <h3 className="text-xl font-bold text-white">Admin Access</h3>
                 <p className="text-xs text-red-400 mt-2">Restricted Area</p>
               </div>
               <form onSubmit={handleAdminSubmit} className="space-y-4 relative z-10">
                 <input type="password" value={adminInputCode} onChange={(e) => setAdminInputCode(e.target.value)} className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-center text-lg outline-none focus:border-red-500 text-white placeholder-gray-600 tracking-widest" placeholder="Passcode" autoFocus />
                 <div className="flex gap-3 pt-2">
                   <button type="button" onClick={() => setShowAdminInput(false)} className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-400 hover:bg-white/5 text-xs font-bold uppercase">Cancel</button>
                   <button type="submit" className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-white shadow-lg shadow-red-900/20 text-xs font-bold uppercase">Unlock</button>
                 </div>
               </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}