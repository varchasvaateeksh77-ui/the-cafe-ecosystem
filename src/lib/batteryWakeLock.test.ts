import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAdaptiveSyncIntervalMs,
  shouldCheckOtaOnResume,
  resolveWakeLockBannerState,
} from './batteryWakeLock';

test('computeAdaptiveSyncIntervalMs stops all HTTP polling when app is backgrounded or WebSocket is live', () => {
  assert.equal(
    computeAdaptiveSyncIntervalMs({
      isVisible: false,
      realtimeConnected: false,
      lowBatteryMode: false,
    }),
    null
  );
  assert.equal(
    computeAdaptiveSyncIntervalMs({
      isVisible: true,
      realtimeConnected: true,
      lowBatteryMode: false,
    }),
    null
  );
  assert.equal(
    computeAdaptiveSyncIntervalMs({
      isVisible: true,
      realtimeConnected: false,
      lowBatteryMode: true,
    }),
    60000
  );
  assert.equal(
    computeAdaptiveSyncIntervalMs({
      isVisible: true,
      realtimeConnected: false,
      lowBatteryMode: false,
    }),
    30000
  );
});

test('shouldCheckOtaOnResume prevents excessive background network checks within 15-minute cooldown', () => {
  const now = 1_794_560_000_000;
  assert.equal(shouldCheckOtaOnResume(0, now), true);
  assert.equal(shouldCheckOtaOnResume(now - 60_000, now), false);
  assert.equal(shouldCheckOtaOnResume(now - 16 * 60_000, now), true);
});

test('resolveWakeLockBannerState surfaces prompt cleanly for Waiter until acquired or dismissed', () => {
  assert.equal(
    resolveWakeLockBannerState({ supported: true, active: false, dismissed: false, isHidden: false }),
    'prompt'
  );
  assert.equal(
    resolveWakeLockBannerState({ supported: true, active: true, dismissed: false, isHidden: false }),
    'active'
  );
  assert.equal(
    resolveWakeLockBannerState({ supported: true, active: false, dismissed: true, isHidden: false }),
    'dismissed'
  );
  assert.equal(
    resolveWakeLockBannerState({ supported: false, active: false, dismissed: false, isHidden: false }),
    'unsupported'
  );
});
