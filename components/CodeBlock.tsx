import React, { useState, memo } from 'react';

interface CodeBlockProps {
  language: string; // e.g., 'python', 'javascript', or a filename like 'index.html'
  code: string;
  maxHeightClass?: string; // Tailwind class like 'max-h-60' for scrolling
}

const CodeBlock: React.FC<CodeBlockProps> = memo(({ language, code, maxHeightClass = 'max-h-96' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-[var(--color-border-glass)] bg-[var(--color-bg-code)] shadow-sm">
      <div className="flex justify-between items-center px-4 py-2.5 border-b border-[var(--color-border-glass)] bg-[var(--color-input-bg)]">
        <span className="text-xs font-bold uppercase opacity-60 font-mono text-[var(--color-text-muted)]">
          {language}
        </span>
        <button onClick={handleCopy} className="text-xs font-bold opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1 text-[var(--color-text-muted)]">
          {copied ? <span className="text-green-500">Copied</span> : 'Copy'}
        </button>
      </div>
      <pre className={`p-4 overflow-x-auto text-sm font-mono scrollbar-hide ${maxHeightClass}`}>
        <code>{code}</code>
      </pre>
    </div>
  );
});

export default CodeBlock;