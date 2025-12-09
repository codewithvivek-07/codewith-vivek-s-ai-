import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { generateAppCode, streamGeminiResponse } from '../services/geminiService';
import { Message, Role, SavedApp } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import SavedAppsModal from './SavedAppsModal';
import CodeBlock from './CodeBlock';

// SvgIcon helper
const SvgIcon: React.FC<{ className?: string, children?: React.ReactNode }> = ({ className, children }) => {
  if (children) {
    return <span className={className}>{children}</span>;
  }
  return <i className={className}></i>;
};

interface PlaygroundProps { 
  isOpen: boolean; 
  onClose: () => void; 
  isAdmin: boolean; 
  themeColors: any;
  aiName: string;
}

const APNA_BANAO_APPS_KEY = 'codewithvivek_apna_banao_apps_v1';
const FORBIDDEN_FILENAME_CHARS = /[\\/*?"<>|:]/;

const PlaygroundScreen: React.FC<PlaygroundProps> = ({ isOpen, onClose, isAdmin, themeColors, aiName: baseAiName }) => {
  // State
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [activeFilename, setActiveFilename] = useState<string | null>(null);
  const [editedFileContent, setEditedFileContent] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // Changed from previewHtml to previewUrl for Blob
  const [playgroundMessages, setPlaygroundMessages] = useState<Message[]>([]);
  const [playgroundInput, setPlaygroundInput] = useState('');
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  
  // Mobile Tab State (New for UI Improvement)
  const [mobileTab, setMobileTab] = useState<'ide' | 'preview'>('ide'); // 'ide' = Files + Chat, 'preview' = Preview Only

  // Device view
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>(() => {
    return (['desktop', 'tablet', 'mobile'].includes(localStorage.getItem('playgroundDeviceView') || 'desktop') 
            ? localStorage.getItem('playgroundDeviceView') 
            : 'desktop') as 'desktop' | 'tablet' | 'mobile';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSavedAppsModalOpen, setIsSavedAppsModalOpen] = useState(false);
  const [savedApps, setSavedApps] = useState<SavedApp[]>([]);

  // Resizing states (Desktop only)
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(() => parseFloat(localStorage.getItem('playgroundLeftPaneWidth') || '30'));
  const [fileExplorerHeight, setFileExplorerHeight] = useState<number>(() => parseFloat(localStorage.getItem('playgroundFileExplorerHeight') || '40')); 

  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingFileExplorer, setIsResizingFileExplorer] = useState(false);

  // Console logs
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  // Refs
  const playgroundChatEndRef = useRef<HTMLDivElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const playgroundAiName = isAdmin ? "Root Dev Bot" : "Playground AI";

  // --- HTML Generator ---
  const generatePreviewContent = useCallback((currentFiles: Record<string, string>, currentActiveFilename: string | null, currentEditedFileContent: string): string => {
    let tempFiles = { ...currentFiles };
    if (currentActiveFilename && currentEditedFileContent !== null) {
      tempFiles[currentActiveFilename] = currentEditedFileContent;
    }

    const indexKey = Object.keys(tempFiles).find(k => k.toLowerCase() === 'index.html' || k.toLowerCase() === 'index.htm' || k.toLowerCase() === 'main.html')
                     || Object.keys(tempFiles).find(k => k.endsWith('.html'));
    
    let html = indexKey ? tempFiles[indexKey] : '';
    
    if (!html) {
        return `<html><body style="background:var(--bg-body);color:rgb(var(--theme-primary-rgb));display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-transform:uppercase;overflow:hidden;"><h2>NO ENTRY POINT FOUND</h2></body></html>`;
    }

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

    Object.entries(tempFiles).forEach(([filename, content]) => {
        if (filename === indexKey) return;
        if (filename.endsWith('.css')) injectResource('style', filename, content);
        if (filename.endsWith('.js')) injectResource('script', filename, content);
    });

    const consoleCaptureScript = `
      <script>
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        const sendLog = (type, args) => {
          try {
            const message = args.map(arg => {
              if (typeof arg === 'object' && arg !== null) {
                try { return JSON.stringify(arg); } catch { return String(arg); }
              }
              return String(arg);
            }).join(' ');
            window.parent.postMessage({ type: 'console', logType: type, message: message }, '*');
          } catch (e) {}
        };
        console.log = (...args) => { sendLog('log', args); originalLog(...args); };
        console.warn = (...args) => { sendLog('warn', args); originalWarn(...args); };
        console.error = (...args) => { sendLog('error', args); originalError(...args); };
        window.onerror = (message, source, lineno, colno, error) => {
          sendLog('error', ['Error:', message, 'at', source + ':' + lineno]);
          return false;
        };
      </script>
    `;

    if (html.includes('</head>')) html = html.replace('</head>', consoleCaptureScript + '</head>');
    else html += consoleCaptureScript;

    return html;
  }, []);

  // --- Effects ---
  useEffect(() => {
    if (!isOpen) {
      setFiles(null);
      setActiveFilename(null);
      setEditedFileContent('');
      setPreviewUrl(null);
      setPlaygroundMessages([]);
      setPlaygroundInput('');
      setPlaygroundLoading(false);
      setDeviceView('desktop');
      setIsFullscreen(false);
      setIsSavedAppsModalOpen(false);
      setConsoleLogs([]);
      setMobileTab('ide');
      return;
    };

    // Load saved apps logic
    try {
        const storedApps = localStorage.getItem(APNA_BANAO_APPS_KEY);
        if (storedApps) {
            const parsedApps = JSON.parse(storedApps);
            setSavedApps(parsedApps);
            if (parsedApps.length > 0 && !files) {
              const firstApp = parsedApps[0];
              setFiles(firstApp.files);
              const firstHtmlFile = Object.keys(firstApp.files).find(k => k.endsWith('.html')) || Object.keys(firstApp.files)[0];
              if (firstHtmlFile) {
                setActiveFilename(firstHtmlFile);
                setEditedFileContent(firstApp.files[firstHtmlFile]);
              }
              setPlaygroundMessages([{ id: 'pg_welcome', role: Role.MODEL, text: `Restored: "${firstApp.title}". Ready to code?`, timestamp: Date.now() }]);
            } else if (playgroundMessages.length === 0) {
              setPlaygroundMessages([{ id: 'pg_welcome', role: Role.MODEL, text: isAdmin ? "System Ready. Root Access Granted." : "Welcome! Describe an app or ask me to write code.", timestamp: Date.now() }]);
            }
        } else if (playgroundMessages.length === 0) {
          setPlaygroundMessages([{ id: 'pg_welcome', role: Role.MODEL, text: "Welcome to Playground! What shall we build?", timestamp: Date.now() }]);
        }
    } catch (e) {}
  }, [isOpen, isAdmin]);

  // Generate Blob URL for preview
  useEffect(() => {
    if (files && (activeFilename !== null || Object.keys(files).length > 0)) {
      const html = generatePreviewContent(files, activeFilename, editedFileContent);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [files, activeFilename, editedFileContent, generatePreviewContent]);

  useEffect(() => {
    playgroundChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [playgroundMessages]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security check: ensure message is from our iframe
      // Note: with blob URLs, source check can be tricky, so we rely on the specific message structure
      if (event.data && event.data.type === 'console') {
        const { logType, message } = event.data;
        let logPrefix = '';
        if(logType === 'error') logPrefix = '🔴 ';
        else if(logType === 'warn') logPrefix = '⚠️ ';
        else logPrefix = 'ℹ️ ';
        setConsoleLogs(prev => [...prev, logPrefix + message]);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // --- Resizing Logic ---
  const startResizing = useCallback((type: 'left' | 'fileExplorer') => (e: React.MouseEvent) => {
    e.preventDefault();
    if (type === 'left') setIsResizingLeft(true);
    else if (type === 'fileExplorer') setIsResizingFileExplorer(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizingLeft(false);
    setIsResizingFileExplorer(false);
    localStorage.setItem('playgroundLeftPaneWidth', leftPaneWidth.toString());
    localStorage.setItem('playgroundFileExplorerHeight', fileExplorerHeight.toString());
  }, [leftPaneWidth, fileExplorerHeight]);

  const resize = useCallback((e: MouseEvent) => {
    if (!overlayRef.current) return;
    const mainContentArea = overlayRef.current.querySelector('.main-content-split') as HTMLElement | null;
    if (!mainContentArea) return;
    const totalWidth = mainContentArea.offsetWidth;
    const leftPane = mainContentArea.querySelector('.left-pane');

    if (isResizingLeft) {
      let newW = (e.clientX / totalWidth) * 100;
      setLeftPaneWidth(Math.max(20, Math.min(newW, 80)));
    } else if (isResizingFileExplorer && leftPane) {
       const rect = leftPane.getBoundingClientRect();
       let newH = ((e.clientY - rect.top) / rect.height) * 100;
       setFileExplorerHeight(Math.max(10, Math.min(newH, 90)));
    }
  }, [isResizingLeft, isResizingFileExplorer]);

  useEffect(() => {
    if (isResizingLeft || isResizingFileExplorer) {
      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', stopResizing);
    } else {
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResizing);
    }
    return () => { document.removeEventListener('mousemove', resize); document.removeEventListener('mouseup', stopResizing); };
  }, [isResizingLeft, isResizingFileExplorer, resize, stopResizing]);

  if (!isOpen) return null;

  // --- Handlers ---
  const handlePlaygroundSend = async () => {
    if (!playgroundInput.trim() || playgroundLoading) return;
    const userMsgText = playgroundInput.trim();
    setPlaygroundInput('');
    setPlaygroundMessages(prev => [...prev, { id: Date.now().toString(), role: Role.USER, text: userMsgText, timestamp: Date.now() }]);
    setPlaygroundLoading(true);

    const currentFilesWithEdits = { ...files };
    if (activeFilename && editedFileContent !== null && files && files[activeFilename] !== editedFileContent) {
      currentFilesWithEdits[activeFilename] = editedFileContent;
    }
    const aiResponseId = (Date.now() + 1).toString();
    setPlaygroundMessages(prev => [...prev, { id: aiResponseId, role: Role.MODEL, text: '', isStreaming: true, timestamp: Date.now() }]);

    try {
      if (!files || Object.keys(files).length === 0) {
        const generatedFiles = await generateAppCode(userMsgText, isAdmin);
        setFiles(generatedFiles);
        setPlaygroundMessages(prev => prev.map(m => m.id === aiResponseId ? { ...m, text: "Project initialized.", isStreaming: false } : m));
        const initFile = Object.keys(generatedFiles).find(k => k.endsWith('.html')) || Object.keys(generatedFiles)[0];
        if (initFile) { setActiveFilename(initFile); setEditedFileContent(generatedFiles[initFile]); }
      } else {
        const isCodeReq = ['add', 'fix', 'change', 'update', 'style', 'script'].some(k => userMsgText.toLowerCase().includes(k));
        if (isCodeReq) {
             const updatedFiles = await generateAppCode(userMsgText, isAdmin, currentFilesWithEdits);
             setFiles(updatedFiles);
             if (activeFilename && updatedFiles[activeFilename]) setEditedFileContent(updatedFiles[activeFilename]);
             setPlaygroundMessages(prev => prev.map(m => m.id === aiResponseId ? { ...m, text: "Code updated.", isStreaming: false } : m));
        } else {
             const context = (activeFilename) ? { content: editedFileContent, name: activeFilename } : undefined;
             await streamGeminiResponse(userMsgText, playgroundMessages, isAdmin, playgroundAiName, "You are a coding assistant.", 
               (txt) => setPlaygroundMessages(prev => prev.map(m => m.id === aiResponseId ? { ...m, text: txt } : m)),
               (final) => setPlaygroundMessages(prev => prev.map(m => m.id === aiResponseId ? { ...m, text: final, isStreaming: false } : m)),
               (err) => setPlaygroundMessages(prev => prev.map(m => m.id === aiResponseId ? { ...m, text: "Error: " + err.message, isStreaming: false } : m)),
               undefined, context
             );
        }
      }
    } catch (e: any) {
        setPlaygroundMessages(prev => prev.map(m => m.id === aiResponseId ? { ...m, text: "Error: " + e.message, isStreaming: false } : m));
    } finally { setPlaygroundLoading(false); }
  };

  const handleNewFile = () => {
      const name = prompt("Filename (e.g., style.css):");
      if(!name) return;
      if(FORBIDDEN_FILENAME_CHARS.test(name)) return alert("Invalid characters.");
      setFiles(prev => ({...prev, [name]: ''}));
      setActiveFilename(name); setEditedFileContent('');
  };
  const handleDeleteFile = (name: string) => {
      if(!confirm(`Delete ${name}?`)) return;
      const next = {...files}; delete next[name]; setFiles(next);
      if(activeFilename === name) { setActiveFilename(null); setEditedFileContent(''); }
  };
  const handleRenameFile = (oldName: string) => {
      const newName = prompt("New name:", oldName);
      if(!newName || newName === oldName) return;
      const content = files![oldName];
      const next = {...files}; delete next[oldName]; next[newName] = content;
      setFiles(next);
      if(activeFilename === oldName) setActiveFilename(newName);
  };
  const resetPlayground = () => {
      if(confirm("Clear all files?")) { setFiles(null); setActiveFilename(null); setEditedFileContent(''); setPlaygroundMessages([]); }
  };
  
  const handleSaveApp = () => {
      const title = prompt("App Title:", "My App");
      if(!title || !files) return;
      const app: SavedApp = { id: Date.now().toString(), title, files, timestamp: Date.now() };
      setSavedApps(prev => {
          const next = [app, ...prev];
          localStorage.setItem(APNA_BANAO_APPS_KEY, JSON.stringify(next));
          return next;
      });
  };
  const handleLoadApp = (app: SavedApp) => {
      setFiles(app.files);
      const startFile = Object.keys(app.files).find(k=>k.endsWith('.html')) || Object.keys(app.files)[0];
      if(startFile) { setActiveFilename(startFile); setEditedFileContent(app.files[startFile]); }
      setIsSavedAppsModalOpen(false);
  };
  const handleDeleteSavedApp = (id: string) => {
      setSavedApps(prev => {
          const next = prev.filter(a => a.id !== id);
          localStorage.setItem(APNA_BANAO_APPS_KEY, JSON.stringify(next));
          return next;
      });
  };

  const handleOpenNewTab = () => {
    if (!previewUrl) return;
    window.open(previewUrl, '_blank');
  };

  const isNativeApp = files && Object.keys(files).some(k => k.includes('AndroidManifest'));
  const rightPaneWidth = 100 - leftPaneWidth;

  // --- Render ---
  return (
    <div ref={overlayRef} className="fixed inset-0 z-[100] flex flex-col bg-[var(--bg-body)] animate-fade-in sm:rounded-3xl overflow-hidden font-sans text-[var(--color-text-base)]">
       
       {/* 1. Enhanced Header */}
       <header className={`flex-none h-14 px-4 flex items-center justify-between border-b border-[rgba(var(--color-panel-border-rgb),1)] bg-[rgba(var(--color-panel-bg-rgb),0.8)] backdrop-blur-md z-20 ${themeColors.adminGlow}`}>
         <div className="flex items-center gap-3 overflow-hidden">
            <div className={`p-2 rounded-lg bg-[rgba(var(--theme-primary-rgb),0.1)] text-[rgb(var(--theme-primary-rgb))]`}>
                <SvgIcon className="fas fa-hammer w-4 h-4" />
            </div>
            <h2 className="font-bold text-sm sm:text-lg truncate tracking-tight">{playgroundAiName}</h2>
         </div>

         {/* Mobile Tab Switcher */}
         <div className="flex md:hidden bg-[var(--color-input-bg)] rounded-lg p-1 mx-2">
            <button onClick={() => setMobileTab('ide')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mobileTab === 'ide' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>Files & AI</button>
            <button onClick={() => setMobileTab('preview')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mobileTab === 'preview' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>Preview</button>
         </div>

         <div className="flex items-center gap-1 sm:gap-2">
            {files && (
              <button onClick={handleSaveApp} className="p-2 hover:bg-[var(--color-input-bg)] rounded-full transition-colors text-[var(--color-text-muted)]" title="Save">
                <SvgIcon className="fas fa-save w-4 h-4" />
              </button>
            )}
            <button onClick={() => setIsSavedAppsModalOpen(true)} className="p-2 hover:bg-[var(--color-input-bg)] rounded-full transition-colors text-[var(--color-text-muted)]" title="Load">
               <SvgIcon className="fas fa-folder-open w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-full transition-colors text-[var(--color-text-muted)] ml-1">
              <SvgIcon className="fas fa-times w-5 h-5" />
            </button>
         </div>
       </header>

       {/* 2. Main Layout (Split Pane or Mobile Tabs) */}
       <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative main-content-split">
          
          {/* LEFT PANE (Files + Chat) */}
          <div 
            style={{ width: `${leftPaneWidth}%` }} 
            className={`
                left-pane flex-col border-r border-[rgba(var(--color-panel-border-rgb),1)] bg-[var(--bg-body)]
                ${mobileTab === 'ide' ? 'flex w-full' : 'hidden md:flex'}
                md:relative absolute inset-0 z-10 md:z-auto
            `}
          >
             {/* File Explorer */}
             <div style={{ height: `${fileExplorerHeight}%` }} className="flex flex-col border-b border-[rgba(var(--color-panel-border-rgb),1)] relative">
                <div className="px-4 py-2 bg-[var(--color-input-bg)] border-b border-[rgba(var(--color-panel-border-rgb),0.5)] flex justify-between items-center">
                    <span className="text-xs font-bold uppercase opacity-60">Project Files</span>
                    {files && (
                        <div className="flex gap-1">
                            <button onClick={handleNewFile} className="p-1 hover:text-[rgb(var(--theme-primary-rgb))]"><SvgIcon className="fas fa-plus w-3 h-3" /></button>
                            <button onClick={resetPlayground} className="p-1 hover:text-red-500"><SvgIcon className="fas fa-trash-alt w-3 h-3" /></button>
                        </div>
                    )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {!files ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-40 text-center p-4">
                            <SvgIcon className="fas fa-box-open text-4xl mb-2" />
                            <p className="text-sm">No active project</p>
                        </div>
                    ) : (
                        Object.keys(files).map(filename => (
                            <div key={filename} 
                                onClick={() => { setActiveFilename(filename); setEditedFileContent(files[filename]); }}
                                className={`
                                    group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm font-mono transition-all
                                    ${activeFilename === filename ? 'bg-[rgba(var(--theme-primary-rgb),0.1)] text-[rgb(var(--theme-primary-rgb))] border-l-2 border-[rgb(var(--theme-primary-rgb))]' : 'hover:bg-[var(--color-input-bg)] border-l-2 border-transparent'}
                                `}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <SvgIcon className={`w-3 h-3 ${filename.endsWith('html') ? 'text-orange-500' : filename.endsWith('css') ? 'text-blue-500' : filename.endsWith('js') ? 'text-yellow-500' : 'text-gray-400'}`}>
                                      <i className="fas fa-file"></i>
                                    </SvgIcon>
                                    <span className="truncate">{filename}</span>
                                </div>
                                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                                    <button onClick={(e)=>{e.stopPropagation(); handleRenameFile(filename)}} className="hover:text-blue-500"><SvgIcon className="fas fa-pen w-3 h-3" /></button>
                                    <button onClick={(e)=>{e.stopPropagation(); handleDeleteFile(filename)}} className="hover:text-red-500"><SvgIcon className="fas fa-times w-3 h-3" /></button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {/* Horizontal Resizer (Desktop) */}
                <div onMouseDown={startResizing('fileExplorer')} className="absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-[rgb(var(--theme-primary-rgb))] z-20 hidden md:block opacity-50 transition-colors"></div>
             </div>

             {/* Chat Section */}
             <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-body)]">
                <div className="px-4 py-2 bg-[var(--color-input-bg)] border-b border-[rgba(var(--color-panel-border-rgb),0.5)]">
                    <span className="text-xs font-bold uppercase opacity-60">AI Assistant</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {playgroundMessages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === Role.USER ? 'justify-end' : 'justify-start'}`}>
                            <div className={`
                                max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm
                                ${msg.role === Role.USER 
                                    ? `${themeColors.userBubble} rounded-br-none` 
                                    : `${themeColors.aiBubble} rounded-bl-none`
                                }
                            `}>
                                <MarkdownRenderer content={msg.text} />
                            </div>
                        </div>
                    ))}
                    <div ref={playgroundChatEndRef} />
                </div>
                <div className="p-3 border-t border-[rgba(var(--color-panel-border-rgb),0.5)] bg-[var(--bg-body)]">
                    <div className="relative flex items-center">
                        <textarea 
                            value={playgroundInput}
                            onChange={(e) => setPlaygroundInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handlePlaygroundSend()}
                            placeholder={isAdmin ? "Command..." : "Ask AI to change code..."}
                            className="w-full pl-4 pr-12 py-3 bg-[var(--color-input-bg)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[rgb(var(--theme-primary-rgb))] resize-none shadow-inner"
                            rows={1}
                        />
                        <button 
                            onClick={handlePlaygroundSend}
                            disabled={!playgroundInput.trim() || playgroundLoading}
                            className={`absolute right-2 p-2 rounded-lg transition-colors ${playgroundInput.trim() ? 'text-[rgb(var(--theme-primary-rgb))] hover:bg-white/10' : 'text-gray-400'}`}
                        >
                            {playgroundLoading ? <SvgIcon className="fas fa-spinner fa-spin" /> : <SvgIcon className="fas fa-paper-plane" />}
                        </button>
                    </div>
                </div>
             </div>
          </div>

          {/* Vertical Resizer (Desktop) */}
          <div 
            onMouseDown={startResizing('left')} 
            className="w-1 cursor-ew-resize bg-[var(--color-panel-border-rgb)] hover:bg-[rgb(var(--theme-primary-rgb))] transition-colors z-30 hidden md:block flex-shrink-0 relative group"
          >
             {/* Grip handle visual */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-1 bg-gray-400 rounded-full group-hover:bg-white transition-colors"></div>
          </div>

          {/* RIGHT PANE (Preview Only) */}
          <div 
            style={{ width: `${rightPaneWidth}%` }} 
            className={`
                right-pane flex-col bg-[var(--bg-code)]
                ${mobileTab === 'preview' ? 'flex w-full' : 'hidden md:flex'}
                md:relative absolute inset-0 z-10 md:z-auto
            `}
          >
             {/* Preview Header with Open in Browser Button */}
             <div className="flex-none flex justify-between items-center px-4 py-2 bg-[var(--color-input-bg)] border-b border-[rgba(var(--color-panel-border-rgb),0.5)]">
                <span className="text-xs font-bold uppercase opacity-60">Live Preview</span>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleOpenNewTab}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-panel-border-rgb)] hover:bg-[rgba(var(--theme-primary-rgb),0.1)] hover:text-[rgb(var(--theme-primary-rgb))] rounded-md text-xs font-bold transition-all border border-transparent"
                        title="Open in new tab"
                    >
                        <SvgIcon className="fas fa-external-link-alt" />
                        <span className="hidden sm:inline">Open in Browser</span>
                    </button>

                    <div className="flex bg-[var(--color-panel-border-rgb)] rounded-md p-0.5">
                        {(['desktop', 'tablet', 'mobile'] as const).map(d => (
                            <button key={d} onClick={() => setDeviceView(d)} className={`p-1.5 rounded text-xs transition-colors ${deviceView === d ? 'bg-[var(--bg-body)] shadow-sm' : 'hover:opacity-70'}`}>
                                <SvgIcon className={`fas fa-${d === 'desktop' ? 'desktop' : d === 'tablet' ? 'tablet-alt' : 'mobile-alt'}`} />
                            </button>
                        ))}
                    </div>
                </div>
             </div>
             
             {/* Preview Content */}
             <div className="flex-1 relative overflow-auto p-4 flex flex-col items-center bg-gray-100/5">
                {previewUrl && !isNativeApp ? (
                    <div 
                        className={`transition-all duration-300 shadow-2xl overflow-hidden bg-white border-4 border-gray-800 ${deviceView === 'mobile' ? 'rounded-[2rem]' : deviceView === 'tablet' ? 'rounded-[1.5rem]' : 'rounded-none border-0 w-full h-full'}`}
                        style={{
                            width: deviceView === 'desktop' ? '100%' : deviceView === 'tablet' ? '768px' : '375px',
                            height: deviceView === 'desktop' ? '100%' : deviceView === 'tablet' ? '1024px' : '667px',
                            flexShrink: 0
                        }}
                    >
                        <iframe 
                            ref={previewIframeRef}
                            src={previewUrl}
                            className="w-full h-full"
                            sandbox="allow-scripts allow-forms allow-modals allow-same-origin"
                        />
                    </div>
                ) : (
                    <div className="m-auto text-center opacity-40">
                        {isNativeApp ? <p>Native Android App (Source Only)</p> : <p>Preview not available</p>}
                    </div>
                )}
             </div>

             {/* Console Log Overlay (Bottom) */}
             {consoleLogs.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 max-h-32 bg-black/80 backdrop-blur text-white text-xs font-mono p-2 overflow-y-auto border-t border-white/10">
                    <div className="flex justify-between items-center sticky top-0 bg-black/80 pb-1 mb-1 border-b border-white/10">
                        <span className="font-bold opacity-70">Console</span>
                        <button onClick={() => setConsoleLogs([])} className="hover:text-red-400"><SvgIcon className="fas fa-ban" /></button>
                    </div>
                    {consoleLogs.map((log, i) => <div key={i} className="whitespace-pre-wrap">{log}</div>)}
                </div>
             )}
          </div>

       </div>

       <SavedAppsModal 
         isOpen={isSavedAppsModalOpen} 
         onClose={() => setIsSavedAppsModalOpen(false)} 
         savedApps={savedApps} 
         onLoadApp={handleLoadApp} 
         onDeleteApp={handleDeleteSavedApp} 
         themeColors={themeColors}
         isAdmin={isAdmin}
       />
    </div>
  );
};
export default PlaygroundScreen;