import React, { memo } from 'react';
import CodeBlock from './CodeBlock'; // Import the new CodeBlock component

interface MarkdownRendererProps { content: string; }

const MarkdownRenderer: React.FC<MarkdownRendererProps> = memo(({ content }) => {
  const blocks = content.split(/(```(?:[\w-]*)?[\s\S]*?```)/g);

  return (
    <div className="space-y-4 w-full text-[15px] leading-7 break-words font-sans text-[var(--color-text-base)]">
      {blocks.map((block, blockIndex) => {
        if (block.startsWith('```')) {
          const lines = block.split('\n');
          // Heuristic to determine language: if first line after ``` is a known language, use it.
          // Otherwise, it might be part of the code or a filename. Default to 'code'.
          const firstLineAfterDelimiter = lines[0].replace(/```/g, '').trim();
          const language = firstLineAfterDelimiter || 'code';
          const code = lines.slice(1, -1).join('\n');

          return <CodeBlock key={blockIndex} language={language} code={code} />;
        } else {
          return (
             <div key={blockIndex} className="whitespace-pre-wrap">
               {block.split('\n').map((line, i) => {
                  const trimmedLine = line.trim();
                  if (trimmedLine.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-4 mb-2">{trimmedLine.replace('### ','')}</h3>;
                  if (trimmedLine.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-6 mb-3 border-b border-[rgba(var(--color-panel-border-rgb),0.5)] pb-2">{trimmedLine.replace('## ','')}</h2>;
                  if (trimmedLine.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-8 mb-4">{trimmedLine.replace('# ','')}</h1>;
                  if (trimmedLine.match(/^[-*]\s/)) return <li key={i} className="ml-4 list-disc marker:text-[rgba(var(--theme-primary-rgb),0.7)] pl-2">{trimmedLine.replace(/^[-*]\s/,'')}</li>;
                  if (trimmedLine.match(/^\d+\.\s/)) return <div key={i} className="ml-4 flex gap-2 my-1"><span className="font-bold opacity-60 text-[var(--color-text-muted)]">{trimmedLine.match(/^\d+\./)?.[0]}</span><span>{trimmedLine.replace(/^\d+\.\s/,'')}</span></div>;
                  return <p key={i} className="min-h-[1rem]">{line}</p>; // Use <p> for paragraphs
               })}
             </div>
          );
        }
      })}
    </div>
  );
});

export default MarkdownRenderer;