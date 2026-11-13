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
  fetchOtaManifest,
  loadLocalEcosystemState,
  pushOtaManifestUpdate,
  saveCloudEcosystemState,
  supabase,
} from './lib/ecosystemStore';
import { TableQrGenerator } from './components/TableQrGenerator';
import { TopDownFloorMap } from './components/TopDownFloorMap';
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

function resolveDedicatedApkRole(): 'waiter' | 'kitchen' | 'admin' | undefined {
  if (typeof window !== 'undefined') {
    const winRole = (
      window as unknown as { __BUILD_BROS_APK_ROLE__?: string }
    ).__BUILD_BROS_APK_ROLE__;
    if (winRole === 'waiter' || winRole === 'kitchen' || winRole === 'admin') {
      return winRole;
    }
    try {
      const storedRole = window.localStorage?.getItem('bb_apk_role');
      if (storedRole === 'waiter' || storedRole === 'kitchen' || storedRole === 'admin') {
        return storedRole;
      }
    } catch {
      // Ignore storage error
    }
  }
  const envRole = (import.meta as unknown as { env?: Record<string, string> })?.env
    ?.VITE_DEFAULT_APK;
  if (envRole === 'waiter' || envRole === 'kitchen' || envRole === 'admin') {
    return envRole;
  }
  return undefined;
}

const DEDICATED_APK_ROLE = resolveDedicatedApkRole();

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
  const base = loadLocalEcosystemState() || createInitialCafeState();
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

const DishPhotoWithFallback: React.FC<{
  dish: DishItem;
  className?: string;
}> = ({ dish, className = 'w-full h-full object-cover' }) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (!dish.imageUrl || imgFailed) {
    return (
      <div
        className={` flex flex-col items-center justify-center p-4 text-center ${className}`}
        style={{ backgroundColor: dish.plateColor || '#8C3F19' }}
      >
        <span className="font-mono-code text-[11px] text-[#FBEFE6]/80 uppercase tracking-widest">
          {dish.category}
        </span>
        <span className="font-bold text-[16px] text-[#FFFFFF] mt-1">{dish.name}</span>
      </div>
    );
  }

  return (
    <img
      src={dish.imageUrl}
      alt={dish.name}
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setImgFailed(true)}
      className={className}
    />
  );
};

