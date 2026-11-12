import React from 'react';

interface SectionLabelProps {
  text: string;
  onDark?: boolean;
}

export const SectionLabel: React.FC<SectionLabelProps> = ({ text, onDark = false }) => {
  return (
    <div className="inline-flex items-center gap-2 mb-3">
      <span
        aria-hidden="true"
        className="w-2.5 h-2.5 rounded-[2px] bg-[#E8500C] shrink-0"
      />
      <span
        className={`text-[14px] font-semibold tracking-[-0.01em] ${
          onDark ? 'text-[#FF8741]' : 'text-[#C03E0A]'
        }`}
      >
        {text}
      </span>
    </div>
  );
};

interface AnnouncementPillProps {
  text: string;
  href: string;
}

export const AnnouncementPill: React.FC<AnnouncementPillProps> = ({ text, href }) => {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-[#FBEFE6]/25 bg-[#140905]/40 text-[#FBEFE6] text-[13px] md:text-[14px] font-medium hover:border-[#FBEFE6]/50 transition-colors duration-150 no-underline whitespace-nowrap"
    >
      <span aria-hidden="true" className="w-2 h-2 rounded-[2px] bg-[#E8500C] shrink-0" />
      <span>{text}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d="M2.5 6H9.5M9.5 6L6.5 3M9.5 6L6.5 9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
};
