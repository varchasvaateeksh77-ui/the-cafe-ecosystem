import React, { useState } from 'react';
import {
  DishItem,
  FloorTable,
  KitchenOrder,
  WaiterCall,
} from '../lib/ecosystemStore';

export interface TopDownFloorMapProps {
  tables: FloorTable[];
  activeTable: number;
  currencySymbol: string;
  orders: KitchenOrder[];
  waiterCalls: WaiterCall[];
  dishes: DishItem[];
  darkTheme?: boolean;
  onSelectTable: (tableNumber: number) => void;
  onAcknowledgeCall: (callId: string) => void;
  onServeOrder: (orderId: string) => void;
  onPlaceAssistedOrder: (tableNumber: number, items: Array<{ dish: DishItem; qty: number }>) => void;
  onOpenTableGuestMenu?: (tableNumber: number) => void;
}

const STATUS_META: Record<
  FloorTable['status'],
  { label: string; dotColor: string; bgLight: string; bgDark: string; border: string; textLight: string; textDark: string }
> = {
  free: {
    label: 'Available',
    dotColor: '#9C968E',
    bgLight: '#FFFFFF',
    bgDark: '#1E1B18',
    border: '#E4E0D8',
    textLight: '#5C5852',
    textDark: '#B8ABA3',
  },
  browsing: {
    label: 'Browsing Menu',
    dotColor: '#B45309',
    bgLight: '#FEF3C7',
    bgDark: '#261D0D',
    border: '#D97706',
    textLight: '#92400E',
    textDark: '#FDE68A',
  },
  waiter_called: {
    label: 'Calling Waiter',
    dotColor: '#D9480F',
    bgLight: '#FFF1EB',
    bgDark: '#2E160D',
    border: '#D9480F',
    textLight: '#D9480F',
    textDark: '#FF986A',
  },
  ordering: {
    label: 'Order Placed',
    dotColor: '#D9480F',
    bgLight: '#FFF1EB',
    bgDark: '#26160F',
    border: '#D9480F',
    textLight: '#B83B0A',
    textDark: '#FAF8F5',
  },
  cooking: {
    label: 'In Kitchen',
    dotColor: '#B45309',
    bgLight: '#FEF3C7',
    bgDark: '#261D0D',
    border: '#D97706',
    textLight: '#92400E',
    textDark: '#FDE68A',
  },
  ready: {
    label: 'Ready at Pass',
    dotColor: '#15803D',
    bgLight: '#ECFDF3',
    bgDark: '#0F2618',
    border: '#15803D',
    textLight: '#15803D',
    textDark: '#86EFAC',
  },
  served: {
    label: 'Dining · Served',
    dotColor: '#181615',
    bgLight: '#EFECE6',
    bgDark: '#24211E',
    border: '#C9C3B8',
    textLight: '#181615',
    textDark: '#E4E0D8',
  },
};

