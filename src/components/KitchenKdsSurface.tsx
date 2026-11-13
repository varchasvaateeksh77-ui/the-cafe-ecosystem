import React, { useState } from 'react';
import { CafeEcosystemState, KitchenOrder } from '../lib/ecosystemStore';
import { UseShiftWakeLockResult } from '../lib/batteryWakeLock';

export interface KitchenKdsSurfaceProps {
  state: CafeEcosystemState;
  isStandaloneApk: boolean;
  wakeLock: UseShiftWakeLockResult;
  onSetOrderStatus: (orderId: string, nextStatus: KitchenOrder['status']) => void;
  onAdvanceOrder: (orderId: string) => void;
  onToggleItemCheck: (orderId: string, dishId: string) => void;
  onSpawnTestTicket: () => void;
}

export const KitchenKdsSurface: React.FC<KitchenKdsSurfaceProps> = ({
  state,
  isStandaloneApk,
  wakeLock,
  onSetOrderStatus,
  onAdvanceOrder,
  onToggleItemCheck,
  onSpawnTestTicket,
}) => {
  const [stageFilter, setStageFilter] = useState<'active' | 'all' | 'ready' | 'served'>('active');

  const activeCount = state.orders.filter((o) => o.status !== 'served').length;
  const visibleOrders = state.orders.filter((o) => {
    if (stageFilter === 'active') return o.status !== 'served';
    if (stageFilter === 'ready') return o.status === 'ready';
    if (stageFilter === 'served') return o.status === 'served';
    return true;
  });

  return (
    <section
      aria-label="Kitchen and Reception KDS App"
      data-testid="surface-kitchen-apk"
      className={`bg-[#FFFFFF] text-[#181615] flex flex-col overflow-hidden ${
        isStandaloneApk
          ? 'min-h-screen'
          : 'rounded-[16px] border border-[#E4E0D8]'
      }`}
    >
      {/* Kitchen Pass Header */}
      <div className="px-5 py-4 border-b border-[#E4E0D8] flex items-center justify-between gap-3 bg-[#FFFFFF]">
        <div className="min-w-0">
          <div className="text-[12px] text-[#5C5852] flex items-center gap-1.5">
            <span>Kitchen Pass KDS</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-code font-medium text-[#181615]">
              {activeCount} active
            </span>
          </div>
          <h3 className="font-display text-[20px] font-semibold text-[#181615] m-0 mt-0.5 truncate">
            4-Stage Ticket Rail
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {wakeLock.isSupported && (
            <button
              type="button"
              onClick={() =>
                wakeLock.isActive ? wakeLock.releaseWakeLock() : wakeLock.acquireWakeLock()
              }
              className={`min-h-[38px] px-3 rounded-[8px] border text-[12px] font-medium cursor-pointer whitespace-nowrap ${
                wakeLock.isActive
                  ? 'bg-[#ECFDF3] border-[#15803D]/40 text-[#15803D]'
                  : 'bg-[#FAF8F5] border-[#E4E0D8] text-[#5C5852]'
              }`}
            >
              {wakeLock.isActive ? 'KDS Awake' : 'Keep Awake'}
            </button>
          )}
          <button
            type="button"
            data-testid="kitchen-spawn-ticket-btn"
            onClick={onSpawnTestTicket}
            className="min-h-[38px] px-3.5 rounded-[8px] bg-[#181615] hover:bg-[#D9480F] text-[#FAF8F5] text-[12px] font-semibold cursor-pointer transition-colors whitespace-nowrap"
          >
            + Test Ticket
          </button>
        </div>
      </div>

      {/* Stage Filter Strip */}
      <div className="px-5 py-2.5 bg-[#FAF8F5] border-b border-[#E4E0D8] flex items-center gap-1.5 overflow-x-auto">
        {(
          [
            { id: 'active', label: `Active (${activeCount})` },
            { id: 'ready', label: `Ready (${state.orders.filter((o) => o.status === 'ready').length})` },
            { id: 'served', label: `Served (${state.orders.filter((o) => o.status === 'served').length})` },
            { id: 'all', label: `All (${state.orders.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStageFilter(tab.id)}
            className={`min-h-[34px] px-3 rounded-[8px] text-[12px] font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              stageFilter === tab.id
                ? 'bg-[#181615] text-[#FAF8F5]'
                : 'bg-[#FFFFFF] border border-[#E4E0D8] text-[#5C5852] hover:text-[#181615]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ticket List */}
      <div className="p-4 flex-1 flex flex-col gap-3.5 bg-[#FAF8F5]">
        {visibleOrders.length === 0 ? (
          <div className="p-6 rounded-[12px] bg-[#FFFFFF] border border-[#E4E0D8] text-center flex flex-col items-center gap-2">
            <p className="text-[13px] text-[#5C5852] m-0">
              No tickets in this stage right now.
            </p>
            <button
              type="button"
              onClick={onSpawnTestTicket}
              className="min-h-[38px] px-4 rounded-[8px] bg-[#181615] text-[#FAF8F5] text-[12px] font-semibold cursor-pointer"
            >
              Send Sample Ticket
            </button>
          </div>
        ) : (
          visibleOrders.map((ord) => {
            const stages: Array<KitchenOrder['status']> = ['new', 'cooking', 'ready', 'served'];
            const checkedIds = ord.checkedItemIds || [];
            const ticketKey = ord.ticketNumber.replace('#', '');
            return (
              <div
                key={ord.id}
                data-testid={`kitchen-ticket-${ticketKey}`}
                className={`p-4 rounded-[12px] bg-[#FFFFFF] border flex flex-col gap-3 ${
                  ord.status === 'ready'
                    ? 'border-[#15803D]/50'
                    : ord.status === 'incoming'
                    ? 'border-[#D9480F]/50'
                    : 'border-[#E4E0D8]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[12px] text-[#5C5852]">
                      Table {ord.tableNumber} · <span className="font-mono-code">{ord.createdAt}</span>
                    </div>
                    <div className="font-mono-code font-bold text-[19px] text-[#181615] mt-0.5">
                      {ord.ticketNumber}
                    </div>
                  </div>

                  <span
                    className={`text-[12px] font-semibold capitalize px-2.5 py-1 rounded-[6px] ${
                      ord.status === 'ready'
                        ? 'bg-[#ECFDF3] text-[#15803D]'
                        : ord.status === 'cooking'
                        ? 'bg-[#FEF3C7] text-[#B45309]'
                        : ord.status === 'incoming'
                        ? 'bg-[#FFF1EB] text-[#D9480F]'
                        : 'bg-[#EFECE6] text-[#5C5852]'
                    }`}
                  >
                    {ord.status}
                  </span>
                </div>

                {/* 4-Stage KDS Selector */}
                <div
                  className="grid grid-cols-4 gap-1.5"
                  role="group"
                  aria-label={`Set stage for ticket ${ord.ticketNumber}`}
                >
                  {stages.map((st) => {
                    const isSelected = ord.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        data-testid={`kds-stage-${ticketKey}-${st}`}
                        onClick={() => onSetOrderStatus(ord.id, st)}
                        className={`min-h-[36px] rounded-[8px] text-[12px] font-medium capitalize cursor-pointer transition-colors ${
                          isSelected
                            ? st === 'ready'
                              ? 'bg-[#15803D] text-[#FFFFFF]'
                              : 'bg-[#181615] text-[#FAF8F5]'
                            : 'bg-[#FAF8F5] border border-[#E4E0D8] text-[#5C5852] hover:text-[#181615]'
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>

                {/* Interactive Plated Item Checklist */}
                <div className="divide-y divide-[#E4E0D8] rounded-[8px] border border-[#E4E0D8] bg-[#FAF8F5] px-3">
                  {ord.items.map((item) => {
                    const isChecked = checkedIds.includes(item.dish.id);
                    return (
                      <button
                        key={item.dish.id}
                        type="button"
                        onClick={() => onToggleItemCheck(ord.id, item.dish.id)}
                        className="w-full min-h-[44px] flex items-center justify-between text-left py-2 cursor-pointer"
                      >
                        <span
                          className={`text-[13px] font-medium ${
                            isChecked ? 'line-through text-[#9C968E]' : 'text-[#181615]'
                          }`}
                        >
                          <strong className="font-mono-code text-[#D9480F] mr-1.5">
                            {isChecked ? '✓' : `${item.qty}×`}
                          </strong>
                          {item.dish.name}
                        </span>
                        <span className="font-mono-code text-[12px] text-[#5C5852]">
                          {state.currencySymbol}
                          {item.dish.price * item.qty}
                        </span>
                      </button>
                    );
                  })}
                  {ord.notes && (
                    <div className="py-2 text-[12px] text-[#B45309] font-medium">
                      Note: {ord.notes}
                    </div>
                  )}
                </div>

                {/* Primary Progression Action */}
                {!ord.receptionConfirmed && ord.status === 'incoming' ? (
                  <button
                    type="button"
                    data-testid={`kds-confirm-${ticketKey}-btn`}
                    onClick={() => onSetOrderStatus(ord.id, 'new')}
                    className="w-full min-h-[44px] rounded-[10px] bg-[#D9480F] hover:bg-[#B83B0A] text-[#FFFFFF] text-[13px] font-semibold cursor-pointer transition-colors"
                  >
                    Confirm at Reception · Queue {ord.ticketNumber}
                  </button>
                ) : ord.status !== 'served' ? (
                  <button
                    type="button"
                    data-testid={`kds-advance-${ticketKey}-btn`}
                    onClick={() => onAdvanceOrder(ord.id)}
                    className={`w-full min-h-[44px] rounded-[10px] text-[13px] font-semibold cursor-pointer transition-colors ${
                      ord.status === 'cooking'
                        ? 'bg-[#15803D] hover:bg-[#166534] text-[#FFFFFF]'
                        : 'bg-[#181615] hover:bg-[#D9480F] text-[#FAF8F5]'
                    }`}
                  >
                    {ord.status === 'new'
                      ? `Start Cooking ${ord.ticketNumber}`
                      : ord.status === 'cooking'
                      ? 'Mark Dish Ready & Notify Waiter'
                      : `Mark Served at Table ${ord.tableNumber}`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSetOrderStatus(ord.id, 'cooking')}
                    className="w-full min-h-[38px] rounded-[8px] bg-[#FAF8F5] border border-[#E4E0D8] text-[#5C5852] text-[12px] font-medium cursor-pointer"
                  >
                    Reopen Ticket to Cooking
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
