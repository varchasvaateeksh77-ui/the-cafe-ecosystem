import React from 'react';
import { OrderTicket } from './demoStore';

interface KitchenWindowProps {
  ticket?: OrderTicket | null;
  onAdvanceStatus?: () => void;
  compact?: boolean;
}

export const KitchenWindow: React.FC<KitchenWindowProps> = ({
  ticket,
  onAdvanceStatus,
  compact = false,
}) => {
  const steps: Array<OrderTicket['kitchenStatus']> = ['New', 'Cooking', 'Ready', 'Served'];

  return (
    <div
      className={`bg-[#FFFFFF] text-[#1A0C06] rounded-[24px] border-2 border-[#E3D9D3] overflow-hidden flex flex-col ${
        compact ? 'w-full max-w-[290px]' : 'w-full max-w-[340px]'
      }`}
      data-testid="kitchen-window"
    >
      <div className="bg-[#F7F2ED] px-4 py-2.5 border-b border-[#E3D9D3] flex items-center justify-between">
        <span className="font-semibold text-[13px] text-[#1A0C06]">Kitchen screen</span>
        <span className="px-2 py-0.5 rounded-[6px] bg-[#F3ECE5] text-[#C03E0A] font-mono-code text-[11px] font-semibold uppercase">
          Demo
        </span>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {ticket ? (
          <div className="p-3.5 rounded-[16px] bg-[#F7F2ED] border border-[#E3D9D3] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono-code font-bold text-[14px] text-[#1A0C06]">
                  {ticket.ticketNumber}
                </span>
                <span className="text-[13px] font-semibold text-[#6C625C]">
                  · Table {ticket.table}
                </span>
              </div>
              <span
                className="px-2.5 py-0.5 rounded-[6px] bg-[#E8500C] text-[#FBEFE6] text-[12px] font-semibold"
                data-testid="kitchen-ticket-status"
              >
                {ticket.kitchenStatus}
              </span>
            </div>

            {/* Step indicators */}
            <div className="grid grid-cols-4 gap-1">
              {steps.map((step) => {
                const active = ticket.kitchenStatus === step;
                return (
                  <div
                    key={step}
                    className={`text-center py-1 rounded-[6px] text-[11px] font-semibold ${
                      active
                        ? 'bg-[#1A0C06] text-[#FBEFE6]'
                        : 'bg-[#F3ECE5] text-[#6C625C]'
                    }`}
                  >
                    {step}
                  </div>
                );
              })}
            </div>

            {/* Items */}
            <div className="flex flex-col gap-1 text-[13px] text-[#1A0C06]">
              {ticket.items.map((item) => (
                <div key={item.dish.id} className="font-medium">
                  {item.qty}x {item.dish.name}
                </div>
              ))}
            </div>

            {onAdvanceStatus && ticket.kitchenStatus !== 'Served' && (
              <button
                type="button"
                onClick={onAdvanceStatus}
                className="w-full h-9 rounded-[8px] bg-[#1A0C06] text-[#FBEFE6] text-[13px] font-semibold hover:bg-[#E8500C] transition-colors cursor-pointer"
              >
                {ticket.kitchenStatus === 'New'
                  ? 'Start cooking'
                  : ticket.kitchenStatus === 'Cooking'
                  ? 'Mark ready'
                  : 'Mark served'}
              </button>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-[13px] text-[#6C625C]">
            No active tickets in the kitchen pass.
          </div>
        )}
      </div>
    </div>
  );
};
