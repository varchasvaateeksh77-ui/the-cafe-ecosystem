import React from 'react';

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  id,
  label,
  error,
  optional = false,
  children,
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[14px] font-semibold text-[#1A0C06] flex items-center justify-between"
      >
        <span>{label}</span>
        {optional && (
          <span className="text-[12px] font-normal text-[#6C625C]">Optional</span>
        )}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[13px] font-medium text-[#C03E0A] m-0">
          {error}
        </p>
      )}
    </div>
  );
};