export default function App() {
  const [state, setState] = useState<CafeEcosystemState>(() => createHydratedInitialState());
  const [view, setView] = useState<ActiveWorkspaceView>(() => getInitialViewFromUrl());
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [guestStep, setGuestStep] = useState<'deck' | 'cart'>('deck');
  const [guestDisplayMode, setGuestDisplayMode] = useState<'swipe' | 'list'>('swipe');
  const [guestOrderNotes, setGuestOrderNotes] = useState<string>('');

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

  // Staff & Admin Navigation Tabs
  // Waiter defaults to 'queue' (unified Priority Queue showing both Pass Pickup + Table Calls)
  const [waiterTab, setWaiterTab] = useState<'queue' | 'pickup' | 'calls' | 'floor'>('queue');
  const [adminTab, setAdminTab] = useState<'floor' | 'menu' | 'qr' | 'ota'>('menu');
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<string>('');
  const [liveToast, setLiveToast] = useState<{ title: string; body: string } | null>(null);
  const [isPushingOta, setIsPushingOta] = useState<boolean>(false);

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
  const stateRef = useRef<CafeEcosystemState>(state);
  const stateVersionRef = useRef<number>(state.stateVersion || 1);
  const otaVersionRef = useRef<number>(state.otaVersion || 240);
  const lastProcessedAlertIdRef = useRef<string | null>(state.lastAlert?.id || null);

  useEffect(() => {
    stateRef.current = state;
    stateVersionRef.current = state.stateVersion || 1;
    otaVersionRef.current = state.otaVersion || 240;
  }, [state]);

  useEffect(() => {
    initNativeNotifications();
  }, []);

  const applyIncomingRemoteState = useCallback(
    (incoming: CafeEcosystemState) => {
      if (!incoming || !Array.isArray(incoming.orders)) return;
      if ((incoming.stateVersion || 0) <= stateVersionRef.current) return;

      const prevOta = otaVersionRef.current;
      stateVersionRef.current = incoming.stateVersion;
      otaVersionRef.current = incoming.otaVersion || prevOta;

      setState((prev) => ({
        ...incoming,
        activeTable: prev.activeTable,
        cart: prev.cart,
        realtimeConnected: true,
      }));

      // If an OTA update was pushed, notify and apply live state immediately
      if ((incoming.otaVersion || 0) > prevOta) {
        soundFX.play('served');
        setLiveToast({
          title: `Live OTA Update v${incoming.otaVersion} Applied`,
          body: 'Updated over the air via Supabase & Cloud Sync — no APK download required.',
        });
        window.setTimeout(() => setLiveToast(null), 4500);
      }

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
            setWaiterTab((prev) => (prev === 'floor' ? 'queue' : prev));
          } else if (alert.title.includes('Waiter')) {
            soundFX.play('waiterCall');
            setWaiterTab((prev) => (prev === 'floor' ? 'queue' : prev));
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

  // Subscribe to Supabase Realtime Broadcast + Peer Catch-Up + Public Cloud Baseline
  useEffect(() => {
    let active = true;

    const checkRemoteOta = () => {
      fetchOtaManifest().then((manifest) => {
        if (!active || !manifest) return;
        const activeOtaVer = Math.max(
          otaVersionRef.current,
          (window as unknown as { __BB_ACTIVE_OTA_VER__?: number }).__BB_ACTIVE_OTA_VER__ || 0
        );
        if (manifest.otaVersion > activeOtaVer) {
          otaVersionRef.current = manifest.otaVersion;
          setState((prev) => ({ ...prev, otaVersion: manifest.otaVersion }));
          const isNative = Boolean(
            (
              window as unknown as {
                Capacitor?: { isNativePlatform?: () => boolean };
              }
            ).Capacitor?.isNativePlatform?.()
          );
          if (isNative) {
            window.setTimeout(() => window.location.reload(), 600);
          }
        }
      });
    };

    fetchCloudEcosystemState().then((remote) => {
      if (active && remote) {
        applyIncomingRemoteState(remote);
      }
    });
    checkRemoteOta();

    const channel = supabase.channel('cafe-ecosystem-realtime', {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'state_sync' }, (payload) => {
        if (payload?.payload) {
          applyIncomingRemoteState(payload.payload as CafeEcosystemState);
        }
      })
      .on('broadcast', { event: 'sync_request' }, (payload) => {
        const peerVer = (payload?.payload as { fromVersion?: number })?.fromVersion || 0;
        if ((stateRef.current.stateVersion || 1) > peerVer) {
          channel.send({
            type: 'broadcast',
            event: 'state_sync',
            payload: stateRef.current,
          });
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
      .on('broadcast', { event: 'ota_push' }, (payload) => {
        const nextOta = (payload?.payload as { otaVersion?: number })?.otaVersion;
        if (nextOta && nextOta > otaVersionRef.current) {
          otaVersionRef.current = nextOta;
          setState((prev) => ({ ...prev, otaVersion: nextOta }));
          setLiveToast({
            title: `OTA Live Update v${nextOta} Synced`,
            body: 'Your installed app updated automatically over the air.',
          });
          window.setTimeout(() => setLiveToast(null), 4000);
          const isNative = Boolean(
            (
              window as unknown as {
                Capacitor?: { isNativePlatform?: () => boolean };
              }
            ).Capacitor?.isNativePlatform?.()
          );
          if (isNative) {
            window.setTimeout(() => window.location.reload(), 900);
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setState((prev) => ({ ...prev, realtimeConnected: true }));
          channel.send({
            type: 'broadcast',
            event: 'sync_request',
            payload: { fromVersion: stateVersionRef.current },
          });
        }
      });

    channelRef.current = channel;

    const syncFromCloud = () => {
      channel.send({
        type: 'broadcast',
        event: 'sync_request',
        payload: { fromVersion: stateVersionRef.current },
      });
      fetchCloudEcosystemState().then((remote) => {
        if (active && remote) {
          applyIncomingRemoteState(remote);
        }
      });
    };

    const pollInterval = window.setInterval(syncFromCloud, 4000);
    const otaInterval = window.setInterval(checkRemoteOta, 30000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncFromCloud();
        checkRemoteOta();
      }
    };
    window.addEventListener('focus', syncFromCloud);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      window.clearInterval(pollInterval);
      window.clearInterval(otaInterval);
      window.removeEventListener('focus', syncFromCloud);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [applyIncomingRemoteState]);

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
      const latencyMs = Math.floor(95 + Math.random() * 55);

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

      channelRef.current?.send({
        type: 'broadcast',
        event: 'state_sync',
        payload: finalState,
      });

      saveCloudEcosystemState(finalState);

      return finalState;
    });
  };

  // Push Over-The-Air (OTA) Live Update to all installed APKs without re-downloading APK files
  const handlePushLiveOtaUpdate = async () => {
    setIsPushingOta(true);
    soundFX.play('served');
    const nextOta = (state.otaVersion || 240) + 1;
    otaVersionRef.current = nextOta;

    await pushOtaManifestUpdate(
      nextOta,
      `Live UI & Menu state synced over the air (v${nextOta})`
    );

    channelRef.current?.send({
      type: 'broadcast',
      event: 'ota_push',
      payload: { otaVersion: nextOta },
    });

    commitAndSync(
      (prev) => ({
        ...prev,
        otaVersion: nextOta,
      }),
      {
        targetApk: 'com.buildbros.waiter',
        channel: 'supabase_ota:live_bundle',
        title: `OTA Live Update v${nextOta} Pushed`,
        body: 'All installed Waiter, Kitchen & Admin phone apps updated over the air.',
        notifyCurrentDeviceToo: true,
      }
    );
    setIsPushingOta(false);
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

  // Level 2: Call the Waiter
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

    setWaiterTab((prev) => (prev === 'floor' ? 'queue' : prev));
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

  // Level 3: Send the Order
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
            notes: guestOrderNotes.trim(),
            createdAt: now,
            checkedItemIds: [],
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
    setGuestOrderNotes('');
  };

  // Staff Assisted Order Entry from Floor Plan or Waiter Call
  const handlePlaceAssistedOrder = (
    tableNumber: number,
    items: Array<{ dish: DishItem; qty: number }>
  ) => {
    if (items.length === 0) return;
    soundFX.play('ticketSent');
    const ticketNumber = `#0${Math.floor(413 + Math.random() * 85)}`;
    const totalAmount = calculateCartTotal(items);
    const itemsSummary = items.map((c) => `${c.qty}x ${c.dish.name}`).join(', ');
    const now = new Date().toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    commitAndSync(
      (prev) => ({
        ...prev,
        waiterCalls: prev.waiterCalls.map((c) =>
          c.tableNumber === tableNumber ? { ...c, status: 'completed' } : c
        ),
        orders: [
          {
            id: `ord-${Date.now()}`,
            ticketNumber,
            tableNumber,
            items,
            totalAmount,
            receptionConfirmed: true,
            status: 'cooking',
            notes: 'Punched by Waiter at Table',
            createdAt: now,
            checkedItemIds: [],
          },
          ...prev.orders,
        ],
        tables: prev.tables.map((t) =>
          t.tableNumber === tableNumber
            ? {
                ...t,
                status: 'cooking',
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
        title: `STAFF ORDER ${ticketNumber} · Table ${tableNumber}`,
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

  // Kitchen KDS: Toggle Dish Item Plated Checkmark
  const handleKitchenToggleItemCheck = (orderId: string, dishId: string) => {
    soundFX.play('tap');
    commitAndSync((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => {
        if (o.id !== orderId) return o;
        const current = o.checkedItemIds || [];
        const next = current.includes(dishId)
          ? current.filter((id) => id !== dishId)
          : [...current, dishId];
        return { ...o, checkedItemIds: next };
      }),
    }));
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

    if (isReady && waiterTab !== 'pickup') {
      setWaiterTab('queue');
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
            notes: 'Fresh pass ticket',
            createdAt: now,
            checkedItemIds: [],
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
        <div className="bg-[#140905] text-[#FBEFE6] px-6 py-3 flex items-center justify-between border-b border-[#2A180D]">
          <span className="font-mono-code text-[12px] text-[#C4F042]">
            Roast &amp; Co. OS · 4-Theme Guest Menu &amp; POS Suite
          </span>
          <button
            type="button"
            onClick={() => setView('split-suite')}
            className="px-4 py-1.5 rounded-[8px] bg-[#E8500C] text-[#FBEFE6] text-[12px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            Back to Command Suite
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
  const activeKitchenOrders = state.orders.filter((o) => o.status !== 'served');
  const shiftRevenue = state.tables.reduce((acc, t) => acc + (t.cartTotal || 0), 0);

  const effectiveX =
    exitDirection === 'right' ? 320 : exitDirection === 'left' ? -320 : dragOffset.x;
  const effectiveRotate = effectiveX * 0.045;
  const showAddStamp = effectiveX > 35;
  const showSkipStamp = effectiveX < -35;

  return (
    <div className="min-h-screen bg-[#F7F2ED] text-[#1A0C06] flex flex-col">
      {/* High-Priority Heads-Up Notification Toast Banner */}
      {liveToast && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="live-push-toast"
          className="fixed top-4 left-4 right-4 z-50 max-w-[500px] mx-auto p-4 rounded-[16px] bg-[#140905] text-[#FBEFE6] border-2 border-[#C4F042] flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="font-mono-code text-[11px] font-bold text-[#C4F042]">
              Live Cross-Device Alert · OTA v{state.otaVersion || 240}
            </div>
            <div className="font-bold text-[14px] text-[#FFFFFF] truncate mt-0.5">
              {liveToast.title}
            </div>
            <div className="text-[12px] text-[#FBEFE6]/85 truncate">{liveToast.body}</div>
          </div>
          <button
            type="button"
            onClick={() => setLiveToast(null)}
            className="px-3 py-1.5 rounded-[8px] bg-[#2A180D] text-[#C4F042] font-mono-code text-[11px] font-bold cursor-pointer whitespace-nowrap shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =====================================================================
          STRICT 3-ZONE TOP BAR CONTRACT (frontend-design §2)
          [Zone 1: Single Wordmark] — [Zone 2: 5 Nav Links] — [Zone 3: 1 Primary CTA]
         ===================================================================== */}
      {!DEDICATED_APK_ROLE && (
        <header className="bg-[#140905] text-[#FBEFE6] border-b border-[#2A180D] px-6 py-4 sticky top-0 z-40">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-8">
            {/* Zone 1: Single text element wordmark */}
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                setView('split-suite');
              }}
              className="text-[19px] font-bold tracking-tight text-[#FBEFE6] no-underline whitespace-nowrap shrink-0"
            >
              Roast &amp; Co. OS
            </a>

            {/* Zone 2: 5 concise single-line text navigation links */}
            <nav
              aria-label="Product surfaces"
              className="hidden md:flex items-center gap-6 text-[13px] font-medium"
            >
              {(
                [
                  { id: 'split-suite', label: 'Live Suite' },
                  { id: 'guest-web', label: 'Guest Menu' },
                  { id: 'waiter-apk', label: 'Waiter App' },
                  { id: 'kitchen-apk', label: 'Kitchen KDS' },
                  { id: 'admin-apk', label: 'Owner Studio' },
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

            {/* Zone 3: 1 Primary Action Button (Push Live OTA Update to Phones) */}
            <div className="flex items-center shrink-0">
              <button
                type="button"
                data-testid="push-live-ota-btn"
                onClick={handlePushLiveOtaUpdate}
                disabled={isPushingOta}
                className="px-4 py-2 rounded-[10px] bg-[#E8500C] hover:bg-[#C03E0A] text-[#FBEFE6] text-[12px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {isPushingOta
                  ? 'Pushing OTA...'
                  : `Push OTA Update (v${state.otaVersion || 240})`}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* =====================================================================
          VENUE CONTEXT & MODE TOOLBAR (Below Header, hidden on single-role APK)
         ===================================================================== */}
      {!DEDICATED_APK_ROLE && (
        <div className="bg-[#EFE8E0] border-b border-[#E3D9D3] px-4 sm:px-6 py-2.5">
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3">
            {/* Mobile Surface Switcher + Venue KPI Summary */}
            <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#6C625C]">
              <div className="flex md:hidden items-center gap-1">
                {(
                  [
                    { id: 'split-suite', label: 'Suite' },
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
                    className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                      view === t.id
                        ? 'bg-[#140905] text-[#FBEFE6]'
                        : 'bg-[#FFFFFF] text-[#1A0C06]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <span className="font-semibold text-[#1A0C06]">{state.venueName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-code tabular-nums">
                Active Table {state.activeTable}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-code tabular-nums">
                Shift Revenue {state.currencySymbol}
                {shiftRevenue}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-code tabular-nums text-[#3F6212] font-semibold">
                {readyOrders.length} Ready at Pass
              </span>
            </div>

            {/* Interactive Controls: Service Level + Sound + Theme Catalogue */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-1 bg-[#FFFFFF] border border-[#E3D9D3] p-1 rounded-[8px]"
                role="group"
                aria-label="Venue Service Level"
              >
                {([1, 2, 3] as ServiceLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    data-testid={`switch-level-${lvl}-btn`}
                    onClick={() => handleSwitchLevel(lvl)}
                    className={`px-2.5 py-1 rounded-[6px] font-mono-code text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      state.serviceLevel === lvl
                        ? 'bg-[#140905] text-[#FBEFE6]'
                        : 'text-[#6C625C] hover:text-[#1A0C06]'
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
                className="px-3 py-1.5 rounded-[8px] bg-[#FFFFFF] border border-[#E3D9D3] text-[#1A0C06] font-mono-code text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                {soundEnabled ? 'Chime Audio: ON' : 'Chime Audio: OFF'}
              </button>

              <button
                type="button"
                onClick={() => setView('theme-catalogue')}
                className="px-3 py-1.5 rounded-[8px] bg-[#140905] text-[#FBEFE6] text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                4-Theme Catalogue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MAIN WORKSPACE STAGE
         ===================================================================== */}
      <main
        className={`flex-1 w-full mx-auto flex flex-col gap-6 ${
          DEDICATED_APK_ROLE
            ? 'max-w-[640px] p-0'
            : 'max-w-[1440px] px-4 sm:px-6 py-5 sm:py-6'
        }`}
      >
        {/* =====================================================================
            SURFACE 4: OWNER STUDIO / ADMIN APP (com.buildbros.admin)
           ===================================================================== */}
        {(view === 'split-suite' || view === 'admin-apk') && (
          <section
            aria-label="Owner Admin Android APK"
            className={`bg-[#FFFFFF] overflow-hidden ${
              DEDICATED_APK_ROLE
                ? 'min-h-screen border-0'
                : 'rounded-[20px] border border-[#E3D9D3]'
            }`}
            data-testid="surface-admin-apk"
          >
            {/* Owner Studio Header */}
            <div className="bg-[#140905] text-[#FBEFE6] px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[12px] text-[#C4F042] font-mono-code">
                  Owner Studio · Live Cloud &amp; OTA Sync (v{state.otaVersion || 240})
                </div>
                <h2 className="text-[20px] font-bold m-0 mt-0.5 text-balance">
                  {state.venueName} · Venue Command &amp; Menu Studio
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
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
                      className={`px-2.5 py-1 rounded-[6px] font-mono-code text-[11px] font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                        state.serviceLevel === lvl
                          ? 'bg-[#E8500C] text-[#FBEFE6]'
                          : 'text-[#FBEFE6]/70'
                      }`}
                    >
                      L{lvl}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handlePushLiveOtaUpdate}
                  className="px-3 py-1.5 rounded-[8px] bg-[#C4F042] text-[#140905] font-mono-code text-[11px] font-bold cursor-pointer whitespace-nowrap shrink-0"
                >
                  Push OTA Update (v{state.otaVersion || 240})
                </button>
              </div>
            </div>

            {/* Owner Studio Navigation Bar */}
            <div className="px-5 py-3 bg-[#F7F2ED] border-b border-[#E3D9D3] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'menu', label: 'Menu & 86 Studio' },
                    { id: 'floor', label: `Interactive Floor Map (${state.tables.length})` },
                    { id: 'qr', label: 'Table QR Generator' },
                    { id: 'ota', label: 'Live OTA & Phone Sync' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    data-testid={`admin-tab-${t.id}`}
                    onClick={() => setAdminTab(t.id)}
                    className={`px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      adminTab === t.id
                        ? 'bg-[#140905] text-[#FBEFE6]'
                        : 'bg-[#FFFFFF] border border-[#E3D9D3] text-[#6C625C] hover:text-[#1A0C06]'
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
                className={`px-3 py-1.5 rounded-[8px] font-mono-code text-[11px] font-semibold border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  state.autoRouteToKitchen
                    ? 'bg-[#FFEEE3] border-[#E8500C] text-[#C03E0A]'
                    : 'bg-[#FFFFFF] border-[#E3D9D3] text-[#6C625C]'
                }`}
              >
                Auto-Send to Kitchen: {state.autoRouteToKitchen ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Owner Studio Tab Panels */}
            <div className="p-5">
              {adminTab === 'menu' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {state.dishes.map((dish) => {
                    const isEditing = editingDishId === dish.id;
                    return (
                      <div
                        key={dish.id}
                        className={`p-3.5 rounded-[16px] border flex items-center justify-between gap-3 ${
                          dish.isAvailable
                            ? 'bg-[#F7F2ED] border-[#E3D9D3]'
                            : 'bg-[#F3ECE5]/60 border-[#E3D9D3] opacity-65'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 h-14 rounded-[10px] overflow-hidden bg-[#140905] shrink-0 border border-[#E3D9D3]">
                            <DishPhotoWithFallback dish={dish} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] text-[#6C625C] truncate">
                              {dish.category} · {dish.dietary}
                            </div>
                            <div className="font-semibold text-[14px] text-[#1A0C06] truncate">
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
                                    className="px-2.5 py-0.5 rounded-[6px] bg-[#E8500C] text-[#FBEFE6] text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
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
                                  className="font-mono-code text-[12px] font-bold text-[#C03E0A] hover:underline cursor-pointer tabular-nums whitespace-nowrap"
                                >
                                  {state.currencySymbol}
                                  {dish.price} · Edit Price
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAdminToggle86(dish.id)}
                          aria-label={`Toggle 86 sold out for ${dish.name}`}
                          className={`px-3 py-1.5 rounded-[8px] font-mono-code text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                            dish.isAvailable
                              ? 'bg-[#FFFFFF] border border-[#E3D9D3] text-[#1A0C06] hover:bg-[#FFEEE3]'
                              : 'bg-[#140905] text-[#FBEFE6]'
                          }`}
                        >
                          {dish.isAvailable ? '86 Sold Out' : 'Restock'}
                        </button>
                      </div>
                    );
                  })}
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
                  onSelectTable={(tableNumber) =>
                    setState((prev) => ({ ...prev, activeTable: tableNumber }))
                  }
                  onAcknowledgeCall={handleWaiterAcknowledge}
                  onServeOrder={handleWaiterServeOrder}
                  onPlaceAssistedOrder={handlePlaceAssistedOrder}
                  onOpenTableGuestMenu={(tableNumber) => {
                    soundFX.play('tap');
                    setState((prev) => ({ ...prev, activeTable: tableNumber }));
                    setGuestStep('deck');
                    if (view === 'admin-apk') {
                      setView('guest-web');
                    }
                  }}
                />
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

              {adminTab === 'ota' && (
                <div
                  className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
                  data-testid="admin-ota-sync-panel"
                >
                  <div className="lg:col-span-6 p-5 rounded-[16px] bg-[#140905] text-[#FBEFE6] flex flex-col gap-3">
                    <div className="font-mono-code text-[11px] text-[#C4F042] uppercase">
                      Over-The-Air (OTA) Live Phone Updater
                    </div>
                    <h3 className="text-[18px] font-bold m-0">
                      Update Installed Phone APKs Without Re-Downloading
                    </h3>
                    <p className="text-[13px] text-[#FBEFE6]/80 m-0 leading-relaxed">
                      Every installed Android APK (Waiter, Kitchen KDS, and Owner Admin) checks{' '}
                      <code className="text-[#C4F042]">ota/manifest.json</code> and subscribes to{' '}
                      <code className="text-[#C4F042]">cafe-ecosystem-realtime</code>. Pushing an
                      OTA update broadcasts the new bundle and state live to all phones in under 2
                      seconds.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handlePushLiveOtaUpdate}
                        className="px-4 py-2.5 rounded-[10px] bg-[#C4F042] text-[#140905] font-mono-code text-[12px] font-bold cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Push Live OTA Update Now (v{(state.otaVersion || 240) + 1}) →
                      </button>
                      <span className="font-mono-code text-[12px] text-[#FBEFE6]/75 tabular-nums">
                        Current OTA: v{state.otaVersion || 240} · State v{state.stateVersion}
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-6 p-5 rounded-[16px] bg-[#F7F2ED] border border-[#E3D9D3] flex flex-col gap-3">
                    <div className="font-mono-code text-[11px] font-bold text-[#C03E0A] uppercase">
                      Recent Cross-Device Sync &amp; Push Events
                    </div>
                    <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto">
                      {state.pushEvents.slice(0, 6).map((evt) => (
                        <div
                          key={evt.id}
                          className="p-3 rounded-[12px] bg-[#FFFFFF] border border-[#E3D9D3] flex items-center justify-between gap-2 text-[12px]"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[#1A0C06] truncate">
                              {evt.title}
                            </div>
                            <div className="text-[11px] text-[#6C625C] truncate">{evt.body}</div>
                          </div>
                          <span className="font-mono-code text-[10px] text-[#6C625C] shrink-0 tabular-nums">
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
        )}

        {/* =====================================================================
            3 OPERATIONAL SURFACES STAGE:
            1. Guest Swipe Menu · 2. Waiter Handheld App · 3. Kitchen Pass KDS App
           ===================================================================== */}
        <div
          className={`grid gap-6 items-start ${
            view === 'split-suite'
              ? 'grid-cols-1 lg:grid-cols-3'
              : 'grid-cols-1 max-w-[680px] mx-auto w-full'
          }`}
        >
          {/* =====================================================================
              SURFACE 1: GUEST TABLE MENU (SWIPE DECK + SUB-SECTIONS + CART VIEW)
             ===================================================================== */}
          {(view === 'split-suite' || view === 'guest-web') && (
            <section
              aria-label="Guest Web Menu"
              className={`bg-[#FFFFFF] overflow-hidden flex flex-col ${
                DEDICATED_APK_ROLE
                  ? 'min-h-screen border-0'
                  : 'rounded-[22px] border border-[#E3D9D3]'
              }`}
              data-testid="surface-guest-web"
            >
              {/* Top Venue Header + Cart Button */}
              <div className="bg-[#140905] text-[#FBEFE6] px-4 py-4 border-b border-[#2A180D] flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono-code text-[11px] text-[#C4F042]">
                    Table {state.activeTable} · Level {state.serviceLevel} · Demo
                  </div>
                  <h3 className="text-[18px] font-bold text-[#FBEFE6] m-0 mt-0.5">
                    {state.venueName}
                  </h3>
                </div>

                {state.serviceLevel >= 2 && (
                  <button
                    type="button"
                    data-testid="header-cart-btn"
                    onClick={() => {
                      soundFX.play('tap');
                      setGuestStep((prev) => (prev === 'cart' ? 'deck' : 'cart'));
                    }}
                    className="px-3.5 py-2 rounded-[10px] bg-[#E8500C] hover:bg-[#C03E0A] text-[#FBEFE6] font-mono-code text-[12px] font-bold cursor-pointer tabular-nums whitespace-nowrap shrink-0"
                  >
                    {guestStep === 'cart'
                      ? '← Swipe Deck'
                      : `Cart (${cartCount}) · ${state.currencySymbol}${cartTotal}`}
                  </button>
                )}
              </div>

              {guestStep === 'cart' && state.serviceLevel >= 2 ? (
                /* ===============================================================
                   GUEST TABLE CART & LIVE ORDER RADAR
                   Level 2 = "Call the Waiter" button
                   Level 3 = "Send the Order" button
                   =============================================================== */
                <div className="p-4 flex flex-col gap-4" data-testid="guest-cart-view">
                  <div className="flex items-center justify-between border-b border-[#E3D9D3] pb-3">
                    <div>
                      <div className="font-mono-code text-[11px] text-[#C03E0A] font-semibold">
                        Table {state.activeTable} Tray · Done Picking
                      </div>
                      <h4 className="text-[17px] font-bold text-[#1A0C06] m-0 mt-0.5">
                        Picked Dishes ({cartCount})
                      </h4>
                    </div>
                    <button
                      type="button"
                      data-testid="guest-back-to-deck-btn"
                      onClick={() => setGuestStep('deck')}
                      className="px-3 py-1.5 rounded-[8px] bg-[#F7F2ED] border border-[#E3D9D3] text-[#1A0C06] font-mono-code text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      ← Back to Deck
                    </button>
                  </div>

                  {/* Live Level 2 Waiter Status Banner */}
                  {activeTableCall && (
                    <div
                      role="status"
                      aria-live="polite"
                      data-testid="guest-cart-waiter-status"
                      className={`p-3.5 rounded-[14px] border flex flex-col gap-1 ${
                        activeTableCall.status === 'acknowledged'
                          ? 'bg-[#140905] text-[#C4F042] border-[#C4F042]'
                          : 'bg-[#FFEEE3] text-[#1A0C06] border-[#E8500C]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono-code text-[11px] font-bold">
                        <span>
                          {activeTableCall.status === 'acknowledged'
                            ? `✓ Waiter Walking to Table ${state.activeTable}`
                            : `Waiter Notified · Table ${state.activeTable}`}
                        </span>
                        <span className="tabular-nums">{activeTableCall.createdAt}</span>
                      </div>
                      <p className="text-[12px] opacity-90 m-0">
                        {activeTableCall.status === 'acknowledged'
                          ? 'Staff #04 claimed your call on the Waiter app and is coming to confirm your order.'
                          : 'Your picked cart and table number are flashing on the Waiter handheld.'}
                      </p>
                    </div>
                  )}

                  {/* Live Level 3 Kitchen Tracker */}
                  {state.serviceLevel === 3 && activeTableOrder && (
                    <div
                      role="status"
                      aria-live="polite"
                      data-testid="guest-cart-order-status"
                      className="p-3.5 rounded-[14px] bg-[#F7F2ED] border border-[#E3D9D3] flex flex-col gap-2.5"
                    >
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-mono-code font-bold text-[#1A0C06] tabular-nums">
                          Live Ticket {activeTableOrder.ticketNumber} · Table {state.activeTable}
                        </span>
                        <span className="font-mono-code text-[11px] font-bold uppercase text-[#C03E0A]">
                          {activeTableOrder.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['new', 'cooking', 'ready', 'served'] as const).map((st) => (
                          <div
                            key={st}
                            className={`text-center py-1.5 rounded-[6px] text-[10px] font-mono-code font-bold uppercase ${
                              activeTableOrder.status === st
                                ? 'bg-[#140905] text-[#C4F042]'
                                : 'bg-[#FFFFFF] border border-[#E3D9D3] text-[#6C625C]'
                            }`}
                          >
                            {st}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Picked Cart Items */}
                  {state.cart.length === 0 ? (
                    <div className="py-8 text-center flex flex-col items-center gap-2.5">
                      <p className="text-[13px] text-[#6C625C] m-0">
                        Your table tray is empty. Swipe right on dish cards to add them.
                      </p>
                      <button
                        type="button"
                        onClick={() => setGuestStep('deck')}
                        className="px-4 py-2 rounded-[10px] bg-[#E8500C] text-[#FBEFE6] font-mono-code text-[12px] font-bold cursor-pointer"
                      >
                        Browse Swipe Deck →
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5 max-h-[250px] overflow-y-auto pr-1">
                      {state.cart.map(({ dish, qty }) => (
                        <div
                          key={dish.id}
                          className="p-2.5 rounded-[12px] bg-[#F7F2ED] border border-[#E3D9D3] flex items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-11 h-11 rounded-[8px] overflow-hidden bg-[#140905] shrink-0">
                              <DishPhotoWithFallback dish={dish} />
                            </div>
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
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(dish.id)}
                              aria-label={`Remove one ${dish.name}`}
                              className="w-8 h-8 rounded-[8px] bg-[#FFFFFF] border border-[#E3D9D3] text-[#1A0C06] font-bold text-[14px] cursor-pointer"
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
                              className="w-8 h-8 rounded-[8px] bg-[#140905] text-[#FBEFE6] font-bold text-[14px] cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Kitchen Note Input */}
                  {state.cart.length > 0 && (
                    <input
                      type="text"
                      aria-label="Special kitchen note"
                      placeholder="Add kitchen note (e.g. extra hot, oat milk, no onions)..."
                      value={guestOrderNotes}
                      onChange={(e) => setGuestOrderNotes(e.target.value)}
                      className="px-3 py-2 rounded-[10px] bg-[#F7F2ED] border border-[#E3D9D3] text-[12px] text-[#1A0C06]"
                    />
                  )}

                  {/* Cart Total & Level 2 / Level 3 Primary Action */}
                  <div className="pt-3 border-t border-[#E3D9D3] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-[#6C625C]">
                        Table {state.activeTable} Total ({cartCount} items)
                      </span>
                      <span className="font-mono-code text-[20px] font-bold text-[#1A0C06] tabular-nums">
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
                        className="w-full h-12 rounded-[12px] bg-[#E8500C] hover:bg-[#C03E0A] disabled:bg-[#E3D9D3] text-[#FBEFE6] font-mono-code font-bold text-[13px] uppercase tracking-wider cursor-pointer transition-colors"
                      >
                        {activeTableCall?.status === 'acknowledged'
                          ? `✓ Waiter On My Way to Table ${state.activeTable}`
                          : activeTableCall?.status === 'pending'
                          ? `Waiter Called · Ring Waiter Again`
                          : `Call the Waiter (Table ${state.activeTable} · ${state.currencySymbol}${cartTotal})`}
                      </button>
                    )}

                    {state.serviceLevel === 3 && (
                      <button
                        type="button"
                        data-testid="guest-send-order-btn"
                        onClick={handleGuestPlaceOrder}
                        disabled={cartCount === 0}
                        className="w-full h-12 rounded-[12px] bg-[#E8500C] hover:bg-[#C03E0A] disabled:bg-[#E3D9D3] text-[#FBEFE6] font-mono-code font-bold text-[13px] uppercase tracking-wider cursor-pointer transition-colors"
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
                  {/* Sub-Section Filter Bar */}
                  <div className="px-4 py-3 bg-[#F7F2ED] border-b border-[#E3D9D3] flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-code text-[11px] font-semibold text-[#6C625C]">
                        Menu Sub-Sections · {filteredDishes.length} Dishes
                      </span>
                      <div className="flex items-center gap-1 bg-[#E3D9D3]/80 p-0.5 rounded-[8px]">
                        <button
                          type="button"
                          onClick={() => setGuestDisplayMode('swipe')}
                          className={`px-2.5 py-1 rounded-[6px] font-mono-code text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                            guestDisplayMode === 'swipe'
                              ? 'bg-[#140905] text-[#FBEFE6]'
                              : 'text-[#6C625C]'
                          }`}
                        >
                          Swipe Deck
                        </button>
                        <button
                          type="button"
                          onClick={() => setGuestDisplayMode('list')}
                          className={`px-2.5 py-1 rounded-[6px] font-mono-code text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                            guestDisplayMode === 'list'
                              ? 'bg-[#140905] text-[#FBEFE6]'
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
                            className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
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
                    <div className="p-4 flex flex-col gap-3.5">
                      <div className="flex items-center justify-between text-[11px] font-mono-code text-[#6C625C]">
                        <span>
                          {currentDeckDish
                            ? `Dish ${deckIndex + 1} of ${filteredDishes.length} · ${selectedCategory}`
                            : `${selectedCategory} Complete`}
                        </span>
                        <span>← Swipe Left: Skip · Right: Add →</span>
                      </div>

                      {lastSwipeFeedback && (
                        <div className="px-3 py-1.5 rounded-[8px] bg-[#F7F2ED] border border-[#E3D9D3] text-[11px] font-mono-code flex items-center justify-between">
                          <span>
                            {lastSwipeFeedback.type === 'add' ? '✓ In Cart:' : '↷ Skipped:'}{' '}
                            <strong>{lastSwipeFeedback.dishName}</strong>
                          </span>
                          <span className="text-[#6C625C] tabular-nums">
                            Skipped: {skippedIds.length}
                          </span>
                        </div>
                      )}

                      {currentDeckDish ? (
                        <>
                          <div className="relative h-[320px] w-full select-none">
                            {nextDeckDish && (
                              <div
                                aria-hidden="true"
                                className="absolute inset-x-3 top-2 bottom-0 rounded-[18px] bg-[#F7F2ED] border border-[#E3D9D3] scale-[0.96] translate-y-2 opacity-75 pointer-events-none"
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
                              className="relative h-full w-full rounded-[18px] bg-[#FFFFFF] border border-[#1A0C06]/25 overflow-hidden flex flex-col justify-between cursor-grab active:cursor-grabbing"
                            >
                              {showAddStamp && (
                                <div className="absolute top-3 left-3 z-20 px-3 py-1 rounded-[8px] bg-[#C4F042] text-[#140905] font-mono-code text-[12px] font-bold uppercase tracking-wider">
                                  ADD TO TABLE +
                                </div>
                              )}
                              {showSkipStamp && (
                                <div className="absolute top-3 right-3 z-20 px-3 py-1 rounded-[8px] bg-[#E8500C] text-[#FBEFE6] font-mono-code text-[12px] font-bold uppercase tracking-wider">
                                  SKIP ←
                                </div>
                              )}

                              {/* 4:3 Culinary Photography with Measured Scrim */}
                              <div className="relative h-[175px] bg-[#140905] overflow-hidden">
                                <DishPhotoWithFallback
                                  dish={currentDeckDish}
                                  className="w-full h-full object-cover pointer-events-none"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

                                <div className="absolute bottom-3 left-3.5 right-3.5 flex items-end justify-between text-[#FBEFE6]">
                                  <div className="pr-2">
                                    <div className="text-[11px] text-[#FBEFE6]/80 font-mono-code">
                                      {currentDeckDish.category} · {currentDeckDish.dietary}
                                      {currentDeckDish.prepTime
                                        ? ` · ${currentDeckDish.prepTime}`
                                        : ''}
                                    </div>
                                    <h4 className="text-[17px] font-bold leading-snug m-0 mt-0.5">
                                      {currentDeckDish.name}
                                    </h4>
                                  </div>
                                  <span className="font-mono-code text-[18px] font-bold text-[#C4F042] shrink-0 tabular-nums">
                                    {state.currencySymbol}
                                    {currentDeckDish.price}
                                  </span>
                                </div>
                              </div>

                              {/* Editorial Dish Description & In-Cart Status */}
                              <div className="p-3.5 flex-1 flex flex-col justify-between bg-[#FFFFFF]">
                                <p className="text-[13px] text-[#6C625C] leading-relaxed m-0 line-clamp-2">
                                  {currentDeckDish.description}
                                </p>

                                <div className="flex items-center justify-between pt-2.5 border-t border-[#E3D9D3] text-[11px] font-mono-code">
                                  <span className="text-[#6C625C]">
                                    Drag card or tap below
                                  </span>
                                  {state.cart.find((c) => c.dish.id === currentDeckDish.id) ? (
                                    <span className="text-[#C03E0A] font-bold tabular-nums">
                                      In Table Tray:{' '}
                                      {
                                        state.cart.find((c) => c.dish.id === currentDeckDish.id)
                                          ?.qty
                                      }
                                    </span>
                                  ) : (
                                    <span className="text-[#1A0C06] font-semibold">
                                      Swipe right to pick
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Tactile Swipe Controls */}
                          <div className="grid grid-cols-7 gap-2 pt-1">
                            <button
                              type="button"
                              data-testid="swipe-left-skip-btn"
                              onClick={() => triggerSwipeAction('left')}
                              className="col-span-3 h-11 rounded-[10px] bg-[#F7F2ED] hover:bg-[#E3D9D3] border border-[#E3D9D3] text-[#1A0C06] font-mono-code text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap"
                            >
                              ← Skip Dish
                            </button>

                            <button
                              type="button"
                              data-testid="swipe-undo-btn"
                              onClick={handleUndoSwipe}
                              disabled={swipeHistory.length === 0}
                              title="Undo last swipe"
                              className="col-span-1 h-11 rounded-[10px] bg-[#FFFFFF] border border-[#E3D9D3] disabled:opacity-40 text-[#1A0C06] font-mono-code text-[12px] font-bold cursor-pointer"
                            >
                              ↺
                            </button>

                            <button
                              type="button"
                              data-testid="swipe-right-add-btn"
                              onClick={() => triggerSwipeAction('right')}
                              className="col-span-3 h-11 rounded-[10px] bg-[#140905] hover:bg-[#E8500C] text-[#FBEFE6] font-mono-code text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap"
                            >
                              {state.serviceLevel >= 2 ? 'Add to Cart + →' : 'Next Dish →'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div
                          data-testid="swipe-deck-complete"
                          className="p-5 rounded-[18px] bg-[#F7F2ED] border border-[#E3D9D3] text-center flex flex-col items-center gap-3"
                        >
                          <div className="font-mono-code text-[11px] font-bold uppercase text-[#C03E0A]">
                            Done Picking · {selectedCategory}
                          </div>
                          <h4 className="text-[17px] font-bold text-[#1A0C06] m-0">
                            You explored all dishes in {selectedCategory}
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
                                className="w-full h-11 rounded-[10px] bg-[#E8500C] hover:bg-[#C03E0A] text-[#FBEFE6] font-mono-code text-[12px] font-bold uppercase cursor-pointer"
                              >
                                Done Picking · Open Cart ({cartCount} · {state.currencySymbol}
                                {cartTotal}) →
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setDeckIndex(0);
                                setSwipeHistory([]);
                              }}
                              className="w-full h-10 rounded-[10px] bg-[#FFFFFF] border border-[#E3D9D3] text-[#1A0C06] font-mono-code text-[11px] font-semibold cursor-pointer"
                            >
                              ↺ Browse {selectedCategory} Again
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* List Mode Alternative */
                    <div className="p-4 flex flex-col gap-2.5 max-h-[360px] overflow-y-auto">
                      {filteredDishes.map((dish) => {
                        const inCart = state.cart.find((c) => c.dish.id === dish.id);
                        return (
                          <div
                            key={dish.id}
                            className="p-3 rounded-[14px] border border-[#E3D9D3] bg-[#F7F2ED]/60 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-[8px] overflow-hidden bg-[#140905] shrink-0">
                                <DishPhotoWithFallback dish={dish} />
                              </div>
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
                            </div>

                            {state.serviceLevel >= 2 && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                {inCart && inCart.qty > 0 && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveFromCart(dish.id)}
                                      className="w-7 h-7 rounded-[8px] bg-[#FFFFFF] border border-[#E3D9D3] text-[#1A0C06] font-bold text-[14px] cursor-pointer"
                                    >
                                      −
                                    </button>
                                    <span className="font-mono-code text-[12px] font-bold w-4 text-center tabular-nums">
                                      {inCart.qty}
                                    </span>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleAddToCart(dish)}
                                  className="px-2.5 h-7 rounded-[8px] bg-[#140905] hover:bg-[#E8500C] text-[#FBEFE6] font-semibold text-[12px] cursor-pointer transition-colors"
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

                  {/* Guest Bottom Table Tray */}
                  <div className="p-4 bg-[#F7F2ED] border-t border-[#E3D9D3] flex flex-col gap-2">
                    {state.serviceLevel === 1 ? (
                      <div className="flex items-center justify-between text-[12px] text-[#6C625C]">
                        <span>Level 1 · Digital Browse Menu</span>
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
                        className="w-full h-12 rounded-[12px] bg-[#140905] hover:bg-[#E8500C] text-[#FBEFE6] font-mono-code font-bold text-[12px] uppercase tracking-wider cursor-pointer transition-colors flex items-center justify-between px-4"
                      >
                        <span>Done Picking · Click Cart ({cartCount})</span>
                        <span className="text-[#C4F042] tabular-nums">
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
              SURFACE 2: WAITER HANDHELD APP (com.buildbros.waiter)
              Unified Priority Queue (Ready Pass Pickups + Table Calls) + Floor Map
             ===================================================================== */}
          {(view === 'split-suite' || view === 'waiter-apk') && (
            <section
              aria-label="Waiter Dedicated Android APK"
              className={`bg-[#140905] text-[#FBEFE6] overflow-hidden flex flex-col ${
                DEDICATED_APK_ROLE
                  ? 'min-h-screen border-0'
                  : 'rounded-[22px] border border-[#2A180D]'
              }`}
              data-testid="surface-waiter-apk"
            >
              {/* Waiter App Top Header */}
              <div className="bg-[#1A0C06] px-4 py-4 border-b border-[#2A180D] flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono-code text-[11px] text-[#C4F042]">
                    Waiter Handheld · Live OTA v{state.otaVersion || 240}
                  </div>
                  <h3 className="text-[18px] font-bold text-[#FBEFE6] m-0 mt-0.5">
                    {state.venueName}
                  </h3>
                </div>

                <button
                  type="button"
                  data-testid="waiter-test-alert-btn"
                  onClick={() => {
                    soundFX.play('kitchenReady');
                    triggerUrgentDeviceNotification(
                      'Waiter Handheld Alert Verified',
                      'Android status-bar notification, chime & haptic vibration active.'
                    );
                    setLiveToast({
                      title: 'Waiter Push Alert Verified',
                      body: 'Audio chime and native notification active on this device.',
                    });
                    window.setTimeout(() => setLiveToast(null), 3500);
                  }}
                  className="px-3 py-1.5 rounded-[8px] bg-[#2A180D] hover:bg-[#E8500C] text-[#C4F042] hover:text-[#FFFFFF] font-mono-code text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  Test Alert
                </button>
              </div>

              {/* 4 Staff Navigation Tabs (Unified Queue + Pass Pickup + Calls + Floor) */}
              <div className="p-2.5 bg-[#1A0C06] border-b border-[#2A180D] grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  data-testid="waiter-tab-queue"
                  onClick={() => setWaiterTab('queue')}
                  className={`py-2 px-2 rounded-[8px] font-mono-code text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                    waiterTab === 'queue'
                      ? 'bg-[#FBEFE6] text-[#140905]'
                      : 'bg-[#2A180D] text-[#FBEFE6]/80'
                  }`}
                >
                  Queue ({readyOrders.length + pendingCalls.length})
                </button>

                <button
                  type="button"
                  data-testid="waiter-tab-pickup"
                  onClick={() => setWaiterTab('pickup')}
                  className={`py-2 px-2 rounded-[8px] font-mono-code text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                    waiterTab === 'pickup'
                      ? 'bg-[#C4F042] text-[#140905]'
                      : readyOrders.length > 0
                      ? 'bg-[#2A180D] text-[#C4F042] border border-[#C4F042]'
                      : 'bg-[#2A180D] text-[#FBEFE6]/75'
                  }`}
                >
                  Pickup ({readyOrders.length})
                </button>

                <button
                  type="button"
                  data-testid="waiter-tab-calls"
                  onClick={() => setWaiterTab('calls')}
                  className={`py-2 px-2 rounded-[8px] font-mono-code text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                    waiterTab === 'calls'
                      ? 'bg-[#E8500C] text-[#FBEFE6]'
                      : pendingCalls.length > 0
                      ? 'bg-[#2A180D] text-[#FF8741] border border-[#E8500C]'
                      : 'bg-[#2A180D] text-[#FBEFE6]/75'
                  }`}
                >
                  Calls ({pendingCalls.length})
                </button>

                <button
                  type="button"
                  data-testid="waiter-tab-floor"
                  onClick={() => setWaiterTab('floor')}
                  className={`py-2 px-2 rounded-[8px] font-mono-code text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                    waiterTab === 'floor'
                      ? 'bg-[#FBEFE6] text-[#140905]'
                      : 'bg-[#2A180D] text-[#FBEFE6]/75'
                  }`}
                >
                  Floor ({state.tables.length})
                </button>
              </div>

              {/* Waiter Body */}
              <div className="p-4 flex-1 flex flex-col gap-3.5">
                {/* KITCHEN PASS PICKUP CARDS (Shown in both 'queue' and 'pickup') */}
                {(waiterTab === 'queue' || waiterTab === 'pickup') && (
                  <div className="flex flex-col gap-3" data-testid="waiter-pickup-list">
                    <div className="flex items-center justify-between text-[11px] font-mono-code text-[#C4F042]">
                      <span>Kitchen Pass Pickup ({readyOrders.length} Ready)</span>
                      <span>Priority 1</span>
                    </div>

                    {readyOrders.length === 0 ? (
                      <div className="p-4 rounded-[14px] bg-[#1A0C06] border border-[#2A180D] text-[12px] text-[#FBEFE6]/70">
                        No dishes waiting at the kitchen pass right now. When Kitchen marks a
                        ticket Ready, it appears here immediately.
                      </div>
                    ) : (
                      readyOrders.map((ord) => (
                        <div
                          key={ord.id}
                          data-testid={`waiter-ready-ticket-${ord.ticketNumber.replace('#', '')}`}
                          className="p-4 rounded-[16px] bg-[#23140B] border-2 border-[#C4F042] flex flex-col gap-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-mono-code text-[11px] font-bold text-[#C4F042]">
                                Ready at Kitchen Pass · Pickup Now
                              </div>
                              <div className="font-mono-code font-bold text-[18px] text-[#FFFFFF] mt-0.5 tabular-nums">
                                {ord.ticketNumber} · Table {ord.tableNumber}
                              </div>
                            </div>
                            <span className="font-mono-code text-[14px] font-bold text-[#C4F042] tabular-nums">
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
                                <span className="font-mono-code text-[#FBEFE6]/70 tabular-nums">
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
                            className="w-full h-11 rounded-[10px] bg-[#C4F042] hover:bg-[#b2df2f] text-[#140905] font-mono-code font-bold text-[12px] uppercase tracking-wider cursor-pointer"
                          >
                            ✓ Deliver &amp; Mark Served at Table {ord.tableNumber}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TABLE CALLS CARDS (Shown in both 'queue' and 'calls') */}
                {(waiterTab === 'queue' || waiterTab === 'calls') && (
                  <div className="flex flex-col gap-3" data-testid="waiter-calls-list">
                    <div className="flex items-center justify-between text-[11px] font-mono-code text-[#FF8741]">
                      <span>Guest Table Calls ({pendingCalls.length} Active)</span>
                      <span>Level 2 Assisted</span>
                    </div>

                    {state.waiterCalls.length === 0 ? (
                      <div className="p-4 rounded-[14px] bg-[#1A0C06] border border-[#2A180D] text-[12px] text-[#FBEFE6]/70">
                        No active waiter calls right now.
                      </div>
                    ) : (
                      state.waiterCalls.map((call) => (
                        <div
                          key={call.id}
                          className={`p-4 rounded-[16px] border flex flex-col gap-2.5 ${
                            call.status === 'pending'
                              ? 'bg-[#2A180D] border-[#E8500C]'
                              : 'bg-[#1A0C06] border-[#2A180D]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-mono-code text-[11px] text-[#FF8741]">
                                {call.status === 'pending'
                                  ? 'Guest Calling Waiter'
                                  : 'Claimed · Walking to Table'}
                              </div>
                              <div className="font-bold text-[17px] mt-0.5">
                                Table {call.tableNumber}
                              </div>
                            </div>
                            <span className="font-mono-code text-[13px] font-bold text-[#C4F042] tabular-nums">
                              {state.currencySymbol}
                              {call.cartTotal}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-[10px] bg-[#140905] text-[12px] text-[#FBEFE6]/90">
                            {call.cartSnapshot.length > 0
                              ? call.cartSnapshot
                                  .map((i) => `${i.qty}x ${i.dish.name}`)
                                  .join(', ')
                              : 'Guest requested waiter assistance at table'}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {call.status === 'pending' && (
                              <button
                                type="button"
                                data-testid={`waiter-ack-${call.tableNumber}-btn`}
                                onClick={() => handleWaiterAcknowledge(call.id)}
                                className="flex-1 h-10 px-3 rounded-[10px] bg-[#C4F042] text-[#140905] font-mono-code font-bold text-[11px] uppercase cursor-pointer whitespace-nowrap"
                              >
                                On My Way →
                              </button>
                            )}
                            {call.cartSnapshot.length > 0 && call.status !== 'completed' && (
                              <button
                                type="button"
                                data-testid={`waiter-send-call-order-${call.tableNumber}-btn`}
                                onClick={() =>
                                  handlePlaceAssistedOrder(call.tableNumber, call.cartSnapshot)
                                }
                                className="flex-1 h-10 px-3 rounded-[10px] bg-[#E8500C] text-[#FBEFE6] font-mono-code font-bold text-[11px] uppercase cursor-pointer whitespace-nowrap"
                              >
                                Send Cart to Kitchen →
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* FLOOR MAP & ASSISTED ORDER PAD IN WAITER APP */}
                {waiterTab === 'floor' && (
                  <TopDownFloorMap
                    tables={state.tables}
                    activeTable={state.activeTable}
                    currencySymbol={state.currencySymbol}
                    orders={state.orders}
                    waiterCalls={state.waiterCalls}
                    dishes={state.dishes}
                    darkTheme
                    onSelectTable={(tableNumber) =>
                      setState((prev) => ({ ...prev, activeTable: tableNumber }))
                    }
                    onAcknowledgeCall={handleWaiterAcknowledge}
                    onServeOrder={handleWaiterServeOrder}
                    onPlaceAssistedOrder={handlePlaceAssistedOrder}
                  />
                )}
              </div>
            </section>
          )}

          {/* =====================================================================
              SURFACE 3: KITCHEN & RECEPTION KDS APP (com.buildbros.kitchen)
              Direct 4-Stage KDS Board + Interactive Dish Prep Checklist
             ===================================================================== */}
          {(view === 'split-suite' || view === 'kitchen-apk') && (
            <section
              aria-label="Kitchen and Reception KDS Android APK"
              className={`bg-[#FFFFFF] text-[#1A0C06] overflow-hidden flex flex-col ${
                DEDICATED_APK_ROLE
                  ? 'min-h-screen border-0'
                  : 'rounded-[22px] border border-[#E3D9D3]'
              }`}
              data-testid="surface-kitchen-apk"
            >
              <div className="bg-[#140905] text-[#FBEFE6] px-4 py-4 border-b border-[#2A180D] flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono-code text-[11px] text-[#C4F042]">
                    Kitchen Pass KDS · {activeKitchenOrders.length} Active Tickets
                  </div>
                  <h3 className="text-[18px] font-bold text-[#FBEFE6] m-0 mt-0.5">
                    4-Stage Culinary Pass
                  </h3>
                </div>

                <button
                  type="button"
                  data-testid="kitchen-spawn-ticket-btn"
                  onClick={handleSpawnFreshKitchenTicket}
                  className="px-3 py-1.5 rounded-[8px] bg-[#2A180D] hover:bg-[#E8500C] text-[#C4F042] hover:text-[#FFFFFF] font-mono-code text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  + New Test Ticket
                </button>
              </div>

              <div className="p-4 flex-1 flex flex-col gap-4">
                {state.orders.map((ord) => {
                  const stages: Array<KitchenOrder['status']> = [
                    'new',
                    'cooking',
                    'ready',
                    'served',
                  ];
                  const checkedIds = ord.checkedItemIds || [];
                  return (
                    <div
                      key={ord.id}
                      data-testid={`kitchen-ticket-${ord.ticketNumber.replace('#', '')}`}
                      className={`p-4 rounded-[18px] border flex flex-col gap-3 ${
                        ord.status === 'ready'
                          ? 'bg-[#F4FCE3] border-[#84CC16]'
                          : ord.status === 'served'
                          ? 'bg-[#F3ECE5]/60 border-[#E3D9D3] opacity-65'
                          : 'bg-[#F7F2ED] border-[#E3D9D3]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono-code text-[11px] text-[#6C625C] tabular-nums">
                            Table {ord.tableNumber} · {ord.createdAt}
                          </div>
                          <div className="font-mono-code font-bold text-[19px] text-[#140905] tabular-nums">
                            {ord.ticketNumber}
                          </div>
                        </div>

                        <span className="font-mono-code text-[12px] font-bold uppercase text-[#C03E0A]">
                          {ord.status}
                        </span>
                      </div>

                      {/* Direct 4-Stage KDS Selector Buttons */}
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

                      {/* Interactive Dish Prep Checklist (Tap to check off plated dishes) */}
                      <div className="p-3 rounded-[12px] bg-[#FFFFFF] border border-[#E3D9D3] flex flex-col gap-1.5 text-[13px]">
                        {ord.items.map((item) => {
                          const isChecked = checkedIds.includes(item.dish.id);
                          return (
                            <button
                              key={item.dish.id}
                              type="button"
                              onClick={() =>
                                handleKitchenToggleItemCheck(ord.id, item.dish.id)
                              }
                              className="w-full flex items-center justify-between text-left py-1 cursor-pointer hover:opacity-80"
                            >
                              <span
                                className={`font-semibold ${
                                  isChecked ? 'line-through text-[#6C625C]' : 'text-[#1A0C06]'
                                }`}
                              >
                                <strong className="text-[#C03E0A] font-mono-code mr-1">
                                  {isChecked ? '✓' : `${item.qty}×`}
                                </strong>{' '}
                                {item.dish.name}
                              </span>
                              <span className="font-mono-code text-[12px] text-[#6C625C] tabular-nums">
                                {state.currencySymbol}
                                {item.dish.price * item.qty}
                              </span>
                            </button>
                          );
                        })}
                        {ord.notes && (
                          <div className="pt-1.5 mt-1 border-t border-[#E3D9D3] text-[11px] text-[#C03E0A] font-medium">
                            Note: {ord.notes}
                          </div>
                        )}
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
                              ? 'bg-[#C4F042] hover:bg-[#b2df2f] text-[#140905] border border-[#140905]'
                              : 'bg-[#140905] hover:bg-[#E8500C] text-[#FBEFE6]'
                          }`}
                        >
                          {ord.status === 'new'
                            ? `Start Cooking ${ord.ticketNumber} →`
                            : ord.status === 'cooking'
                            ? `Mark Dish Ready (Alert Waiter App) →`
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
