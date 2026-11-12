import React, { useState } from 'react';

export interface AccordionItem {
  q: string;
  a: string;
}

interface AccordionProps {
  items: AccordionItem[];
}

export const Accordion: React.FC<AccordionProps> = ({ items }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        const panelId = `faq-panel-${idx}`;
        const btnId = `faq-btn-${idx}`;

        return (
          <div
            key={item.q}
            className="bg-[#FFFFFF] rounded-[24px] border border-[#E3D9D3] overflow-hidden"
          >
            <button
              id={btnId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left text-[17px] md:text-[18px] font-semibold text-[#1A0C06] hover:text-[#C03E0A] transition-colors duration-150 cursor-pointer"
            >
              <span>{item.q}</span>
              <span
                aria-hidden="true"
                className="w-7 h-7 rounded-[8px] bg-[#F3ECE5] flex items-center justify-center shrink-0 text-[#1A0C06]"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className={`transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
                >
                  <path
                    d="M6 1.5V10.5M1.5 6H10.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </button>
            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={btnId}
                className="px-6 pb-5 pt-0 text-[15px] md:text-[16px] leading-[1.5] text-[#6C625C]"
              >
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
