import React, { useEffect, useRef, useState } from 'react';
import {
  CafeEcosystemState,
  DishItem,
  FCM_VAPID_PUBLIC_KEY,
  PushNotificationEvent,
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLISHABLE_KEY,
  ServiceLevel,
  applyAdminDishPatch,
  calculateCartTotal,
  createInitialCafeState,
  supabase,
} from './lib/ecosystemStore';
import { ThemeCataloguePage } from './catalogue/ThemeCataloguePage';
import { LiveThemeInstance } from './catalogue/LiveThemeInstance';
import { ThemeId } from './catalogue/themeCatalogData';
import { soundFX, useSoundEffects } from './lib/soundEffects';

type ActiveWorkspaceView =
  | 'split-suite'
  | 'guest-web'
  | 'waiter-apk'
  | 'kitchen-apk'
  | 'admin-apk'
  | 'theme-catalogue'
  | 'live-theme';

export default function App() {
  const [state, setState] = useState<CafeEcosystemState>(() => createInitialCafeState());
  const [view, setView] = useState<ActiveWorkspaceView>('split-suite');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [waiterTab, setWaiterTab] = useState<'calls' | 'pickup' | 'floor'>('calls');
  const [adminTab, setAdminTab] = useState<'menu' | 'floor' | 'qr' | 'apk-build'>('menu');
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<string>('');
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeThemeConfig, setActiveThemeConfig] = useState<{
    themeId: ThemeId;
    customBrandName: string;
    serviceLevel: ServiceLevel;
    initialTable: number;
  }>({
    themeId: 'classy-elegant',
    customBrandName: 'Roast & Co.',
    serviceLevel: 3,
    initialTable: 5,
  });

  const { soundEnabled, toggleSound } = useSoundEffects();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase.channel('cafe-ecosystem-realtime', {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'dish_patch' }, (payload) => {
        if (payload?.payload) {
          const { dishId, patch } = payload.payload as {
            dishId: string;
            patch: Partial<DishItem>;
          };
          setState((prev) => applyAdminDishPatch(prev, dishId, patch));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setState((prev) => ({ ...prev, realtimeConnected: true }));
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const pushLog = (
    targetApk: PushNotificationEvent['targetApk'],
    channel: string,
    title: string,
    body: string
  ) => {
    const now = new Date().toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const latencyMs = Math.floor(110 + Math.random() * 75);
    const evt: PushNotificationEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      targetApk,
      channel,
      title,
      body,
      latencyMs,
    };
    setState((prev) => ({
      ...prev,
      lastSyncLatencyMs: latencyMs,
      pushEvents: [evt, ...prev.pushEvents.slice(0, 19)],
    }));
  };

  // Guest Web Menu Handlers
  const handleAddToCart = (dish: DishItem) => {
    if (!dish.isAvailable) return;
    soundFX.play('cartAdd');
    setState((prev) => {
      const existing = prev.cart.find((c) => c.dish.id === dish.id);
      const nextCart = existing
        ? prev.cart.map((c) => (c.dish.id === dish.id ? { ...c, qty: c.qty + 1 } : c))
        : [...prev.cart, { dish, qty: 1 }];
      return { ...prev, cart: nextCart };
    });
  };

  const handleRemoveFromCart = (dishId: string) => {
    soundFX.play('cartRemove');
    setState((prev) => ({
      ...prev,
      cart: prev.cart
        .map((c) => (c.dish.id === dishId ? { ...c, qty: c.qty - 1 } : c))
        .filter((c) => c.qty > 0),
    }));
  };

  const handleGuestCallWaiter = () => {
    soundFX.play('waiterCall');
    const total = calculateCartTotal(state.cart);
    const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setState((prev) => ({
      ...prev,
      waiterCalls: [
        {
          id: `wc-${Date.now()}`,
          tableNumber: prev.activeTable,
          cartSnapshot: [...prev.cart],
          cartTotal: total,
          status: 'pending',
          createdAt: now,
        },
        ...prev.waiterCalls.filter((c) => c.tableNumber !== prev.activeTable),
      ],
      tables: prev.tables.map((t) =>
        t.tableNumber === prev.activeTable
          ? { ...t, status: 'waiter_called', cartTotal: total, updatedAt: 'Just now' }
          : t
      ),
    }));
    pushLog(
      'com.buildbros.waiter',
      'fcm:waiter_calls_urgent',
      `Table ${state.activeTable} Needs a Waiter`,
      `Cart ready (${state.currencySymbol}${total}) — High-priority FCM chime fired`
    );
  };

  const handleGuestPlaceOrder = () => {
    if (state.cart.length === 0) return;
    soundFX.play('ticketSent');
    const ticketNumber = `#0${Math.floor(413 + Math.random() * 85)}`;
    const totalAmount = calculateCartTotal(state.cart);
    const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setState((prev) => ({
      ...prev,
      orders: [
        {
          id: `ord-${Date.now()}`,
          ticketNumber,
          tableNumber: prev.activeTable,
          items: [...prev.cart],
          totalAmount,
          receptionConfirmed: prev.autoRouteToKitchen,
          status: prev.autoRouteToKitchen ? 'cooking' : 'incoming',
          notes: '',
          createdAt: now,
        },
        ...prev.orders,
      ],
      tables: prev.tables.map((t) =>
        t.tableNumber === prev.activeTable
          ? {
              ...t,
              status: prev.autoRouteToKitchen ? 'cooking' : 'ordering',
              activeTicket: ticketNumber,
              cartTotal: totalAmount,
              updatedAt: 'Just now',
            }
          : t
      ),
    }));

    pushLog(
      'com.buildbros.kitchen',
      'fcm:kitchen_pass_bell',
      `New Order ${ticketNumber} · Table ${state.activeTable}`,
      `${state.cart.map((c) => `${c.qty}x ${c.dish.name}`).join(', ')} (${
        state.autoRouteToKitchen ? 'Auto-routed to KDS' : 'At Reception Gate'
      })`
    );
  };

  // Waiter APK Handlers
  const handleWaiterAcknowledge = (callId: string) => {
    soundFX.play('served');
    setState((prev) => {
      const target = prev.waiterCalls.find((c) => c.id === callId);
      return {
        ...prev,
        waiterCalls: prev.waiterCalls.map((c) =>
          c.id === callId ? { ...c, status: 'acknowledged', acknowledgedBy: 'Staff #04' } : c
        ),
        tables: prev.tables.map((t) =>
          target && t.tableNumber === target.tableNumber
            ? { ...t, status: 'ordering', updatedAt: 'Just now' }
            : t
        ),
      };
    });
    pushLog(
      'guest-web',
      'supabase_realtime:waiter_calls',
      `Waiter On My Way → Table ${state.activeTable}`,
      'Waiter APK claimed call; guest phone banner updated in real time'
    );
  };

  const handleWaiterServeOrder = (orderId: string) => {
    soundFX.play('served');
    setState((prev) => {
      const target = prev.orders.find((o) => o.id === orderId);
      return {
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? { ...o, status: 'served' } : o)),
        tables: prev.tables.map((t) =>
          target && t.tableNumber === target.tableNumber
            ? { ...t, status: 'served', updatedAt: 'Just now' }
            : t
        ),
      };
    });
    pushLog(
      'com.buildbros.admin',
      'supabase_realtime:orders',
      'Order Delivered & Table Served',
      'Waiter APK marked pickup ticket as Served'
    );
  };

  // Kitchen & Reception KDS APK Handlers
  const handleReceptionConfirm = (orderId: string) => {
    soundFX.play('tap');
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === orderId ? { ...o, receptionConfirmed: true, status: 'new' } : o
      ),
    }));
    pushLog(
      'com.buildbros.kitchen',
      'supabase_realtime:orders',
      'Reception Confirmed Ticket',
      'Ticket released from Counter Gate to Kitchen Pass KDS'
    );
  };

  const handleKitchenAdvance = (orderId: string) => {
    const target = state.orders.find((o) => o.id === orderId);
    if (!target) return;
    const nextStatusMap: Record<typeof target.status, typeof target.status> = {
      incoming: 'new',
      new: 'cooking',
      cooking: 'ready',
      ready: 'served',
      served: 'served',
    };
    const nextStatus = nextStatusMap[target.status];
    soundFX.play(nextStatus === 'served' ? 'served' : 'kitchenReady');

    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === orderId ? { ...o, receptionConfirmed: true, status: nextStatus } : o
      ),
      tables: prev.tables.map((t) =>
        t.tableNumber === target.tableNumber
          ? {
              ...t,
              status:
                nextStatus === 'cooking'
                  ? 'cooking'
                  : nextStatus === 'ready'
                  ? 'ready'
                  : 'served',
              updatedAt: 'Just now',
            }
          : t
      ),
    }));

    if (nextStatus === 'ready') {
      pushLog(
        'com.buildbros.waiter',
        'fcm:waiter_calls_urgent',
        `PICKUP READY · ${target.ticketNumber} (Table ${target.tableNumber})`,
        'Kitchen KDS marked Ready — FCM high-priority alert fired to Waiter APK'
      );
    } else {
      pushLog(
        'guest-web',
        'supabase_realtime:orders',
        `Ticket ${target.ticketNumber} → ${nextStatus.toUpperCase()}`,
        `Guest phone at Table ${target.tableNumber} updated live`
      );
    }
  };

  // Admin APK Handlers
  const handleAdminSavePrice = (dishId: string) => {
    const parsed = parseFloat(priceDraft);
    if (!Number.isNaN(parsed) && parsed > 0) {
      soundFX.play('tap');
      setState((prev) => applyAdminDishPatch(prev, dishId, { price: Math.round(parsed) }));
      channelRef.current?.send({
        type: 'broadcast',
        event: 'dish_patch',
        payload: { dishId, patch: { price: Math.round(parsed) } },
      });
    }
    setEditingDishId(null);
  };

  const handleAdminToggle86 = (dishId: string) => {
    soundFX.play('tap');
    const target = state.dishes.find((d) => d.id === dishId);
    const nextAvailable = !target?.isAvailable;
    setState((prev) => applyAdminDishPatch(prev, dishId, { isAvailable: nextAvailable }));
    channelRef.current?.send({
      type: 'broadcast',
      event: 'dish_patch',
      payload: { dishId, patch: { isAvailable: nextAvailable } },
    });
  };

  const handleSwitchLevel = (level: ServiceLevel) => {
    soundFX.play('tap');
    setState((prev) => ({ ...prev, serviceLevel: level }));
    pushLog(
      'guest-web',
      'supabase_realtime:venues',
      `Service Level Switched → Level ${level}`,
      level === 1
        ? 'All tables switched to Digital Menu browse mode'
        : level === 2
        ? 'All tables enabled Cart + 1-tap Waiter Call'
        : 'All tables enabled Full Mobile Ordering to Kitchen KDS'
    );
  };

  if (view === 'theme-catalogue') {
    return (
      <div>
        <div className="bg-[#140905] text-[#FBEFE6] px-4 py-2.5 flex items-center justify-between border-b border-[#FBEFE6]/15">
          <span className="font-mono-code text-[12px] text-[#C4F042]">
            The Cafe Ecosystem · 4-Theme Guest Menu &amp; POS Suite
          </span>
          <button
            type="button"
            onClick={() => setView('split-suite')}
            className="px-3 py-1 rounded-[8px] bg-[#E8500C] text-[#FBEFE6] text-[12px] font-semibold cursor-pointer"
          >
            ← Back to 4-Surface APK Command Center
          </button>
        </div>
        <ThemeCataloguePage
          onInitializeTheme={(config) => {
            setActiveThemeConfig(config);
            setView('live-theme');
          }}
          onBackToCommandCenter={() => setView('split-suite')}
        />
      </div>
    );
  }

  if (view === 'live-theme') {
    return (
      <LiveThemeInstance
        initialThemeId={activeThemeConfig.themeId}
        initialLevel={activeThemeConfig.serviceLevel}
        initialVenueName={activeThemeConfig.customBrandName || state.venueName}
        initialTable={activeThemeConfig.initialTable}
        onBackToCatalogue={() => setView('theme-catalogue')}
      />
    );
  }

  const categories = ['All', ...Array.from(new Set(state.dishes.map((d) => d.category)))];
  const filteredDishes =
    selectedCategory === 'All'
      ? state.dishes
      : state.dishes.filter((d) => d.category === selectedCategory);
  const cartTotal = calculateCartTotal(state.cart);
  const cartCount = state.cart.reduce((sum, c) => sum + c.qty, 0);
  const activeTableCall = state.waiterCalls.find((c) => c.tableNumber === state.activeTable);
  const activeTableOrder = state.orders.find((o) => o.tableNumber === state.activeTable) || state.orders[0];
  const readyOrders = state.orders.filter((o) => o.status === 'ready');
  const pendingCalls = state.waiterCalls.filter((c) => c.status === 'pending');
  const shiftRevenue = state.tables.reduce((acc, t) => acc + (t.cartTotal || 0), 0);

  return (
    <div className="min-h-screen bg-[#F7F2ED] text-[#1A0C06] flex flex-col">
      {/* Top Product Command Header (Strict 3-Zone Contract) */}
      <header className="bg-[#140905] text-[#FBEFE6] border-b border-[#2A180D] px-4 md:px-6 py-3 sticky top-0 z-50">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
          {/* Zone 1: Brand Title */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setView('split-suite');
            }}
            className="text-[17px] font-bold tracking-tight text-[#FBEFE6] no-underline whitespace-nowrap shrink-0"
          >
            The Cafe Ecosystem
          </a>

          {/* Zone 2: Surface Switcher Links */}
          <nav
            aria-label="Product surfaces"
            className="hidden lg:flex items-center gap-5 text-[13px] font-medium"
          >
            {(
              [
                { id: 'split-suite', label: 'All 4 Surfaces' },
                { id: 'guest-web', label: '1. Guest Web Menu' },
                { id: 'waiter-apk', label: '2. Waiter APK' },
                { id: 'kitchen-apk', label: '3. Kitchen KDS APK' },
                { id: 'admin-apk', label: '4. Owner Admin APK' },
              ] as Array<{ id: ActiveWorkspaceView; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`cursor-pointer transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
                  view === tab.id
                    ? 'text-[#FFFFFF] border-[#E8500C] font-semibold'
                    : 'text-[#FBEFE6]/75 border-transparent hover:text-[#FFFFFF]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setView('theme-catalogue')}
              className="px-3.5 py-1.5 rounded-[10px] bg-[#E8500C] hover:bg-[#C03E0A] text-[#FBEFE6] text-[12px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Open 4-Theme Catalogue
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Sub-Toolbar: Live Supabase + FCM Telemetry & Level Controls */}
      <div className="bg-[#1A0C06] text-[#FBEFE6] border-b border-[#2A180D] px-4 md:px-6 py-2.5">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3 text-[12px]">
          <div className="flex flex-wrap items-center gap-3 font-mono-code">
            <span className="inline-flex items-center gap-1.5 text-[#C4F042] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#C4F042]" aria-hidden="true" />
              Supabase Realtime + FCM Active ({state.lastSyncLatencyMs}ms)
            </span>
            <span className="text-[#FBEFE6]/60 hidden sm:inline">·</span>
            <span className="text-[#FBEFE6]/80 hidden sm:inline">
              {SUPABASE_PROJECT_URL.replace('https://', '')}
            </span>
          </div>

          {/* Mobile surface selector + Level switcher + Sound FX */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex lg:hidden items-center gap-1">
              {(
                [
                  { id: 'split-suite', label: 'All 4' },
                  { id: 'guest-web', label: 'Guest' },
                  { id: 'waiter-apk', label: 'Waiter' },
                  { id: 'kitchen-apk', label: 'Kitchen' },
                  { id: 'admin-apk', label: 'Admin' },
                ] as Array<{ id: ActiveWorkspaceView; label: string }>
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setView(t.id)}
                  className={`px-2 py-1 rounded-[6px] text-[11px] font-semibold cursor-pointer ${
                    view === t.id ? 'bg-[#E8500C] text-[#FBEFE6]' : 'bg-[#2A180D] text-[#FBEFE6]/80'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-[#2A180D] p-1 rounded-[8px]" role="group" aria-label="Venue Service Level">
              {([1, 2, 3] as ServiceLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => handleSwitchLevel(lvl)}
                  className={`px-2.5 py-1 rounded-[6px] font-mono-code text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                    state.serviceLevel === lvl
                      ? 'bg-[#E8500C] text-[#FBEFE6]'
                      : 'text-[#FBEFE6]/75 hover:text-[#FFFFFF]'
                  }`}
                >
                  Level {lvl}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundEnabled}
              className="px-2.5 py-1 rounded-[8px] bg-[#2A180D] hover:bg-[#3A2214] text-[#FBEFE6] font-mono-code text-[11px] cursor-pointer whitespace-nowrap"
            >
              {soundEnabled ? 'Chime Audio: ON' : 'Chime Audio: OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Product Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">
        {/* Surface 4: Owner / Admin Dedicated Android APK (com.buildbros.admin) */}
        {(view === 'split-suite' || view === 'admin-apk') && (
          <section
            aria-label="Owner Admin Android APK"
            className="bg-[#FFFFFF] rounded-[20px] border-2 border-[#1A0C06] overflow-hidden"
            data-testid="surface-admin-apk"
          >
            <div className="bg-[#140905] text-[#FBEFE6] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-0.5 rounded-[6px] bg-[#E8500C] text-[#FBEFE6] font-mono-code text-[11px] font-bold">
                  SURFACE 4 · ADMIN APK
                </span>
                <h2 className="text-[15px] font-semibold m-0">
                  com.buildbros.admin · Live Price, 86 Sold-Out &amp; Floor Controller
                </h2>
              </div>
              <div className="flex items-center gap-4 font-mono-code text-[12px]">
                <span className="text-[#C4F042]">Sync: {state.lastSyncLatencyMs}ms</span>
                <span>Active Table: #{state.activeTable}</span>
                <span className="font-bold">
                  Shift Revenue: {state.currencySymbol}
                  {shiftRevenue}
                </span>
              </div>
            </div>

            <div className="px-4 py-2.5 bg-[#F7F2ED] border-b border-[#E3D9D3] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'menu', label: 'Instant Menu & 86 Editor' },
                    { id: 'floor', label: 'Live 12-Table Floor Monitor' },
                    { id: 'qr', label: 'Table QR Plaque Generator' },
                    { id: 'apk-build', label: 'Android APK & Supabase SQL' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAdminTab(t.id)}
                    className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                      adminTab === t.id
                        ? 'bg-[#1A0C06] text-[#FBEFE6]'
                        : 'bg-[#F3ECE5] text-[#6C625C] hover:text-[#1A0C06]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    autoRouteToKitchen: !prev.autoRouteToKitchen,
                  }))
                }
                className={`px-3 py-1 rounded-[8px] font-mono-code text-[11px] font-semibold border cursor-pointer transition-colors whitespace-nowrap ${
                  state.autoRouteToKitchen
                    ? 'bg-[#FFEEE3] border-[#E8500C] text-[#C03E0A]'
                    : 'bg-[#FFFFFF] border-[#E3D9D3] text-[#6C625C]'
                }`}
              >
                Skip Reception Gate (Auto-KDS): {state.autoRouteToKitchen ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="p-4">
              {adminTab === 'menu' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {state.dishes.map((dish) => {
                    const isEditing = editingDishId === dish.id;
                    return (
                      <div
                        key={dish.id}
                        className={`p-3 rounded-[14px] border flex items-center justify-between gap-2 ${
                          dish.isAvailable
                            ? 'bg-[#F7F2ED] border-[#E3D9D3]'
                            : 'bg-[#F3ECE5]/60 border-[#E3D9D3] opacity-70'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[13px] text-[#1A0C06] truncate">
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
                                  className="w-20 px-2 py-0.5 text-[12px] font-mono-code bg-[#FFFFFF] border border-[#1A0C06] rounded-[6px]"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAdminSavePrice(dish.id)}
                                  className="px-2 py-0.5 rounded-[6px] bg-[#E8500C] text-[#FBEFE6] text-[11px] font-semibold cursor-pointer"
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
                                className="font-mono-code text-[12px] font-bold text-[#C03E0A] hover:underline cursor-pointer tabular-nums"
                              >
                                {state.currencySymbol}
                                {dish.price} · Edit Price
                              </button>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAdminToggle86(dish.id)}
                          aria-label={`Toggle 86 sold out for ${dish.name}`}
                          className={`px-2.5 py-1.5 rounded-[8px] font-mono-code text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                            dish.isAvailable
                              ? 'bg-[#FFFFFF] border border-[#E3D9D3] text-[#1A0C06] hover:bg-[#FFEEE3]'
                              : 'bg-[#1A0C06] text-[#FBEFE6]'
                          }`}
                        >
                          {dish.isAvailable ? '86 Sold Out' : 'Sold Out (Restock)'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {adminTab === 'floor' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                  {state.tables.map((t) => {
                    const isSelected = state.activeTable === t.tableNumber;
                    return (
                      <button
                        key={t.tableNumber}
                        type="button"
                        onClick={() => setState((prev) => ({ ...prev, activeTable: t.tableNumber }))}
                        className={`p-3 rounded-[14px] border text-left flex flex-col gap-1 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#140905] text-[#FBEFE6] border-[#E8500C]'
                            : 'bg-[#F7F2ED] text-[#1A0C06] border-[#E3D9D3] hover:border-[#1A0C06]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono-code font-bold text-[13px]">
                            Table {t.tableNumber}
                          </span>
                          <span className="text-[10px] font-mono-code opacity-75">{t.seats}p</span>
                        </div>
                        <span className="text-[11px] font-semibold capitalize text-[#E8500C]">
                          {t.status.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] font-mono-code opacity-75 tabular-nums">
                          {t.cartTotal ? `${state.currencySymbol}${t.cartTotal}` : t.updatedAt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {adminTab === 'qr' && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-[16px] bg-[#F7F2ED] border border-[#E3D9D3]">
                  <div className="flex flex-col gap-2">
                    <span className="font-mono-code text-[11px] font-bold uppercase text-[#C03E0A]">
                      Print-Ready Table QR Plaque · Table {state.activeTable}
                    </span>
                    <div className="font-semibold text-[16px]">
                      https://menu.buildbros.app/{state.venueSlug}?table={state.activeTable}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setState((prev) => ({ ...prev, activeTable: n }))}
                          className={`px-2.5 py-1 rounded-[6px] font-mono-code text-[11px] font-semibold cursor-pointer ${
                            state.activeTable === n
                              ? 'bg-[#E8500C] text-[#FBEFE6]'
                              : 'bg-[#FFFFFF] border border-[#E3D9D3] text-[#1A0C06]'
                          }`}
                        >
                          Table {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {adminTab === 'apk-build' && (
                <div className="p-4 rounded-[16px] bg-[#140905] text-[#FBEFE6] font-mono-code text-[12px] flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[#C4F042] font-bold">
                      Capacitor 6 Android APK Monorepo + Supabase SQL Schema
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          `-- Run in Supabase SQL Editor (${SUPABASE_PROJECT_URL})\n-- Full migration in /supabase/migrations/0001_init_cafe_ecosystem.sql`
                        );
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 2000);
                      }}
                      className="px-3 py-1 rounded-[6px] bg-[#E8500C] text-[#FBEFE6] text-[11px] font-semibold cursor-pointer"
                    >
                      {copiedSql ? 'Copied SQL Info' : 'Copy SQL Reference'}
                    </button>
                  </div>
                  <div className="text-[11px] text-[#FBEFE6]/80">
                    APKs: android-apks/waiter-apk (com.buildbros.waiter) · android-apks/kitchen-apk (com.buildbros.kitchen) · android-apks/admin-apk (com.buildbros.admin)
                  </div>
                  <div className="text-[11px] text-[#FBEFE6]/70 break-all">
                    Supabase Publishable Key: {SUPABASE_PUBLISHABLE_KEY} · FCM VAPID Key: {FCM_VAPID_PUBLIC_KEY.slice(0, 36)}...
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 3 Operational Surfaces Grid: Guest Web Menu + Waiter APK + Kitchen & Reception KDS APK */}
        <div
          className={`grid gap-6 items-start ${
            view === 'split-suite'
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 max-w-[540px] mx-auto w-full'
          }`}
        >
          {/* Surface 1: Guest Web Menu (Zero-App Table QR Browser Experience) */}
          {(view === 'split-suite' || view === 'guest-web') && (
            <section
              aria-label="Guest Web Menu"
              className="bg-[#FFFFFF] rounded-[24px] border-2 border-[#E3D9D3] overflow-hidden flex flex-col"
              data-testid="surface-guest-web"
            >
              <div className="bg-[#F7F2ED] px-4 py-3 border-b border-[#E3D9D3] flex items-center justify-between">
                <div>
                  <span className="font-mono-code text-[10px] font-bold uppercase text-[#C03E0A] block">
                    SURFACE 1 · GUEST WEB MENU
                  </span>
                  <h3 className="text-[15px] font-bold text-[#1A0C06] m-0">
                    {state.venueName} · Table {state.activeTable}
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-[8px] bg-[#1A0C06] text-[#FBEFE6] font-mono-code text-[11px] font-semibold">
                  Level {state.serviceLevel}
                </span>
              </div>

              {/* Category Tabs */}
              <div className="px-3.5 py-2 flex items-center gap-1.5 overflow-x-auto border-b border-[#E3D9D3]">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-[8px] text-[12px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[#1A0C06] text-[#FBEFE6]'
                        : 'bg-[#F3ECE5] text-[#6C625C] hover:text-[#1A0C06]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Dish List */}
              <div className="p-3.5 flex flex-col gap-2.5 max-h-[340px] overflow-y-auto">
                {filteredDishes.map((dish) => {
                  const inCart = state.cart.find((c) => c.dish.id === dish.id);
                  return (
                    <div
                      key={dish.id}
                      className={`p-3 rounded-[14px] border border-[#E3D9D3] bg-[#F7F2ED]/60 flex items-center justify-between gap-3 ${
                        !dish.isAvailable ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true" className="shrink-0">
                          <circle cx="17" cy="17" r="15" fill="#F3ECE5" stroke="#E3D9D3" strokeWidth="1.5" />
                          <circle cx="17" cy="17" r="9" fill={dish.plateColor} />
                        </svg>
                        <div className="min-w-0">
                          <div className="font-semibold text-[13px] text-[#1A0C06] truncate">
                            {dish.name}
                          </div>
                          <div className="text-[11px] text-[#6C625C] truncate">
                            {dish.description}
                          </div>
                          <div className="font-mono-code text-[12px] font-bold text-[#1A0C06] mt-0.5 tabular-nums">
                            {dish.isAvailable
                              ? `${state.currencySymbol}${dish.price}`
                              : '86 · Sold Out'}
                          </div>
                        </div>
                      </div>

                      {state.serviceLevel >= 2 && dish.isAvailable && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {inCart && inCart.qty > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRemoveFromCart(dish.id)}
                                aria-label={`Remove one ${dish.name}`}
                                className="w-7 h-7 rounded-[8px] bg-[#F3ECE5] text-[#1A0C06] font-bold text-[14px] cursor-pointer"
                              >
                                -
                              </button>
                              <span className="font-mono-code text-[12px] font-bold w-4 text-center tabular-nums">
                                {inCart.qty}
                              </span>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAddToCart(dish)}
                            aria-label={`Add ${dish.name} to cart`}
                            className="px-2.5 h-7 rounded-[8px] bg-[#1A0C06] hover:bg-[#E8500C] text-[#FBEFE6] font-semibold text-[12px] cursor-pointer transition-colors"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Guest Footer Cart & Order Tracker */}
              <div className="p-4 bg-[#F7F2ED] border-t border-[#E3D9D3] flex flex-col gap-2.5">
                {state.serviceLevel === 1 && (
                  <div className="flex items-center justify-between text-[12px] text-[#6C625C]">
                    <span>Level 1 · Live Digital Menu</span>
                    <span className="font-mono-code">Synced in &lt;300ms</span>
                  </div>
                )}

                {state.serviceLevel >= 2 && (
                  <>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-semibold">
                        Table {state.activeTable} Cart ({cartCount} items)
                      </span>
                      <span className="font-mono-code font-bold text-[15px] tabular-nums">
                        {state.currencySymbol}
                        {cartTotal}
                      </span>
                    </div>

                    {state.serviceLevel === 2 && (
                      <button
                        type="button"
                        onClick={handleGuestCallWaiter}
                        disabled={cartCount === 0}
                        className="w-full h-10 rounded-[10px] bg-[#E8500C] hover:bg-[#C03E0A] disabled:bg-[#E3D9D3] text-[#FBEFE6] font-semibold text-[13px] cursor-pointer transition-colors"
                      >
                        {activeTableCall?.status === 'acknowledged'
                          ? `Waiter on the way to Table ${state.activeTable}`
                          : activeTableCall?.status === 'pending'
                          ? `Waiter notified · Table ${state.activeTable}`
                          : `Call waiter to Table ${state.activeTable}`}
                      </button>
                    )}

                    {state.serviceLevel === 3 && (
                      <div className="flex flex-col gap-2">
                        {activeTableOrder && (
                          <div className="px-3 py-2 rounded-[10px] bg-[#FFEEE3] border border-[#E8500C]/30 flex items-center justify-between text-[12px]">
                            <span className="font-mono-code font-bold">
                              Ticket {activeTableOrder.ticketNumber}
                            </span>
                            <span className="font-semibold text-[#C03E0A] uppercase font-mono-code">
                              {activeTableOrder.status}
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={handleGuestPlaceOrder}
                          disabled={cartCount === 0}
                          className="w-full h-10 rounded-[10px] bg-[#E8500C] hover:bg-[#C03E0A] disabled:bg-[#E3D9D3] text-[#FBEFE6] font-semibold text-[13px] cursor-pointer transition-colors"
                        >
                          Place Order to Kitchen ({state.currencySymbol}
                          {cartTotal})
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          {/* Surface 2: Waiter Dedicated Android APK (com.buildbros.waiter) */}
          {(view === 'split-suite' || view === 'waiter-apk') && (
            <section
              aria-label="Waiter Dedicated Android APK"
              className="bg-[#140905] text-[#FBEFE6] rounded-[24px] border-2 border-[#2A180D] overflow-hidden flex flex-col"
              data-testid="surface-waiter-apk"
            >
              <div className="bg-[#2A180D] px-4 py-3 border-b border-[#F7F2ED]/10 flex items-center justify-between">
                <div>
                  <span className="font-mono-code text-[10px] font-bold uppercase text-[#C4F042] block">
                    SURFACE 2 · WAITER APK
                  </span>
                  <h3 className="text-[15px] font-bold text-[#FBEFE6] m-0">
                    com.buildbros.waiter
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-[6px] bg-[#140905] text-[#C4F042] font-mono-code text-[10px] font-semibold">
                  FCM Wake Lock
                </span>
              </div>

              <div className="px-3.5 py-2 bg-[#1A0C06] border-b border-[#F7F2ED]/10 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setWaiterTab('calls')}
                    className={`px-2.5 py-1 rounded-[8px] text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                      waiterTab === 'calls'
                        ? 'bg-[#E8500C] text-[#FBEFE6]'
                        : 'bg-[#2A180D] text-[#FBEFE6]/75'
                    }`}
                  >
                    Calls ({pendingCalls.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaiterTab('pickup')}
                    className={`px-2.5 py-1 rounded-[8px] text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                      waiterTab === 'pickup'
                        ? 'bg-[#E8500C] text-[#FBEFE6]'
                        : 'bg-[#2A180D] text-[#FBEFE6]/75'
                    }`}
                  >
                    Pass Pickup ({readyOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaiterTab('floor')}
                    className={`px-2.5 py-1 rounded-[8px] text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                      waiterTab === 'floor'
                        ? 'bg-[#E8500C] text-[#FBEFE6]'
                        : 'bg-[#2A180D] text-[#FBEFE6]/75'
                    }`}
                  >
                    Floor Map
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundFX.play('waiterCall');
                    pushLog(
                      'com.buildbros.waiter',
                      'fcm:waiter_calls_urgent',
                      'Test Push Chime Fired',
                      'Verified Android wake-lock sound & vibration [0, 400, 200, 400]'
                    );
                  }}
                  className="px-2 py-1 rounded-[6px] bg-[#2A180D] hover:bg-[#E8500C] text-[#FBEFE6] font-mono-code text-[10px] font-semibold cursor-pointer whitespace-nowrap"
                >
                  Chime
                </button>
              </div>

              <div className="p-3.5 flex flex-col gap-3 max-h-[380px] overflow-y-auto">
                {waiterTab === 'calls' &&
                  state.waiterCalls.map((call) => (
                    <div
                      key={call.id}
                      className={`p-3.5 rounded-[14px] border flex flex-col gap-2 ${
                        call.status === 'pending'
                          ? 'bg-[#2A180D] border-[#E8500C]'
                          : 'bg-[#1A0C06] border-[#F7F2ED]/15'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[15px]">Table {call.tableNumber}</span>
                        <span
                          className={`px-2 py-0.5 rounded-[6px] font-mono-code text-[10px] font-semibold ${
                            call.status === 'pending'
                              ? 'bg-[#E8500C] text-[#FBEFE6]'
                              : 'bg-[#140905] text-[#C4F042]'
                          }`}
                        >
                          {call.status === 'pending' ? 'URGENT · Waiter Call' : 'On My Way · Claimed'}
                        </span>
                      </div>
                      <div className="text-[12px] text-[#FBEFE6]/80">
                        {call.cartSnapshot.map((i) => `${i.qty}x ${i.dish.name}`).join(', ')}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#F7F2ED]/10">
                        <span className="font-mono-code text-[12px] font-bold tabular-nums">
                          Cart {state.currencySymbol}
                          {call.cartTotal}
                        </span>
                        {call.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleWaiterAcknowledge(call.id)}
                            className="px-3 py-1.5 rounded-[8px] bg-[#C4F042] text-[#140905] font-bold text-[12px] cursor-pointer"
                          >
                            On My Way
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                {waiterTab === 'pickup' &&
                  (readyOrders.length === 0 ? (
                    <div className="py-8 text-center text-[13px] text-[#FBEFE6]/60">
                      No tickets waiting at the kitchen pass right now.
                    </div>
                  ) : (
                    readyOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3.5 rounded-[14px] bg-[#2A180D] border border-[#C4F042] flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono-code font-bold text-[14px] text-[#C4F042]">
                            PICKUP {ord.ticketNumber} · Table {ord.tableNumber}
                          </span>
                          <span className="font-mono-code text-[11px]">Ready at Pass</span>
                        </div>
                        <div className="text-[12px] text-[#FBEFE6]/90">
                          {ord.items.map((i) => `${i.qty}x ${i.dish.name}`).join(', ')}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleWaiterServeOrder(ord.id)}
                          className="w-full h-9 rounded-[8px] bg-[#C4F042] text-[#140905] font-bold text-[12px] cursor-pointer mt-1"
                        >
                          Mark Served at Table {ord.tableNumber}
                        </button>
                      </div>
                    ))
                  ))}

                {waiterTab === 'floor' && (
                  <div className="grid grid-cols-4 gap-2">
                    {state.tables.map((t) => (
                      <button
                        key={t.tableNumber}
                        type="button"
                        onClick={() =>
                          setState((prev) => ({ ...prev, activeTable: t.tableNumber }))
                        }
                        className={`p-2.5 rounded-[10px] border text-left cursor-pointer ${
                          state.activeTable === t.tableNumber
                            ? 'bg-[#E8500C] border-[#FBEFE6]'
                            : 'bg-[#1A0C06] border-[#F7F2ED]/15'
                        }`}
                      >
                        <div className="font-mono-code font-bold text-[12px]">T{t.tableNumber}</div>
                        <div className="text-[10px] capitalize truncate opacity-80">
                          {t.status.replace('_', ' ')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Surface 3: Kitchen & Reception Dedicated Android APK (com.buildbros.kitchen) */}
          {(view === 'split-suite' || view === 'kitchen-apk') && (
            <section
              aria-label="Kitchen and Reception KDS Android APK"
              className="bg-[#FFFFFF] text-[#1A0C06] rounded-[24px] border-2 border-[#E3D9D3] overflow-hidden flex flex-col"
              data-testid="surface-kitchen-apk"
            >
              <div className="bg-[#F7F2ED] px-4 py-3 border-b border-[#E3D9D3] flex items-center justify-between">
                <div>
                  <span className="font-mono-code text-[10px] font-bold uppercase text-[#C03E0A] block">
                    SURFACE 3 · KITCHEN &amp; RECEPTION APK
                  </span>
                  <h3 className="text-[15px] font-bold text-[#1A0C06] m-0">
                    com.buildbros.kitchen · 4-Stage KDS
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-[6px] bg-[#FFEEE3] text-[#C03E0A] font-mono-code text-[10px] font-semibold">
                  Keep-Awake KDS
                </span>
              </div>

              <div className="p-3.5 flex flex-col gap-3 max-h-[420px] overflow-y-auto">
                {state.orders.map((ord) => {
                  const stages: Array<typeof ord.status> = ['new', 'cooking', 'ready', 'served'];
                  return (
                    <div
                      key={ord.id}
                      className="p-3.5 rounded-[16px] bg-[#F7F2ED] border border-[#E3D9D3] flex flex-col gap-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-code font-bold text-[15px]">
                            {ord.ticketNumber}
                          </span>
                          <span className="text-[13px] font-semibold text-[#6C625C]">
                            · Table {ord.tableNumber}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-[6px] bg-[#E8500C] text-[#FBEFE6] font-mono-code text-[11px] font-semibold uppercase">
                          {ord.status}
                        </span>
                      </div>

                      {/* 4-Stage KDS Progress Bar */}
                      <div className="grid grid-cols-4 gap-1">
                        {stages.map((st) => (
                          <div
                            key={st}
                            className={`text-center py-1 rounded-[6px] text-[10px] font-mono-code font-semibold uppercase ${
                              ord.status === st
                                ? 'bg-[#1A0C06] text-[#FBEFE6]'
                                : 'bg-[#F3ECE5] text-[#6C625C]'
                            }`}
                          >
                            {st}
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col gap-1 text-[13px]">
                        {ord.items.map((item) => (
                          <div key={item.dish.id} className="flex justify-between font-medium">
                            <span>
                              {item.qty}x {item.dish.name}
                            </span>
                            <span className="font-mono-code text-[#6C625C] tabular-nums">
                              {state.currencySymbol}
                              {item.dish.price * item.qty}
                            </span>
                          </div>
                        ))}
                      </div>

                      {!ord.receptionConfirmed && ord.status === 'incoming' ? (
                        <button
                          type="button"
                          onClick={() => handleReceptionConfirm(ord.id)}
                          className="w-full h-9 rounded-[8px] bg-[#E8500C] hover:bg-[#C03E0A] text-[#FBEFE6] font-semibold text-[12px] cursor-pointer transition-colors"
                        >
                          Reception Gate: Confirm Order {ord.ticketNumber}
                        </button>
                      ) : (
                        ord.status !== 'served' && (
                          <button
                            type="button"
                            onClick={() => handleKitchenAdvance(ord.id)}
                            className="w-full h-9 rounded-[8px] bg-[#1A0C06] hover:bg-[#E8500C] text-[#FBEFE6] font-semibold text-[12px] cursor-pointer transition-colors"
                          >
                            {ord.status === 'new'
                              ? 'Start Cooking'
                              : ord.status === 'cooking'
                              ? 'Mark Ready (Alert Waiter APK)'
                              : 'Mark Served'}
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Live Supabase WebSocket & FCM Push Event Feed */}
        <section
          aria-label="Live Supabase Realtime and FCM Push Stream"
          className="p-4 rounded-[18px] bg-[#140905] text-[#FBEFE6] border border-[#2A180D] flex flex-col gap-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F7F2ED]/10 pb-2">
            <span className="font-mono-code text-[12px] font-bold text-[#C4F042] uppercase">
              Live Supabase Realtime &amp; FCM Push Event Stream
            </span>
            <span className="font-mono-code text-[11px] text-[#FBEFE6]/60">
              postgres_changes · waiter_calls_urgent · kitchen_pass_bell
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {state.pushEvents.slice(0, 3).map((evt) => (
              <div
                key={evt.id}
                className="p-2.5 rounded-[12px] bg-[#2A180D]/80 border border-[#F7F2ED]/10 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between text-[10px] font-mono-code text-[#FF8741]">
                  <span>{evt.targetApk}</span>
                  <span className="tabular-nums">
                    {evt.latencyMs}ms · {evt.timestamp}
                  </span>
                </div>
                <div className="font-semibold text-[12px] text-[#FBEFE6] truncate">
                  {evt.title}
                </div>
                <div className="text-[11px] text-[#FBEFE6]/75 truncate">{evt.body}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
