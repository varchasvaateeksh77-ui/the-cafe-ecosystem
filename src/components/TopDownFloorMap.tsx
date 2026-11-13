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
    dotColor: '#8C7E75',
    bgLight: '#F7F2ED',
    bgDark: '#1A0C06',
    border: '#D5C7BD',
    textLight: '#6C625C',
    textDark: '#B8ABA3',
  },
  browsing: {
    label: 'Browsing Menu',
    dotColor: '#D97B38',
    bgLight: '#FFF8F2',
    bgDark: '#24130B',
    border: '#D97B38',
    textLight: '#9A4E18',
    textDark: '#FBEFE6',
  },
  waiter_called: {
    label: 'Calling Waiter',
    dotColor: '#E8500C',
    bgLight: '#FFEEE3',
    bgDark: '#361608',
    border: '#E8500C',
    textLight: '#C03E0A',
    textDark: '#FF986A',
  },
  ordering: {
    label: 'Order Placed',
    dotColor: '#E8500C',
    bgLight: '#FFF3EB',
    bgDark: '#2D140A',
    border: '#E8500C',
    textLight: '#C03E0A',
    textDark: '#FBEFE6',
  },
  cooking: {
    label: 'In Kitchen',
    dotColor: '#F59E0B',
    bgLight: '#FEF9E7',
    bgDark: '#2B1D08',
    border: '#D97706',
    textLight: '#92400E',
    textDark: '#FDE68A',
  },
  ready: {
    label: 'Ready at Pass',
    dotColor: '#769900',
    bgLight: '#F4FCE3',
    bgDark: '#1F2909',
    border: '#84CC16',
    textLight: '#3F6212',
    textDark: '#C4F042',
  },
  served: {
    label: 'Dining · Served',
    dotColor: '#1A0C06',
    bgLight: '#EFECE8',
    bgDark: '#22140D',
    border: '#9C8E85',
    textLight: '#1A0C06',
    textDark: '#E3D9D3',
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
        className={`lg:col-span-7 rounded-[20px] border p-4 sm:p-5 flex flex-col gap-4 ${
          darkTheme
            ? 'bg-[#140905] border-[#2A180D] text-[#FBEFE6]'
            : 'bg-[#F7F2ED] border-[#E3D9D3] text-[#1A0C06]'
        }`}
      >
        {/* Architectural Top Fixtures: Espresso Bar & Kitchen Pass Window */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            className={`p-3 rounded-[14px] border flex items-center justify-between ${
              darkTheme
                ? 'bg-[#1E100A] border-[#382115]'
                : 'bg-[#EFE7DF] border-[#D8C8BC]'
            }`}
          >
            <div>
              <div className="font-mono-code text-[10px] uppercase tracking-wider opacity-70">
                NORTH COUNTER
              </div>
              <div className="font-semibold text-[13px] mt-0.5">
                Espresso &amp; Cold Brew Bar
              </div>
            </div>
            <span className="font-mono-code text-[11px] opacity-75">Barista Station</span>
          </div>

          <div
            className={`p-3 rounded-[14px] border flex items-center justify-between ${
              readyPassCount > 0
                ? 'bg-[#140905] border-[#C4F042] text-[#C4F042]'
                : darkTheme
                ? 'bg-[#1E100A] border-[#382115]'
                : 'bg-[#EFE7DF] border-[#D8C8BC]'
            }`}
          >
            <div>
              <div className="font-mono-code text-[10px] uppercase tracking-wider opacity-80">
                KITCHEN PASS WINDOW
              </div>
              <div className="font-semibold text-[13px] mt-0.5">
                {readyPassCount > 0
                  ? `${readyPassCount} Order${readyPassCount > 1 ? 's' : ''} Ready for Pickup`
                  : 'Pass Clear · Cooking Active'}
              </div>
            </div>
            <span className="font-mono-code text-[12px] font-bold tabular-nums">
              {readyPassCount} Ready
            </span>
          </div>
        </div>

        {/* Dining Room Floor Grid (Architectural Table Nodes with Chairs) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 py-1">
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
                    ? '#E8500C'
                    : isUrgent
                    ? meta.border
                    : darkTheme
                    ? '#2E1B10'
                    : meta.border,
                }}
                className={`relative p-3.5 rounded-[18px] border-2 text-left transition-transform cursor-pointer flex flex-col justify-between min-h-[112px] ${
                  isSelected ? 'ring-2 ring-[#E8500C] ring-offset-1' : ''
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
        className={`lg:col-span-5 rounded-[20px] border p-4 sm:p-5 flex flex-col gap-4 ${
          darkTheme
            ? 'bg-[#1A0C06] border-[#2A180D] text-[#FBEFE6]'
            : 'bg-[#FFFFFF] border-[#E3D9D3] text-[#1A0C06]'
        }`}
        data-testid="floor-table-inspector"
      >
        <div className="flex items-start justify-between gap-2 border-b border-current/10 pb-3">
          <div>
            <div className="font-mono-code text-[11px] text-[#E8500C] font-semibold">
              Selected Table Inspector
            </div>
            <h3 className="text-[20px] font-bold m-0 mt-0.5">
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
              className="px-3 py-1.5 rounded-[10px] bg-[#E8500C] hover:bg-[#C03E0A] text-[#FBEFE6] font-mono-code text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              Open Table {selectedTableObj.tableNumber} Menu →
            </button>
          )}
        </div>

        {/* Immediate Action Alert if Table Has Ready Order or Pending Waiter Call */}
        {readyOrderForTable && (
          <div className="p-3.5 rounded-[14px] bg-[#140905] text-[#FBEFE6] border-2 border-[#C4F042] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono-code text-[11px] font-bold text-[#C4F042] uppercase">
                Ready at Kitchen Pass · {readyOrderForTable.ticketNumber}
              </span>
              <span className="font-mono-code text-[13px] font-bold text-[#C4F042] tabular-nums">
                {currencySymbol}
                {readyOrderForTable.totalAmount}
              </span>
            </div>
            <div className="text-[12px] opacity-90">
              {readyOrderForTable.items
                .map((i) => `${i.qty}× ${i.dish.name}`)
                .join(', ')}
            </div>
            <button
              type="button"
              onClick={() => onServeOrder(readyOrderForTable.id)}
              className="w-full h-10 rounded-[10px] bg-[#C4F042] text-[#140905] font-mono-code text-[12px] font-bold uppercase cursor-pointer"
            >
              ✓ Deliver &amp; Mark Served at Table {selectedTableObj.tableNumber}
            </button>
          </div>
        )}

        {pendingCallForTable && (
          <div className="p-3.5 rounded-[14px] bg-[#2A180D] text-[#FBEFE6] border-2 border-[#E8500C] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono-code text-[11px] font-bold text-[#FF8741] uppercase">
                Guest Calling Waiter · Table {selectedTableObj.tableNumber}
              </span>
              <span className="font-mono-code text-[12px] text-[#C4F042] tabular-nums">
                Cart: {currencySymbol}
                {pendingCallForTable.cartTotal}
              </span>
            </div>
            <div className="text-[12px] opacity-90">
              {pendingCallForTable.cartSnapshot.length > 0
                ? pendingCallForTable.cartSnapshot
                    .map((i) => `${i.qty}× ${i.dish.name}`)
                    .join(', ')
                : 'Guest requested waiter assistance at table'}
            </div>
            <button
              type="button"
              onClick={() => onAcknowledgeCall(pendingCallForTable.id)}
              className="w-full h-10 rounded-[10px] bg-[#E8500C] text-[#FBEFE6] font-mono-code text-[12px] font-bold uppercase cursor-pointer"
            >
              Claim Call · On My Way to Table {selectedTableObj.tableNumber} →
            </button>
          </div>
        )}

        {/* Active Kitchen Orders for Selected Table */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-mono-code text-[11px] font-bold uppercase opacity-75">
              Active Tickets for Table {selectedTableObj.tableNumber} ({tableOrders.length})
            </span>
            <button
              type="button"
              data-testid="toggle-assisted-order-btn"
              onClick={() => setShowAssistedComposer((prev) => !prev)}
              className="font-mono-code text-[11px] font-bold text-[#E8500C] hover:underline cursor-pointer"
            >
              {showAssistedComposer
                ? 'Close Order Pad'
                : `+ Punch Order for Table ${selectedTableObj.tableNumber}`}
            </button>
          </div>

          {tableOrders.length === 0 ? (
            <div className="p-3.5 rounded-[12px] border border-current/10 text-[12px] opacity-75">
              No active kitchen tickets for Table {selectedTableObj.tableNumber}. Use{' '}
              <strong>+ Punch Order</strong> below to send dishes directly to the kitchen.
            </div>
          ) : (
            tableOrders.map((ord) => (
              <div
                key={ord.id}
                className="p-3 rounded-[12px] border border-current/15 flex flex-col gap-1.5 text-[12px]"
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
            className={`p-3.5 rounded-[14px] border flex flex-col gap-3 ${
              darkTheme
                ? 'bg-[#140905] border-[#382115]'
                : 'bg-[#F7F2ED] border-[#E3D9D3]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono-code text-[11px] font-bold uppercase text-[#E8500C]">
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
                    className={`p-2 rounded-[10px] border flex items-center justify-between gap-2 text-[12px] ${
                      darkTheme
                        ? 'bg-[#1A0C06] border-[#2A180D]'
                        : 'bg-[#FFFFFF] border-[#E3D9D3]'
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
                            className="w-7 h-7 rounded-[6px] border border-current/20 font-bold cursor-pointer"
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
                        className="px-2.5 h-7 rounded-[6px] bg-[#E8500C] text-[#FBEFE6] font-mono-code text-[11px] font-bold cursor-pointer"
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
              className="w-full h-10 rounded-[10px] bg-[#E8500C] hover:bg-[#C03E0A] disabled:opacity-40 text-[#FBEFE6] font-mono-code text-[12px] font-bold uppercase cursor-pointer"
            >
              Send Table {selectedTableObj.tableNumber} Order to Kitchen ({currencySymbol}
              {assistedTotal}) →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
