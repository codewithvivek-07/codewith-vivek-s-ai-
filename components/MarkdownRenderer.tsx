import React, { useState, memo } from 'react';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = memo(({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handlePreview = (code: string) => {
    setPreviewContent(code);
  };

  const blocks = content.split(/(```(?:[\w-]*)?[\s\S]*?```)/g);

  return (
    <div className="space-y-4 w-full text-base leading-relaxed break-words font-sans tracking-wide">
      {blocks.map((block, blockIndex) => {
        if (block.startsWith('```')) {
          const lines = block.split('\n');
          const language = lines[0].replace(/```/g, '').trim().toLowerCase() || 'code';
          
          let code = "";
          if (lines.length > 1) {
             const lastLine = lines[lines.length - 1];
             if (lastLine.trim().startsWith('```')) {
                 code = lines.slice(1, -1).join('\n');
             } else {
                 code = lines.slice(1).join('\n');
             }
          }

          const isPreviewable = language === 'html' || language === 'xml' || language === 'svg';

          return (
            <div key={blockIndex} className="my-6 overflow-hidden rounded border border-gray-700 bg-[#0c0c14] shadow-lg relative group">
              {/* Scanline overlay for code blocks */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none z-10 opacity-50"></div>
              
              <div className="flex justify-between items-center px-4 py-2 bg-[#1a1a24] border-b border-gray-700 relative z-20">
                <div className="flex items-center gap-2">
                   <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                      <div className="w-2 h-2 rounded-full bg-yellow-500/50"></div>
                      <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                   </div>
                   <span className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono ml-2">
                     {language}
                   </span>
                </div>
                <div className="flex gap-2">
                  {isPreviewable && (
                    <button 
                      onClick={() => handlePreview(code)}
                      className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Execute
                    </button>
                  )}
                  <button 
                    onClick={() => handleCopy(code, blockIndex)}
                    className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border border-gray-600 text-gray-400 hover:text-white hover:border-white transition-colors"
                  >
                    {copiedIndex === blockIndex ? (
                      <span className="flex items-center gap-1 text-green-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        COPIED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        COPY
                      </span>
                    )}
                  </button>
                </div>
              </div>
              
              <pre className="p-4 overflow-x-auto overflow-y-auto max-h-96 text-sm font-mono text-green-400 bg-black whitespace-pre scrollbar-thin relative z-20">
                <code>{code}</code>
              </pre>
            </div>
          );
        } else {
          const lines = block.split('\n');
          return (
            <div key={blockIndex} className="whitespace-pre-wrap">
              {lines.map((line, lineIndex) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('### ')) return <h3 key={lineIndex} className="text-lg font-bold mt-6 mb-2 text-blue-400 uppercase tracking-wide border-l-4 border-blue-500 pl-3">{parseInline(line.replace('### ', ''))}</h3>;
                if (trimmed.startsWith('## ')) return <h2 key={lineIndex} className="text-xl font-bold mt-8 mb-4 text-purple-400 uppercase tracking-widest border-b border-purple-500/30 pb-2">{parseInline(line.replace('## ', ''))}</h2>;
                if (trimmed.startsWith('# ')) return <h1 key={lineIndex} className="text-2xl font-bold mt-10 mb-6 text-white uppercase tracking-[0.2em] text-shadow-glow">{parseInline(line.replace('# ', ''))}</h1>;
                if (trimmed.match(/^[-*]\s/)) return <div key={lineIndex} className="flex gap-3 ml-2 my-2"><span className="text-cyan-500">▶</span><span>{parseInline(line.replace(/^[-*]\s/, ''))}</span></div>;
                if (trimmed.match(/^\d+\.\s/)) return <div key={lineIndex} className="flex gap-3 ml-2 my-2"><span className="text-cyan-500 font-mono font-bold">{line.match(/^\d+\./)?.[0]}</span><span>{parseInline(line.replace(/^\d+\.\s/, ''))}</span></div>;
                return trimmed === '' ? <div key={lineIndex} className="h-2"></div> : <div key={lineIndex} className="min-h-[1.5rem]">{parseInline(line)}</div>;
              })}
            </div>
          );
        }
      })}

      {/* Live Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-black border border-blue-500/50 rounded-xl overflow-hidden shadow-2xl shadow-blue-500/20 w-full max-w-4xl h-[80vh] flex flex-col relative">
             <div className="flex justify-between items-center p-3 bg-gray-900 border-b border-blue-500/30">
               <h3 className="font-bold text-blue-400 text-sm uppercase tracking-widest font-mono">Runtime_Environment</h3>
               <button onClick={() => setPreviewContent(null)} className="text-gray-500 hover:text-red-500 transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
             </div>
             <iframe 
               srcDoc={previewContent} 
               className="flex-1 w-full h-full border-none bg-white" 
               sandbox="allow-scripts allow-forms allow-same-origin"
             />
          </div>
        </div>
      )}
    </div>
  );
});

const parseInline = (text: string): React.ReactNode[] => {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.flatMap((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`code-${i}`} className="bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-neon-pink mx-0.5 border border-gray-700">{part.slice(1, -1)}</code>;
    }
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((subPart, j) => {
       if (subPart.startsWith('**') && subPart.endsWith('**')) return <strong key={`bold-${i}-${j}`} className="font-bold text-white text-shadow-sm">{subPart.slice(2, -2)}</strong>;
       return subPart;
    });
  });
};

export default MarkdownRenderer;