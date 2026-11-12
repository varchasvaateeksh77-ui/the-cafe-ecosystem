import React, { useState, useEffect, useRef } from 'react';
import {
  PRODUCT_THEMES,
  ProductThemeConfig,
  ServiceLevel,
  ThemeId,
  ThemeMenuItem,
  LiveOrderTicket,
  LiveWaiterCall,
  filterThemeMenu,
  computeThemeCartSummary,
  nextTicketStatus,
} from './themeCatalogData';
import { DishSwipeDeck } from './DishSwipeDeck';
import { OwnerAdminPanel } from './OwnerAdminPanel';
import { soundEffects } from '../lib/soundEffects';

interface LiveThemeInstanceProps {
  initialThemeId: ThemeId;
  initialLevel: ServiceLevel;
  initialVenueName?: string;
  initialTable?: number;
  onBackToCatalogue: () => void;
}

type FocusView = 'guest' | 'waiter' | 'kitchen' | 'backend' | 'admin';
type GuestStep = 'menu' | 'cart';
type MenuDisplayMode = 'swipe' | 'list';

const SHORT_THEME_LABELS: Record<ThemeId, string> = {
  'classy-elegant': '01. Elegant',
  minimalist: '02. Minimalist',
  'street-style': '03. Street',
  'artisanal-terracotta': '04. Terracotta',
};

