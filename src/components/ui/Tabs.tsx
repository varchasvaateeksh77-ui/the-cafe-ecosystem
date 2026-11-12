import React from 'react';

export interface TabOption<T extends string | number> {
  id: T;
  label: string;
}

interface TabsProps<T extends string | number> {
  options: TabOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  variant?: 'peach-pill' | 'underline';
  className?: string;
}

export function Tabs<T extends string | number>({
  options,
  activeId,
  onChange,
  ariaLabel,
  variant = 'peach-pill',
  className = '',
}: TabsProps<T>) {
  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = options[(idx + 1) % options.length];
      onChange(next.id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = options[(idx - 1 + options.length) % options.length];
      onChange(prev.id);
    }
  };

  if (variant === 'underline') {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={`flex flex-wrap items-center gap-2 border-b border-[#E3D9D3] pb-3 ${className}`}
      >
        {options.map((opt, idx) => {
          const isActive = opt.id === activeId;
          return (
            <button
              key={String(opt.id)}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => onChange(opt.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`px-4 py-2 rounded-[10px] text-[15px] font-semibold transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#1A0C06] text-[#FBEFE6]'
                  : 'bg-[#F3ECE5] text-[#6C625C] hover:text-[#1A0C06]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 p-1 sm:p-1.5 rounded-[16px] bg-[#FFEEE3]/90 border border-[#E3D9D3] max-w-full overflow-x-auto ${className}`}
    >
      {options.map((opt, idx) => {
        const isActive = opt.id === activeId;
        return (
          <button
            key={String(opt.id)}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(opt.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-[12px] text-[13px] sm:text-[15px] font-semibold transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
              isActive
                ? 'bg-[#FFFFFF] text-[#1A0C06] border border-[#E3D9D3]'
                : 'bg-transparent text-[#6C625C] hover:text-[#1A0C06]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
