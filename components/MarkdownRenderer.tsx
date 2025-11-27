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
          const language = lines[0].replace(/```/g, '').trim().toLowerCase() || 'code';
          const code = lines.slice(1, -1).join('\n');

          return <CodeBlock key={blockIndex} language={language} code={code} />;
        } else {
          return (
             <div key={blockIndex} className="whitespace-pre-wrap">
               {block.split('\n').map((line, i) => {
                  const t = line.trim();
                  if (t.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-4 mb-2">{t.replace('### ','')}</h3>;
                  if (t.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-6 mb-3 border-b border-[var(--color-border-glass)] pb-2">{t.replace('## ','')}</h2>;
                  if (t.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-8 mb-4">{t.replace('# ','')}</h1>;
                  if (t.match(/^[-*]\s/)) return <li key={i} className="ml-4 list-disc marker:opacity-50 pl-2">{t.replace(/^[-*]\s/,'')}</li>;
                  if (t.match(/^\d+\.\s/)) return <div key={i} className="ml-4 flex gap-2 my-1"><span className="font-bold opacity-60 text-[var(--color-text-muted)]">{t.match(/^\d+\./)?.[0]}</span><span>{t.replace(/^\d+\.\s/,'')}</span></div>;
                  return <div key={i} className="min-h-[1rem]">{line}</div>;
               })}
             </div>
          );
        }
      })}
    </div>
  );
});

export default MarkdownRenderer;