import React, { useState } from 'react';
import {
  CafeEcosystemState,
  DishItem,
} from '../lib/ecosystemStore';
import { UseShiftWakeLockResult } from '../lib/batteryWakeLock';
import { TopDownFloorMap } from './TopDownFloorMap';

export interface WaiterHandheldSurfaceProps {
  state: CafeEcosystemState;
  isStandaloneApk: boolean;
  wakeLock: UseShiftWakeLockResult;
  onAcknowledgeCall: (callId: string) => void;
  onServeOrder: (orderId: string) => void;
  onPlaceAssistedOrder: (
    tableNumber: number,
    items: Array<{ dish: DishItem; qty: number }>
  ) => void;
  onSelectTable: (tableNumber: number) => void;
  onTestAlert: () => void;
}

export const WaiterHandheldSurface: React.FC<WaiterHandheldSurfaceProps> = ({
  state,
  isStandaloneApk,
  wakeLock,
  onAcknowledgeCall,
  onServeOrder,
  onPlaceAssistedOrder,
  onSelectTable,
  onTestAlert,
}) => {
  const [waiterTab, setWaiterTab] = useState<'queue' | 'pickup' | 'calls' | 'floor'>('queue');

  const readyOrders = state.orders.filter((o) => o.status === 'ready');
  const pendingCalls = state.waiterCalls.filter((c) => c.status === 'pending');
  const activeCalls = state.waiterCalls.filter((c) => c.status !== 'completed');

  return (
    <section
      aria-label="Waiter Handheld App"
      data-testid="surface-waiter-apk"
      className={`bg-[#FFFFFF] text-[#181615] flex flex-col overflow-hidden ${
        isStandaloneApk
          ? 'min-h-screen'
          : 'rounded-[16px] border border-[#E4E0D8]'
      }`}
    >
      {/* Clean Daylight Header */}
      <div className="px-5 py-4 border-b border-[#E4E0D8] flex items-center justify-between gap-3 bg-[#FFFFFF]">
        <div className="min-w-0">
          <div className="text-[12px] text-[#5C5852] flex items-center gap-1.5">
            <span>Waiter Handheld</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-code">OTA v{state.otaVersion || 242}</span>
          </div>
          <h3 className="font-display text-[20px] font-semibold text-[#181615] m-0 mt-0.5 truncate">
            {state.venueName}
          </h3>
        </div>

        <button
          type="button"
          data-testid="waiter-test-alert-btn"
          onClick={onTestAlert}
          className="min-h-[38px] px-3.5 rounded-[8px] bg-[#FAF8F5] hover:bg-[#EFECE6] border border-[#E4E0D8] text-[#181615] text-[12px] font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
        >
          Test Alert
        </button>
      </div>

      {/* Explicit Shift Wake Lock & Low-Battery Background Prompt */}
      <div
        data-testid="waiter-wakelock-card"
        className="px-5 py-3 bg-[#FAF8F5] border-b border-[#E4E0D8]"
      >
        {wakeLock.isActive ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[#15803D]">
                Shift Wake Lock Active · Android Keep-Awake On
              </div>
              <div className="text-[11px] text-[#5C5852] truncate">
                {state.realtimeConnected
                  ? 'Event-driven WebSocket connected · 0 background HTTP polling'
                  : 'Push notifications active · Auto-paused when locked'}
              </div>
            </div>
            <button
              type="button"
              data-testid="waiter-wakelock-release-btn"
              onClick={() => wakeLock.releaseWakeLock()}
              className="min-h-[36px] px-3 rounded-[8px] bg-[#FFFFFF] border border-[#E4E0D8] text-[#181615] text-[12px] font-medium cursor-pointer whitespace-nowrap shrink-0"
            >
              Pause Lock
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5" data-testid="waiter-wakelock-prompt">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[13px] font-semibold text-[#181615]">
                  Acquire Waiter Wake Lock for Shift
                </div>
                <p className="text-[12px] text-[#5C5852] m-0 mt-0.5 leading-snug">
                  Prevents Android from sleeping live kitchen pickups &amp; table calls. Uses zero-poll WebSocket push to minimize phone battery drain.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="waiter-wakelock-acquire-btn"
                onClick={() => wakeLock.acquireWakeLock()}
                className="min-h-[40px] px-4 rounded-[8px] bg-[#D9480F] hover:bg-[#B83B0A] text-[#FFFFFF] text-[12px] font-semibold cursor-pointer whitespace-nowrap"
              >
                Keep Waiter App Awake
              </button>
              <button
                type="button"
                data-testid="waiter-low-battery-toggle"
                onClick={() => {
                  wakeLock.setLowBatteryMode(!wakeLock.lowBatteryMode);
                  wakeLock.dismissPrompt();
                }}
                className="min-h-[40px] px-3 rounded-[8px] bg-[#FFFFFF] border border-[#E4E0D8] text-[#5C5852] hover:text-[#181615] text-[12px] font-medium cursor-pointer whitespace-nowrap"
              >
                {wakeLock.lowBatteryMode ? 'Low-Battery Push Only: ON' : 'Pocket Battery Saver'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Waiter Body */}
      <div className="p-4 flex-1 flex flex-col gap-4 bg-[#FAF8F5]">
        {(waiterTab === 'queue' || waiterTab === 'pickup') && (
          <div className="flex flex-col gap-2.5" data-testid="waiter-pickup-list">
            <div className="flex items-center justify-between text-[12px] font-semibold text-[#15803D] px-0.5">
              <span>Ready at Kitchen Pass ({readyOrders.length})</span>
              <span className="text-[#5C5852] font-normal">Deliver first</span>
            </div>

            {readyOrders.length === 0 ? (
              <div className="p-4 rounded-[12px] bg-[#FFFFFF] border border-[#E4E0D8] text-[13px] text-[#5C5852]">
                No orders waiting at the pass right now. When Kitchen marks a ticket ready, it lands here immediately.
              </div>
            ) : (
              readyOrders.map((ord) => (
                <div
                  key={ord.id}
                  data-testid={`waiter-ready-ticket-${ord.ticketNumber.replace('#', '')}`}
                  className="p-4 rounded-[12px] bg-[#FFFFFF] border border-[#15803D]/40 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold text-[#15803D]">
                        Pass Ready · Pick Up Now
                      </div>
                      <div className="font-mono-code font-bold text-[18px] text-[#181615] mt-0.5">
                        {ord.ticketNumber} · Table {ord.tableNumber}
                      </div>
                    </div>
                    <span className="font-mono-code text-[15px] font-bold text-[#181615]">
                      {state.currencySymbol}
                      {ord.totalAmount}
                    </span>
                  </div>

                  <div className="px-3 py-2.5 rounded-[8px] bg-[#ECFDF3] flex flex-col gap-1 text-[13px] text-[#14532D]">
                    {ord.items.map((i) => (
                      <div key={i.dish.id} className="flex justify-between font-medium">
                        <span>
                          <strong>{i.qty}×</strong> {i.dish.name}
                        </span>
                        <span className="font-mono-code text-[12px] opacity-80">
                          {state.currencySymbol}
                          {i.dish.price * i.qty}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    data-testid={`waiter-serve-${ord.ticketNumber.replace('#', '')}-btn`}
                    onClick={() => onServeOrder(ord.id)}
                    className="w-full min-h-[44px] rounded-[10px] bg-[#15803D] hover:bg-[#166534] text-[#FFFFFF] text-[13px] font-semibold cursor-pointer transition-colors"
                  >
                    Mark Delivered to Table {ord.tableNumber}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {(waiterTab === 'queue' || waiterTab === 'calls') && (
          <div className="flex flex-col gap-2.5" data-testid="waiter-calls-list">
            <div className="flex items-center justify-between text-[12px] font-semibold text-[#D9480F] px-0.5">
              <span>Table Calls ({pendingCalls.length} waiting)</span>
              <span className="text-[#5C5852] font-normal">Assisted flow</span>
            </div>

            {activeCalls.length === 0 ? (
              <div className="p-4 rounded-[12px] bg-[#FFFFFF] border border-[#E4E0D8] text-[13px] text-[#5C5852]">
                No active guest table calls.
              </div>
            ) : (
              activeCalls.map((call) => (
                <div
                  key={call.id}
                  className={`p-4 rounded-[12px] bg-[#FFFFFF] border flex flex-col gap-3 ${
                    call.status === 'pending' ? 'border-[#D9480F]/45' : 'border-[#E4E0D8]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold text-[#D9480F]">
                        {call.status === 'pending'
                          ? 'Guest Calling Waiter'
                          : 'Acknowledged · Walking to Table'}
                      </div>
                      <div className="font-display font-semibold text-[18px] text-[#181615] mt-0.5">
                        Table {call.tableNumber}
                      </div>
                    </div>
                    <span className="font-mono-code text-[14px] font-semibold text-[#181615]">
                      {state.currencySymbol}
                      {call.cartTotal}
                    </span>
                  </div>

                  <div className="px-3 py-2.5 rounded-[8px] bg-[#F7F6F2] text-[12px] text-[#5C5852]">
                    {call.cartSnapshot.length > 0
                      ? call.cartSnapshot.map((i) => `${i.qty}× ${i.dish.name}`).join(', ')
                      : 'Guest requested waiter assistance at table'}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {call.status === 'pending' && (
                      <button
                        type="button"
                        data-testid={`waiter-ack-${call.tableNumber}-btn`}
                        onClick={() => onAcknowledgeCall(call.id)}
                        className="flex-1 min-h-[44px] px-3 rounded-[10px] bg-[#181615] hover:bg-[#292524] text-[#FAF8F5] text-[13px] font-semibold cursor-pointer whitespace-nowrap"
                      >
                        On My Way
                      </button>
                    )}
                    {call.cartSnapshot.length > 0 && call.status !== 'completed' && (
                      <button
                        type="button"
                        data-testid={`waiter-send-call-order-${call.tableNumber}-btn`}
                        onClick={() => onPlaceAssistedOrder(call.tableNumber, call.cartSnapshot)}
                        className="flex-1 min-h-[44px] px-3 rounded-[10px] bg-[#D9480F] hover:bg-[#B83B0A] text-[#FFFFFF] text-[13px] font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Send to Kitchen
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {waiterTab === 'floor' && (
          <TopDownFloorMap
            tables={state.tables}
            activeTable={state.activeTable}
            currencySymbol={state.currencySymbol}
            orders={state.orders}
            waiterCalls={state.waiterCalls}
            dishes={state.dishes}
            onSelectTable={onSelectTable}
            onAcknowledgeCall={onAcknowledgeCall}
            onServeOrder={onServeOrder}
            onPlaceAssistedOrder={onPlaceAssistedOrder}
          />
        )}
      </div>

      {/* Bottom Ergonomic Thumb Tab Bar (44px+ touch targets) */}
      <nav
        aria-label="Waiter handheld tabs"
        className="mt-auto px-3 py-2 bg-[#FFFFFF] border-t border-[#E4E0D8] grid grid-cols-4 gap-1.5"
      >
        <button
          type="button"
          data-testid="waiter-tab-queue"
          onClick={() => setWaiterTab('queue')}
          className={`min-h-[44px] px-2 rounded-[8px] text-[12px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            waiterTab === 'queue'
              ? 'bg-[#181615] text-[#FAF8F5]'
              : 'text-[#5C5852] hover:bg-[#F7F6F2]'
          }`}
        >
          Queue ({readyOrders.length + pendingCalls.length})
        </button>

        <button
          type="button"
          data-testid="waiter-tab-pickup"
          onClick={() => setWaiterTab('pickup')}
          className={`min-h-[44px] px-2 rounded-[8px] text-[12px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            waiterTab === 'pickup'
              ? 'bg-[#15803D] text-[#FFFFFF]'
              : readyOrders.length > 0
              ? 'bg-[#ECFDF3] text-[#15803D]'
              : 'text-[#5C5852] hover:bg-[#F7F6F2]'
          }`}
        >
          Pickup ({readyOrders.length})
        </button>

        <button
          type="button"
          data-testid="waiter-tab-calls"
          onClick={() => setWaiterTab('calls')}
          className={`min-h-[44px] px-2 rounded-[8px] text-[12px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            waiterTab === 'calls'
              ? 'bg-[#D9480F] text-[#FFFFFF]'
              : pendingCalls.length > 0
              ? 'bg-[#FFF1EB] text-[#D9480F]'
              : 'text-[#5C5852] hover:bg-[#F7F6F2]'
          }`}
        >
          Calls ({pendingCalls.length})
        </button>

        <button
          type="button"
          data-testid="waiter-tab-floor"
          onClick={() => setWaiterTab('floor')}
          className={`min-h-[44px] px-2 rounded-[8px] text-[12px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            waiterTab === 'floor'
              ? 'bg-[#181615] text-[#FAF8F5]'
              : 'text-[#5C5852] hover:bg-[#F7F6F2]'
          }`}
        >
          Floor ({state.tables.length})
        </button>
      </nav>
    </section>
  );
};
