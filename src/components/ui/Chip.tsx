import React, { useState } from 'react';

interface ChipProps {
  text: string;
  tag?: string;
  copyValue?: string;
  variant?: 'hero-dark' | 'beige';
  className?: string;
}

export const Chip: React.FC<ChipProps> = ({
  text,
  tag,
  copyValue,
  variant = 'beige',
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const val = copyValue || text;
    try {
      await navigator.clipboard.writeText(val);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  if (variant === 'hero-dark') {
    return (
      <div
        className={`inline-flex items-center justify-between gap-3 bg-[#140905] text-[#FBEFE6] pl-4 pr-1.5 py-1.5 rounded-[12px] border border-[#F7F2ED]/15 max-w-full ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
          {tag && (
            <span className="text-[12px] font-semibold px-2 py-0.5 rounded-[6px] bg-[#E8500C] text-[#FBEFE6] whitespace-nowrap shrink-0">
              {tag}
            </span>
          )}
          <code className="font-mono-code text-[14px] text-[#FBEFE6]/90 truncate">
            {text}
          </code>
        </div>
        {copyValue !== undefined && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Copy ${text}`}
            className="w-9 h-9 rounded-[10px] bg-[#2A180D] hover:bg-[#3D2314] text-[#FBEFE6] flex items-center justify-center shrink-0 transition-colors duration-150 cursor-pointer"
          >
            {copied ? (
              <span className="text-[11px] font-mono-code font-semibold text-[#E8500C]">OK</span>
            ) : (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <rect x="5" y="5" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M3 10V3.5C3 2.94772 3.44772 2.5 4 2.5H10"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 bg-[#F3ECE5] text-[#6C625C] px-3.5 py-1.5 rounded-[12px] font-mono-code text-[13px] font-medium whitespace-nowrap ${className}`}
    >
      {text}
    </span>
  );
};
