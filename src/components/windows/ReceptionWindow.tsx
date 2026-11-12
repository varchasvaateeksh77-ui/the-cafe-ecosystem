import React from 'react';
import { OrderTicket, WaiterNotification, formatPrice } from './demoStore';

interface ReceptionWindowProps {
  mode: 'waiter' | 'reception';
  waiterAlert?: WaiterNotification | null;
  onAcknowledgeWaiter?: () => void;
  ticket?: OrderTicket | null;
  onConfirmOrder?: () => void;
  compact?: boolean;
}

export const ReceptionWindow: React.FC<ReceptionWindowProps> = ({
  mode,
  waiterAlert,
  onAcknowledgeWaiter,
  ticket,
  onConfirmOrder,
  compact = false,
}) => {
  if (mode === 'waiter') {
    const orderTaken = waiterAlert?.status === 'Order taken';
    return (
      <div
        className={`bg-[#FFFFFF] text-[#1A0C06] rounded-[24px] border-2 border-[#E3D9D3] overflow-hidden flex flex-col ${
          compact ? 'w-full max-w-[300px]' : 'w-full max-w-[360px]'
        }`}
        data-testid="waiter-window"
      >
        <div className="bg-[#F7F2ED] px-4 py-2.5 border-b border-[#E3D9D3] flex items-center justify-between">
          <span className="font-semibold text-[13px] text-[#1A0C06]">Waiter screen</span>
          <span className="px-2 py-0.5 rounded-[6px] bg-[#F3ECE5] text-[#C03E0A] font-mono-code text-[11px] font-semibold uppercase">
            Demo
          </span>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {waiterAlert ? (
            <div className="p-3.5 rounded-[16px] bg-[#FFEEE3] border border-[#E8500C]/40 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[15px] text-[#1A0C06]">
                  Table {waiterAlert.table}
                </span>
                <span
                  className="px-2.5 py-0.5 rounded-[6px] bg-[#E8500C] text-[#FBEFE6] text-[12px] font-semibold"
                  data-testid="waiter-alert-status"
                >
                  {waiterAlert.status}
                </span>
              </div>
              <div className="text-[13px] text-[#6C625C]">
                {waiterAlert.itemsSummary}
              </div>

              {/* Live floor path showing waiter walking from Counter to Table 5 */}
              <div className="p-2.5 rounded-[12px] bg-[#140905] text-[#FBEFE6] flex items-center justify-between gap-2">
                <div className="text-[11px]">
                  <div className="font-mono-code text-[10px] text-[#FF8741]">
                    Floor dispatch
                  </div>
                  <div className="font-semibold text-[#FBEFE6]">
                    {orderTaken
                      ? 'Waiter at Table 5 · Order taken'
                      : 'Waiter walking to Table 5'}
                  </div>
                </div>
                <svg width="110" height="44" viewBox="0 0 110 44" fill="none" aria-hidden="true">
                  <rect x="4" y="10" width="28" height="24" rx="4" fill="#2A180D" stroke="#F7F2ED" strokeOpacity="0.4" />
                  <text x="18" y="25" fill="#FBEFE6" fontSize="7.5" textAnchor="middle">Counter</text>
                  <line x1="34" y1="22" x2="78" y2="22" stroke="#FF8741" strokeWidth="1.5" strokeDasharray="3 2" />
                  <circle cx="90" cy="22" r="12" fill="#E8500C" />
                  <text x="90" y="25" fill="#FBEFE6" fontSize="8" fontWeight="700" textAnchor="middle">T5</text>
                  <circle
                    cx={orderTaken ? 74 : 56}
                    cy="22"
                    r="6"
                    fill="#F7F2ED"
                    stroke="#E8500C"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[#E3D9D3]">
                <span className="font-mono-code text-[13px] font-semibold text-[#1A0C06] tabular-nums">
                  Cart {formatPrice(waiterAlert.total)}
                </span>
                {onAcknowledgeWaiter && waiterAlert.status === 'Needs you' && (
                  <button
                    type="button"
                    onClick={onAcknowledgeWaiter}
                    className="px-3.5 py-1.5 rounded-[8px] bg-[#1A0C06] text-[#FBEFE6] text-[12px] font-semibold hover:bg-[#E8500C] transition-colors cursor-pointer"
                  >
                    Mark order taken
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-[13px] text-[#6C625C]">
              No tables calling right now. Tap "Call waiter" on the guest phone.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-[#FFFFFF] text-[#1A0C06] rounded-[24px] border-2 border-[#E3D9D3] overflow-hidden flex flex-col ${
        compact ? 'w-full max-w-[290px]' : 'w-full max-w-[340px]'
      }`}
      data-testid="reception-window"
    >
      <div className="bg-[#F7F2ED] px-4 py-2.5 border-b border-[#E3D9D3] flex items-center justify-between">
        <span className="font-semibold text-[13px] text-[#1A0C06]">Reception screen</span>
        <span className="px-2 py-0.5 rounded-[6px] bg-[#F3ECE5] text-[#C03E0A] font-mono-code text-[11px] font-semibold uppercase">
          Demo
        </span>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {ticket ? (
          <div className="p-3.5 rounded-[16px] bg-[#F7F2ED] border border-[#E3D9D3] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[15px] text-[#1A0C06]">
                  Table {ticket.table}
                </span>
                <span className="font-mono-code text-[12px] text-[#6C625C]">
                  {ticket.ticketNumber}
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-[6px] bg-[#FFEEE3] text-[#C03E0A] text-[12px] font-semibold">
                {ticket.receptionConfirmed ? 'Confirmed' : 'Incoming'}
              </span>
            </div>

            <div className="flex flex-col gap-1 text-[13px] text-[#6C625C]">
              {ticket.items.map((item) => (
                <div key={item.dish.id} className="flex justify-between">
                  <span>
                    {item.qty}x {item.dish.name}
                  </span>
                  <span className="font-mono-code tabular-nums">
                    {formatPrice(item.dish.price * item.qty)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#E3D9D3]">
              <span className="font-mono-code font-bold text-[13px] text-[#1A0C06] tabular-nums">
                Total {formatPrice(ticket.total)}
              </span>
              {!ticket.receptionConfirmed && onConfirmOrder && (
                <button
                  type="button"
                  onClick={onConfirmOrder}
                  className="px-3.5 py-1.5 rounded-[8px] bg-[#E8500C] text-[#FBEFE6] text-[12px] font-semibold hover:bg-[#C03E0A] transition-colors cursor-pointer"
                >
                  Confirm order
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-[13px] text-[#6C625C]">
            Waiting for incoming table orders.
          </div>
        )}
      </div>
    </div>
  );
};
