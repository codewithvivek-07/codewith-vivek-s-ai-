import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { generateAppCode, streamGeminiResponse } from '../services/geminiService';
import { Message, Role } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
// import CodeBlock from './CodeBlock'; // Using textarea for live editing

interface PlaygroundProps { 
  isOpen: boolean; 
  onClose: () => void; 
  isAdmin: boolean; 
  themeColors: any; // Passed from App.tsx
  aiName: string; // Base AI Name from App.tsx
}

const PlaygroundOverlay: React.FC<PlaygroundProps> = ({ isOpen, onClose, isAdmin, themeColors, aiName: baseAiName }) => {
  const [initialPrompt, setInitialPrompt] = useState('');
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [activeFilename, setActiveFilename] = useState<string | null>(null);
  const [editedFileContent, setEditedFileContent] = useState<string>('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [playgroundMessages, setPlaygroundMessages] = useState<Message[]>([]);
  const [playgroundInput, setPlaygroundInput] = useState('');
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false); // New state for fullscreen

  const playgroundChatEndRef = useRef<HTMLDivElement>(null);
  const codeEditorRef = useRef<HTMLTextAreaElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null); // New ref for the iframe

  const playgroundAiName = isAdmin ? "Dilli Dev Bot" : "Playground AI";

  // --- Utility to create preview HTML ---
  const generatePreviewContent = useCallback((currentFiles: Record<string, string>, currentActiveFilename: string | null, currentEditedFileContent: string): string => {
    let tempFiles = { ...currentFiles };
    if (currentActiveFilename && currentEditedFileContent !== null) { // Check for null explicitly
      tempFiles[currentActiveFilename] = currentEditedFileContent;
    }

    const indexKey = Object.keys(tempFiles).find(k => k.toLowerCase() === 'index.html' || k.toLowerCase() === 'index.htm' || k.toLowerCase() === 'main.html')
                     || Object.keys(tempFiles).find(k => k.endsWith('.html'));
    
    let html = indexKey ? tempFiles[indexKey] : '';
    
    if (!html) {
        // Use CSS variables directly for styling error message
        return `<html><body style="background:var(--bg-body);color:rgb(var(--theme-primary-rgb));display:flex;align-items:center;justify-content:center;height:100vh;font-family:var(--font-sans);text-transform:uppercase;"><h2>ERROR: ENTRY_POINT_MISSING</h2></body></html>`;
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

    return html;
  }, []); // No need for isAdmin in useCallback deps, as CSS vars handle it

  // --- Effects ---
  useEffect(() => {
    if (!isOpen) {
      // Cleanup on close
      setInitialPrompt('');
      setFiles(null);
      setActiveFilename(null);
      setEditedFileContent('');
      setPreviewHtml(null);
      setPlaygroundMessages([]);
      setPlaygroundInput('');
      setPlaygroundLoading(false);
      setDeviceView('desktop');
      setIsFullscreen(false); // Reset fullscreen state
      return;
    };

    // Initial playground message
    if (playgroundMessages.length === 0) {
      setPlaygroundMessages([{ id: 'pg_welcome', role: Role.MODEL, text: isAdmin ? "Kya scene hai boss! Admin mode mein Playground hazir hai. Bol, kya banau ya kya fix karu? No fikar, no sharam, seedha kaam pe lag jaate hain." : "Welcome to the Playground! Describe an app you want to build, or ask me to modify existing code.", timestamp: Date.now() }]);
    }
  }, [isOpen, isAdmin, playgroundMessages.length]); // Re-run if isOpen changes or if messages length is 0 and it becomes 0

  useEffect(() => {
    if (files && activeFilename !== null && editedFileContent !== null) {
      setPreviewHtml(generatePreviewContent(files, activeFilename, editedFileContent));
    } else if (files && Object.keys(files).length > 0) {
      // If files exist but no active file selected, select the first one
      const firstFile = Object.keys(files)[0];
      setActiveFilename(firstFile);
      setEditedFileContent(files[firstFile]);
    }
  }, [files, activeFilename, editedFileContent, generatePreviewContent]);

  useEffect(() => {
    playgroundChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [playgroundMessages]);

  // Effect for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (!isOpen) return null;

  // --- Handlers ---
  const handleInitialGenerate = async () => {
    if (!initialPrompt.trim()) return;
    setPlaygroundLoading(true);
    try {
      setPlaygroundMessages(prev => [...prev, { id: Date.now().toString(), role: Role.USER, text: initialPrompt, timestamp: Date.now() }]);
      const aiResponseId = (Date.now() + 1).toString();
      setPlaygroundMessages(prev => [...prev, { id: aiResponseId, role: Role.MODEL, text: isAdmin ? "Theek hai boss, tera app banake deta hoon. Zara sabar kar." : "Okay, building your app...", isStreaming: true, timestamp: Date.now() }]);

      const generatedFiles = await generateAppCode(initialPrompt, isAdmin);
      setFiles(generatedFiles);
      setPlaygroundMessages(prev => prev.map(m => m.id === aiResponseId ? { ...m, text: isAdmin ? "Le boss, tera app ready hai. Dekh, aur bata kya change karna hai." : "App built successfully!", isStreaming: false } : m));
      
      const firstHtmlFile = Object.keys(generatedFiles).find(k => k.endsWith('.html'));
      if (firstHtmlFile) {
        setActiveFilename(firstHtmlFile);
        setEditedFileContent(generatedFiles[firstHtmlFile]);
      } else if (Object.keys(generatedFiles).length > 0) {
        const firstFile = Object.keys(generatedFiles)[0];
        setActiveFilename(firstFile);
        setEditedFileContent(generatedFiles[firstFile]);
      }
      setInitialPrompt(''); // Clear initial prompt after generation
    } catch (e: any) {
      console.error("Playground initial generate error:", e);
      setPlaygroundMessages(prev => [...prev, { id: Date.now().toString(), role: Role.MODEL, text: isAdmin ? `Firse locha ho gaya boss! ${e.message || 'Kuch gadbad ho gayi.'}` : `Error building app: ${e.message}`, timestamp: Date.now() }]);
    } finally {
      setPlaygroundLoading(false);
    }
  };

  const handleFileSelect = (filename: string) => {
    // Save current edits if any before switching file
    if (activeFilename && files && editedFileContent !== null) {
      setFiles(prev => ({ ...prev!, [activeFilename]: editedFileContent }));
    }
    setActiveFilename(filename);
    setEditedFileContent(files![filename]);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setEditedFileContent(newContent);
    // Auto-update preview with local edits as user types
    if (files && activeFilename) {
      setPreviewHtml(generatePreviewContent(files, activeFilename, newContent));
    }
  };

  const handlePlaygroundSend = async () => {
    if (!playgroundInput.trim() || playgroundLoading || !files) return;

    const userMsgText = playgroundInput.trim();
    setPlaygroundInput('');
    setPlaygroundMessages(prev => [...prev, { id: Date.now().toString(), role: Role.USER, text: userMsgText, timestamp: Date.now() }]);
    setPlaygroundLoading(true);

    // Apply any current local edits to the 'files' state before sending to AI
    const currentFilesWithEdits = { ...files };
    if (activeFilename && editedFileContent !== null) {
      currentFilesWithEdits[activeFilename] = editedFileContent;
    }

    const aiResponseId = (Date.now() + 1).toString();
    setPlaygroundMessages(prev => [...prev, { id: aiResponseId, role: Role.MODEL, text: isAdmin ? "Theek hai, check karta hoon..." : "Processing your request...", isStreaming: true, timestamp: Date.now() }]);

    // Heuristics to decide between code modification and chat
    const codeModificationKeywords = ['add', 'create', 'make', 'change', 'update', 'modify', 'refactor', 'fix', 'implement', 'build', 'remove', 'delete'];
    const isCodeModificationRequest = codeModificationKeywords.some(keyword => userMsgText.toLowerCase().includes(keyword));

    try {
      if (isCodeModificationRequest) {
        // User wants to modify the code
        const updatedFiles = await generateAppCode(userMsgText, isAdmin, currentFilesWithEdits);
        setFiles(updatedFiles);
        // Refresh active file content if it was changed by AI
        if (activeFilename && updatedFiles[activeFilename] !== undefined) {
          setEditedFileContent(updatedFiles[activeFilename]);
        }
        setPlaygroundMessages(prev => prev.map(m => m.id === aiResponseId ? { ...m, text: isAdmin ? "Code update kar diya hai boss. Dekh le preview." : "Code updated. Preview refreshed.", isStreaming: false } : m));
      } else {
        // User wants an explanation or general chat about the code
        // For explanation, provide the active file's content as context
        const fileContextToSend = (activeFilename && editedFileContent !== null) ? { content: editedFileContent, name: activeFilename } : undefined;

        await streamGeminiResponse(
          userMsgText,
          playgroundMessages, // Pass current playground chat history
          isAdmin,
          playgroundAiName, // Custom AI Name for playground
          isAdmin ? "You are a no-nonsense, street-smart Delhi developer AI. Use Hinglish with local slang, no filters. Your goal is to help the user build/understand apps in the Playground." : "You are a helpful app development assistant in the playground. Explain code and assist in building apps.",
          (txt) => setPlaygroundMessages(prev => prev.map(m => m.id === aiResponseId ? { ...m, text: txt } : m)),
          (final) => setPlaygroundMessages(prev => prev.map(m => m.id === aiResponseId ? { ...m, text: final, isStreaming: false } : m)),
          (err) => setPlaygroundMessages(prev => prev.map(m => m.id === aiResponseId ? { ...m, text: isAdmin ? `Locha ho gaya! ${err.message}` : `Error: ${err.message}`, isStreaming: false } : m)),
          undefined, // no attachment
          fileContextToSend // file context for explanation
        );
      }
    } catch (e: any) {
      console.error("Playground AI interaction error:", e);
      setPlaygroundMessages(prev => prev.map(m => m.id === aiResponseId ? { ...m, text: isAdmin ? `Uff! Phir se gadbad. ${e.message || 'Kuch error aa gaya.'}` : `An error occurred: ${e.message}`, isStreaming: false } : m));
    } finally {
      setPlaygroundLoading(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!files || !window.JSZip) return;
    // Ensure all current edits are saved to files state before zipping
    const filesToZip = { ...files };
    if (activeFilename && editedFileContent !== null) {
      filesToZip[activeFilename] = editedFileContent;
    }

    const zip = new window.JSZip();
    Object.entries(filesToZip).forEach(([filename, content]) => {
      zip.file(filename, content);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "playground_project.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadFile = (filename: string) => {
    if (!files || files[filename] === undefined) return;
    const content = (activeFilename === filename && editedFileContent !== null) ? editedFileContent : files[filename];
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetPlayground = () => {
    setInitialPrompt('');
    setFiles(null);
    setActiveFilename(null);
    setEditedFileContent('');
    setPreviewHtml(null);
    setPlaygroundMessages([{ id: 'pg_welcome', role: Role.MODEL, text: isAdmin ? "Naya shuru karein boss? Kya banayेंगे ab?" : "Starting fresh! What would you like to build?", timestamp: Date.now() }]);
    setPlaygroundInput('');
    setPlaygroundLoading(false);
  };

  const handleOpenNewTab = () => {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleToggleFullscreen = () => {
    const iframeElement = previewIframeRef.current;
    if (iframeElement) {
      if (!document.fullscreenElement) {
        iframeElement.requestFullscreen().catch((err) => {
          console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };


  const isWebApp = files && Object.keys(files).some(k => k.endsWith('.html') || k.endsWith('.htm'));
  const isNativeApp = files && Object.keys(files).some(k => k.includes('AndroidManifest.xml') || k.includes('.java') || k.includes('.kt'));

  // Styles for iframe based on device view
  const iframeStyles = {
    width: deviceView === 'desktop' ? '100%' : deviceView === 'tablet' ? '768px' : '375px',
    height: deviceView === 'desktop' ? '100%' : deviceView === 'tablet' ? '1024px' : '667px',
    border: deviceView === 'desktop' ? 'none' : `4px solid rgb(${isAdmin ? 'var(--theme-admin-rgb)' : 'var(--theme-primary-rgb)'})`,
    borderRadius: deviceView === 'desktop' ? '0' : '20px',
    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    backgroundColor: 'white',
    margin: '0 auto',
    boxShadow: deviceView === 'desktop' ? 'none' : `0 25px 50px -12px rgba(${isAdmin ? 'var(--theme-admin-rgb)' : 'var(--theme-primary-rgb)'}, 0.5)`
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--bg-body)] animate-fade-in rounded-3xl">
       {/* Header */}
       <div className={`p-4 border-b border-[rgba(var(--color-panel-border-rgb),1)] flex justify-between items-center app-panel shadow-panel-glow ${themeColors.adminGlow}`}>
         <h2 className={`font-bold text-xl ${themeColors.accent}`}>Playground {isAdmin && '(ADMIN)'}</h2>
         <div className="flex items-center gap-3">
            {isWebApp && files && (
              <>
                <button 
                  onClick={handleOpenNewTab} 
                  className={`px-4 py-2 bg-[var(--color-input-bg)] border border-[rgba(var(--color-panel-border-rgb),0.5)] text-[var(--color-text-muted)] hover:border-[rgba(var(--theme-primary-rgb),0.3)] hover:text-[var(--color-text-base)] hover:shadow-neon-sm font-bold text-sm uppercase tracking-wider transition-all duration-150 ease-in-out items-center gap-2 rounded-xl flex`}
                  title="Open in New Tab"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </button>
                <button 
                  onClick={handleToggleFullscreen} 
                  className={`px-4 py-2 bg-[var(--color-input-bg)] border border-[rgba(var(--color-panel-border-rgb),0.5)] text-[var(--color-text-muted)] hover:border-[rgba(var(--theme-primary-rgb),0.3)] hover:text-[var(--color-text-base)] hover:shadow-neon-sm font-bold text-sm uppercase tracking-wider transition-all duration-150 ease-in-out items-center gap-2 rounded-xl flex`}
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15L3.75 20.25M15 9V4.5M15 9H19.5M15 9L20.25 3.75M15 15v4.5M15 15H19.5M15 15L20.25 20.25" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                  )}
                </button>
              </>
            )}

            {files && (
              <button onClick={handleDownloadZip} className={`px-4 py-2 rounded-xl font-bold text-sm transition-all duration-150 ease-in-out ${themeColors.button}`}>
                Download Project (ZIP)
              </button>
            )}
            <button onClick={onClose} className="p-2 bg-[var(--color-input-bg)] rounded-full text-[var(--color-text-muted)] hover:opacity-80 transition-opacity border border-transparent hover:border-[rgba(var(--theme-primary-rgb),0.3)] hover:shadow-neon-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
         </div>
       </div>

       {/* Main Content Area */}
       <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Pane: Controls & File Explorer */}
          <div className="w-full md:w-1/4 min-w-[250px] p-4 border-b md:border-b-0 md:border-r border-[rgba(var(--color-panel-border-rgb),1)] flex flex-col gap-4 app-panel">
             {(!files || Object.keys(files).length === 0) ? (
                <>
                  <textarea 
                    className="w-full flex-1 bg-[var(--color-input-bg)] rounded-xl p-3 resize-none outline-none focus:ring-0 focus:shadow-input-focus-glow placeholder-[var(--color-text-muted)] text-sm text-[var(--color-text-base)]" 
                    placeholder={isAdmin ? "Kya banau boss? Jaise 'ek to-do list app, ekdum faadu style mein'" : "Describe the app you want to build..."} 
                    value={initialPrompt} 
                    onChange={e => setInitialPrompt(e.target.value)}
                    disabled={playgroundLoading}
                  ></textarea>
                  <button 
                    onClick={handleInitialGenerate} 
                    disabled={!initialPrompt.trim() || playgroundLoading} 
                    className={`py-3 rounded-xl font-bold text-sm transition-all duration-150 ease-in-out ${(!initialPrompt.trim() || playgroundLoading) ? 'bg-gray-500/20 text-gray-500' : themeColors.button}`}
                  >
                    {playgroundLoading ? (isAdmin ? 'Ban raha hai...' : 'Building App...') : (isAdmin ? 'Bana de!' : 'Generate App')}
                  </button>
                </>
             ) : (
                <div className="flex-1 flex flex-col">
                  <h3 className="text-sm font-bold opacity-60 uppercase mb-2 text-[var(--color-text-muted)]">Project Files</h3>
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                    {Object.keys(files).map(filename => (
                      <button 
                        key={filename} 
                        onClick={() => handleFileSelect(filename)} 
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-mono transition-colors border duration-150 ease-in-out flex justify-between items-center
                          ${activeFilename === filename 
                            ? `bg-[rgba(var(--theme-primary-rgb),0.1)] border-[rgba(var(--theme-primary-rgb),0.3)] shadow-neon-sm ${themeColors.accent}` 
                            : `border-transparent hover:bg-[var(--color-input-bg)] hover:border-[rgba(var(--color-panel-border-rgb),0.3)] text-[var(--color-text-base)]`
                          }`}
                      >
                        <span className="truncate">{filename}</span>
                        <button onClick={(e) => { e.stopPropagation(); handleDownloadFile(filename); }} className="ml-2 p-1 text-[var(--color-text-muted)] hover:text-[rgb(var(--theme-primary-rgb))] rounded-full opacity-70 hover:opacity-100 transition-opacity duration-150 ease-in-out">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                      </button>
                    ))}
                  </div>
                  <button onClick={resetPlayground} className={`mt-4 w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-red-500 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 transition-colors duration-150 ease-in-out`}>
                    Start New Project
                  </button>
                </div>
             )}
          </div>

          {/* Middle Pane: Code Editor & Preview */}
          <div className="flex-1 flex flex-col overflow-hidden border-b md:border-b-0 md:border-r border-[rgba(var(--color-panel-border-rgb),1)]">
            {files && (
              <>
                {/* Code Editor */}
                <div className="h-1/2 flex flex-col border-b border-[rgba(var(--color-panel-border-rgb),1)]">
                  <div className="flex justify-between items-center px-4 py-2 bg-[var(--color-input-bg)] border-b border-[rgba(var(--color-panel-border-rgb),0.5)]">
                    <span className="text-sm font-bold opacity-60 font-mono text-[var(--color-text-muted)]">{activeFilename || 'No file selected'}</span>
                  </div>
                  <textarea 
                    ref={codeEditorRef}
                    className="flex-1 bg-[var(--color-bg-code)] font-mono text-sm p-4 resize-none outline-none overflow-auto text-[var(--color-text-base)]"
                    value={editedFileContent} 
                    onChange={handleCodeChange}
                    disabled={!activeFilename || playgroundLoading}
                    spellCheck="false"
                  />
                </div>

                {/* Preview */}
                <div className="h-1/2 flex flex-col relative bg-[var(--bg-body)]">
                   <div className="flex justify-between items-center px-4 py-2 border-b border-[rgba(var(--color-panel-border-rgb),0.5)] bg-[var(--color-input-bg)]">
                     <span className="text-sm font-bold opacity-60 font-mono text-[var(--color-text-muted)]">Live Preview {isNativeApp && '(No Live Preview for native apps)'}</span>
                     {!isNativeApp && (
                       <div className="flex bg-[var(--color-input-bg)] border border-[rgba(var(--color-panel-border-rgb),0.5)] p-1 gap-1 rounded-lg">
                         {(['desktop', 'tablet', 'mobile'] as const).map(d => (
                           <button 
                             key={d}
                             onClick={() => setDeviceView(d)}
                             className={`p-2 transition-all duration-150 ease-in-out rounded-md ${deviceView === d ? themeColors.toggleActive + ' text-white shadow-neon-sm' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-glass)]'}`}
                             title={d}
                           >
                            {d === 'desktop' && <i className="fas fa-desktop w-4 h-4"></i>}
                            {d === 'tablet' && <i className="fas fa-tablet-alt w-4 h-4"></i>}
                            {d === 'mobile' && <i className="fas fa-mobile-alt w-4 h-4"></i>}
                           </button>
                         ))}
                       </div>
                     )}
                   </div>
                   <div className="flex-1 flex items-center justify-center p-4">
                     {previewHtml && !isNativeApp ? (
                        <iframe 
                          ref={previewIframeRef} // Attach ref here
                          srcDoc={previewHtml}
                          title="Playground Preview"
                          style={iframeStyles}
                          sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
                        />
                     ) : (
                        <div className="flex flex-col items-center justify-center opacity-50 text-[var(--color-text-muted)]">
                           {isNativeApp ? (
                              <p className="mt-4 text-[10px] text-center max-w-sm">
                                Native Android projects cannot be previewed directly in browser.
                              </p>
                           ) : (
                              <p className="text-[10px] uppercase tracking-[0.2em] animate-pulse">
                                  {playgroundLoading ? 'Generating Preview...' : 'No Preview Available'}
                              </p>
                           )}
                        </div>
                     )}
                   </div>
                </div>
              </>
            )}
          </div>

          {/* Right Pane: Playground AI Chat */}
          <div className="w-full md:w-1/4 min-h-[250px] p-4 flex flex-col app-panel"> {/* Added min-h-[250px] for better mobile/stacked layout */}
            <h3 className="text-sm font-bold opacity-60 uppercase mb-2 text-[var(--color-text-muted)]">Playground AI Chat</h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {playgroundMessages.map((msg) => (
                <div key={msg.id} className={`flex flex-col max-w-full ${msg.role === Role.USER ? 'items-end' : 'items-start'}`}>
                  <div className={`relative px-4 py-3 text-[14px] leading-relaxed max-w-[90%]
                    ${msg.role === Role.USER 
                      ? themeColors.userBubble 
                      : themeColors.aiBubble
                    }`}>
                    {msg.isStreaming && !msg.text ? (
                       <div className="flex space-x-1 h-4 items-center">
                          <div className="w-1 h-1 bg-current rounded-full animate-bounce"></div>
                          <div className="w-1 h-1 bg-current rounded-full animate-bounce delay-75"></div>
                          <div className="w-1 h-1 bg-current rounded-full animate-bounce delay-150"></div>
                       </div>
                    ) : (
                      // Use a simplified MarkdownRenderer for chat messages
                      // For full markdown including code blocks, use MarkdownRenderer
                      <MarkdownRenderer content={msg.text} />
                    )}
                  </div>
                </div>
              ))}
              <div ref={playgroundChatEndRef} className="h-2" />
            </div>
            
            <div className="mt-4 relative flex-shrink-0"> {/* Added flex-shrink-0 here */}
              <textarea 
                className="w-full bg-[var(--color-input-bg)] rounded-xl p-3 pr-10 resize-none outline-none focus:ring-0 focus:shadow-input-focus-glow placeholder-[var(--color-text-muted)] text-sm text-[var(--color-text-base)]" 
                placeholder={isAdmin ? "Kya command hai boss? Code change karu ya kuch samjhau?" : "Ask about the code or request changes..."}
                value={playgroundInput} 
                onChange={e => setPlaygroundInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handlePlaygroundSend()}
                rows={3}
                disabled={!files || playgroundLoading}
              ></textarea>
              <button 
                onClick={handlePlaygroundSend} 
                disabled={!playgroundInput.trim() || !files || playgroundLoading} 
                className={`absolute bottom-3 right-3 p-2 rounded-full transition-all duration-150 ease-in-out 
                  ${(!playgroundInput.trim() || !files || playgroundLoading) ? 'bg-gray-500/20 text-gray-500' : themeColors.button}`}
              >
                {playgroundLoading ? <div className={`h-4 w-4 border-2 border-[rgba(var(--theme-primary-rgb),0.3)] border-t-[rgb(var(--theme-primary-rgb))] rounded-full animate-spin`} /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>}
              </button>
            </div>
          </div>
       </div>
    </div>
  );
};
export default PlaygroundOverlay;