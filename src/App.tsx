import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CafeEcosystemState,
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
import {
  computeAdaptiveSyncIntervalMs,
  shouldCheckOtaOnResume,
  useShiftWakeLock,
} from './lib/batteryWakeLock';
import { ThemeCataloguePage } from './catalogue/ThemeCataloguePage';
import { LiveThemeInstance } from './catalogue/LiveThemeInstance';
import { ThemeId } from './catalogue/themeCatalogData';
import { soundFX, useSoundEffects } from './lib/soundEffects';
import {
  initNativeNotifications,
  triggerUrgentDeviceNotification,
} from './lib/nativeNotifications';
import { GuestMenuSurface } from './components/GuestMenuSurface';
import { WaiterHandheldSurface } from './components/WaiterHandheldSurface';
import { KitchenKdsSurface } from './components/KitchenKdsSurface';
import { OwnerStudioSurface } from './components/OwnerStudioSurface';

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

function resolveQueryApkMode(): 'guest' | 'waiter' | 'kitchen' | 'admin' | undefined {
  if (typeof window === 'undefined') return undefined;
  const params = new URLSearchParams(window.location.search);
  const apk = params.get('apk');
  if (apk === 'waiter' || apk === 'kitchen' || apk === 'admin' || apk === 'guest') {
    return apk;
  }
  if (params.get('table')) return 'guest';
  return undefined;
}

const DEDICATED_APK_ROLE = resolveDedicatedApkRole();
const INITIAL_QUERY_APK_MODE = resolveQueryApkMode();

