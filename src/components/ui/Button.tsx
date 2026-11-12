import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'white' | 'accent' | 'dark' | 'ghost';
  showArrow?: boolean;
  href?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'accent',
  showArrow = true,
  href,
  children,
  className = '',
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center gap-2.5 h-[50px] px-6 rounded-[12px] text-[16px] font-semibold tracking-[-0.01em] whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer select-none no-underline';

  const variants: Record<string, string> = {
    white: 'bg-[#FFFFFF] text-[#1A0C06] hover:bg-[#F7F2ED]',
    accent: 'bg-[#E8500C] text-[#FBEFE6] hover:bg-[#C03E0A]',
    dark: 'bg-[#1A0C06] text-[#FBEFE6] hover:bg-[#371307]',
    ghost: 'bg-transparent text-[#FBEFE6] border border-[#F7F2ED]/25 hover:bg-[#F7F2ED]/10',
  };

  const content = (
    <>
      <span>{children}</span>
      {showArrow && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          <path
            d="M2.5 7H11.5M11.5 7L7.5 3M11.5 7L7.5 11"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </>
  );

  if (href) {
    return (
      <a href={href} className={`${base} ${variants[variant]} ${className}`}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" className={`${base} ${variants[variant]} ${className}`} {...props}>
      {content}
    </button>
  );
};
