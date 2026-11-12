import React from 'react';

interface SkeletonProps {
  className?: string;
  label?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = 'h-32 w-full',
  label = 'Loading preview',
}) => {
  return (
    <div
      role="status"
      aria-label={label}
      className={`bg-[#F3ECE5] rounded-[16px] border border-[#E3D9D3] flex items-center justify-center text-[13px] text-[#6C625C] font-mono-code ${className}`}
    >
      <span>{label}</span>
    </div>
  );
};