function getInitialViewFromUrl(): ActiveWorkspaceView {
  if (DEDICATED_APK_ROLE === 'waiter') return 'waiter-apk';
  if (DEDICATED_APK_ROLE === 'kitchen') return 'kitchen-apk';
  if (DEDICATED_APK_ROLE === 'admin') return 'admin-apk';

  if (INITIAL_QUERY_APK_MODE === 'waiter') return 'waiter-apk';
  if (INITIAL_QUERY_APK_MODE === 'kitchen') return 'kitchen-apk';
  if (INITIAL_QUERY_APK_MODE === 'admin') return 'admin-apk';
  if (INITIAL_QUERY_APK_MODE === 'guest') return 'guest-web';
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

export default function App() {
  const [state, setState] = useState<CafeEcosystemState>(() => createHydratedInitialState());
  const [view, setView] = useState<ActiveWorkspaceView>(() => getInitialViewFromUrl());
  const [liveToast, setLiveToast] = useState<{ title: string; body: string } | null>(null);
  const [isPushingOta, setIsPushingOta] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  );

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
  const wakeLock = useShiftWakeLock(
    DEDICATED_APK_ROLE === 'waiter' || view === 'waiter-apk' || view === 'split-suite'
  );

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const stateRef = useRef<CafeEcosystemState>(state);
  const stateVersionRef = useRef<number>(state.stateVersion || 1);
  const otaVersionRef = useRef<number>(state.otaVersion || 242);
  const lastOtaCheckMsRef = useRef<number>(0);
  const lastProcessedAlertIdRef = useRef<string | null>(state.lastAlert?.id || null);

  useEffect(() => {
    stateRef.current = state;
    stateVersionRef.current = state.stateVersion || 1;
    otaVersionRef.current = state.otaVersion || 242;
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

      if ((incoming.otaVersion || 0) > prevOta) {
        soundFX.play('served');
        setLiveToast({
          title: `Live OTA Update v${incoming.otaVersion} Applied`,
          body: 'Updated over the air without re-downloading APK.',
        });
        window.setTimeout(() => setLiveToast(null), 4000);
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
          } else if (alert.title.includes('Waiter')) {
            soundFX.play('waiterCall');
          } else {
            soundFX.play('ticketSent');
          }

          setLiveToast({ title: alert.title, body: alert.body });
          window.setTimeout(() => setLiveToast(null), 4500);
          triggerUrgentDeviceNotification(alert.title, alert.body);
        }
      }
    },
    [view]
  );

  // Check OTA manifest throttled (at boot or >15 min foreground resume to save battery)
  const checkOtaThrottled = useCallback((activeFlag: { current: boolean }) => {
    const now = Date.now();
    if (!shouldCheckOtaOnResume(lastOtaCheckMsRef.current, now)) return;
    lastOtaCheckMsRef.current = now;

    fetchOtaManifest().then((manifest) => {
      if (!activeFlag.current || !manifest) return;
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
  }, []);

  // Battery-Conscious Event-Driven Sync:
  // Zero periodic HTTP timers when WebSocket is active or app is backgrounded.
  useEffect(() => {
    const activeRef = { current: true };

    fetchCloudEcosystemState().then((remote) => {
      if (activeRef.current && remote) {
        applyIncomingRemoteState(remote);
      }
    });
    checkOtaThrottled(activeRef);

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
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setState((prev) => ({ ...prev, realtimeConnected: false }));
        }
      });

    channelRef.current = channel;

    const handleVisibility = () => {
      const visibleNow = document.visibilityState === 'visible';
      setIsVisible(visibleNow);
      if (visibleNow) {
        channel.send({
          type: 'broadcast',
          event: 'sync_request',
          payload: { fromVersion: stateVersionRef.current },
        });
        checkOtaThrottled(activeRef);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      activeRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [applyIncomingRemoteState, checkOtaThrottled]);

  // Adaptive HTTP fallback ONLY when foregrounded AND WebSocket is disconnected
  useEffect(() => {
    const intervalMs = computeAdaptiveSyncIntervalMs({
      isVisible,
      realtimeConnected: state.realtimeConnected,
      lowBatteryMode: wakeLock.lowBatteryMode,
    });
    if (!intervalMs) return;

    const id = window.setInterval(() => {
      fetchCloudEcosystemState().then((remote) => {
        if (remote) applyIncomingRemoteState(remote);
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [isVisible, state.realtimeConnected, wakeLock.lowBatteryMode, applyIncomingRemoteState]);

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
      const alertId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const nextState: CafeEcosystemState = {
        ...baseNext,
        stateVersion: nextVersion,
        updatedAtMs: Date.now(),
        lastSyncLatencyMs: latencyMs,
        pushEvents: alertInfo
          ? [
              {
                id: alertId,
                timestamp: now,
                targetApk: alertInfo.targetApk,
                channel: alertInfo.channel,
                title: alertInfo.title,
                body: alertInfo.body,
                latencyMs,
              },
              ...baseNext.pushEvents.slice(0, 19),
            ]
          : baseNext.pushEvents,
        lastAlert: alertInfo
          ? {
              id: alertId,
              targetApk: alertInfo.targetApk,
              title: alertInfo.title,
              body: alertInfo.body,
              createdAtMs: Date.now(),
            }
          : baseNext.lastAlert,
      };

      saveCloudEcosystemState(nextState);
      channelRef.current?.send({
        type: 'broadcast',
        event: 'state_sync',
        payload: nextState,
      });

      if (alertInfo?.notifyCurrentDeviceToo) {
        lastProcessedAlertIdRef.current = alertId;
        setLiveToast({ title: alertInfo.title, body: alertInfo.body });
        window.setTimeout(() => setLiveToast(null), 4000);
        triggerUrgentDeviceNotification(alertInfo.title, alertInfo.body);
      }

      return nextState;
    });
  };

  // Push Live OTA Update across connected devices
  const handlePushLiveOtaUpdate = async () => {
    setIsPushingOta(true);
    const nextOtaVer = Math.max(state.otaVersion || 242, otaVersionRef.current) + 1;
    otaVersionRef.current = nextOtaVer;
    soundFX.play('served');

    await pushOtaManifestUpdate(
      nextOtaVer,
      `Live Over-The-Air update v${nextOtaVer} from Owner Studio`
    );

    channelRef.current?.send({
      type: 'broadcast',
      event: 'ota_push',
      payload: { otaVersion: nextOtaVer },
    });

    commitAndSync(
      (prev) => ({ ...prev, otaVersion: nextOtaVer }),
      {
        targetApk: 'com.buildbros.waiter',
        channel: 'ota:manifest_update',
        title: `Live OTA Update v${nextOtaVer} Pushed`,
        body: 'Connected staff apps will refresh live over the air.',
        notifyCurrentDeviceToo: true,
      }
    );
    setIsPushingOta(false);
  };

  // Cart & Order Action Handlers
  const handleAddToCart = (dish: DishItem) => {
    if (!dish.isAvailable) return;
    soundFX.play('tap');
    setState((prev) => {
      const existing = prev.cart.find((c) => c.dish.id === dish.id);
      const nextCart = existing
        ? prev.cart.map((c) => (c.dish.id === dish.id ? { ...c, qty: c.qty + 1 } : c))
        : [...prev.cart, { dish, qty: 1 }];
      const next = {
        ...prev,
        cart: nextCart,
        tables: prev.tables.map((t) =>
          t.tableNumber === prev.activeTable && t.status === 'free'
            ? { ...t, status: 'browsing' as const, updatedAt: 'Just now' }
            : t
        ),
      };
      saveCloudEcosystemState(next);
      return next;
    });
  };

  const handleRemoveFromCart = (dishId: string) => {
    soundFX.play('tap');
    setState((prev) => {
      const nextCart = prev.cart
        .map((c) => (c.dish.id === dishId ? { ...c, qty: c.qty - 1 } : c))
        .filter((c) => c.qty > 0);
      const next = { ...prev, cart: nextCart };
      saveCloudEcosystemState(next);
      return next;
    });
  };

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
        body: `Tray (${state.currencySymbol}${total}): ${itemsSummary}`,
        notifyCurrentDeviceToo: true,
      }
    );
  };

  const handleGuestPlaceOrder = (notes: string) => {
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
            notes: notes.trim(),
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
  };

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
            notes: 'Placed by Waiter at Table',
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
          t.tableNumber === tableNum ? { ...t, status: 'ordering', updatedAt: 'Just now' } : t
        ),
      }),
      {
        targetApk: 'guest-web',
        channel: 'supabase_realtime:waiter_calls',
        title: `Waiter On My Way → Table ${tableNum}`,
        body: `Staff #04 claimed Table ${tableNum} call.`,
        notifyCurrentDeviceToo: false,
      }
    );
  };

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

  const handleKitchenSetOrderStatus = (
    orderId: string,
    nextStatus: KitchenOrder['status']
  ) => {
    const target = state.orders.find((o) => o.id === orderId);
    if (!target) return;

    const isReady = nextStatus === 'ready';
    soundFX.play(isReady ? 'kitchenReady' : nextStatus === 'served' ? 'served' : 'tap');
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

    commitAndSync((prev) => ({
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
        ...prev.orders,
      ],
    }));
  };

  const handleAdminSavePrice = (dishId: string, price: number) => {
    soundFX.play('tap');
    commitAndSync((prev) => applyAdminDishPatch(prev, dishId, { price }));
    channelRef.current?.send({
      type: 'broadcast',
      event: 'dish_patch',
      payload: { dishId, patch: { price } },
    });
  };

  const handleAdminToggle86 = (dishId: string) => {
    soundFX.play('tap');
    const target = state.dishes.find((d) => d.id === dishId);
    const nextAvailable = !target?.isAvailable;
    commitAndSync((prev) => applyAdminDishPatch(prev, dishId, { isAvailable: nextAvailable }));
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
    commitAndSync(
      (prev) => ({ ...prev, serviceLevel: level }),
      {
        targetApk: 'guest-web',
        channel: 'supabase_realtime:venues',
        title: `Service Level Switched → Level ${level}`,
        body:
          level === 1
            ? 'All tables switched to browse menu'
            : level === 2
            ? 'Tables enabled Swipe Deck + Call Waiter'
            : 'Tables enabled Swipe Deck + Send Order',
        notifyCurrentDeviceToo: false,
      }
    );
  };

  if (view === 'theme-catalogue') {
    return (
      <div>
        <div className="bg-[#FFFFFF] border-b border-[#E4E0D8] px-6 py-3 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#181615]">
            Build Bros · 4-Theme Guest Menu Catalogue
          </span>
          <button
            type="button"
            onClick={() => setView('split-suite')}
            className="px-4 py-1.5 rounded-[8px] bg-[#181615] text-[#FAF8F5] text-[12px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            Back to Floor OS
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

  const readyCount = state.orders.filter((o) => o.status === 'ready').length;
  const shiftRevenue = state.tables.reduce((acc, t) => acc + (t.cartTotal || 0), 0);
  const isFocusedDeviceShell =
    Boolean(DEDICATED_APK_ROLE) ||
    (Boolean(INITIAL_QUERY_APK_MODE) && view !== 'split-suite');

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#181615] flex flex-col">
      <a href="#main-workspace" className="skip-link">
        Skip to main workspace
      </a>

      {/* Urgent Cross-Device Notification Banner */}
      {liveToast && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="live-push-toast"
          className="fixed top-4 left-4 right-4 z-50 max-w-[480px] mx-auto p-3.5 rounded-[12px] bg-[#181615] text-[#FAF8F5] border border-[#D9480F] flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="text-[11px] font-mono-code text-[#FAF8F5]/75">
              Live Floor Alert · OTA v{state.otaVersion || 242}
            </div>
            <div className="font-semibold text-[14px] text-[#FFFFFF] truncate mt-0.5">
              {liveToast.title}
            </div>
            <div className="text-[12px] text-[#FAF8F5]/80 truncate">{liveToast.body}</div>
          </div>
          <button
            type="button"
            onClick={() => setLiveToast(null)}
            className="px-3 py-1.5 rounded-[8px] bg-[#292524] text-[#FAF8F5] text-[12px] font-medium cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Strict 3-Zone Top Bar (Hidden when inside compiled APK or scanned QR mobile surface) */}
      {!isFocusedDeviceShell && (
        <header className="bg-[#FFFFFF] border-b border-[#E4E0D8] px-6 py-3.5 sticky top-0 z-40">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-8">
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                setView('split-suite');
              }}
              className="font-display text-[20px] font-semibold tracking-tight text-[#181615] no-underline whitespace-nowrap shrink-0"
            >
              Build Bros OS
            </a>

            <nav
              aria-label="Product surfaces"
              className="hidden md:flex items-center gap-7 text-[13px] font-medium"
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
                  className={`cursor-pointer transition-colors whitespace-nowrap shrink-0 pb-1 border-b-2 ${
                    view === tab.id
                      ? 'text-[#181615] border-[#D9480F] font-semibold'
                      : 'text-[#5C5852] border-transparent hover:text-[#181615]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center shrink-0">
              <button
                type="button"
                data-testid="push-live-ota-btn"
                onClick={handlePushLiveOtaUpdate}
                disabled={isPushingOta}
                className="min-h-[38px] px-4 rounded-[8px] bg-[#D9480F] hover:bg-[#B83B0A] text-[#FFFFFF] text-[12px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {isPushingOta ? 'Pushing...' : `Push OTA (v${state.otaVersion || 242})`}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Compact Venue Context Strip (Suite Preview Only) */}
      {!isFocusedDeviceShell && (
        <div className="bg-[#EFECE6] border-b border-[#E4E0D8] px-4 sm:px-6 py-2.5">
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 text-[12px] text-[#5C5852]">
              <div className="flex md:hidden items-center gap-1 overflow-x-auto">
                {(
                  [
                    { id: 'split-suite', label: 'Suite' },
                    { id: 'guest-web', label: 'Guest' },
                    { id: 'waiter-apk', label: 'Waiter' },
                    { id: 'kitchen-apk', label: 'KDS' },
                    { id: 'admin-apk', label: 'Owner' },
                  ] as Array<{ id: ActiveWorkspaceView; label: string }>
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setView(t.id)}
                    className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                      view === t.id
                        ? 'bg-[#181615] text-[#FAF8F5]'
                        : 'bg-[#FFFFFF] text-[#5C5852]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <span className="font-semibold text-[#181615]">{state.venueName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-code">Table {state.activeTable}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-code">
                Shift {state.currencySymbol}
                {shiftRevenue}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#15803D]">{readyCount} ready at pass</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-1 bg-[#FFFFFF] border border-[#E4E0D8] p-0.5 rounded-[8px]"
                role="group"
                aria-label="Venue Service Level"
              >
                {([1, 2, 3] as ServiceLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    data-testid={`switch-level-${lvl}-btn`}
                    onClick={() => handleSwitchLevel(lvl)}
                    className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
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
                onClick={toggleSound}
                aria-pressed={soundEnabled}
                className="min-h-[32px] px-3 rounded-[8px] bg-[#FFFFFF] border border-[#E4E0D8] text-[#181615] text-[11px] font-medium cursor-pointer whitespace-nowrap"
              >
                {soundEnabled ? 'Chime: ON' : 'Chime: OFF'}
              </button>

              <button
                type="button"
                onClick={() => setView('theme-catalogue')}
                className="min-h-[32px] px-3 rounded-[8px] bg-[#FFFFFF] border border-[#E4E0D8] hover:border-[#181615] text-[#181615] text-[11px] font-semibold cursor-pointer whitespace-nowrap"
              >
                4-Theme Catalogue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <main
        id="main-workspace"
        className={`flex-1 w-full mx-auto flex flex-col gap-6 ${
          isFocusedDeviceShell
            ? 'max-w-[540px] p-0'
            : 'max-w-[1440px] px-4 sm:px-6 py-5 sm:py-6'
        }`}
      >
        {view === 'admin-apk' ? (
          <OwnerStudioSurface
            state={state}
            isStandaloneApk={isFocusedDeviceShell}
            isPushingOta={isPushingOta}
            onSwitchLevel={handleSwitchLevel}
            onPushOta={handlePushLiveOtaUpdate}
            onToggleAutoRoute={() =>
              commitAndSync((prev) => ({
                ...prev,
                autoRouteToKitchen: !prev.autoRouteToKitchen,
              }))
            }
            onSavePrice={handleAdminSavePrice}
            onToggle86={handleAdminToggle86}
            onSelectTable={(tableNumber) =>
              setState((prev) => ({ ...prev, activeTable: tableNumber }))
            }
            onAddTable={handleAddFloorTable}
            onAcknowledgeCall={handleWaiterAcknowledge}
            onServeOrder={handleWaiterServeOrder}
            onPlaceAssistedOrder={handlePlaceAssistedOrder}
            onOpenTableGuestMenu={(tableNumber) => {
              soundFX.play('tap');
              setState((prev) => ({ ...prev, activeTable: tableNumber }));
              setView('guest-web');
            }}
          />
        ) : (
          <div
            className={`grid gap-6 items-start ${
              view === 'split-suite'
                ? 'grid-cols-1 lg:grid-cols-3'
                : 'grid-cols-1 max-w-[540px] mx-auto w-full'
            }`}
          >
            {(view === 'split-suite' || view === 'guest-web') && (
              <GuestMenuSurface
                state={state}
                isStandaloneApk={isFocusedDeviceShell}
                onAddToCart={handleAddToCart}
                onRemoveFromCart={handleRemoveFromCart}
                onCallWaiter={handleGuestCallWaiter}
                onPlaceOrder={handleGuestPlaceOrder}
              />
            )}

            {(view === 'split-suite' || view === 'waiter-apk') && (
              <WaiterHandheldSurface
                state={state}
                isStandaloneApk={isFocusedDeviceShell}
                wakeLock={wakeLock}
                onAcknowledgeCall={handleWaiterAcknowledge}
                onServeOrder={handleWaiterServeOrder}
                onPlaceAssistedOrder={handlePlaceAssistedOrder}
                onSelectTable={(tableNumber) =>
                  setState((prev) => ({ ...prev, activeTable: tableNumber }))
                }
                onTestAlert={() => {
                  soundFX.play('kitchenReady');
                  triggerUrgentDeviceNotification(
                    'Waiter Handheld Alert Verified',
                    'Android status-bar notification, wake chime & haptic alert active.'
                  );
                  setLiveToast({
                    title: 'Waiter Push Alert Verified',
                    body: 'Audio chime and native notification active on this device.',
                  });
                  window.setTimeout(() => setLiveToast(null), 3500);
                }}
              />
            )}

            {(view === 'split-suite' || view === 'kitchen-apk') && (
              <KitchenKdsSurface
                state={state}
                isStandaloneApk={isFocusedDeviceShell}
                wakeLock={wakeLock}
                onSetOrderStatus={handleKitchenSetOrderStatus}
                onAdvanceOrder={handleKitchenAdvance}
                onToggleItemCheck={handleKitchenToggleItemCheck}
                onSpawnTestTicket={handleSpawnFreshKitchenTicket}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