export const TopDownFloorMap: React.FC<TopDownFloorMapProps> = ({
  tables,
  activeTable,
  currencySymbol,
  orders,
  waiterCalls,
  dishes,
  darkTheme = false,
  onSelectTable,
  onAcknowledgeCall,
  onServeOrder,
  onPlaceAssistedOrder,
  onOpenTableGuestMenu,
}) => {
  const [assistedQtys, setAssistedQtys] = useState<Record<string, number>>({});
  const [showAssistedComposer, setShowAssistedComposer] = useState<boolean>(false);

  const selectedTableObj =
    tables.find((t) => t.tableNumber === activeTable) || tables[0];
  const tableOrders = orders.filter(
    (o) => o.tableNumber === activeTable && o.status !== 'served'
  );
  const readyOrderForTable = orders.find(
    (o) => o.tableNumber === activeTable && o.status === 'ready'
  );
  const pendingCallForTable = waiterCalls.find(
    (c) => c.tableNumber === activeTable && c.status === 'pending'
  );
  const readyPassCount = orders.filter((o) => o.status === 'ready').length;

  const availableDishes = dishes.filter((d) => d.isAvailable);
  const assistedItems = availableDishes
    .map((dish) => ({ dish, qty: assistedQtys[dish.id] || 0 }))
    .filter((i) => i.qty > 0);
  const assistedTotal = assistedItems.reduce(
    (sum, i) => sum + i.dish.price * i.qty,
    0
  );

  const handleAdjustAssistedQty = (dishId: string, delta: number) => {
    setAssistedQtys((prev) => {
      const next = Math.max(0, (prev[dishId] || 0) + delta);
      return { ...prev, [dishId]: next };
    });
  };

  const handleSubmitAssisted = () => {
    if (assistedItems.length === 0) return;
    onPlaceAssistedOrder(activeTable, assistedItems);
    setAssistedQtys({});
    setShowAssistedComposer(false);
  };

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
      data-testid="interactive-top-down-floor-map"
    >
      {/* Left 7 Cols: Architectural Top-Down Dining Room Plan */}
      <div
        className={`lg:col-span-7 rounded-[14px] border p-4 flex flex-col gap-4 ${
          darkTheme
            ? 'bg-[#181615] border-[#2E2A27] text-[#FAF8F5]'
            : 'bg-[#FAF8F5] border-[#E4E0D8] text-[#181615]'
        }`}
      >
        {/* Architectural Top Fixtures: Espresso Bar & Kitchen Pass Window */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            className={`p-3 rounded-[10px] border flex items-center justify-between ${
              darkTheme
                ? 'bg-[#24211E] border-[#38332E]'
                : 'bg-[#FFFFFF] border-[#E4E0D8]'
            }`}
          >
            <div>
              <div className="text-[11px] text-[#5C5852]">North Counter</div>
              <div className="font-semibold text-[13px] mt-0.5">
                Espresso &amp; Cold Brew Bar
              </div>
            </div>
            <span className="font-mono-code text-[11px] text-[#5C5852]">Barista</span>
          </div>

          <div
            className={`p-3 rounded-[10px] border flex items-center justify-between ${
              readyPassCount > 0
                ? 'bg-[#ECFDF3] border-[#15803D]/40 text-[#15803D]'
                : darkTheme
                ? 'bg-[#24211E] border-[#38332E]'
                : 'bg-[#FFFFFF] border-[#E4E0D8]'
            }`}
          >
            <div>
              <div className="text-[11px] opacity-80">Kitchen Pass</div>
              <div className="font-semibold text-[13px] mt-0.5">
                {readyPassCount > 0
                  ? `${readyPassCount} Order${readyPassCount > 1 ? 's' : ''} Ready`
                  : 'Pass Clear'}
              </div>
            </div>
            <span className="font-mono-code text-[12px] font-bold tabular-nums">
              {readyPassCount} Ready
            </span>
          </div>
        </div>

        {/* Dining Room Floor Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 py-1">
          {tables.map((t) => {
            const meta = STATUS_META[t.status] || STATUS_META.free;
            const isSelected = t.tableNumber === activeTable;
            const isUrgent = t.status === 'ready' || t.status === 'waiter_called';

            return (
              <button
                key={t.tableNumber}
                type="button"
                data-testid={`floor-map-table-${t.tableNumber}`}
                onClick={() => onSelectTable(t.tableNumber)}
                style={{
                  backgroundColor: darkTheme ? meta.bgDark : meta.bgLight,
                  borderColor: isSelected
                    ? '#D9480F'
                    : isUrgent
                    ? meta.border
                    : darkTheme
                    ? '#38332E'
                    : meta.border,
                }}
                className={`relative p-3 rounded-[12px] border text-left transition-colors cursor-pointer flex flex-col justify-between min-h-[108px] ${
                  isSelected ? 'ring-2 ring-[#D9480F] ring-offset-1' : ''
                }`}
              >
                {/* Top Row: Table Shape + Number + Seats */}
                <div className="flex items-center justify-between gap-1 w-full">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 font-mono-code text-[11px] font-bold ${
                        t.shape === 'round' ? 'rounded-full' : 'rounded-[6px]'
                      } ${
                        darkTheme
                          ? 'bg-[#FBEFE6] text-[#140905]'
                          : 'bg-[#140905] text-[#FBEFE6]'
                      }`}
                    >
                      {t.tableNumber}
                    </span>
                    <span className="font-semibold text-[13px] whitespace-nowrap">
                      Table {t.tableNumber}
                    </span>
                  </div>
                  <span className="font-mono-code text-[10px] opacity-70 tabular-nums">
                    {t.seats}p
                  </span>
                </div>

                {/* Middle Row: Status Text */}
                <div className="my-2">
                  <div
                    style={{
                      color: darkTheme ? meta.textDark : meta.textLight,
                    }}
                    className="text-[12px] font-semibold leading-tight"
                  >
                    {meta.label}
                  </div>
                  {t.activeTicket && (
                    <div className="font-mono-code text-[11px] opacity-80 mt-0.5 tabular-nums">
                      Ticket {t.activeTicket}
                    </div>
                  )}
                </div>

                {/* Bottom Row: Bill Total or Last Activity */}
                <div className="flex items-center justify-between w-full pt-1.5 border-t border-current/10 font-mono-code text-[11px] tabular-nums">
                  <span>
                    {t.cartTotal ? `${currencySymbol}${t.cartTotal}` : 'No Bill'}
                  </span>
                  <span className="opacity-70 text-[10px]">{t.updatedAt}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Floor Legend Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-current/10 text-[11px] opacity-80">
          <span>Tap any table to inspect live tickets or punch in an order</span>
          <span className="font-mono-code tabular-nums">
            {tables.filter((t) => t.status !== 'free').length} of {tables.length} Tables Occupied
          </span>
        </div>
      </div>

      {/* Right 5 Cols: Selected Table Live Inspector & Assisted Order Drawer */}
      <div
        className={`lg:col-span-5 rounded-[16px] border p-4 sm:p-5 flex flex-col gap-4 ${
          darkTheme
            ? 'bg-[#181615] border-[#292524] text-[#FAF8F5]'
            : 'bg-[#FFFFFF] border-[#E4E0D8] text-[#181615]'
        }`}
        data-testid="floor-table-inspector"
      >
        <div className="flex items-start justify-between gap-2 border-b border-current/10 pb-3">
          <div>
            <div className="text-[11px] font-semibold text-[#D9480F]">
              Selected Table Inspector
            </div>
            <h3 className="font-display text-[20px] font-semibold m-0 mt-0.5">
              Table {selectedTableObj.tableNumber} · {selectedTableObj.seats} Seats (
              {selectedTableObj.shape})
            </h3>
            <div className="text-[12px] opacity-75 mt-0.5">
              Status:{' '}
              <strong className="capitalize">
                {selectedTableObj.status.replace('_', ' ')}
              </strong>{' '}
              · Updated {selectedTableObj.updatedAt}
            </div>
          </div>

          {onOpenTableGuestMenu && (
            <button
              type="button"
              onClick={() => onOpenTableGuestMenu(selectedTableObj.tableNumber)}
              className="min-h-[36px] px-3 rounded-[8px] bg-[#D9480F] hover:bg-[#B83B0A] text-[#FFFFFF] text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              Open Table {selectedTableObj.tableNumber} Menu →
            </button>
          )}
        </div>

        {/* Immediate Action Alert if Table Has Ready Order or Pending Waiter Call */}
        {readyOrderForTable && (
          <div className="p-3.5 rounded-[12px] bg-[#ECFDF3] text-[#181615] border border-[#15803D]/40 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#15803D] uppercase">
                Ready at Kitchen Pass · {readyOrderForTable.ticketNumber}
              </span>
              <span className="font-mono-code text-[13px] font-bold text-[#181615] tabular-nums">
                {currencySymbol}
                {readyOrderForTable.totalAmount}
              </span>
            </div>
            <div className="text-[12px] text-[#5C5852]">
              {readyOrderForTable.items
                .map((i) => `${i.qty}× ${i.dish.name}`)
                .join(', ')}
            </div>
            <button
              type="button"
              onClick={() => onServeOrder(readyOrderForTable.id)}
              className="w-full min-h-[42px] rounded-[8px] bg-[#15803D] hover:bg-[#166534] text-[#FFFFFF] text-[12px] font-semibold cursor-pointer"
            >
              Mark Served at Table {selectedTableObj.tableNumber}
            </button>
          </div>
        )}

        {pendingCallForTable && (
          <div className="p-3.5 rounded-[12px] bg-[#FFF7ED] text-[#181615] border border-[#D9480F]/40 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#D9480F] uppercase">
                Guest Calling Waiter · Table {selectedTableObj.tableNumber}
              </span>
              <span className="font-mono-code text-[12px] font-semibold text-[#181615] tabular-nums">
                Cart: {currencySymbol}
                {pendingCallForTable.cartTotal}
              </span>
            </div>
            <div className="text-[12px] text-[#5C5852]">
              {pendingCallForTable.cartSnapshot.length > 0
                ? pendingCallForTable.cartSnapshot
                    .map((i) => `${i.qty}× ${i.dish.name}`)
                    .join(', ')
                : 'Guest requested waiter assistance at table'}
            </div>
            <button
              type="button"
              onClick={() => onAcknowledgeCall(pendingCallForTable.id)}
              className="w-full min-h-[42px] rounded-[8px] bg-[#D9480F] hover:bg-[#B83B0A] text-[#FFFFFF] text-[12px] font-semibold cursor-pointer"
            >
              Claim Call · On My Way →
            </button>
          </div>
        )}

        {/* Active Kitchen Orders for Selected Table */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-[#5C5852]">
              Active Tickets for Table {selectedTableObj.tableNumber} ({tableOrders.length})
            </span>
            <button
              type="button"
              data-testid="toggle-assisted-order-btn"
              onClick={() => setShowAssistedComposer((prev) => !prev)}
              className="text-[11px] font-semibold text-[#D9480F] hover:underline cursor-pointer"
            >
              {showAssistedComposer
                ? 'Close Order Pad'
                : `+ Punch Order for Table ${selectedTableObj.tableNumber}`}
            </button>
          </div>

          {tableOrders.length === 0 ? (
            <div className="p-3.5 rounded-[10px] border border-[#E4E0D8] text-[12px] text-[#5C5852]">
              No active kitchen tickets for Table {selectedTableObj.tableNumber}. Use{' '}
              <strong>+ Punch Order</strong> above to send dishes directly to the kitchen.
            </div>
          ) : (
            tableOrders.map((ord) => (
              <div
                key={ord.id}
                className="p-3 rounded-[10px] border border-[#E4E0D8] flex flex-col gap-1.5 text-[12px]"
              >
                <div className="flex items-center justify-between font-mono-code font-bold">
                  <span>
                    {ord.ticketNumber} · {ord.status.toUpperCase()}
                  </span>
                  <span className="tabular-nums">
                    {currencySymbol}
                    {ord.totalAmount}
                  </span>
                </div>
                <div className="opacity-85">
                  {ord.items.map((i) => `${i.qty}× ${i.dish.name}`).join(' · ')}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Waiter / Owner Assisted Table Order Composer */}
        {showAssistedComposer && (
          <div
            data-testid="assisted-order-composer"
            className={`p-3.5 rounded-[12px] border flex flex-col gap-3 ${
              darkTheme
                ? 'bg-[#1C1917] border-[#292524]'
                : 'bg-[#FAF8F5] border-[#E4E0D8]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase text-[#D9480F]">
                Staff Order Pad · Table {selectedTableObj.tableNumber}
              </span>
              <span className="font-mono-code text-[12px] font-bold tabular-nums">
                Total: {currencySymbol}
                {assistedTotal}
              </span>
            </div>

            <div className="flex flex-col gap-1.5 max-h-[210px] overflow-y-auto pr-1">
              {availableDishes.map((dish) => {
                const qty = assistedQtys[dish.id] || 0;
                return (
                  <div
                    key={dish.id}
                    className={`p-2 rounded-[8px] border flex items-center justify-between gap-2 text-[12px] ${
                      darkTheme
                        ? 'bg-[#181615] border-[#292524]'
                        : 'bg-[#FFFFFF] border-[#E4E0D8]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{dish.name}</div>
                      <div className="font-mono-code text-[11px] opacity-75 tabular-nums">
                        {currencySymbol}
                        {dish.price}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {qty > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAdjustAssistedQty(dish.id, -1)}
                            className="w-7 h-7 rounded-[6px] border border-[#E4E0D8] font-bold cursor-pointer"
                          >
                            −
                          </button>
                          <span className="font-mono-code font-bold w-4 text-center tabular-nums">
                            {qty}
                          </span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAdjustAssistedQty(dish.id, 1)}
                        className="px-2.5 h-7 rounded-[6px] bg-[#D9480F] text-[#FFFFFF] text-[11px] font-semibold cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              data-testid="submit-assisted-order-btn"
              disabled={assistedItems.length === 0}
              onClick={handleSubmitAssisted}
              className="w-full min-h-[42px] rounded-[8px] bg-[#D9480F] hover:bg-[#B83B0A] disabled:opacity-40 text-[#FFFFFF] text-[12px] font-semibold cursor-pointer"
            >
              Send Table {selectedTableObj.tableNumber} Order ({currencySymbol}
              {assistedTotal}) →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
