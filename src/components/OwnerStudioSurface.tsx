import React, { useState } from 'react';
import {
  CafeEcosystemState,
  DishItem,
  ServiceLevel,
} from '../lib/ecosystemStore';
import { DishImage } from './DishImage';
import { TopDownFloorMap } from './TopDownFloorMap';
import { TableQrGenerator } from './TableQrGenerator';

export interface OwnerStudioSurfaceProps {
  state: CafeEcosystemState;
  isStandaloneApk: boolean;
  isPushingOta: boolean;
  onSwitchLevel: (level: ServiceLevel) => void;
  onPushOta: () => void;
  onToggleAutoRoute: () => void;
  onSavePrice: (dishId: string, price: number) => void;
  onToggle86: (dishId: string) => void;
  onSelectTable: (tableNumber: number) => void;
  onAddTable: () => void;
  onAcknowledgeCall: (callId: string) => void;
  onServeOrder: (orderId: string) => void;
  onPlaceAssistedOrder: (
    tableNumber: number,
    items: Array<{ dish: DishItem; qty: number }>
  ) => void;
  onOpenTableGuestMenu: (tableNumber: number) => void;
}

export const OwnerStudioSurface: React.FC<OwnerStudioSurfaceProps> = ({
  state,
  isStandaloneApk,
  isPushingOta,
  onSwitchLevel,
  onPushOta,
  onToggleAutoRoute,
  onSavePrice,
  onToggle86,
  onSelectTable,
  onAddTable,
  onAcknowledgeCall,
  onServeOrder,
  onPlaceAssistedOrder,
  onOpenTableGuestMenu,
}) => {
  const [adminTab, setAdminTab] = useState<'menu' | 'floor' | 'qr' | 'ota'>('menu');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<string>('');

  const filteredMenu = state.dishes.filter((d) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      d.name.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q) ||
      d.dietary.toLowerCase().includes(q)
    );
  });

  const handleCommitPrice = (dishId: string) => {
    const parsed = parseFloat(priceDraft);
    if (!Number.isNaN(parsed) && parsed > 0) {
      onSavePrice(dishId, Math.round(parsed));
    }
    setEditingDishId(null);
  };

  return (
    <section
      aria-label="Owner Admin Studio"
      data-testid="surface-admin-apk"
      className={`bg-[#FFFFFF] text-[#181615] overflow-hidden ${
        isStandaloneApk
          ? 'min-h-screen'
          : 'rounded-[16px] border border-[#E4E0D8]'
      }`}
    >
      {/* Clean Executive Header */}
      <div className="px-6 py-4 border-b border-[#E4E0D8] flex flex-wrap items-center justify-between gap-4 bg-[#FFFFFF]">
        <div>
          <div className="text-[12px] text-[#5C5852] flex items-center gap-2">
            <span>Owner Console</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-code">OTA v{state.otaVersion || 242}</span>
          </div>
          <h2 className="font-display text-[22px] font-semibold text-[#181615] m-0 mt-0.5">
            {state.venueName} · Operations &amp; Menu
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className="flex items-center gap-1 bg-[#F7F6F2] border border-[#E4E0D8] p-1 rounded-[8px]"
            role="group"
            aria-label="Admin Service Level Switcher"
          >
            {([1, 2, 3] as ServiceLevel[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => onSwitchLevel(lvl)}
                className={`px-3 py-1 rounded-[6px] text-[12px] font-medium cursor-pointer whitespace-nowrap transition-colors ${
                  state.serviceLevel === lvl
                    ? 'bg-[#181615] text-[#FAF8F5]'
                    : 'text-[#5C5852] hover:text-[#181615]'
                }`}
              >
                Level {lvl}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onPushOta}
            disabled={isPushingOta}
            className="min-h-[38px] px-4 rounded-[8px] bg-[#D9480F] hover:bg-[#B83B0A] text-[#FFFFFF] text-[12px] font-semibold cursor-pointer whitespace-nowrap transition-colors"
          >
            {isPushingOta ? 'Pushing OTA...' : `Push OTA (v${state.otaVersion || 242})`}
          </button>
        </div>
      </div>

      {/* Sub-Navigation & Auto-Route Toggle */}
      <div className="px-6 py-3 bg-[#FAF8F5] border-b border-[#E4E0D8] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'menu', label: 'Menu & 86 Control' },
              { id: 'floor', label: `Floor Plan (${state.tables.length})` },
              { id: 'qr', label: 'Table QR Generator' },
              { id: 'ota', label: 'OTA & Battery Sync' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`admin-tab-${t.id}`}
              onClick={() => setAdminTab(t.id)}
              className={`min-h-[36px] px-3.5 rounded-[8px] text-[13px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                adminTab === t.id
                  ? 'bg-[#181615] text-[#FAF8F5]'
                  : 'bg-[#FFFFFF] border border-[#E4E0D8] text-[#5C5852] hover:text-[#181615]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onToggleAutoRoute}
          className={`min-h-[36px] px-3.5 rounded-[8px] text-[12px] font-medium border cursor-pointer transition-colors whitespace-nowrap ${
            state.autoRouteToKitchen
              ? 'bg-[#FFF1EB] border-[#D9480F]/40 text-[#D9480F]'
              : 'bg-[#FFFFFF] border-[#E4E0D8] text-[#5C5852]'
          }`}
        >
          Auto-Send to Kitchen: {state.autoRouteToKitchen ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Panel Body */}
      <div className="p-6">
        {adminTab === 'menu' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <input
                type="search"
                aria-label="Filter menu dishes"
                placeholder="Search dishes, category, or dietary tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-80 min-h-[40px] px-3.5 rounded-[8px] bg-[#FAF8F5] border border-[#E4E0D8] text-[13px] text-[#181615]"
              />
              <span className="text-[12px] text-[#5C5852]">
                {filteredMenu.filter((d) => d.isAvailable).length} of {state.dishes.length} available
              </span>
            </div>

            {filteredMenu.length === 0 ? (
              <div className="p-8 text-center rounded-[12px] bg-[#FAF8F5] border border-[#E4E0D8] text-[13px] text-[#5C5852]">
                No dishes match &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredMenu.map((dish) => {
                  const isEditing = editingDishId === dish.id;
                  return (
                    <div
                      key={dish.id}
                      className={`p-3.5 rounded-[12px] border flex items-center justify-between gap-3 ${
                        dish.isAvailable
                          ? 'bg-[#FFFFFF] border-[#E4E0D8]'
                          : 'bg-[#FAF8F5] border-[#E4E0D8] opacity-65'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-14 h-14 rounded-[8px] overflow-hidden bg-[#EFECE6] shrink-0">
                          <DishImage dish={dish} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] text-[#5C5852] truncate">
                            {dish.category} · {dish.dietary}
                          </div>
                          <div className="font-semibold text-[14px] text-[#181615] truncate">
                            {dish.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  aria-label={`Edit price for ${dish.name}`}
                                  value={priceDraft}
                                  onChange={(e) => setPriceDraft(e.target.value)}
                                  className="w-20 px-2 py-1 text-[12px] font-mono-code bg-[#FAF8F5] border border-[#181615] rounded-[6px]"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleCommitPrice(dish.id)}
                                  className="px-2.5 py-1 rounded-[6px] bg-[#D9480F] text-[#FFFFFF] text-[11px] font-semibold cursor-pointer"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDishId(dish.id);
                                  setPriceDraft(String(dish.price));
                                }}
                                className="font-mono-code text-[12px] font-semibold text-[#D9480F] hover:underline cursor-pointer whitespace-nowrap"
                              >
                                {state.currencySymbol}
                                {dish.price} · Edit
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggle86(dish.id)}
                        aria-label={`Toggle 86 sold out for ${dish.name}`}
                        className={`min-h-[36px] px-3 rounded-[8px] text-[12px] font-medium cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                          dish.isAvailable
                            ? 'bg-[#FAF8F5] border border-[#E4E0D8] text-[#181615] hover:bg-[#FFF1EB]'
                            : 'bg-[#181615] text-[#FAF8F5]'
                        }`}
                      >
                        {dish.isAvailable ? '86 Sold Out' : 'Restock'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {adminTab === 'floor' && (
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
            onOpenTableGuestMenu={onOpenTableGuestMenu}
          />
        )}

        {adminTab === 'qr' && (
          <TableQrGenerator
            venueName={state.venueName}
            venueSlug={state.venueSlug}
            serviceLevel={state.serviceLevel}
            activeTable={state.activeTable}
            tables={state.tables}
            onSelectTable={onSelectTable}
            onAddTable={onAddTable}
            onTestTableMenu={onOpenTableGuestMenu}
          />
        )}

        {adminTab === 'ota' && (
          <div
            className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
            data-testid="admin-ota-sync-panel"
          >
            <div className="lg:col-span-6 p-5 rounded-[12px] bg-[#FAF8F5] border border-[#E4E0D8] flex flex-col gap-3">
              <div className="text-[12px] font-semibold text-[#D9480F]">
                Live Over-The-Air &amp; Low-Battery Architecture
              </div>
              <h3 className="font-display text-[20px] font-semibold text-[#181615] m-0">
                Push Live Updates Without Re-Installing APKs
              </h3>
              <p className="text-[13px] text-[#5C5852] m-0 leading-relaxed">
                Installed Waiter, Kitchen KDS, and Owner APKs pull UI &amp; code updates directly from{' '}
                <code className="font-mono-code text-[12px] text-[#181615]">ota/manifest.json</code>{' '}
                and sync live floor state over event-driven WebSockets—halting background HTTP polling when locked or minimized to protect phone battery.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onPushOta}
                  disabled={isPushingOta}
                  className="min-h-[42px] px-4 rounded-[10px] bg-[#181615] hover:bg-[#D9480F] text-[#FAF8F5] text-[13px] font-semibold cursor-pointer whitespace-nowrap transition-colors"
                >
                  Broadcast Live OTA (v{(state.otaVersion || 242) + 1})
                </button>
                <span className="font-mono-code text-[12px] text-[#5C5852]">
                  Active: v{state.otaVersion || 242} · State v{state.stateVersion}
                </span>
              </div>
            </div>

            <div className="lg:col-span-6 p-5 rounded-[12px] bg-[#FFFFFF] border border-[#E4E0D8] flex flex-col gap-3">
              <div className="text-[12px] font-semibold text-[#181615]">
                Recent Cross-Device Events
              </div>
              <div className="flex flex-col divide-y divide-[#E4E0D8] max-h-[220px] overflow-y-auto">
                {state.pushEvents.slice(0, 6).map((evt) => (
                  <div
                    key={evt.id}
                    className="py-2.5 flex items-center justify-between gap-2 text-[12px]"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[#181615] truncate">{evt.title}</div>
                      <div className="text-[11px] text-[#5C5852] truncate">{evt.body}</div>
                    </div>
                    <span className="font-mono-code text-[11px] text-[#5C5852] shrink-0">
                      {evt.latencyMs}ms · {evt.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
