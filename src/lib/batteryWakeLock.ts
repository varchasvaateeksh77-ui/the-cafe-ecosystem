import { useCallback, useEffect, useRef, useState } from 'react';

export type WakeLockStatus = 'prompt' | 'active' | 'paused_background' | 'dismissed' | 'unsupported';

export interface AdaptiveSyncPolicyInput {
  isVisible: boolean;
  realtimeConnected: boolean;
  lowBatteryMode: boolean;
}

/**
 * Computes HTTP fallback polling interval in ms.
 * Returns null (0 polling) whenever:
 * - Page/APK is backgrounded (`isVisible === false`), preventing Android battery drain.
 * - Supabase Realtime WebSocket is actively subscribed (`realtimeConnected === true`),
 *   relying purely on push events over the open socket.
 * Only polls at a gentle interval when foregrounded AND WebSocket is disconnected.
 */
export function computeAdaptiveSyncIntervalMs(input: AdaptiveSyncPolicyInput): number | null {
  if (!input.isVisible) return null;
  if (input.realtimeConnected) return null;
  return input.lowBatteryMode ? 60000 : 30000;
}

/**
 * Throttles OTA manifest checks so waking a phone screen repeatedly inside a busy
 * cafe shift doesn't burn cellular/Wi-Fi battery checking GitHub every few seconds.
 */
export function shouldCheckOtaOnResume(
  lastCheckMs: number,
  nowMs: number,
  minIntervalMs = 15 * 60 * 1000
): boolean {
  if (lastCheckMs <= 0) return true;
  return nowMs - lastCheckMs >= minIntervalMs;
}

export function resolveWakeLockBannerState(params: {
  supported: boolean;
  active: boolean;
  dismissed: boolean;
  isHidden: boolean;
}): WakeLockStatus {
  if (!params.supported) return 'unsupported';
  if (params.active) return 'active';
  if (params.dismissed) return 'dismissed';
  if (params.isHidden) return 'paused_background';
  return 'prompt';
}

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
}

export interface UseShiftWakeLockResult {
  status: WakeLockStatus;
  isActive: boolean;
  isSupported: boolean;
  lowBatteryMode: boolean;
  acquireWakeLock: () => Promise<boolean>;
  releaseWakeLock: () => Promise<void>;
  dismissPrompt: () => void;
  setLowBatteryMode: (enabled: boolean) => void;
}

const WAKE_LOCK_PREF_KEY = 'bb_waiter_wakelock_desired';
const LOW_BATTERY_PREF_KEY = 'bb_low_battery_sync';

export function useShiftWakeLock(autoPromptRole: boolean): UseShiftWakeLockResult {
  const isSupported =
    typeof navigator !== 'undefined' &&
    'wakeLock' in navigator &&
    typeof (navigator as unknown as { wakeLock?: { request?: unknown } }).wakeLock?.request ===
      'function';

  const [isActive, setIsActive] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WAKE_LOCK_PREF_KEY) === 'dismissed';
    } catch {
      return false;
    }
  });
  const [lowBatteryMode, setLowBatteryModeState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(LOW_BATTERY_PREF_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [isHidden, setIsHidden] = useState<boolean>(
    typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false
  );

  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const desiredRef = useRef<boolean>(false);

  const acquireWakeLock = useCallback(async (): Promise<boolean> => {
    desiredRef.current = true;
    setDismissed(false);
    try {
      localStorage.setItem(WAKE_LOCK_PREF_KEY, 'desired');
    } catch {
      // Ignore storage error
    }

    if (!isSupported) {
      setIsActive(false);
      return false;
    }

    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        setIsActive(true);
        return true;
      }
      const wakeLockApi = (
        navigator as unknown as {
          wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
        }
      ).wakeLock;
      const sentinel = await wakeLockApi.request('screen');
      sentinelRef.current = sentinel;
      setIsActive(true);
      sentinel.addEventListener?.('release', () => {
        setIsActive(false);
      });
      return true;
    } catch {
      setIsActive(false);
      return false;
    }
  }, [isSupported]);

  const releaseWakeLock = useCallback(async (): Promise<void> => {
    desiredRef.current = false;
    try {
      localStorage.setItem(WAKE_LOCK_PREF_KEY, 'released');
    } catch {
      // Ignore storage error
    }
    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        await sentinelRef.current.release();
      }
    } catch {
      // Ignore release error
    } finally {
      sentinelRef.current = null;
      setIsActive(false);
    }
  }, []);

  const dismissPrompt = useCallback(() => {
    desiredRef.current = false;
    setDismissed(true);
    try {
      localStorage.setItem(WAKE_LOCK_PREF_KEY, 'dismissed');
    } catch {
      // Ignore storage error
    }
  }, []);

  const setLowBatteryMode = useCallback((enabled: boolean) => {
    setLowBatteryModeState(enabled);
    try {
      localStorage.setItem(LOW_BATTERY_PREF_KEY, String(enabled));
    } catch {
      // Ignore storage error
    }
  }, []);

  // Re-acquire Wake Lock automatically if Waiter returns app to foreground & desiredRef is true
  useEffect(() => {
    if (!autoPromptRole) return;
    try {
      if (localStorage.getItem(WAKE_LOCK_PREF_KEY) === 'desired') {
        desiredRef.current = true;
      }
    } catch {
      // Ignore
    }

    const handleVisibility = () => {
      const hiddenNow = document.visibilityState === 'hidden';
      setIsHidden(hiddenNow);
      if (!hiddenNow && desiredRef.current && isSupported) {
        acquireWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [autoPromptRole, isSupported, acquireWakeLock]);

  const status = resolveWakeLockBannerState({
    supported: isSupported,
    active: isActive,
    dismissed,
    isHidden,
  });

  return {
    status,
    isActive,
    isSupported,
    lowBatteryMode,
    acquireWakeLock,
    releaseWakeLock,
    dismissPrompt,
    setLowBatteryMode,
  };
}
