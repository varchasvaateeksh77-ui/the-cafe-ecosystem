import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CafeEcosystemState,
  CrossDeviceAlert,
  DishItem,
  KitchenOrder,
  PushNotificationEvent,
  ServiceLevel,
  applyAdminDishPatch,
  calculateCartTotal,
  createInitialCafeState,
  fetchCloudEcosystemState,
  saveCloudEcosystemState,
  supabase,
} from './lib/ecosystemStore';
import { TableQrGenerator } from './components/TableQrGenerator';
import { ThemeCataloguePage } from './catalogue/ThemeCataloguePage';
import { LiveThemeInstance } from './catalogue/LiveThemeInstance';
import { ThemeId } from './catalogue/themeCatalogData';
import { soundFX, useSoundEffects } from './lib/soundEffects';
import {
  initNativeNotifications,
  triggerUrgentDeviceNotification,
} from './lib/nativeNotifications';

type ActiveWorkspaceView =
  | 'split-suite'
  | 'guest-web'
  | 'waiter-apk'
  | 'kitchen-apk'
  | 'admin-apk'
  | 'theme-catalogue'
  | 'live-theme';

const DEDICATED_APK_ROLE = (import.meta as unknown as { env?: Record<string, string> })?.env
  ?.VITE_DEFAULT_APK as 'waiter' | 'kitchen' | 'admin' | undefined;

function getInitialViewFromUrl(): ActiveWorkspaceView {
  if (DEDICATED_APK_ROLE === 'waiter') return 'waiter-apk';
  if (DEDICATED_APK_ROLE === 'kitchen') return 'kitchen-apk';
  if (DEDICATED_APK_ROLE === 'admin') return 'admin-apk';

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const apk = params.get('apk');
    if (apk === 'waiter') return 'waiter-apk';
    if (apk === 'kitchen') return 'kitchen-apk';
    if (apk === 'admin') return 'admin-apk';
    if (apk === 'guest' || params.get('table')) return 'guest-web';
  }
  return 'split-suite';
}

function createHydratedInitialState(): CafeEcosystemState {
  const base = createInitialCafeState();
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const tableParam = parseInt(params.get('table') || '', 10);
    if (!Number.isNaN(tableParam) && tableParam >= 1 && tableParam <= 50) {
      base.activeTable = tableParam;
    }
    const levelParam = parseInt(params.get('level') || '', 10);
    if (levelParam === 1 || levelParam === 2 || levelParam === 3) {
      base.serviceLevel = levelParam;
    }
  }
  return base;
}