export const LiveThemeInstance: React.FC<LiveThemeInstanceProps> = ({
  initialThemeId,
  initialLevel,
  initialVenueName,
  initialTable = 5,
  onBackToCatalogue,
}) => {
  const [activeThemeId, setActiveThemeId] = useState<ThemeId>(initialThemeId);
  const [focusView, setFocusView] = useState<FocusView>('guest');
  const [guestStep, setGuestStep] = useState<GuestStep>('menu');
  const [menuDisplayMode, setMenuDisplayMode] = useState<MenuDisplayMode>('swipe');
  const [serviceLevel, setServiceLevel] = useState<ServiceLevel>(initialLevel);
  const [tableNumber] = useState<number>(initialTable);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [orderNote, setOrderNote] = useState<string>('');
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(false);
  const [activeWaiterCallId, setActiveWaiterCallId] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState<boolean>(false);

  const secretTapCountRef = useRef<number>(0);
  const secretTapTimerRef = useRef<number | null>(null);

  const baseTheme: ProductThemeConfig =
    PRODUCT_THEMES.find((t) => t.id === activeThemeId) || PRODUCT_THEMES[0];

  const [menusByTheme, setMenusByTheme] = useState<Record<ThemeId, ThemeMenuItem[]>>(() => ({
    'classy-elegant': PRODUCT_THEMES[0].menu,
    minimalist: PRODUCT_THEMES[1].menu,
    'street-style': PRODUCT_THEMES[2].menu,
    'artisanal-terracotta': PRODUCT_THEMES[3].menu,
  }));

  const venueName =
    initialVenueName && activeThemeId === initialThemeId
      ? initialVenueName
      : baseTheme.defaultVenueName;

  const currentMenu = menusByTheme[activeThemeId];
  const filteredDishes = filterThemeMenu(currentMenu, activeCategory, '');

  const [cartsByTheme, setCartsByTheme] = useState<Record<ThemeId, Record<string, number>>>({
    'classy-elegant': {},
    minimalist: {},
    'street-style': {},
    'artisanal-terracotta': {},
  });

  const currentCart = cartsByTheme[activeThemeId] || {};
  const cartSummary = computeThemeCartSummary(currentMenu, currentCart);

  const [tickets, setTickets] = useState<LiveOrderTicket[]>([
    {
      ticketNumber: '#0414',
      tableNumber: 5,
      items: [
        {
          id: 'ce-1',
          name: 'Truffle & Heirloom Burrata',
          qty: 1,
          price: 18.0,
          imageUrl: PRODUCT_THEMES[0].menu[0].imageUrl,
        },
        {
          id: 'ce-3',
          name: '36-Hour Crispy Duck Confit',
          qty: 1,
          price: 34.0,
          imageUrl: PRODUCT_THEMES[0].menu[2].imageUrl,
        },
      ],
      total: 52.0,
      status: 'cooking',
      createdAt: 'Just now',
      source: 'guest-direct',
    },
  ]);

  const [waiterCalls, setWaiterCalls] = useState<LiveWaiterCall[]>([]);
  const [guestBanner, setGuestBanner] = useState<string | null>(null);

  // Connect to Real-Time Express + SSE Backend (/api/events)
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/events');
      es.onopen = () => setSseConnected(true);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'STATE_SYNC') {
            if (Array.isArray(data.tickets)) setTickets(data.tickets);
            if (Array.isArray(data.waiterCalls)) setWaiterCalls(data.waiterCalls);
            if (data.menusByTheme) setMenusByTheme(data.menusByTheme);
          }
        } catch {
          // Ignore malformed SSE frame
        }
      };
      es.onerror = () => {
        setSseConnected(false);
      };
    } catch {
      setSseConnected(false);
    }

    // Keyboard shortcut Shift + A to toggle Hidden Owner Admin Panel
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.shiftKey &&
        e.key.toLowerCase() === 'a' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (e.target as HTMLElement)?.tagName || ''
        )
      ) {
        e.preventDefault();
        setFocusView('admin');
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      es?.close();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Secret triple-tap on Table Badge to open Hidden Owner Admin Panel
  const handleSecretTableBadgeTap = () => {
    secretTapCountRef.current += 1;
    if (secretTapTimerRef.current) {
      window.clearTimeout(secretTapTimerRef.current);
    }
    if (secretTapCountRef.current >= 3) {
      secretTapCountRef.current = 0;
      soundEffects.playClick();
      setFocusView('admin');
      return;
    }
    secretTapTimerRef.current = window.setTimeout(() => {
      secretTapCountRef.current = 0;
    }, 650);
  };

  const handleSelectTheme = (id: ThemeId) => {
    soundEffects.playClick();
    setActiveThemeId(id);
    setActiveCategory('All');
    setGuestStep('menu');
    setGuestBanner(null);
  };

  const handleUpdateQty = (dishId: string, delta: number) => {
    soundEffects.playPop();
    setCartsByTheme((prev) => {
      const themeCart = { ...(prev[activeThemeId] || {}) };
      const nextQty = Math.max(0, (themeCart[dishId] || 0) + delta);
      if (nextQty === 0) {
        delete themeCart[dishId];
      } else {
        themeCart[dishId] = nextQty;
      }
      return { ...prev, [activeThemeId]: themeCart };
    });
  };

  const handleOpenCart = () => {
    soundEffects.playClick();
    setFocusView('guest');
    setGuestStep('cart');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Level 2: Call Waiter — Stays inside the Cart on Standby (never kicks guest out!)
  const handleCallWaiterFromCartOrHeader = (stayInCart: boolean) => {
    soundEffects.playWaiterCall();
    const callId = `wc-${Date.now()}`;
    const newCall: LiveWaiterCall = {
      id: callId,
      tableNumber,
      cartCount: cartSummary.totalCount,
      cartTotal: cartSummary.subtotal,
      cartItems: cartSummary.items.map((entry) => ({
        id: entry.item.id,
        name: entry.item.name,
        qty: entry.qty,
        price: entry.item.price,
      })),
      note: orderNote.trim() || undefined,
      reason: cartSummary.totalCount > 0 ? 'Order ready in cart' : 'Question for waiter',
      status: 'calling',
      createdAt: 'Just now',
    };

    setWaiterCalls((prev) => [newCall, ...prev]);
    setActiveWaiterCallId(callId);

    if (stayInCart) {
      setGuestStep('cart');
    } else {
      setGuestBanner(
        `Waiter notified for Table ${tableNumber}. Please standby—your waiter is on the way.`
      );
    }

    fetch('/api/waiter-calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCall),
    }).catch(() => {});
  };

  // Waiter Screen Action: Acknowledge / Confirm Cart to Kitchen / Mark Assisted
  const handleWaiterUpdateCall = (
    callId: string,
    nextStatus: LiveWaiterCall['status']
  ) => {
    soundEffects.playClick();
    const targetCall = waiterCalls.find((c) => c.id === callId);

    setWaiterCalls((prev) =>
      prev.map((c) => (c.id === callId ? { ...c, status: nextStatus } : c))
    );

    if (nextStatus === 'confirmed' && targetCall && targetCall.cartItems.length > 0) {
      soundEffects.playOrderSent();
      const nextNum = `#0${415 + tickets.length}`;
      const newTicket: LiveOrderTicket = {
        ticketNumber: nextNum,
        tableNumber: targetCall.tableNumber,
        items: targetCall.cartItems.map((it, idx) => ({
          ...it,
          note: idx === 0 && targetCall.note ? targetCall.note : undefined,
        })),
        total: targetCall.cartTotal,
        status: 'incoming',
        createdAt: 'Confirmed by Waiter',
        source: 'waiter-confirmed',
      };
      setTickets((prev) => [newTicket, ...prev]);
      setCartsByTheme((prev) => ({ ...prev, [activeThemeId]: {} }));
      setGuestBanner(
        `Waiter confirmed your Table ${targetCall.tableNumber} order (${nextNum}) and sent it to the kitchen.`
      );
    }

    fetch(`/api/waiter-calls/${encodeURIComponent(callId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    }).catch(() => {});
  };

  // Level 3: Guest Direct Place Order from Cart
  const handlePlaceOrder = () => {
    if (cartSummary.items.length === 0) return;
    soundEffects.playOrderSent();
    const nextNum = `#0${415 + tickets.length}`;
    const trimmedNote = orderNote.trim();
    const newTicket: LiveOrderTicket = {
      ticketNumber: nextNum,
      tableNumber,
      items: cartSummary.items.map((entry, idx) => ({
        id: entry.item.id,
        name: entry.item.name,
        qty: entry.qty,
        price: entry.item.price,
        imageUrl: entry.item.imageUrl,
        note: idx === 0 && trimmedNote ? trimmedNote : undefined,
      })),
      total: cartSummary.subtotal,
      status: 'incoming',
      createdAt: 'Just now',
      source: 'guest-direct',
    };
    setTickets((prev) => [newTicket, ...prev]);
    setCartsByTheme((prev) => ({ ...prev, [activeThemeId]: {} }));
    setOrderNote('');
    setActiveWaiterCallId(null);
    setGuestStep('menu');
    setGuestBanner(
      `Order ${nextNum} placed for Table ${tableNumber}. Sent directly to Kitchen Screen.`
    );

    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTicket),
    }).catch(() => {});
  };

  // Kitchen Screen: Advance Ticket Status
  const handleAdvanceTicket = (ticketNumber: string) => {
    soundEffects.playKitchenReady();
    let updatedStatus: LiveOrderTicket['status'] = 'cooking';
    setTickets((prev) =>
      prev.map((t) => {
        if (t.ticketNumber !== ticketNumber) return t;
        updatedStatus = nextTicketStatus(t.status);
        setGuestBanner(
          `Ticket ${t.ticketNumber} (Table ${t.tableNumber}) is now ${updatedStatus.toUpperCase()}.`
        );
        return { ...t, status: updatedStatus };
      })
    );

    fetch(`/api/orders/${encodeURIComponent(ticketNumber)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: updatedStatus }),
    }).catch(() => {});
  };

  // Hidden Admin Panel: Sync Updated Menu to Backend
  const handleAdminUpdateMenu = (nextMenu: ThemeMenuItem[]) => {
    soundEffects.playPop();
    setMenusByTheme((prev) => ({
      ...prev,
      [activeThemeId]: nextMenu,
    }));

    fetch(`/api/menu/${encodeURIComponent(activeThemeId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menu: nextMenu }),
    }).catch(() => {});
  };

  const activeStandbyCall =
    waiterCalls.find((c) => c.id === activeWaiterCallId) ||
    waiterCalls.find(
      (c) => c.tableNumber === tableNumber && c.status !== 'assisted'
    );

  const pendingWaiterAlertsCount =
    waiterCalls.filter((c) => c.status === 'calling' || c.status === 'walking')
      .length + tickets.filter((t) => t.status === 'ready').length;

  const activeKitchenTicketsCount = tickets.filter(
    (t) => t.status !== 'served'
  ).length;

  return (
    <div
      style={{
        backgroundColor: baseTheme.palette.canvas,
        color: baseTheme.palette.text,
        fontFamily: baseTheme.bodyFont,
      }}
      className="min-h-screen transition-colors duration-300 pb-32"
    >
      {/* Sleek Single-Row Floating Pill Top Bar */}
      <div className="sticky top-4 z-50 px-4 md:px-8 pointer-events-none">
        <header
          style={{
            backgroundColor:
              baseTheme.palette.mode === 'dark'
                ? 'rgba(18, 14, 12, 0.90)'
                : 'rgba(26, 18, 12, 0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          className="pointer-events-auto max-w-[1240px] mx-auto h-14 px-4 rounded-[18px] text-[#FBEFE6] flex items-center justify-between gap-2 border border-white/12 overflow-x-auto"
        >
          {/* Zone 1: Back to Catalogue + Compact Theme Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onBackToCatalogue}
              className="px-3 py-1.5 rounded-[10px] bg-white/10 hover:bg-white/18 text-[12px] font-medium cursor-pointer transition-colors shrink-0"
            >
              ← Catalogue
            </button>

            <div className="hidden xl:flex items-center gap-1 pl-2 border-l border-white/15">
              {PRODUCT_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTheme(t.id)}
                  className={`px-2.5 py-1 rounded-[8px] text-[12px] cursor-pointer transition-colors whitespace-nowrap ${
                    t.id === activeThemeId
                      ? 'bg-[#E8500C] text-white font-semibold'
                      : 'text-[#D6C7B8] hover:text-white'
                  }`}
                >
                  {SHORT_THEME_LABELS[t.id]}
                </button>
              ))}
            </div>
          </div>

          {/* Zone 2: Real Operational Screens Switcher (Guest Phone | Waiter Screen | Kitchen Screen | Backend) */}
          <nav
            aria-label="Live operational screens"
            className="flex items-center gap-1 p-1 rounded-[12px] bg-black/35 border border-white/10 shrink-0"
          >
            <button
              type="button"
              onClick={() => {
                setFocusView('guest');
              }}
              className={`px-3 py-1 rounded-[8px] text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                focusView === 'guest'
                  ? 'bg-white text-[#140905] font-semibold'
                  : 'text-[#D6C7B8] hover:text-white'
              }`}
            >
              Guest Phone
            </button>

            <button
              type="button"
              onClick={() => setFocusView('waiter')}
              className={`px-3 py-1 rounded-[8px] text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                focusView === 'waiter'
                  ? 'bg-white text-[#140905] font-semibold'
                  : 'text-[#D6C7B8] hover:text-white'
              }`}
            >
              Waiter Screen ({pendingWaiterAlertsCount})
            </button>

            <button
              type="button"
              onClick={() => setFocusView('kitchen')}
              className={`px-3 py-1 rounded-[8px] text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                focusView === 'kitchen'
                  ? 'bg-white text-[#140905] font-semibold'
                  : 'text-[#D6C7B8] hover:text-white'
              }`}
            >
              Kitchen Screen ({activeKitchenTicketsCount})
            </button>

            <button
              type="button"
              onClick={() => setFocusView('backend')}
              className={`px-3 py-1 rounded-[8px] text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                focusView === 'backend'
                  ? 'bg-white text-[#140905] font-semibold'
                  : 'text-[#D6C7B8] hover:text-white'
              }`}
            >
              Backend &amp; Sync
            </button>
          </nav>

          {/* Zone 3: Service Level Pill + Hidden Owner Admin Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-black/30 p-1 rounded-[10px]">
              {([1, 2, 3] as ServiceLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    setServiceLevel(lvl);
                    if (lvl === 1) setGuestStep('menu');
                  }}
                  className={`px-2.5 py-1 rounded-[7px] font-mono-code text-[11px] cursor-pointer ${
                    serviceLevel === lvl
                      ? 'bg-[#E8500C] text-white font-semibold'
                      : 'text-[#D6C7B8] hover:text-white'
                  }`}
                >
                  L{lvl}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setFocusView('admin')}
              title="Owner Admin Panel (Shortcut: Shift+A or triple-tap Table badge)"
              className={`px-2.5 py-1 rounded-[8px] font-mono-code text-[11px] cursor-pointer border transition-colors ${
                focusView === 'admin'
                  ? 'bg-[#9BE564] text-[#140905] border-[#9BE564] font-bold'
                  : 'bg-white/8 text-[#D6C7B8] border-white/15 hover:text-white'
              }`}
            >
              Owner PIN
            </button>
          </div>
        </header>
      </div>

      {/* =====================================================================
          VIEW 1: GUEST PHONE (Swipe Deck + Menu List + Cart Standby Flow)
         ===================================================================== */}
      {focusView === 'guest' && (
        <main className="max-w-[960px] mx-auto px-4 md:px-8 pt-10 md:pt-14">
          {guestStep === 'cart' && serviceLevel >= 2 ? (
            /* ===============================================================
               STEP B: DEDICATED GUEST CART & LEVEL 2 STANDBY SCREEN
               (Never kicks the customer out when Call Waiter is clicked!)
               =============================================================== */
            <section
              aria-label="Your Table Cart"
              className="max-w-[720px] mx-auto space-y-8"
            >
              {/* Top Back to Menu & Table Header */}
              <div
                style={{ borderColor: baseTheme.palette.border }}
                className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setGuestStep('menu')}
                    style={{
                      borderColor: baseTheme.palette.border,
                      color: baseTheme.palette.text,
                      borderRadius: baseTheme.buttonRadius,
                    }}
                    className="px-4 py-2 border font-mono-code text-[12px] uppercase tracking-[0.08em] cursor-pointer mb-4 inline-block"
                  >
                    ← Back to {venueName} Menu
                  </button>
                  <p
                    className="font-mono-code text-[11px] uppercase tracking-[0.14em]"
                    style={{ color: baseTheme.palette.accent }}
                  >
                    TABLE {tableNumber} · REVIEW YOUR SELECTION
                  </p>
                  <h1
                    style={{ fontFamily: baseTheme.displayFont }}
                    className="text-[34px] md:text-[42px] font-bold leading-tight mt-1"
                  >
                    Your Table Cart
                  </h1>
                </div>

                <span
                  style={{
                    backgroundColor: baseTheme.palette.surface,
                    borderColor: baseTheme.palette.border,
                    borderRadius: baseTheme.buttonRadius,
                  }}
                  className="px-4 py-2 border font-mono-code text-[13px] font-semibold tabular-nums"
                >
                  {cartSummary.totalCount}{' '}
                  {cartSummary.totalCount === 1 ? 'Item' : 'Items'}
                </span>
              </div>

              {/* ===========================================================
                  LEVEL 2 WAITER STANDBY BANNER (Stays right inside Cart!)
                 =========================================================== */}
              {activeStandbyCall && (
                <div
                  role="status"
                  aria-live="polite"
                  data-testid="waiter-standby-card"
                  style={{
                    backgroundColor: baseTheme.palette.surface,
                    borderColor: baseTheme.palette.accent,
                    borderRadius: baseTheme.cardRadius,
                  }}
                  className="p-6 md:p-7 border-2 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      style={{
                        backgroundColor: baseTheme.palette.accent,
                        color: baseTheme.palette.accentText,
                        borderRadius: baseTheme.buttonRadius,
                      }}
                      className="px-3.5 py-1 font-mono-code text-[11px] font-bold uppercase tracking-[0.12em]"
                    >
                      {activeStandbyCall.status === 'calling'
                        ? '● WAITER CALLED · PLEASE BE ON STANDBY'
                        : activeStandbyCall.status === 'walking'
                        ? '● WAITER ACKNOWLEDGED · WALKING TO TABLE 5'
                        : '✓ ORDER CONFIRMED BY WAITER'}
                    </span>

                    <span
                      className="font-mono-code text-[11px] uppercase tracking-[0.1em]"
                      style={{ color: baseTheme.palette.muted }}
                    >
                      Table {tableNumber} · Live Sync Active
                    </span>
                  </div>

                  <h2
                    style={{ fontFamily: baseTheme.displayFont }}
                    className="text-[24px] md:text-[28px] font-bold leading-snug"
                  >
                    {activeStandbyCall.status === 'calling'
                      ? `Waiter called for Table ${tableNumber}. Please standby on this screen.`
                      : activeStandbyCall.status === 'walking'
                      ? `Your waiter is walking over to Table ${tableNumber} right now.`
                      : `Your waiter confirmed your cart and sent it to the kitchen!`}
                  </h2>

                  <p
                    className="text-[14px] leading-relaxed"
                    style={{ color: baseTheme.palette.muted }}
                  >
                    Keep your cart open below so you can show or read your selection when your waiter arrives at Table {tableNumber}.
                  </p>

                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFocusView('waiter')}
                      style={{
                        borderColor: baseTheme.palette.accent,
                        color: baseTheme.palette.accent,
                        borderRadius: baseTheme.buttonRadius,
                      }}
                      className="px-4 py-2 border font-mono-code text-[11px] font-semibold uppercase tracking-[0.08em] cursor-pointer"
                    >
                      Preview Waiter Handheld Screen →
                    </button>
                  </div>
                </div>
              )}

              {cartSummary.items.length === 0 ? (
                <div
                  style={{
                    backgroundColor: baseTheme.palette.surface,
                    borderColor: baseTheme.palette.border,
                    borderRadius: baseTheme.cardRadius,
                  }}
                  className="p-10 border text-center space-y-4"
                >
                  <p className="text-[18px] font-medium">
                    Your Table {tableNumber} cart is currently empty.
                  </p>
                  <p
                    className="text-[14px]"
                    style={{ color: baseTheme.palette.muted }}
                  >
                    Swipe right on dishes in the deck to add them to your cart, then return here to place your order.
                  </p>
                  <button
                    type="button"
                    onClick={() => setGuestStep('menu')}
                    style={{
                      backgroundColor: baseTheme.palette.accent,
                      color: baseTheme.palette.accentText,
                      borderRadius: baseTheme.buttonRadius,
                    }}
                    className="px-6 py-3 font-mono-code text-[12px] font-semibold uppercase tracking-[0.1em] cursor-pointer mt-2"
                  >
                    Open Swipe Deck →
                  </button>
                </div>
              ) : (
                <>
                  {/* Cart Line Items List with Dish Thumbnails */}
                  <div
                    style={{
                      backgroundColor: baseTheme.palette.surface,
                      borderColor: baseTheme.palette.border,
                      borderRadius: baseTheme.cardRadius,
                    }}
                    className="border divide-y"
                  >
                    {cartSummary.items.map(({ item, qty, lineTotal }) => (
                      <div
                        key={item.id}
                        style={{ borderColor: baseTheme.palette.border }}
                        className="p-5 md:p-6 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-4">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-16 h-16 rounded-[10px] object-cover border shrink-0"
                            style={{ borderColor: baseTheme.palette.border }}
                          />
                          <div className="space-y-1">
                            <h2
                              style={{ fontFamily: baseTheme.displayFont }}
                              className="text-[20px] md:text-[22px] font-bold leading-snug"
                            >
                              {item.name}
                            </h2>
                            <p
                              className="font-mono-code text-[12px] tabular-nums"
                              style={{ color: baseTheme.palette.muted }}
                            >
                              {baseTheme.currencySymbol}
                              {item.price.toFixed(2)} each · {item.category}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-5">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              aria-label={`Decrease quantity of ${item.name}`}
                              onClick={() => handleUpdateQty(item.id, -1)}
                              style={{
                                borderColor: baseTheme.palette.border,
                                borderRadius: baseTheme.buttonRadius,
                              }}
                              className="w-8 h-8 border flex items-center justify-center cursor-pointer"
                            >
                              −
                            </button>
                            <span className="font-mono-code text-[14px] font-semibold w-6 text-center tabular-nums">
                              {qty}
                            </span>
                            <button
                              type="button"
                              aria-label={`Increase quantity of ${item.name}`}
                              onClick={() => handleUpdateQty(item.id, 1)}
                              style={{
                                backgroundColor: baseTheme.palette.accent,
                                color: baseTheme.palette.accentText,
                                borderRadius: baseTheme.buttonRadius,
                              }}
                              className="w-8 h-8 flex items-center justify-center font-bold cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          <span
                            className="font-mono-code text-[16px] font-bold tabular-nums min-w-[68px] text-right"
                            style={{ color: baseTheme.palette.accent }}
                          >
                            {baseTheme.currencySymbol}
                            {lineTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Optional Kitchen Note */}
                  <div
                    style={{
                      backgroundColor: baseTheme.palette.surface,
                      borderColor: baseTheme.palette.border,
                      borderRadius: baseTheme.cardRadius,
                    }}
                    className="p-5 md:p-6 border space-y-2"
                  >
                    <label
                      htmlFor="cart-kitchen-note"
                      className="block font-mono-code text-[11px] uppercase tracking-[0.12em]"
                      style={{ color: baseTheme.palette.muted }}
                    >
                      Kitchen / Waiter Note for Table {tableNumber} (Optional)
                    </label>
                    <input
                      id="cart-kitchen-note"
                      type="text"
                      value={orderNote}
                      onChange={(e) => setOrderNote(e.target.value)}
                      placeholder="Allergies, spice preference, or serve drinks first..."
                      style={{
                        backgroundColor: baseTheme.palette.canvas,
                        borderColor: baseTheme.palette.border,
                        color: baseTheme.palette.text,
                        borderRadius: baseTheme.buttonRadius,
                      }}
                      className="w-full px-4 py-2.5 border text-[14px] focus:outline-none"
                    />
                  </div>

                  {/* Final Order Summary & Action CTA */}
                  <div
                    style={{
                      backgroundColor: baseTheme.palette.surface,
                      borderColor: baseTheme.palette.accent,
                      borderRadius: baseTheme.cardRadius,
                    }}
                    className="p-6 md:p-8 border-2 space-y-6"
                  >
                    <div className="space-y-2">
                      <div
                        className="flex items-center justify-between text-[14px]"
                        style={{ color: baseTheme.palette.muted }}
                      >
                        <span>Table Number</span>
                        <span className="font-mono-code tabular-nums">
                          Table {tableNumber}
                        </span>
                      </div>
                      <div
                        className="flex items-center justify-between text-[14px]"
                        style={{ color: baseTheme.palette.muted }}
                      >
                        <span>Dishes in Cart</span>
                        <span className="font-mono-code tabular-nums">
                          {cartSummary.totalCount}
                        </span>
                      </div>
                      <div
                        style={{ borderColor: baseTheme.palette.border }}
                        className="pt-3 border-t flex items-baseline justify-between"
                      >
                        <span className="text-[18px] font-bold">Total</span>
                        <span
                          className="font-mono-code text-[24px] font-bold tabular-nums"
                          style={{ color: baseTheme.palette.accent }}
                        >
                          {baseTheme.currencySymbol}
                          {cartSummary.subtotal.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setGuestStep('menu')}
                        style={{
                          borderColor: baseTheme.palette.border,
                          color: baseTheme.palette.text,
                          borderRadius: baseTheme.buttonRadius,
                        }}
                        className="w-full sm:w-auto px-5 py-3.5 border font-mono-code text-[12px] uppercase tracking-[0.08em] cursor-pointer"
                      >
                        + Add More Dishes
                      </button>

                      {serviceLevel === 2 ? (
                        <button
                          type="button"
                          onClick={() => handleCallWaiterFromCartOrHeader(true)}
                          style={{
                            backgroundColor: baseTheme.palette.accent,
                            color: baseTheme.palette.accentText,
                            borderRadius: baseTheme.buttonRadius,
                          }}
                          className="w-full sm:w-auto px-8 py-3.5 font-mono-code text-[13px] font-bold uppercase tracking-[0.1em] cursor-pointer"
                        >
                          {activeStandbyCall
                            ? 'Waiter Called · Ping Waiter Again'
                            : `Call Waiter to Confirm Order · ${baseTheme.currencySymbol}${cartSummary.subtotal.toFixed(2)} →`}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handlePlaceOrder}
                          style={{
                            backgroundColor: baseTheme.palette.accent,
                            color: baseTheme.palette.accentText,
                            borderRadius: baseTheme.buttonRadius,
                          }}
                          className="w-full sm:w-auto px-8 py-3.5 font-mono-code text-[13px] font-bold uppercase tracking-[0.1em] cursor-pointer"
                        >
                          Place Order for Table {tableNumber} ·{' '}
                          {baseTheme.currencySymbol}
                          {cartSummary.subtotal.toFixed(2)} →
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>
          ) : (
            /* ===============================================================
               STEP A: GUEST MENU (Swipe Deck Default + Full List Toggle)
               =============================================================== */
            <>
              {/* Compact Venue Header Banner */}
              <section
                style={{
                  borderColor: baseTheme.palette.border,
                  borderRadius: baseTheme.cardRadius,
                }}
                className="relative h-52 md:h-64 overflow-hidden border mb-8"
              >
                <img
                  src={baseTheme.heroImage}
                  alt={venueName}
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(10, 8, 6, 0.88) 0%, rgba(10, 8, 6, 0.24) 60%, rgba(10, 8, 6, 0.4) 100%)',
                  }}
                />

                <div className="absolute top-4 left-5 right-5 flex items-center justify-between text-[#FBEFE6]">
                  <button
                    type="button"
                    onClick={handleSecretTableBadgeTap}
                    title="Triple-tap for Owner Admin Panel"
                    className="font-mono-code text-[11px] uppercase tracking-[0.16em] px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm cursor-pointer"
                  >
                    TABLE {tableNumber} · LEVEL {serviceLevel} · DEMO
                  </button>

                  {serviceLevel >= 2 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCallWaiterFromCartOrHeader(false)}
                        className="px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-[#FBEFE6] border border-white/20 font-mono-code text-[11px] uppercase tracking-[0.1em] cursor-pointer"
                      >
                        Call Waiter
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenCart}
                        style={{
                          backgroundColor: baseTheme.palette.accent,
                          color: baseTheme.palette.accentText,
                          borderRadius: baseTheme.buttonRadius,
                        }}
                        className="px-4 py-1.5 font-mono-code text-[11px] font-semibold uppercase tracking-[0.1em] cursor-pointer tabular-nums"
                      >
                        Cart ({cartSummary.totalCount})
                      </button>
                    </div>
                  )}
                </div>

                <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-4 text-[#FBEFE6]">
                  <div>
                    <p className="font-mono-code text-[11px] uppercase tracking-[0.16em] text-[#E6D5C3] mb-0.5">
                      {baseTheme.venueSubtitle}
                    </p>
                    <h1
                      style={{ fontFamily: baseTheme.displayFont }}
                      className="text-[32px] md:text-[44px] font-bold leading-[1.02]"
                    >
                      {venueName}
                    </h1>
                  </div>

                  {/* Mode Switcher: Swipe Deck vs Full Menu List */}
                  <div className="flex items-center gap-1 p-1 rounded-[12px] bg-black/65 border border-white/15 backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={() => setMenuDisplayMode('swipe')}
                      className={`px-3.5 py-1.5 rounded-[8px] font-mono-code text-[11px] uppercase tracking-[0.08em] cursor-pointer transition-colors ${
                        menuDisplayMode === 'swipe'
                          ? 'bg-[#E8500C] text-white font-bold'
                          : 'text-[#D6C7B8] hover:text-white'
                      }`}
                    >
                      Swipe Deck
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuDisplayMode('list')}
                      className={`px-3.5 py-1.5 rounded-[8px] font-mono-code text-[11px] uppercase tracking-[0.08em] cursor-pointer transition-colors ${
                        menuDisplayMode === 'list'
                          ? 'bg-[#E8500C] text-white font-bold'
                          : 'text-[#D6C7B8] hover:text-white'
                      }`}
                    >
                      Menu List
                    </button>
                  </div>
                </div>
              </section>

              {/* Calm Live Order / Waiter Notification Strip */}
              {guestBanner && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    backgroundColor: baseTheme.palette.surface,
                    borderColor: baseTheme.palette.accent,
                    borderRadius: baseTheme.buttonRadius,
                  }}
                  className="mb-8 px-5 py-4 border flex items-center justify-between gap-4"
                >
                  <span className="text-[14px] font-medium">{guestBanner}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setFocusView(serviceLevel === 2 ? 'waiter' : 'kitchen')
                    }
                    style={{ color: baseTheme.palette.accent }}
                    className="font-mono-code text-[12px] font-semibold uppercase tracking-[0.08em] cursor-pointer shrink-0"
                  >
                    {serviceLevel === 2
                      ? 'Open Waiter Screen →'
                      : 'Open Kitchen Screen →'}
                  </button>
                </div>
              )}

              {/* Clean Horizontal Category Bar */}
              <nav
                aria-label="Menu categories"
                style={{ borderColor: baseTheme.palette.border }}
                className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 border-b"
              >
                {baseTheme.categories.map((cat) => {
                  const isSelected = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      style={{
                        backgroundColor: isSelected
                          ? baseTheme.palette.accent
                          : baseTheme.palette.surface,
                        color: isSelected
                          ? baseTheme.palette.accentText
                          : baseTheme.palette.text,
                        borderColor: baseTheme.palette.border,
                        borderRadius: baseTheme.buttonRadius,
                      }}
                      className="px-4 py-2 border text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors"
                    >
                      {cat}
                    </button>
                  );
                })}
              </nav>

              {/* ===============================================================
                  MODE 1: INTERACTIVE SWIPE DECK (Right = Add to Cart, Left = Skip)
                 =============================================================== */}
              {menuDisplayMode === 'swipe' ? (
                <DishSwipeDeck
                  theme={baseTheme}
                  dishes={filteredDishes}
                  cart={currentCart}
                  serviceLevel={serviceLevel}
                  totalCartCount={cartSummary.totalCount}
                  totalCartSubtotal={cartSummary.subtotal}
                  onAddDish={(dishId) => handleUpdateQty(dishId, 1)}
                  onOpenCart={handleOpenCart}
                  onSwitchToListView={() => setMenuDisplayMode('list')}
                />
              ) : (
                /* =============================================================
                   MODE 2: FULL MENU LIST WITH DISH PHOTOS
                   ============================================================= */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredDishes.map((dish) => {
                    const qty = currentCart[dish.id] || 0;
                    return (
                      <div
                        key={dish.id}
                        style={{
                          backgroundColor: baseTheme.palette.surface,
                          borderColor: baseTheme.palette.border,
                          borderRadius: baseTheme.cardRadius,
                        }}
                        className="border overflow-hidden flex flex-col justify-between"
                      >
                        <div>
                          <div
                            className="relative h-48 w-full overflow-hidden border-b"
                            style={{ borderColor: baseTheme.palette.border }}
                          >
                            <img
                              src={dish.imageUrl}
                              alt={dish.name}
                              className="w-full h-full object-cover"
                            />
                            <span
                              style={{
                                backgroundColor: baseTheme.palette.accent,
                                color: baseTheme.palette.accentText,
                              }}
                              className="absolute top-3 right-3 px-3 py-1 rounded-full font-mono-code text-[14px] font-bold tabular-nums"
                            >
                              {baseTheme.currencySymbol}
                              {dish.price.toFixed(2)}
                            </span>
                          </div>

                          <div className="p-5 space-y-2">
                            <h2
                              style={{ fontFamily: baseTheme.displayFont }}
                              className="text-[22px] font-bold leading-snug"
                            >
                              {dish.name}
                            </h2>
                            <p
                              className="text-[14px] leading-relaxed"
                              style={{ color: baseTheme.palette.muted }}
                            >
                              {dish.description}
                            </p>
                          </div>
                        </div>

                        {serviceLevel >= 2 && (
                          <div className="px-5 pb-5 flex items-center justify-between">
                            <span
                              className="font-mono-code text-[11px] uppercase tracking-[0.1em]"
                              style={{ color: baseTheme.palette.muted }}
                            >
                              {dish.category} · {dish.prepMinutes}m
                            </span>

                            {qty > 0 ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  aria-label={`Remove one ${dish.name}`}
                                  onClick={() => handleUpdateQty(dish.id, -1)}
                                  style={{
                                    borderColor: baseTheme.palette.border,
                                    borderRadius: baseTheme.buttonRadius,
                                  }}
                                  className="w-8 h-8 border flex items-center justify-center cursor-pointer"
                                >
                                  −
                                </button>
                                <span className="font-mono-code text-[14px] font-bold w-5 text-center tabular-nums">
                                    {qty}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Add one more ${dish.name}`}
                                  onClick={() => handleUpdateQty(dish.id, 1)}
                                  style={{
                                    backgroundColor: baseTheme.palette.accent,
                                    color: baseTheme.palette.accentText,
                                    borderRadius: baseTheme.buttonRadius,
                                  }}
                                  className="w-8 h-8 flex items-center justify-center font-bold cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={dish.soldOut}
                                onClick={() => handleUpdateQty(dish.id, 1)}
                                style={{
                                  backgroundColor: baseTheme.palette.accent,
                                  color: baseTheme.palette.accentText,
                                  borderRadius: baseTheme.buttonRadius,
                                }}
                                className="px-4 py-2 font-mono-code text-[12px] font-semibold uppercase tracking-[0.08em] cursor-pointer disabled:opacity-40"
                              >
                                {dish.soldOut ? 'Sold Out' : '+ Add to Cart'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sleek Floating Bottom "View Cart ->" Pill */}
              {serviceLevel >= 2 && cartSummary.totalCount > 0 && (
                <div className="fixed bottom-5 left-4 right-4 z-40 pointer-events-none">
                  <div
                    style={{
                      backgroundColor: baseTheme.palette.surface,
                      borderColor: baseTheme.palette.accent,
                      borderRadius: '999px',
                    }}
                    className="pointer-events-auto max-w-[560px] mx-auto px-6 py-3 border-2 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="font-mono-code text-[12px] uppercase tracking-[0.1em]"
                        style={{ color: baseTheme.palette.muted }}
                      >
                        Added to Cart
                      </span>
                      <span className="font-mono-code text-[16px] font-bold tabular-nums">
                        {cartSummary.totalCount}{' '}
                        {cartSummary.totalCount === 1 ? 'dish' : 'dishes'} ·{' '}
                        {baseTheme.currencySymbol}
                        {cartSummary.subtotal.toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenCart}
                      style={{
                        backgroundColor: baseTheme.palette.accent,
                        color: baseTheme.palette.accentText,
                        borderRadius: '999px',
                      }}
                      className="px-5 py-2 font-mono-code text-[12px] font-semibold uppercase tracking-[0.08em] cursor-pointer"
                    >
                      View Cart →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      )}

      {/* =====================================================================
          VIEW 2: WAITER HANDHELD SCREEN (Live Notifications & Table Cart Review)
         ===================================================================== */}
      {focusView === 'waiter' && (
        <main className="max-w-[960px] mx-auto px-4 md:px-8 pt-10 md:pt-14 space-y-10">
          <div
            style={{ borderColor: baseTheme.palette.border }}
            className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#9BE564] inline-block" />
                <span
                  className="font-mono-code text-[11px] uppercase tracking-[0.16em]"
                  style={{ color: baseTheme.palette.accent }}
                >
                  WAITER HANDHELD APP · LIVE SSE STREAM ({sseConnected ? 'ONLINE' : 'LOCAL SYNC'})
                </span>
              </div>
              <h1
                style={{ fontFamily: baseTheme.displayFont }}
                className="text-[32px] md:text-[42px] font-bold leading-tight"
              >
                Waiter Live Alerts &amp; Table Carts
              </h1>
              <p
                className="text-[15px] mt-1"
                style={{ color: baseTheme.palette.muted }}
              >
                Every waiter carries this screen on their phone. When Table {tableNumber} taps &ldquo;Call Waiter&rdquo; in their cart, it chimes immediately with their table number and pre-selected dishes.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setFocusView('guest')}
              style={{
                borderColor: baseTheme.palette.border,
                color: baseTheme.palette.text,
                borderRadius: baseTheme.buttonRadius,
              }}
              className="px-4 py-2 border font-mono-code text-[12px] uppercase tracking-[0.08em] cursor-pointer"
            >
              ← Return to Guest Phone
            </button>
          </div>

          {/* 1. Kitchen Ready-for-Pickup Alerts for Waiter */}
          {tickets.some((t) => t.status === 'ready') && (
            <section className="space-y-4">
              <h2
                className="font-mono-code text-[12px] uppercase tracking-[0.14em]"
                style={{ color: '#9BE564' }}
              >
                ● Kitchen Pickup Alerts (Food Hot on Pass)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {tickets
                  .filter((t) => t.status === 'ready')
                  .map((ticket) => (
                    <div
                      key={ticket.ticketNumber}
                      style={{
                        backgroundColor: baseTheme.palette.surface,
                        borderColor: '#9BE564',
                        borderRadius: baseTheme.cardRadius,
                      }}
                      className="p-6 border-2 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono-code text-[18px] font-bold tabular-nums">
                          {ticket.ticketNumber} · Deliver to Table {ticket.tableNumber}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-[#9BE564] text-[#140905] font-mono-code text-[11px] font-bold uppercase">
                          READY ON PASS
                        </span>
                      </div>

                      <div className="space-y-1 text-[14px]">
                        {ticket.items.map((it) => (
                          <div key={it.id}>
                            <strong>{it.qty}×</strong> {it.name}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAdvanceTicket(ticket.ticketNumber)}
                        style={{
                          backgroundColor: '#9BE564',
                          color: '#140905',
                          borderRadius: baseTheme.buttonRadius,
                        }}
                        className="w-full py-2.5 font-mono-code text-[12px] font-bold uppercase tracking-[0.1em] cursor-pointer"
                      >
                        Mark Delivered to Table {ticket.tableNumber} ✓
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* 2. Incoming Table Waiter Calls */}
          <section className="space-y-4">
            <h2
              className="font-mono-code text-[12px] uppercase tracking-[0.14em]"
              style={{ color: baseTheme.palette.muted }}
            >
              Incoming Table Calls ({waiterCalls.length})
            </h2>

            {waiterCalls.length === 0 ? (
              <div
                style={{
                  backgroundColor: baseTheme.palette.surface,
                  borderColor: baseTheme.palette.border,
                  borderRadius: baseTheme.cardRadius,
                }}
                className="p-8 border text-center space-y-3"
              >
                <p className="text-[17px] font-medium">
                  No active waiter calls right now.
                </p>
                <p
                  className="text-[14px]"
                  style={{ color: baseTheme.palette.muted }}
                >
                  Switch to Level 2 on the Guest Phone, add dishes to your cart, and tap &ldquo;Call Waiter&rdquo; to see the live notification arrive here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {waiterCalls.map((call) => (
                  <div
                    key={call.id}
                    style={{
                      backgroundColor: baseTheme.palette.surface,
                      borderColor:
                        call.status === 'calling'
                          ? baseTheme.palette.accent
                          : baseTheme.palette.border,
                      borderRadius: baseTheme.cardRadius,
                    }}
                    className="p-6 border-2 space-y-5"
                  >
                    <div
                      className="flex items-center justify-between border-b pb-3"
                      style={{ borderColor: baseTheme.palette.border }}
                    >
                      <div>
                        <span className="font-mono-code text-[20px] font-bold tabular-nums">
                          Table {call.tableNumber}
                        </span>
                        <span
                          className="block font-mono-code text-[11px]"
                          style={{ color: baseTheme.palette.muted }}
                        >
                          {call.reason} · {call.createdAt}
                        </span>
                      </div>

                      <span
                        style={{
                          backgroundColor: baseTheme.palette.accent,
                          color: baseTheme.palette.accentText,
                          borderRadius: baseTheme.buttonRadius,
                        }}
                        className="px-3 py-1 font-mono-code text-[11px] font-bold uppercase tracking-[0.1em]"
                      >
                        {call.status}
                      </span>
                    </div>

                    {/* Pre-Selected Items in Guest's Cart */}
                    {call.cartItems && call.cartItems.length > 0 && (
                      <div className="space-y-2">
                        <span
                          className="font-mono-code text-[11px] uppercase tracking-[0.12em] block"
                          style={{ color: baseTheme.palette.muted }}
                        >
                          Guest&apos;s Standby Cart ({call.cartCount} items ·{' '}
                          {baseTheme.currencySymbol}
                          {call.cartTotal.toFixed(2)})
                        </span>
                        {call.cartItems.map((it) => (
                          <div
                            key={it.id}
                            className="flex items-center justify-between text-[14px]"
                          >
                            <span>
                              <strong className="font-mono-code tabular-nums">
                                {it.qty}×
                              </strong>{' '}
                              {it.name}
                            </span>
                            <span
                              className="font-mono-code tabular-nums"
                              style={{ color: baseTheme.palette.muted }}
                            >
                              {baseTheme.currencySymbol}
                              {(it.price * it.qty).toFixed(2)}
                            </span>
                          </div>
                        ))}
                        {call.note && (
                          <p
                            className="font-mono-code text-[12px] italic pt-1"
                            style={{ color: baseTheme.palette.accent }}
                          >
                            Guest Note: &ldquo;{call.note}&rdquo;
                          </p>
                        )}
                      </div>
                    )}

                    {/* Waiter Handheld Action Buttons */}
                    <div className="flex flex-col gap-2 pt-2">
                      {call.status === 'calling' && (
                        <button
                          type="button"
                          onClick={() => handleWaiterUpdateCall(call.id, 'walking')}
                          style={{
                            backgroundColor: baseTheme.palette.accent,
                            color: baseTheme.palette.accentText,
                            borderRadius: baseTheme.buttonRadius,
                          }}
                          className="w-full py-2.5 font-mono-code text-[12px] font-bold uppercase tracking-[0.1em] cursor-pointer"
                        >
                          1. Acknowledge · Walking to Table {call.tableNumber} →
                        </button>
                      )}

                      {(call.status === 'calling' || call.status === 'walking') &&
                        call.cartItems &&
                        call.cartItems.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleWaiterUpdateCall(call.id, 'confirmed')
                            }
                            style={{
                              borderColor: baseTheme.palette.accent,
                              color: baseTheme.palette.accent,
                              borderRadius: baseTheme.buttonRadius,
                            }}
                            className="w-full py-2.5 border font-mono-code text-[12px] font-bold uppercase tracking-[0.1em] cursor-pointer"
                          >
                            2. Confirm Cart at Table &amp; Send to Kitchen →
                          </button>
                        )}

                      {call.status !== 'assisted' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleWaiterUpdateCall(call.id, 'assisted')
                          }
                          style={{
                            borderColor: baseTheme.palette.border,
                            color: baseTheme.palette.muted,
                            borderRadius: baseTheme.buttonRadius,
                          }}
                          className="w-full py-2 border font-mono-code text-[11px] uppercase tracking-[0.08em] cursor-pointer"
                        >
                          Mark Table Assisted ✓
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      )}

      {/* =====================================================================
          VIEW 3: KITCHEN DISPLAY SCREEN (KDS)
         ===================================================================== */}
      {focusView === 'kitchen' && (
        <main className="max-w-[960px] mx-auto px-4 md:px-8 pt-10 md:pt-14 space-y-10">
          <div
            style={{ borderColor: baseTheme.palette.border }}
            className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#9BE564] inline-block" />
                <span
                  className="font-mono-code text-[11px] uppercase tracking-[0.16em]"
                  style={{ color: baseTheme.palette.accent }}
                >
                  KITCHEN DISPLAY SYSTEM (KDS) · REAL-TIME TICKET QUEUE
                </span>
              </div>
              <h1
                style={{ fontFamily: baseTheme.displayFont }}
                className="text-[32px] md:text-[42px] font-bold leading-tight"
              >
                Kitchen Pass Tickets ({tickets.length})
              </h1>
              <p
                className="text-[15px] mt-1"
                style={{ color: baseTheme.palette.muted }}
              >
                Mounted on a tablet at the kitchen pass. Orders placed by guests (Level 3) or confirmed by waiters (Level 2) appear instantly with table numbers and notes.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setFocusView('guest')}
              style={{
                borderColor: baseTheme.palette.border,
                color: baseTheme.palette.text,
                borderRadius: baseTheme.buttonRadius,
              }}
              className="px-4 py-2 border font-mono-code text-[12px] uppercase tracking-[0.08em] cursor-pointer"
            >
              ← Return to Guest Phone
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tickets.map((ticket) => (
              <div
                key={ticket.ticketNumber}
                style={{
                  backgroundColor: baseTheme.palette.surface,
                  borderColor:
                    ticket.status === 'incoming'
                      ? baseTheme.palette.accent
                      : baseTheme.palette.border,
                  borderRadius: baseTheme.cardRadius,
                }}
                className="p-6 border-2 space-y-5"
              >
                <div
                  className="flex items-center justify-between border-b pb-3"
                  style={{ borderColor: baseTheme.palette.border }}
                >
                  <div>
                    <span className="font-mono-code text-[20px] font-bold tabular-nums">
                      {ticket.ticketNumber} · Table {ticket.tableNumber}
                    </span>
                    <span
                      className="block font-mono-code text-[11px]"
                      style={{ color: baseTheme.palette.muted }}
                    >
                      {ticket.createdAt} ·{' '}
                      {ticket.source === 'waiter-confirmed'
                        ? 'Confirmed by Waiter'
                        : 'Direct from Table QR'}
                    </span>
                  </div>
                  <span
                    style={{
                      backgroundColor: baseTheme.palette.accent,
                      color: baseTheme.palette.accentText,
                      borderRadius: baseTheme.buttonRadius,
                    }}
                    className="px-3 py-1 font-mono-code text-[11px] font-bold uppercase tracking-[0.1em]"
                  >
                    {ticket.status}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {ticket.items.map((item) => (
                    <div key={item.id} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[15px]">
                        <span>
                          <strong className="font-mono-code tabular-nums">
                            {item.qty}×
                          </strong>{' '}
                          {item.name}
                        </span>
                        <span
                          className="font-mono-code tabular-nums"
                          style={{ color: baseTheme.palette.muted }}
                        >
                          {baseTheme.currencySymbol}
                          {(item.price * item.qty).toFixed(2)}
                        </span>
                      </div>
                      {item.note && (
                        <p
                          className="font-mono-code text-[12px] italic"
                          style={{ color: baseTheme.palette.accent }}
                        >
                          Kitchen Note: &ldquo;{item.note}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleAdvanceTicket(ticket.ticketNumber)}
                  style={{
                    backgroundColor: baseTheme.palette.accent,
                    color: baseTheme.palette.accentText,
                    borderRadius: baseTheme.buttonRadius,
                  }}
                  className="w-full py-3 font-mono-code text-[12px] font-bold uppercase tracking-[0.1em] cursor-pointer"
                >
                  {ticket.status === 'served'
                    ? 'Order Served ✓'
                    : ticket.status === 'cooking'
                    ? 'Mark READY (Pings Waiter Screen) →'
                    : `Advance to ${nextTicketStatus(ticket.status).toUpperCase()} →`}
                </button>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* =====================================================================
          VIEW 4: HOW THE REAL-TIME BACKEND & NOTIFICATIONS WORK
         ===================================================================== */}
      {focusView === 'backend' && (
        <main className="max-w-[960px] mx-auto px-4 md:px-8 pt-10 md:pt-14 space-y-10">
          <div
            style={{ borderColor: baseTheme.palette.border }}
            className="pb-6 border-b"
          >
            <span
              className="font-mono-code text-[11px] uppercase tracking-[0.16em] block mb-1"
              style={{ color: baseTheme.palette.accent }}
            >
              SYSTEM ARCHITECTURE · EXPRESS + SERVER-SENT EVENTS (/API/EVENTS)
            </span>
            <h1
              style={{ fontFamily: baseTheme.displayFont }}
              className="text-[32px] md:text-[42px] font-bold leading-tight"
            >
              How Guest Phones, Waiters, and Kitchen Sync Live
            </h1>
            <p
              className="text-[15px] mt-2 max-w-[68ch]"
              style={{ color: baseTheme.palette.muted }}
            >
              This app runs an Express + Server-Sent Events (`server.ts`) backend on port 3000. Below is the exact end-to-end flow showing how notifications and orders are managed across devices in a real restaurant.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                step: '01 · TABLE QR & SESSION',
                title: 'Signed Table URL (?table=5)',
                body: 'Each table plaque encodes a unique signed URL (/t/latelier?table=5&sig=...). Scanning opens the web app directly in Safari or Chrome with zero app-store install. The guest swipes right on dishes to build their local cart.',
              },
              {
                step: '02 · LEVEL 2 WAITER NOTIFICATION',
                title: 'POST /api/waiter-calls → Waiter Handheld',
                body: 'When the guest taps "Call Waiter" inside their cart, the client sends POST /api/waiter-calls with Table #5 and the pre-selected cart items. The guest stays on the Cart Standby screen while the server pushes a real-time SSE event to every waiter phone (triggering Web Audio chime + navigator.vibrate).',
              },
              {
                step: '03 · WAITER ACKNOWLEDGE & CONFIRM',
                title: 'PATCH /api/waiter-calls/:id → Kitchen KDS',
                body: 'When the waiter taps "Acknowledge (Walking to Table 5)" on their phone, the guest’s Cart Standby banner updates live to show the waiter is on the way. Once at the table, the waiter taps "Confirm Cart", which creates Ticket #0415 on the Kitchen Screen.',
              },
              {
                step: '04 · LEVEL 3 KITCHEN PASS & PICKUP',
                title: 'POST /api/orders → Kitchen Tablet → Waiter Pickup',
                body: 'In Level 3, tapping "Place Order" inside the cart dispatches the ticket straight to the Kitchen tablet (POST /api/orders) and optional thermal printer (ESC/POS over LAN). When the chef taps "Mark READY", the Waiter Screen receives a green Pickup Alert to run the food to Table 5.',
              },
            ].map((card) => (
              <div
                key={card.step}
                style={{
                  backgroundColor: baseTheme.palette.surface,
                  borderColor: baseTheme.palette.border,
                  borderRadius: baseTheme.cardRadius,
                }}
                className="p-6 md:p-7 border space-y-3"
              >
                <span
                  className="font-mono-code text-[11px] uppercase tracking-[0.14em] block"
                  style={{ color: baseTheme.palette.accent }}
                >
                  {card.step}
                </span>
                <h2
                  style={{ fontFamily: baseTheme.displayFont }}
                  className="text-[24px] font-bold leading-snug"
                >
                  {card.title}
                </h2>
                <p
                  className="text-[14px] leading-relaxed"
                  style={{ color: baseTheme.palette.muted }}
                >
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* =====================================================================
          VIEW 5: HIDDEN OWNER ADMIN PANEL (Prices, Dish Photos, Add Dishes)
         ===================================================================== */}
      {focusView === 'admin' && (
        <main className="max-w-[960px] mx-auto px-4 md:px-8 pt-10 md:pt-14">
          <OwnerAdminPanel
            theme={baseTheme}
            menu={currentMenu}
            isUnlocked={adminUnlocked}
            onUnlock={() => setAdminUnlocked(true)}
            onUpdateMenu={handleAdminUpdateMenu}
            onClose={() => setFocusView('guest')}
          />
        </main>
      )}
    </div>
  );
};