export default function App() {
  const [state, setState] = useState<CafeEcosystemState>(() => createHydratedInitialState());
  const [view, setView] = useState<ActiveWorkspaceView>(() => getInitialViewFromUrl());
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [guestStep, setGuestStep] = useState<'deck' | 'cart'>('deck');
  const [guestDisplayMode, setGuestDisplayMode] = useState<'swipe' | 'list'>('swipe');

  // Swipe Deck State for Surface 1 (Guest Web Menu)
  const [deckIndex, setDeckIndex] = useState<number>(0);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [swipeHistory, setSwipeHistory] = useState<
    Array<{ index: number; action: 'skip' | 'add'; dishId: string }>
  >([]);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const [lastSwipeFeedback, setLastSwipeFeedback] = useState<{
    type: 'skip' | 'add';
    dishName: string;
  } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const [waiterTab, setWaiterTab] = useState<'pickup' | 'calls' | 'floor'>('pickup');
  const [adminTab, setAdminTab] = useState<'menu' | 'floor' | 'qr'>('menu');
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<string>('');
  const [liveToast, setLiveToast] = useState<{ title: string; body: string } | null>(null);
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
  const stateVersionRef = useRef<number>(state.stateVersion || 1);
  const lastProcessedAlertIdRef = useRef<string | null>(state.lastAlert?.id || null);

  useEffect(() => {
    stateVersionRef.current = state.stateVersion || 1;
  }, [state.stateVersion]);

  // Initialize Native Android Notification Channel & Permissions on Mount
  useEffect(() => {
    initNativeNotifications();
  }, []);

  // Process Incoming Cross-Device State & Trigger Native Notification / Auto-Tab Switch
  const applyIncomingRemoteState = useCallback(
    (incoming: CafeEcosystemState) => {
      if (!incoming || !Array.isArray(incoming.orders)) return;
      if ((incoming.stateVersion || 0) <= stateVersionRef.current) return;

      stateVersionRef.current = incoming.stateVersion;

      // Preserve URL-bound activeTable on guest phones while syncing shared orders/calls/menu
      setState((prev) => ({
        ...incoming,
        activeTable: prev.activeTable,
        cart: prev.cart,
        realtimeConnected: true,
      }));

      // Check if there is a new alert that hasn't been notified yet
      const alert = incoming.lastAlert;
      if (alert && alert.id !== lastProcessedAlertIdRef.current) {
        lastProcessedAlertIdRef.current = alert.id;

        const isForWaiter =
          alert.targetApk === 'com.buildbros.waiter' &&
          (view === 'waiter-apk' || view === 'split-suite' || DEDICATED_APK_ROLE === 'waiter');
        const isForKitchen =
          alert.targetApk === 'com.buildbros.kitchen' &&
          (view === 'kitchen-apk' || view === 'split-suite' || DEDICATED_APK_ROLE === 'kitchen');
        const isForGuest =
          alert.targetApk === 'guest-web' &&
          (view === 'guest-web' || view === 'split-suite');

        if (isForWaiter || isForKitchen || isForGuest) {
          if (alert.title.includes('READY')) {
            soundFX.play('kitchenReady');
            setWaiterTab('pickup');
          } else if (alert.title.includes('Waiter')) {
            soundFX.play('waiterCall');
            setWaiterTab('calls');
          } else {
            soundFX.play('ticketSent');
          }

          setLiveToast({ title: alert.title, body: alert.body });
          window.setTimeout(() => setLiveToast(null), 5000);
          triggerUrgentDeviceNotification(alert.title, alert.body);
        }
      }
    },
    [view]
  );

  // Subscribe to Supabase Realtime Broadcast + Persistent Cloud State Sync
  useEffect(() => {
    let active = true;

    // 1. Initial pull from Supabase Cloud Storage
    fetchCloudEcosystemState().then((remote) => {
      if (active && remote) {
        applyIncomingRemoteState(remote);
      }
    });

    // 2. Realtime WebSocket Broadcast Channel (<150ms)
    const channel = supabase.channel('cafe-ecosystem-realtime', {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'state_sync' }, (payload) => {
        if (payload?.payload) {
          applyIncomingRemoteState(payload.payload as CafeEcosystemState);
        }
      })
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

    // 3. Foreground / App-Switch Resume Listener + Fast Cloud Polling Fallback (every 1.5s)
    // Ensures switching between Kitchen APK and Waiter APK on the same phone always syncs!
    const syncFromCloud = () => {
      fetchCloudEcosystemState().then((remote) => {
        if (active && remote) {
          applyIncomingRemoteState(remote);
        }
      });
    };

    const pollInterval = window.setInterval(syncFromCloud, 1500);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncFromCloud();
      }
    };
    window.addEventListener('focus', syncFromCloud);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      window.clearInterval(pollInterval);
      window.removeEventListener('focus', syncFromCloud);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [applyIncomingRemoteState]);

  // Unified Mutator: Updates Local State + Broadcasts via WebSocket + Saves to Supabase Cloud
  const commitAndSync = (
    recipe: (prev: CafeEcosystemState) => CafeEcosystemState,
    alertInfo?: {
      targetApk: PushNotificationEvent['targetApk'];
      channel: string;
      title: string;
      body: string;
      notifyCurrentDeviceToo?: boolean;
    }
  ) => {
    setState((prev) => {
      const baseNext = recipe(prev);
      const nextVersion = Math.max(prev.stateVersion || 1, stateVersionRef.current) + 1;
      stateVersionRef.current = nextVersion;

      const now = new Date().toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const latencyMs = Math.floor(105 + Math.random() * 65);

      let nextPushEvents = baseNext.pushEvents;
      let nextAlert: CrossDeviceAlert | undefined = baseNext.lastAlert;

      if (alertInfo) {
        const alertId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        lastProcessedAlertIdRef.current = alertId;

        const evt: PushNotificationEvent = {
          id: alertId,
          timestamp: now,
          targetApk: alertInfo.targetApk,
          channel: alertInfo.channel,
          title: alertInfo.title,
          body: alertInfo.body,
          latencyMs,
        };
        nextPushEvents = [evt, ...baseNext.pushEvents.slice(0, 19)];
        nextAlert = {
          id: alertId,
          targetApk: alertInfo.targetApk,
          title: alertInfo.title,
          body: alertInfo.body,
          createdAtMs: Date.now(),
        };

        if (alertInfo.notifyCurrentDeviceToo) {
          setLiveToast({ title: alertInfo.title, body: alertInfo.body });
          window.setTimeout(() => setLiveToast(null), 4500);
          triggerUrgentDeviceNotification(alertInfo.title, alertInfo.body);
        }
      }

      const finalState: CafeEcosystemState = {
        ...baseNext,
        stateVersion: nextVersion,
        updatedAtMs: Date.now(),
        lastSyncLatencyMs: latencyMs,
        pushEvents: nextPushEvents,
        lastAlert: nextAlert,
      };

      // Broadcast over Supabase Realtime WebSocket immediately
      channelRef.current?.send({
        type: 'broadcast',
        event: 'state_sync',
        payload: finalState,
      });

      // Persist to Supabase Cloud Storage so switching APKs on the phone stays 100% synced
      saveCloudEcosystemState(finalState);

      return finalState;
    });
  };

  // Available dishes in selected sub-section
  const categories = ['All', ...Array.from(new Set(state.dishes.map((d) => d.category)))];
  const filteredDishes = (
    selectedCategory === 'All'
      ? state.dishes
      : state.dishes.filter((d) => d.category === selectedCategory)
  ).filter((d) => d.isAvailable);

  const currentDeckDish: DishItem | undefined = filteredDishes[deckIndex];
  const nextDeckDish: DishItem | undefined = filteredDishes[deckIndex + 1];

  const handleSelectSubSection = (cat: string) => {
    soundFX.play('tap');
    setSelectedCategory(cat);
    setDeckIndex(0);
    setSwipeHistory([]);
    setDragOffset({ x: 0, y: 0 });
    setExitDirection(null);
    setGuestStep('deck');
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

  // Swipe Deck Actions: Swipe Left = Skip, Swipe Right = Add to Cart
  const triggerSwipeAction = (direction: 'left' | 'right') => {
    if (!currentDeckDish || exitDirection) return;
    const dish = currentDeckDish;
    setExitDirection(direction);

    if (direction === 'right') {
      if (state.serviceLevel >= 2) {
        handleAddToCart(dish);
      } else {
        soundFX.play('tap');
      }
      setLastSwipeFeedback({ type: 'add', dishName: dish.name });
    } else {
      soundFX.play('tap');
      setSkippedIds((prev) => (prev.includes(dish.id) ? prev : [...prev, dish.id]));
      setLastSwipeFeedback({ type: 'skip', dishName: dish.name });
    }

    setSwipeHistory((prev) => [
      ...prev,
      { index: deckIndex, action: direction === 'right' ? 'add' : 'skip', dishId: dish.id },
    ]);

    window.setTimeout(() => {
      setDeckIndex((prev) => prev + 1);
      setExitDirection(null);
      setDragOffset({ x: 0, y: 0 });
    }, 180);
  };

  const handleUndoSwipe = () => {
    if (swipeHistory.length === 0) return;
    soundFX.play('tap');
    const last = swipeHistory[swipeHistory.length - 1];
    setSwipeHistory((prev) => prev.slice(0, -1));
    if (last.action === 'skip') {
      setSkippedIds((prev) => prev.filter((id) => id !== last.dishId));
    }
    setDeckIndex(last.index);
    setExitDirection(null);
    setDragOffset({ x: 0, y: 0 });
    setLastSwipeFeedback(null);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (exitDirection) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = (e.clientY - dragStartRef.current.y) * 0.25;
    setDragOffset({ x: dx, y: dy });
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    dragStartRef.current = null;
    const SWIPE_THRESHOLD = 75;
    if (dragOffset.x > SWIPE_THRESHOLD) {
      triggerSwipeAction('right');
    } else if (dragOffset.x < -SWIPE_THRESHOLD) {
      triggerSwipeAction('left');
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  // Level 2: Call the Waiter (Syncs to Waiter APK & fires urgent notification)
  const handleGuestCallWaiter = () => {
    soundFX.play('waiterCall');
    const total = calculateCartTotal(state.cart);
    const itemsSummary = state.cart.map((c) => `${c.qty}x ${c.dish.name}`).join(', ');
    const now = new Date().toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setWaiterTab('calls');
    commitAndSync(
      (prev) => ({
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
      }),
      {
        targetApk: 'com.buildbros.waiter',
        channel: 'fcm:waiter_calls_urgent',
        title: `URGENT · Table ${state.activeTable} Called Waiter`,
        body: `Cart (${state.currencySymbol}${total}): ${itemsSummary}`,
        notifyCurrentDeviceToo: true,
      }
    );
  };

  // Level 3: Send the Order (Syncs to Kitchen APK & fires pass bell notification)
  const handleGuestPlaceOrder = () => {
    if (state.cart.length === 0) return;
    soundFX.play('ticketSent');
    const ticketNumber = `#0${Math.floor(413 + Math.random() * 85)}`;
    const totalAmount = calculateCartTotal(state.cart);
    const itemsSummary = state.cart.map((c) => `${c.qty}x ${c.dish.name}`).join(', ');
    const now = new Date().toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    commitAndSync(
      (prev) => ({
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
      }),
      {
        targetApk: 'com.buildbros.kitchen',
        channel: 'fcm:kitchen_pass_bell',
        title: `NEW ORDER ${ticketNumber} · Table ${state.activeTable}`,
        body: `${itemsSummary} (${state.currencySymbol}${totalAmount})`,
        notifyCurrentDeviceToo: true,
      }
    );
  };

  // Waiter APK: Acknowledge Table Call ("On My Way")
  const handleWaiterAcknowledge = (callId: string) => {
    soundFX.play('served');
    const targetCall = state.waiterCalls.find((c) => c.id === callId);
    const tableNum = targetCall?.tableNumber || state.activeTable;

    commitAndSync(
      (prev) => ({
        ...prev,
        waiterCalls: prev.waiterCalls.map((c) =>
          c.id === callId ? { ...c, status: 'acknowledged', acknowledgedBy: 'Staff #04' } : c
        ),
        tables: prev.tables.map((t) =>
          t.tableNumber === tableNum
            ? { ...t, status: 'ordering', updatedAt: 'Just now' }
            : t
        ),
      }),
      {
        targetApk: 'guest-web',
        channel: 'supabase_realtime:waiter_calls',
        title: `Waiter On My Way → Table ${tableNum}`,
        body: `Waiter claimed Table ${tableNum} call and is walking over now.`,
        notifyCurrentDeviceToo: false,
      }
    );
  };

  // Waiter APK: Mark Ready Order as Served at Table
  const handleWaiterServeOrder = (orderId: string) => {
    soundFX.play('served');
    const targetOrder = state.orders.find((o) => o.id === orderId);
    const tableNum = targetOrder?.tableNumber || state.activeTable;
    const ticketNum = targetOrder?.ticketNumber || '#Order';

    commitAndSync(
      (prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? { ...o, status: 'served' } : o)),
        tables: prev.tables.map((t) =>
          t.tableNumber === tableNum ? { ...t, status: 'served', updatedAt: 'Just now' } : t
        ),
      }),
      {
        targetApk: 'com.buildbros.admin',
        channel: 'supabase_realtime:orders',
        title: `Order ${ticketNum} Served at Table ${tableNum}`,
        body: `Waiter delivered ${ticketNum} to Table ${tableNum}.`,
        notifyCurrentDeviceToo: false,
      }
    );
  };

  // Kitchen & Reception KDS APK: Confirm Incoming Order or Set Any Stage Directly
  const handleKitchenSetOrderStatus = (
    orderId: string,
    nextStatus: KitchenOrder['status']
  ) => {
    const target = state.orders.find((o) => o.id === orderId);
    if (!target) return;

    const isReady = nextStatus === 'ready';
    soundFX.play(isReady ? 'kitchenReady' : nextStatus === 'served' ? 'served' : 'tap');

    if (isReady) {
      setWaiterTab('pickup');
    }

    const itemsSummary = target.items.map((i) => `${i.qty}x ${i.dish.name}`).join(', ');

    commitAndSync(
      (prev) => ({
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
                    : nextStatus === 'served'
                    ? 'served'
                    : 'ordering',
                updatedAt: 'Just now',
              }
            : t
        ),
      }),
      isReady
        ? {
            targetApk: 'com.buildbros.waiter',
            channel: 'fcm:waiter_calls_urgent',
            title: `PICKUP READY · ${target.ticketNumber} (Table ${target.tableNumber})`,
            body: `Ready at Kitchen Pass: ${itemsSummary}`,
            notifyCurrentDeviceToo: true,
          }
        : {
            targetApk: 'guest-web',
            channel: 'supabase_realtime:orders',
            title: `Ticket ${target.ticketNumber} → ${nextStatus.toUpperCase()}`,
            body: `Table ${target.tableNumber}: ${itemsSummary}`,
            notifyCurrentDeviceToo: false,
          }
    );
  };

  const handleKitchenAdvance = (orderId: string) => {
    const target = state.orders.find((o) => o.id === orderId);
    if (!target) return;
    const nextStatusMap: Record<KitchenOrder['status'], KitchenOrder['status']> = {
      incoming: 'new',
      new: 'cooking',
      cooking: 'ready',
      ready: 'served',
      served: 'served',
    };
    handleKitchenSetOrderStatus(orderId, nextStatusMap[target.status]);
  };

  // Spawn / Reset Demo Orders so Kitchen & Waiter always have active tickets to test
  const handleSpawnFreshKitchenTicket = () => {
    soundFX.play('ticketSent');
    const ticketNumber = `#0${Math.floor(415 + Math.random() * 80)}`;
    const now = new Date().toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const sampleItems = [
      { dish: state.dishes[0], qty: 2 },
      { dish: state.dishes[2], qty: 1 },
    ];
    const totalAmount = calculateCartTotal(sampleItems);

    commitAndSync(
      (prev) => ({
        ...prev,
        orders: [
          {
            id: `ord-${Date.now()}`,
            ticketNumber,
            tableNumber: prev.activeTable,
            items: sampleItems,
            totalAmount,
            receptionConfirmed: true,
            status: 'cooking',
            notes: 'Fresh test ticket',
            createdAt: now,
          },
          ...prev.orders.map((o) =>
            o.ticketNumber === '#0412'
              ? { ...o, receptionConfirmed: true, status: 'cooking' as const }
              : o
          ),
        ],
      }),
      {
        targetApk: 'com.buildbros.kitchen',
        channel: 'supabase_realtime:orders',
        title: `Active Ticket ${ticketNumber} Ready to Test`,
        body: `Tap "Mark Dish Ready" to test live Waiter pickup notification.`,
        notifyCurrentDeviceToo: false,
      }
    );
  };

  // Admin APK Handlers
  const handleAdminSavePrice = (dishId: string) => {
    const parsed = parseFloat(priceDraft);
    if (!Number.isNaN(parsed) && parsed > 0) {
      soundFX.play('tap');
      const rounded = Math.round(parsed);
      commitAndSync((prev) => applyAdminDishPatch(prev, dishId, { price: rounded }));
      channelRef.current?.send({
        type: 'broadcast',
        event: 'dish_patch',
        payload: { dishId, patch: { price: rounded } },
      });
    }
    setEditingDishId(null);
  };

  const handleAdminToggle86 = (dishId: string) => {
    soundFX.play('tap');
    const target = state.dishes.find((d) => d.id === dishId);
    const nextAvailable = !target?.isAvailable;
    commitAndSync((prev) =>
      applyAdminDishPatch(prev, dishId, { isAvailable: nextAvailable })
    );
    channelRef.current?.send({
      type: 'broadcast',
      event: 'dish_patch',
      payload: { dishId, patch: { isAvailable: nextAvailable } },
    });
  };

  const handleAddFloorTable = () => {
    soundFX.play('tap');
    commitAndSync((prev) => {
      const nextNum = prev.tables.length + 1;
      return {
        ...prev,
        activeTable: nextNum,
        tables: [
          ...prev.tables,
          {
            tableNumber: nextNum,
            shape: nextNum % 2 === 0 ? 'square' : 'round',
            seats: 4,
            status: 'free',
            updatedAt: 'Just added',
          },
        ],
      };
    });
  };

  const handleSwitchLevel = (level: ServiceLevel) => {
    soundFX.play('tap');
    if (level === 1) {
      setGuestStep('deck');
    }
    commitAndSync(
      (prev) => ({ ...prev, serviceLevel: level }),
      {
        targetApk: 'guest-web',
        channel: 'supabase_realtime:venues',
        title: `Service Level Switched → Level ${level}`,
        body:
          level === 1
            ? 'All tables switched to Digital Menu browse mode'
            : level === 2
            ? 'All tables enabled Swipe Deck Cart + Call the Waiter'
            : 'All tables enabled Swipe Deck Cart + Send the Order',
        notifyCurrentDeviceToo: false,
      }
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
            ← Back to Command Center
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

  const cartTotal = calculateCartTotal(state.cart);
  const cartCount = state.cart.reduce((sum, c) => sum + c.qty, 0);
  const activeTableCall = state.waiterCalls.find((c) => c.tableNumber === state.activeTable);
  const activeTableOrder =
    state.orders.find((o) => o.tableNumber === state.activeTable) || state.orders[0];
  const readyOrders = state.orders.filter((o) => o.status === 'ready');
  const pendingCalls = state.waiterCalls.filter((c) => c.status === 'pending');
  const shiftRevenue = state.tables.reduce((acc, t) => acc + (t.cartTotal || 0), 0);

  const effectiveX =
    exitDirection === 'right' ? 320 : exitDirection === 'left' ? -320 : dragOffset.x;
  const effectiveRotate = effectiveX * 0.045;
  const showAddStamp = effectiveX > 35;
  const showSkipStamp = effectiveX < -35;

  return (
    <div className="min-h-screen bg-[#F7F2ED] text-[#1A0C06] flex flex-col">
      {/* High-Priority Heads-Up Notification Toast Banner (Appears on Cross-Device Events) */}
      {liveToast && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="live-push-toast"
          className="fixed top-3 left-3 right-3 z-50 max-w-[520px] mx-auto p-3.5 rounded-[14px] bg-[#140905] text-[#FBEFE6] border-2 border-[#C4F042] flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="font-mono-code text-[11px] font-bold text-[#C4F042] uppercase">
              ● LIVE PUSH NOTIFICATION
            </div>
            <div className="font-bold text-[14px] text-[#FFFFFF] truncate">
              {liveToast.title}
            </div>
            <div className="text-[12px] text-[#FBEFE6]/85 truncate">{liveToast.body}</div>
          </div>
          <button
            type="button"
            onClick={() => setLiveToast(null)}
            className="px-2.5 py-1 rounded-[8px] bg-[#2A180D] text-[#C4F042] font-mono-code text-[11px] font-bold cursor-pointer shrink-0"
          >
            OK
          </button>
        </div>
      )}

      {/* Top Product Command Header (Hidden when compiled as a dedicated single-role Android APK) */}
      {!DEDICATED_APK_ROLE && (
        <header className="bg-[#140905] text-[#FBEFE6] border-b border-[#2A180D] px-4 md:px-6 py-3 sticky top-0 z-40">
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
                  { id: 'guest-web', label: '1. Guest Swipe Menu' },
                  { id: 'waiter-apk', label: '2. Waiter App' },
                  { id: 'kitchen-apk', label: '3. Kitchen KDS App' },
                  { id: 'admin-apk', label: '4. Owner Admin App' },
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

            {/* Zone 3: Level Switcher + 4-Theme Catalogue */}
            <div className="flex items-center gap-2 shrink-0">
              <div
                className="flex items-center gap-1 bg-[#2A180D] p-1 rounded-[8px]"
                role="group"
                aria-label="Venue Service Level"
              >
                {([1, 2, 3] as ServiceLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    data-testid={`switch-level-${lvl}-btn`}
                    onClick={() => handleSwitchLevel(lvl)}
                    className={`px-2 py-1 rounded-[6px] font-mono-code text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
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
                onClick={() => setView('theme-catalogue')}
                className="hidden sm:inline-block px-3 py-1.5 rounded-[10px] bg-[#E8500C] hover:bg-[#C03E0A] text-[#FBEFE6] text-[12px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                4-Theme Catalogue
              </button>
            </div>
          </div>

          {/* Mobile surface switcher bar (only in web multi-surface preview) */}
          <div className="flex lg:hidden items-center justify-between gap-1 pt-2.5 mt-2.5 border-t border-[#2A180D]">
            <div className="flex items-center gap-1 overflow-x-auto">
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
                  className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                    view === t.id
                      ? 'bg-[#E8500C] text-[#FBEFE6]'
                      : 'bg-[#2A180D] text-[#FBEFE6]/80'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundEnabled}
              className="px-2 py-1 rounded-[6px] bg-[#2A180D] text-[#C4F042] font-mono-code text-[10px] font-semibold cursor-pointer shrink-0"
            >
              {soundEnabled ? 'Audio ON' : 'Audio OFF'}
            </button>
          </div>
        </header>
      )}

      {/* Main Product Workspace */}
      <main
        className={`flex-1 w-full mx-auto flex flex-col gap-5 ${
          DEDICATED_APK_ROLE
            ? 'max-w-[600px] p-0'
            : 'max-w-[1440px] px-3 sm:px-6 py-4 sm:py-6'
        }`}
      >
        {/* =====================================================================
            SURFACE 4: OWNER / ADMIN APP (com.buildbros.admin)
           ===================================================================== */}
        {(view === 'split-suite' || view === 'admin-apk') && (
          <section
            aria-label="Owner Admin Android APK"
            className={`bg-[#FFFFFF] overflow-hidden ${
              DEDICATED_APK_ROLE
                ? 'min-h-screen border-0'
                : 'rounded-[20px] border-2 border-[#1A0C06]'
            }`}
            data-testid="surface-admin-apk"
          >
            <div className="bg-[#140905] text-[#FBEFE6] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-[6px] bg-[#E8500C] text-[#FBEFE6] font-mono-code text-[10px] font-bold">
                    OWNER ADMIN
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono-code text-[11px] text-[#C4F042]">
                    <span className="w-2 h-2 rounded-full bg-[#C4F042]" /> Live Cloud Sync
                  </span>
                </div>
                <h2 className="text-[17px] font-bold m-0 mt-1">
                  {state.venueName} · Controller
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Service Level Switcher inside Admin App so Owner APK always has it */}
                <div
                  className="flex items-center gap-1 bg-[#2A180D] p-1 rounded-[8px]"
                  role="group"
                  aria-label="Admin Service Level Switcher"
                >
                  {([1, 2, 3] as ServiceLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => handleSwitchLevel(lvl)}
                      className={`px-2.5 py-1 rounded-[6px] font-mono-code text-[11px] font-bold cursor-pointer ${
                        state.serviceLevel === lvl
                          ? 'bg-[#E8500C] text-[#FBEFE6]'
                          : 'text-[#FBEFE6]/70'
                      }`}
                    >
                      L{lvl}
                    </button>
                  ))}
                </div>

                <span className="px-2.5 py-1 rounded-[8px] bg-[#2A180D] font-mono-code text-[12px] font-bold text-[#C4F042]">
                  {state.currencySymbol}
                  {shiftRevenue}
                </span>
              </div>
            </div>

            <div className="px-4 py-2.5 bg-[#F7F2ED] border-b border-[#E3D9D3] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'menu', label: 'Menu & 86 Editor' },
                    { id: 'floor', label: `${state.tables.length}-Table Floor` },
                    { id: 'qr', label: 'Table QR Generator' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    data-testid={`admin-tab-${t.id}`}
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
                  commitAndSync((prev) => ({
                    ...prev,
                    autoRouteToKitchen: !prev.autoRouteToKitchen,
                  }))
                }
                className={`px-3 py-1.5 rounded-[8px] font-mono-code text-[11px] font-semibold border cursor-pointer transition-colors whitespace-nowrap ${
                  state.autoRouteToKitchen
                    ? 'bg-[#FFEEE3] border-[#E8500C] text-[#C03E0A]'
                    : 'bg-[#FFFFFF] border-[#E3D9D3] text-[#6C625C]'
                }`}
              >
                Auto-Send to Kitchen: {state.autoRouteToKitchen ? 'ON' : 'OFF'}
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
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono-code text-[10px] px-1.5 py-0.5 rounded bg-[#E3D9D3]/70 text-[#1A0C06]">
                              {dish.category}
                            </span>
                            <span className="font-semibold text-[13px] text-[#1A0C06] truncate">
                              {dish.name}
                            </span>
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
                        onClick={() =>
                          setState((prev) => ({ ...prev, activeTable: t.tableNumber }))
                        }
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
                <TableQrGenerator
                  venueName={state.venueName}
                  venueSlug={state.venueSlug}
                  serviceLevel={state.serviceLevel}
                  activeTable={state.activeTable}
                  tables={state.tables}
                  onSelectTable={(tableNumber) =>
                    setState((prev) => ({ ...prev, activeTable: tableNumber }))
                  }
                  onAddTable={handleAddFloorTable}
                  onTestTableMenu={(tableNumber) => {
                    soundFX.play('tap');
                    setState((prev) => ({ ...prev, activeTable: tableNumber }));
                    setGuestStep('deck');
                    if (view === 'admin-apk') {
                      setView('guest-web');
                    }
                  }}
                />
              )}
            </div>
          </section>
        )}

        {/* 3 Operational Surfaces Grid: Guest Swipe Deck Menu + Waiter App + Kitchen & Reception KDS App */}
        <div
          className={`grid gap-6 items-start ${
            view === 'split-suite'
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 w-full'
          }`}
        >
          {/* =====================================================================
              SURFACE 1: GUEST WEB MENU (SWIPE DECK + SUB-SECTIONS + CART VIEW)
             ===================================================================== */}
          {(view === 'split-suite' || view === 'guest-web') && (
            <section
              aria-label="Guest Web Menu"
              className={`bg-[#FFFFFF] overflow-hidden flex flex-col ${
                DEDICATED_APK_ROLE
                  ? 'min-h-screen border-0'
                  : 'rounded-[24px] border-2 border-[#1A0C06]'
              }`}
              data-testid="surface-guest-web"
            >
              {/* Top Venue Header + Cart Button */}
              <div className="bg-[#140905] text-[#FBEFE6] px-4 py-3.5 border-b border-[#2A180D] flex items-center justify-between gap-2">
                <div>
                  <span className="font-mono-code text-[10px] font-bold uppercase text-[#C4F042] block">
                    TABLE {state.activeTable} · SWIPE MENU · DEMO
                  </span>
                  <h3 className="text-[16px] font-bold text-[#FBEFE6] m-0">
                    {state.venueName}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-1 rounded-[8px] bg-[#2A180D] text-[#C4F042] font-mono-code text-[11px] font-semibold">
                    L{state.serviceLevel}
                  </span>
                  {state.serviceLevel >= 2 && (
                    <button
                      type="button"
                      data-testid="header-cart-btn"
                      onClick={() => {
                        soundFX.play('tap');
                        setGuestStep((prev) => (prev === 'cart' ? 'deck' : 'cart'));
                      }}
                      className="px-3 py-1.5 rounded-[8px] bg-[#E8500C] hover:bg-[#C03E0A] text-[#FBEFE6] font-mono-code text-[11px] font-bold cursor-pointer tabular-nums"
                    >
                      {guestStep === 'cart'
                        ? '← Deck'
                        : `Cart (${cartCount}) · ${state.currencySymbol}${cartTotal}`}
                    </button>
                  )}
                </div>
              </div>

              {guestStep === 'cart' && state.serviceLevel >= 2 ? (
                /* ===============================================================
                   GUEST CART VIEW (Done Picking -> Click Cart)
                   Level 2 = "Call the Waiter" button
                   Level 3 = "Send the Order" button
                   =============================================================== */
                <div className="p-4 flex flex-col gap-3.5" data-testid="guest-cart-view">
                  <div className="flex items-center justify-between border-b border-[#E3D9D3] pb-2.5">
                    <div>
                      <span className="font-mono-code text-[10px] font-bold uppercase text-[#C03E0A] block">
                        DONE PICKING · TABLE {state.activeTable} CART
                      </span>
                      <h4 className="text-[16px] font-bold text-[#1A0C06] m-0">
                        Your Picked Dishes ({cartCount})
                      </h4>
                    </div>
                    <button
                      type="button"
                      data-testid="guest-back-to-deck-btn"
                      onClick={() => setGuestStep('deck')}
                      className="px-2.5 py-1 rounded-[8px] bg-[#F3ECE5] hover:bg-[#E3D9D3] text-[#1A0C06] font-mono-code text-[11px] font-semibold cursor-pointer"
                    >
                      ← Back to Swipe Deck
                    </button>
                  </div>

                  {/* Live Level 2 Waiter Standby Status inside Cart */}
                  {activeTableCall && (
                    <div
                      role="status"
                      aria-live="polite"
                      data-testid="guest-cart-waiter-status"
                      className={`p-3 rounded-[12px] border-2 flex flex-col gap-1 ${
                        activeTableCall.status === 'acknowledged'
                          ? 'bg-[#140905] text-[#C4F042] border-[#C4F042]'
                          : 'bg-[#FFEEE3] text-[#1A0C06] border-[#E8500C]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono-code text-[11px] font-bold uppercase">
                        <span>
                          {activeTableCall.status === 'acknowledged'
                            ? '✓ WAITER ON MY WAY TO TABLE ' + state.activeTable
                            : '● WAITER NOTIFIED · STANDBY AT TABLE ' + state.activeTable}
                        </span>
                        <span>{activeTableCall.createdAt}</span>
                      </div>
                      <p className="text-[12px] opacity-90 m-0">
                        {activeTableCall.status === 'acknowledged'
                          ? 'Staff #04 acknowledged your call on the Waiter APK and is walking to your table now.'
                          : 'Your cart snapshot and Table number were pushed to the Waiter APK.'}
                      </p>
                    </div>
                  )}

                  {/* Live Level 3 Order Status Tracker inside Cart */}
                  {state.serviceLevel === 3 && activeTableOrder && (
                    <div
                      role="status"
                      aria-live="polite"
                      data-testid="guest-cart-order-status"
                      className="p-3 rounded-[12px] bg-[#F7F2ED] border border-[#E8500C] flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-mono-code font-bold text-[#1A0C06]">
                          Live Ticket {activeTableOrder.ticketNumber} · Table {state.activeTable}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#E8500C] text-[#FBEFE6] font-mono-code text-[10px] font-bold uppercase">
                          {activeTableOrder.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {(['new', 'cooking', 'ready', 'served'] as const).map((st) => (
                          <div
                            key={st}
                            className={`text-center py-1 rounded text-[9px] font-mono-code font-bold uppercase ${
                              activeTableOrder.status === st
                                ? 'bg-[#1A0C06] text-[#C4F042]'
                                : 'bg-[#E3D9D3]/60 text-[#6C625C]'
                            }`}
                          >
                            {st}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cart Items List */}
                  {state.cart.length === 0 ? (
                    <div className="py-8 text-center flex flex-col items-center gap-2">
                      <p className="text-[13px] text-[#6C625C] m-0">
                        Your cart is empty. Swipe right on dish cards to add them!
                      </p>
                      <button
                        type="button"
                        onClick={() => setGuestStep('deck')}
                        className="px-4 py-2 rounded-[10px] bg-[#E8500C] text-[#FBEFE6] font-mono-code text-[12px] font-bold cursor-pointer mt-1"
                      >
                        Open Swipe Deck →
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
                      {state.cart.map(({ dish, qty }) => (
                        <div
                          key={dish.id}
                          className="p-2.5 rounded-[12px] bg-[#F7F2ED] border border-[#E3D9D3] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[13px] text-[#1A0C06] truncate">
                              {dish.name}
                            </div>
                            <div className="font-mono-code text-[11px] text-[#6C625C] tabular-nums">
                              {state.currencySymbol}
                              {dish.price} × {qty} ={' '}
                              <strong className="text-[#1A0C06]">
                                {state.currencySymbol}
                                {dish.price * qty}
                              </strong>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(dish.id)}
                              aria-label={`Remove one ${dish.name}`}
                              className="w-7 h-7 rounded-[8px] bg-[#FFFFFF] border border-[#E3D9D3] text-[#1A0C06] font-bold text-[14px] cursor-pointer"
                            >
                              −
                            </button>
                            <span className="font-mono-code text-[12px] font-bold w-5 text-center tabular-nums">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddToCart(dish)}
                              aria-label={`Add one ${dish.name}`}
                              className="w-7 h-7 rounded-[8px] bg-[#1A0C06] text-[#FBEFE6] font-bold text-[14px] cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cart Total & Level 2 ("Call the Waiter") / Level 3 ("Send the Order") Action Buttons */}
                  <div className="pt-3 border-t border-[#E3D9D3] flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-[#6C625C]">
                        Table {state.activeTable} Total ({cartCount} items)
                      </span>
                      <span className="font-mono-code text-[18px] font-bold text-[#1A0C06] tabular-nums">
                        {state.currencySymbol}
                        {cartTotal}
                      </span>
                    </div>

                    {state.serviceLevel === 2 && (
                      <button
                        type="button"
                        data-testid="guest-call-waiter-btn"
                        onClick={handleGuestCallWaiter}
                        disabled={cartCount === 0}
                        className="w-full h-11 rounded-[12px] bg-[#E8500C] hover:bg-[#C03E0A] disabled:bg-[#E3D9D3] text-[#FBEFE6] font-mono-code font-bold text-[13px] uppercase tracking-wider cursor-pointer transition-colors"
                      >
                        {activeTableCall?.status === 'acknowledged'
                          ? `✓ Waiter On My Way to Table ${state.activeTable}`
                          : activeTableCall?.status === 'pending'
                          ? `Waiter Called · Call the Waiter Again`
                          : `Call the Waiter (Table ${state.activeTable} · ${state.currencySymbol}${cartTotal})`}
                      </button>
                    )}

                    {state.serviceLevel === 3 && (
                      <button
                        type="button"
                        data-testid="guest-send-order-btn"
                        onClick={handleGuestPlaceOrder}
                        disabled={cartCount === 0}
                        className="w-full h-11 rounded-[12px] bg-[#E8500C] hover:bg-[#C03E0A] disabled:bg-[#E3D9D3] text-[#FBEFE6] font-mono-code font-bold text-[13px] uppercase tracking-wider cursor-pointer transition-colors"
                      >
                        Send the Order (Table {state.activeTable} · {state.currencySymbol}
                        {cartTotal}) →
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* ===============================================================
                   GUEST MENU SWIPE DECK WITH SUB-SECTIONS
                   =============================================================== */
                <>
                  {/* Sub-Section Category Pills + Swipe/List Mode Toggle */}
                  <div className="px-3.5 py-2.5 bg-[#F7F2ED] border-b border-[#E3D9D3] flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-code text-[10px] font-bold uppercase text-[#6C625C]">
                        SUB-SECTIONS ({filteredDishes.length} DISHES)
                      </span>
                      <div className="flex items-center gap-1 bg-[#E3D9D3]/70 p-0.5 rounded-[7px]">
                        <button
                          type="button"
                          onClick={() => setGuestDisplayMode('swipe')}
                          className={`px-2 py-0.5 rounded-[5px] font-mono-code text-[10px] font-bold cursor-pointer ${
                            guestDisplayMode === 'swipe'
                              ? 'bg-[#1A0C06] text-[#FBEFE6]'
                              : 'text-[#6C625C]'
                          }`}
                        >
                          Swipe Deck
                        </button>
                        <button
                          type="button"
                          onClick={() => setGuestDisplayMode('list')}
                          className={`px-2 py-0.5 rounded-[5px] font-mono-code text-[10px] font-bold cursor-pointer ${
                            guestDisplayMode === 'list'
                              ? 'bg-[#1A0C06] text-[#FBEFE6]'
                              : 'text-[#6C625C]'
                          }`}
                        >
                          List
                        </button>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
                      role="tablist"
                      aria-label="Menu sub-sections"
                    >
                      {categories.map((cat) => {
                        const count =
                          cat === 'All'
                            ? state.dishes.filter((d) => d.isAvailable).length
                            : state.dishes.filter((d) => d.category === cat && d.isAvailable)
                                .length;
                        return (
                          <button
                            key={cat}
                            type="button"
                            role="tab"
                            aria-selected={selectedCategory === cat}
                            data-testid={`subsection-tab-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                            onClick={() => handleSelectSubSection(cat)}
                            className={`px-2.5 py-1 rounded-[8px] text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                              selectedCategory === cat
                                ? 'bg-[#E8500C] text-[#FBEFE6]'
                                : 'bg-[#FFFFFF] border border-[#E3D9D3] text-[#1A0C06] hover:border-[#1A0C06]'
                            }`}
                          >
                            {cat} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {guestDisplayMode === 'swipe' ? (
                    <div className="p-3.5 flex flex-col gap-3">
                      <div className="flex items-center justify-between text-[11px] font-mono-code text-[#6C625C]">
                        <span>
                          {currentDeckDish
                            ? `Card ${deckIndex + 1} of ${filteredDishes.length} · ${selectedCategory}`
                            : `${selectedCategory} Complete`}
                        </span>
                        <span>← Left: Skip · Right: In Cart →</span>
                      </div>

                      {lastSwipeFeedback && (
                        <div className="px-3 py-1 rounded-[8px] bg-[#F3ECE5] text-[11px] font-mono-code flex items-center justify-between">
                          <span>
                            {lastSwipeFeedback.type === 'add' ? '✓ Added to Cart:' : '↷ Skipped:'}{' '}
                            <strong>{lastSwipeFeedback.dishName}</strong>
                          </span>
                          <span className="text-[#6C625C]">Skipped: {skippedIds.length}</span>
                        </div>
                      )}

                      {currentDeckDish ? (
                        <>
                          <div className="relative h-[300px] w-full select-none">
                            {nextDeckDish && (
                              <div
                                aria-hidden="true"
                                className="absolute inset-x-3 top-2 bottom-0 rounded-[18px] bg-[#F3ECE5] border border-[#E3D9D3] scale-[0.96] translate-y-2 opacity-70 pointer-events-none"
                              />
                            )}

                            <div
                              data-testid="active-swipe-dish-card"
                              onPointerDown={handlePointerDown}
                              onPointerMove={handlePointerMove}
                              onPointerUp={handlePointerUp}
                              onPointerCancel={handlePointerUp}
                              style={{
                                transform: `translate3d(${effectiveX}px, ${dragOffset.y}px, 0) rotate(${effectiveRotate}deg)`,
                                transition: isDragging
                                  ? 'none'
                                  : 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
                                touchAction: 'pan-y',
                              }}
                              className="relative h-full w-full rounded-[18px] bg-[#FFFFFF] border-2 border-[#1A0C06] overflow-hidden flex flex-col justify-between cursor-grab active:cursor-grabbing"
                            >
                              {showAddStamp && (
                                <div className="absolute top-3 left-3 z-20 px-3 py-1 rounded-[8px] bg-[#C4F042] text-[#140905] border-2 border-[#140905] font-mono-code text-[12px] font-bold uppercase tracking-wider">
                                  IN CART +
                                </div>
                              )}
                              {showSkipStamp && (
                                <div className="absolute top-3 right-3 z-20 px-3 py-1 rounded-[8px] bg-[#E8500C] text-[#FBEFE6] border-2 border-[#140905] font-mono-code text-[12px] font-bold uppercase tracking-wider">
                                  SKIPPED ←
                                </div>
                              )}

                              <div className="relative h-[145px] bg-[#140905] overflow-hidden">
                                {currentDeckDish.imageUrl ? (
                                  <img
                                    src={currentDeckDish.imageUrl}
                                    alt={currentDeckDish.name}
                                    draggable={false}
                                    className="w-full h-full object-cover opacity-90 pointer-events-none"
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full flex items-center justify-center"
                                    style={{ backgroundColor: currentDeckDish.plateColor }}
                                  />
                                )}
                                <div
                                  className="absolute inset-0 pointer-events-none"
                                  style={{
                                    background:
                                      'linear-gradient(to top, rgba(20,9,5,0.85) 0%, rgba(20,9,5,0.15) 65%)',
                                  }}
                                />

                                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1">
                                  <span className="px-2 py-0.5 rounded-[6px] bg-[#140905]/85 text-[#FBEFE6] font-mono-code text-[10px] font-semibold">
                                    {currentDeckDish.category}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {currentDeckDish.prepTime && (
                                      <span className="px-2 py-0.5 rounded-[6px] bg-[#140905]/85 text-[#FBEFE6] font-mono-code text-[10px]">
                                        {currentDeckDish.prepTime}
                                      </span>
                                    )}
                                    <span className="px-2 py-0.5 rounded-[6px] bg-[#E8500C] text-[#FBEFE6] font-mono-code text-[10px] font-bold">
                                      {currentDeckDish.dietary}
                                    </span>
                                  </div>
                                </div>

                                <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between text-[#FBEFE6]">
                                  <h4 className="text-[16px] font-bold leading-snug m-0 pr-2">
                                    {currentDeckDish.name}
                                  </h4>
                                  <span className="font-mono-code text-[16px] font-bold text-[#C4F042] shrink-0 tabular-nums">
                                    {state.currencySymbol}
                                    {currentDeckDish.price}
                                  </span>
                                </div>
                              </div>

                              <div className="p-3.5 flex-1 flex flex-col justify-between bg-[#FFFFFF]">
                                <p className="text-[12px] text-[#6C625C] leading-relaxed m-0 line-clamp-2">
                                  {currentDeckDish.description}
                                </p>

                                <div className="flex items-center justify-between pt-2 border-t border-[#E3D9D3] text-[11px] font-mono-code">
                                  <span className="text-[#6C625C]">Drag card left or right</span>
                                  {state.cart.find((c) => c.dish.id === currentDeckDish.id) ? (
                                    <span className="px-2 py-0.5 rounded bg-[#FFEEE3] text-[#C03E0A] font-bold">
                                      In Cart:{' '}
                                      {
                                        state.cart.find((c) => c.dish.id === currentDeckDish.id)
                                          ?.qty
                                      }
                                    </span>
                                  ) : (
                                    <span className="text-[#1A0C06] font-semibold">
                                      Not in cart yet
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-7 gap-2 pt-1">
                            <button
                              type="button"
                              data-testid="swipe-left-skip-btn"
                              onClick={() => triggerSwipeAction('left')}
                              className="col-span-3 h-10 rounded-[10px] bg-[#F3ECE5] hover:bg-[#E3D9D3] border border-[#1A0C06]/20 text-[#1A0C06] font-mono-code text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              ← Swipe Left (Skip)
                            </button>

                            <button
                              type="button"
                              data-testid="swipe-undo-btn"
                              onClick={handleUndoSwipe}
                              disabled={swipeHistory.length === 0}
                              title="Undo last swipe"
                              className="col-span-1 h-10 rounded-[10px] bg-[#FFFFFF] border border-[#E3D9D3] disabled:opacity-40 text-[#1A0C06] font-mono-code text-[11px] font-bold cursor-pointer"
                            >
                              ↺
                            </button>

                            <button
                              type="button"
                              data-testid="swipe-right-add-btn"
                              onClick={() => triggerSwipeAction('right')}
                              className="col-span-3 h-10 rounded-[10px] bg-[#1A0C06] hover:bg-[#E8500C] text-[#FBEFE6] font-mono-code text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              {state.serviceLevel >= 2
                                ? 'Swipe Right (Cart +) →'
                                : 'Next Card →'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div
                          data-testid="swipe-deck-complete"
                          className="p-5 rounded-[18px] bg-[#F7F2ED] border-2 border-[#1A0C06] text-center flex flex-col items-center gap-3"
                        >
                          <span className="px-2.5 py-0.5 rounded-[6px] bg-[#C4F042] text-[#140905] font-mono-code text-[10px] font-bold uppercase">
                            DONE PICKING · {selectedCategory}
                          </span>
                          <h4 className="text-[17px] font-bold text-[#1A0C06] m-0">
                            You swiped through all dishes in {selectedCategory}!
                          </h4>
                          <p className="text-[12px] text-[#6C625C] m-0">
                            Picked <strong>{cartCount} items</strong> ({state.currencySymbol}
                            {cartTotal}) · Skipped {skippedIds.length} dishes.
                          </p>

                          <div className="w-full flex flex-col gap-2 pt-1">
                            {state.serviceLevel >= 2 && (
                              <button
                                type="button"
                                data-testid="deck-done-open-cart-btn"
                                onClick={() => {
                                  soundFX.play('tap');
                                  setGuestStep('cart');
                                }}
                                className="w-full h-10 rounded-[10px] bg-[#E8500C] hover:bg-[#C03E0A] text-[#FBEFE6] font-mono-code text-[12px] font-bold uppercase cursor-pointer"
                              >
                                Done Picking · Click Cart ({cartCount} items ·{' '}
                                {state.currencySymbol}
                                {cartTotal}) →
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setDeckIndex(0);
                                setSwipeHistory([]);
                              }}
                              className="w-full h-9 rounded-[10px] bg-[#FFFFFF] border border-[#1A0C06] text-[#1A0C06] font-mono-code text-[11px] font-semibold cursor-pointer"
                            >
                              ↺ Swipe {selectedCategory} Deck Again
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3.5 flex flex-col gap-2.5 max-h-[340px] overflow-y-auto">
                      {filteredDishes.map((dish) => {
                        const inCart = state.cart.find((c) => c.dish.id === dish.id);
                        return (
                          <div
                            key={dish.id}
                            className="p-3 rounded-[14px] border border-[#E3D9D3] bg-[#F7F2ED]/60 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-[13px] text-[#1A0C06] truncate">
                                {dish.name}
                              </div>
                              <div className="text-[11px] text-[#6C625C] truncate">
                                {dish.category} · {dish.description}
                              </div>
                              <div className="font-mono-code text-[12px] font-bold text-[#1A0C06] mt-0.5 tabular-nums">
                                {state.currencySymbol}
                                {dish.price}
                              </div>
                            </div>

                            {state.serviceLevel >= 2 && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                {inCart && inCart.qty > 0 && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveFromCart(dish.id)}
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
                  )}

                  {/* Guest Sticky Bottom Bar */}
                  <div className="p-3.5 bg-[#F7F2ED] border-t border-[#E3D9D3] flex flex-col gap-2">
                    {state.serviceLevel === 1 ? (
                      <div className="flex items-center justify-between text-[12px] text-[#6C625C]">
                        <span>Level 1 · Browse-Only Swipe Deck</span>
                        <span className="font-mono-code">Switch to L2 / L3 for Cart</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-testid="guest-open-cart-btn"
                        onClick={() => {
                          soundFX.play('tap');
                          setGuestStep('cart');
                        }}
                        className="w-full h-11 rounded-[12px] bg-[#E8500C] hover:bg-[#C03E0A] text-[#FBEFE6] font-mono-code font-bold text-[12px] uppercase tracking-wider cursor-pointer transition-colors flex items-center justify-between px-4"
                      >
                        <span>Done Picking · Click Cart ({cartCount})</span>
                        <span className="tabular-nums">
                          {state.currencySymbol}
                          {cartTotal} →
                        </span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          {/* =====================================================================
              SURFACE 2: WAITER STAFF APP (com.buildbros.waiter)
              Full-bleed mobile design, live Pass Pickup + Table Calls + Native Push
             ===================================================================== */}
          {(view === 'split-suite' || view === 'waiter-apk') && (
            <section
              aria-label="Waiter Dedicated Android APK"
              className={`bg-[#140905] text-[#FBEFE6] overflow-hidden flex flex-col ${
                DEDICATED_APK_ROLE
                  ? 'min-h-screen border-0'
                  : 'rounded-[24px] border-2 border-[#2A180D]'
              }`}
              data-testid="surface-waiter-apk"
            >
              {/* Waiter App Top Header */}
              <div className="bg-[#1A0C06] px-4 py-3.5 border-b border-[#FBEFE6]/12 flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#C4F042]" />
                    <span className="font-mono-code text-[10px] font-bold uppercase text-[#C4F042] tracking-wider">
                      WAITER HANDHELD · LIVE SYNC
                    </span>
                  </div>
                  <h3 className="text-[17px] font-bold text-[#FBEFE6] m-0 mt-0.5">
                    {state.venueName}
                  </h3>
                </div>

                <button
                  type="button"
                  data-testid="waiter-test-alert-btn"
                  onClick={() => {
                    soundFX.play('kitchenReady');
                    triggerUrgentDeviceNotification(
                      'TEST ALERT · Waiter Handheld Active',
                      'Android system notification, audio chime & vibration verified.'
                    );
                    setLiveToast({
                      title: 'Waiter Push Notification Active',
                      body: 'Vibration & sound chime verified on this phone.',
                    });
                    window.setTimeout(() => setLiveToast(null), 3500);
                  }}
                  className="px-3 py-1.5 rounded-[8px] bg-[#2A180D] hover:bg-[#E8500C] text-[#C4F042] hover:text-[#FFFFFF] font-mono-code text-[11px] font-bold cursor-pointer transition-colors shrink-0"
                >
                  Test Push Alert
                </button>
              </div>

              {/* 3 Large, High-Contrast Staff Navigation Tabs */}
              <div className="p-2.5 bg-[#1A0C06] border-b border-[#FBEFE6]/10 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  data-testid="waiter-tab-pickup"
                  onClick={() => setWaiterTab('pickup')}
                  className={`py-2.5 px-2 rounded-[10px] font-mono-code text-[12px] font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                    waiterTab === 'pickup'
                      ? 'bg-[#C4F042] text-[#140905]'
                      : readyOrders.length > 0
                      ? 'bg-[#2A180D] text-[#C4F042] border border-[#C4F042]'
                      : 'bg-[#2A180D] text-[#FBEFE6]/75'
                  }`}
                >
                  <span>Pass Pickup</span>
                  <span className="px-1.5 py-0.5 rounded bg-black/25 text-[11px]">
                    {readyOrders.length}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="waiter-tab-calls"
                  onClick={() => setWaiterTab('calls')}
                  className={`py-2.5 px-2 rounded-[10px] font-mono-code text-[12px] font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                    waiterTab === 'calls'
                      ? 'bg-[#E8500C] text-[#FBEFE6]'
                      : pendingCalls.length > 0
                      ? 'bg-[#2A180D] text-[#FF8741] border border-[#E8500C]'
                      : 'bg-[#2A180D] text-[#FBEFE6]/75'
                  }`}
                >
                  <span>Table Calls</span>
                  <span className="px-1.5 py-0.5 rounded bg-black/25 text-[11px]">
                    {pendingCalls.length}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="waiter-tab-floor"
                  onClick={() => setWaiterTab('floor')}
                  className={`py-2.5 px-2 rounded-[10px] font-mono-code text-[12px] font-bold cursor-pointer transition-colors ${
                    waiterTab === 'floor'
                      ? 'bg-[#FBEFE6] text-[#140905]'
                      : 'bg-[#2A180D] text-[#FBEFE6]/75'
                  }`}
                >
                  Floor ({state.tables.length})
                </button>
              </div>

              {/* Waiter Content Area */}
              <div className="p-4 flex-1 flex flex-col gap-3">
                {/* Cross-Tab Urgent Banner so Waiter NEVER misses a Ready Pickup or Table Call */}
                {waiterTab !== 'pickup' && readyOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setWaiterTab('pickup')}
                    className="w-full p-3 rounded-[12px] bg-[#C4F042] text-[#140905] font-mono-code text-[12px] font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>
                      ● {readyOrders.length} ORDER{readyOrders.length > 1 ? 'S' : ''} READY AT
                      KITCHEN PASS!
                    </span>
                    <span>View Pickup →</span>
                  </button>
                )}

                {waiterTab !== 'calls' && pendingCalls.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setWaiterTab('calls')}
                    className="w-full p-3 rounded-[12px] bg-[#E8500C] text-[#FBEFE6] font-mono-code text-[12px] font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>
                      ● {pendingCalls.length} TABLE CALL{pendingCalls.length > 1 ? 'S' : ''}{' '}
                      WAITING!
                    </span>
                    <span>View Calls →</span>
                  </button>
                )}

                {/* TAB 1: KITCHEN PASS PICKUP (Ready Orders from Kitchen KDS) */}
                {waiterTab === 'pickup' && (
                  <div className="flex flex-col gap-3" data-testid="waiter-pickup-list">
                    {readyOrders.length === 0 ? (
                      <div className="p-6 rounded-[16px] bg-[#1A0C06] border border-[#FBEFE6]/10 text-center flex flex-col items-center gap-2">
                        <div className="font-semibold text-[14px] text-[#FBEFE6]">
                          No dishes waiting at the kitchen pass right now.
                        </div>
                        <p className="text-[12px] text-[#FBEFE6]/65 m-0 max-w-[320px]">
                          As soon as Kitchen KDS marks a ticket <strong>READY</strong>, it pops up
                          here with an audio chime and phone notification.
                        </p>
                      </div>
                    ) : (
                      readyOrders.map((ord) => (
                        <div
                          key={ord.id}
                          data-testid={`waiter-ready-ticket-${ord.ticketNumber.replace('#', '')}`}
                          className="p-4 rounded-[16px] bg-[#2A180D] border-2 border-[#C4F042] flex flex-col gap-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="px-2 py-0.5 rounded bg-[#C4F042] text-[#140905] font-mono-code text-[10px] font-bold uppercase">
                                READY AT KITCHEN PASS
                              </span>
                              <div className="font-mono-code font-bold text-[18px] text-[#FFFFFF] mt-1">
                                {ord.ticketNumber} · Table {ord.tableNumber}
                              </div>
                            </div>
                            <span className="font-mono-code text-[13px] font-bold text-[#C4F042]">
                              {state.currencySymbol}
                              {ord.totalAmount}
                            </span>
                          </div>

                          <div className="p-3 rounded-[10px] bg-[#140905] flex flex-col gap-1.5 text-[13px]">
                            {ord.items.map((i) => (
                              <div key={i.dish.id} className="flex justify-between font-medium">
                                <span>
                                  <strong className="text-[#C4F042]">{i.qty}×</strong>{' '}
                                  {i.dish.name}
                                </span>
                                <span className="font-mono-code text-[#FBEFE6]/70">
                                  {state.currencySymbol}
                                  {i.dish.price * i.qty}
                                </span>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            data-testid={`waiter-serve-${ord.ticketNumber.replace('#', '')}-btn`}
                            onClick={() => handleWaiterServeOrder(ord.id)}
                            className="w-full h-11 rounded-[10px] bg-[#C4F042] hover:bg-[#b2df2f] text-[#140905] font-mono-code font-bold text-[13px] uppercase tracking-wider cursor-pointer"
                          >
                            ✓ Mark Served at Table {ord.tableNumber}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 2: TABLE CALLS */}
                {waiterTab === 'calls' && (
                  <div className="flex flex-col gap-3" data-testid="waiter-calls-list">
                    {state.waiterCalls.length === 0 ? (
                      <div className="p-6 rounded-[16px] bg-[#1A0C06] border border-[#FBEFE6]/10 text-center text-[13px] text-[#FBEFE6]/65">
                        No active waiter calls right now.
                      </div>
                    ) : (
                      state.waiterCalls.map((call) => (
                        <div
                          key={call.id}
                          className={`p-4 rounded-[16px] border-2 flex flex-col gap-2.5 ${
                            call.status === 'pending'
                              ? 'bg-[#2A180D] border-[#E8500C]'
                              : 'bg-[#1A0C06] border-[#FBEFE6]/15'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[17px]">
                              Table {call.tableNumber}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-[6px] font-mono-code text-[10px] font-bold uppercase ${
                                call.status === 'pending'
                                  ? 'bg-[#E8500C] text-[#FBEFE6]'
                                  : 'bg-[#140905] text-[#C4F042]'
                              }`}
                            >
                              {call.status === 'pending'
                                ? 'URGENT · NEEDS WAITER'
                                : '✓ ON MY WAY'}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-[10px] bg-[#140905] text-[12px] text-[#FBEFE6]/90">
                            {call.cartSnapshot.length > 0
                              ? call.cartSnapshot
                                  .map((i) => `${i.qty}x ${i.dish.name}`)
                                  .join(', ')
                              : 'Guest requested waiter assistance at table'}
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="font-mono-code text-[13px] font-bold text-[#C4F042] tabular-nums">
                              Cart Total: {state.currencySymbol}
                              {call.cartTotal}
                            </span>
                            {call.status === 'pending' && (
                              <button
                                type="button"
                                data-testid={`waiter-ack-${call.tableNumber}-btn`}
                                onClick={() => handleWaiterAcknowledge(call.id)}
                                className="px-4 py-2 rounded-[10px] bg-[#C4F042] text-[#140905] font-mono-code font-bold text-[12px] uppercase cursor-pointer"
                              >
                                On My Way →
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 3: FLOOR MAP */}
                {waiterTab === 'floor' && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {state.tables.map((t) => (
                      <button
                        key={t.tableNumber}
                        type="button"
                        onClick={() =>
                          setState((prev) => ({ ...prev, activeTable: t.tableNumber }))
                        }
                        className={`p-3 rounded-[12px] border text-left cursor-pointer ${
                          t.status === 'ready'
                            ? 'bg-[#2A180D] border-[#C4F042] text-[#C4F042]'
                            : t.status === 'waiter_called'
                            ? 'bg-[#2A180D] border-[#E8500C] text-[#FF8741]'
                            : 'bg-[#1A0C06] border-[#FBEFE6]/15 text-[#FBEFE6]'
                        }`}
                      >
                        <div className="font-mono-code font-bold text-[14px]">
                          Table {t.tableNumber}
                        </div>
                        <div className="text-[11px] capitalize mt-0.5 opacity-90">
                          {t.status.replace('_', ' ')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* =====================================================================
              SURFACE 3: KITCHEN & RECEPTION KDS APP (com.buildbros.kitchen)
              Direct 4-Stage KDS Board — Tapping READY alerts Waiter App live!
             ===================================================================== */}
          {(view === 'split-suite' || view === 'kitchen-apk') && (
            <section
              aria-label="Kitchen and Reception KDS Android APK"
              className={`bg-[#FFFFFF] text-[#1A0C06] overflow-hidden flex flex-col ${
                DEDICATED_APK_ROLE
                  ? 'min-h-screen border-0'
                  : 'rounded-[24px] border-2 border-[#1A0C06]'
              }`}
              data-testid="surface-kitchen-apk"
            >
              <div className="bg-[#140905] text-[#FBEFE6] px-4 py-3.5 border-b border-[#2A180D] flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#C4F042]" />
                    <span className="font-mono-code text-[10px] font-bold uppercase text-[#C4F042]">
                      KITCHEN &amp; RECEPTION KDS
                    </span>
                  </div>
                  <h3 className="text-[17px] font-bold text-[#FBEFE6] m-0 mt-0.5">
                    Live Ticket Board ({state.orders.filter((o) => o.status !== 'served').length}{' '}
                    Active)
                  </h3>
                </div>

                <button
                  type="button"
                  data-testid="kitchen-spawn-ticket-btn"
                  onClick={handleSpawnFreshKitchenTicket}
                  className="px-3 py-1.5 rounded-[8px] bg-[#2A180D] hover:bg-[#E8500C] text-[#C4F042] hover:text-[#FFFFFF] font-mono-code text-[11px] font-bold cursor-pointer transition-colors shrink-0"
                >
                  + New Test Ticket
                </button>
              </div>

              <div className="p-4 flex-1 flex flex-col gap-3.5">
                {state.orders.map((ord) => {
                  const stages: Array<KitchenOrder['status']> = [
                    'new',
                    'cooking',
                    'ready',
                    'served',
                  ];
                  return (
                    <div
                      key={ord.id}
                      data-testid={`kitchen-ticket-${ord.ticketNumber.replace('#', '')}`}
                      className={`p-4 rounded-[18px] border-2 flex flex-col gap-3 ${
                        ord.status === 'ready'
                          ? 'bg-[#F7F2ED] border-[#140905]'
                          : ord.status === 'served'
                          ? 'bg-[#F3ECE5]/60 border-[#E3D9D3] opacity-65'
                          : 'bg-[#F7F2ED] border-[#E8500C]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-code font-bold text-[18px] text-[#140905]">
                            {ord.ticketNumber}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-[6px] bg-[#140905] text-[#FBEFE6] font-mono-code text-[12px] font-bold">
                            Table {ord.tableNumber}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-[6px] font-mono-code text-[11px] font-bold uppercase ${
                            ord.status === 'ready'
                              ? 'bg-[#C4F042] text-[#140905]'
                              : ord.status === 'served'
                              ? 'bg-[#E3D9D3] text-[#6C625C]'
                              : 'bg-[#E8500C] text-[#FBEFE6]'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>

                      {/* Interactive 4-Stage KDS Selector Buttons (Tap any stage directly!) */}
                      <div
                        className="grid grid-cols-4 gap-1.5"
                        role="group"
                        aria-label={`Set stage for ticket ${ord.ticketNumber}`}
                      >
                        {stages.map((st) => (
                          <button
                            key={st}
                            type="button"
                            data-testid={`kds-stage-${ord.ticketNumber.replace('#', '')}-${st}`}
                            onClick={() => handleKitchenSetOrderStatus(ord.id, st)}
                            className={`py-1.5 rounded-[8px] text-[10px] font-mono-code font-bold uppercase cursor-pointer transition-colors ${
                              ord.status === st
                                ? st === 'ready'
                                  ? 'bg-[#C4F042] text-[#140905] border border-[#140905]'
                                  : 'bg-[#140905] text-[#FBEFE6]'
                                : 'bg-[#FFFFFF] border border-[#E3D9D3] text-[#6C625C] hover:text-[#140905]'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      <div className="p-3 rounded-[12px] bg-[#FFFFFF] border border-[#E3D9D3] flex flex-col gap-1.5 text-[13px]">
                        {ord.items.map((item) => (
                          <div key={item.dish.id} className="flex justify-between font-semibold">
                            <span>
                              <strong className="text-[#C03E0A]">{item.qty}×</strong>{' '}
                              {item.dish.name}
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
                          data-testid={`kds-confirm-${ord.ticketNumber.replace('#', '')}-btn`}
                          onClick={() => handleKitchenSetOrderStatus(ord.id, 'new')}
                          className="w-full h-11 rounded-[10px] bg-[#E8500C] hover:bg-[#C03E0A] text-[#FBEFE6] font-mono-code font-bold text-[12px] uppercase tracking-wider cursor-pointer transition-colors"
                        >
                          Reception Gate: Confirm Order {ord.ticketNumber} →
                        </button>
                      ) : ord.status !== 'served' ? (
                        <button
                          type="button"
                          data-testid={`kds-advance-${ord.ticketNumber.replace('#', '')}-btn`}
                          onClick={() => handleKitchenAdvance(ord.id)}
                          className={`w-full h-11 rounded-[10px] font-mono-code font-bold text-[12px] uppercase tracking-wider cursor-pointer transition-colors ${
                            ord.status === 'cooking'
                              ? 'bg-[#C4F042] hover:bg-[#b2df2f] text-[#140905] border-2 border-[#140905]'
                              : 'bg-[#140905] hover:bg-[#E8500C] text-[#FBEFE6]'
                          }`}
                        >
                          {ord.status === 'new'
                            ? `Start Cooking ${ord.ticketNumber} →`
                            : ord.status === 'cooking'
                            ? `🔔 Mark Dish Ready (Alert Waiter App) →`
                            : `✓ Mark Served at Table ${ord.tableNumber}`}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleKitchenSetOrderStatus(ord.id, 'cooking')}
                          className="w-full h-9 rounded-[8px] bg-[#FFFFFF] border border-[#E3D9D3] text-[#6C625C] font-mono-code text-[11px] font-semibold cursor-pointer"
                        >
                          ↺ Reopen Ticket to Cooking
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
