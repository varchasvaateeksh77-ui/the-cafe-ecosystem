import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const URGENT_CHANNEL_ID = 'buildbros_urgent_alerts';
let channelInitialized = false;

export async function initNativeNotifications(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
      if (!channelInitialized) {
        await LocalNotifications.createChannel({
          id: URGENT_CHANNEL_ID,
          name: 'Urgent Waiter & Kitchen Alerts',
          description: 'High-priority table calls and kitchen pass ready notifications',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#E8500C',
        });
        channelInitialized = true;
      }
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  } catch {
    // Ignore permission errors in headless/restricted environments
  }
}

export async function triggerUrgentDeviceNotification(
  title: string,
  body: string
): Promise<void> {
  // 1. Trigger Vibration (Native Haptics + Navigator Vibrate fallback)
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.vibrate({ duration: 500 });
      window.setTimeout(() => {
        Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      }, 300);
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([0, 400, 200, 400]);
    }
  } catch {
    // Ignore vibration errors
  }

  // 2. Trigger Real Native Android Status-Bar / Heads-Up Notification
  try {
    if (Capacitor.isNativePlatform()) {
      await initNativeNotifications();
      const notificationId = Math.floor(1000 + Math.random() * 900000);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title,
            body,
            channelId: URGENT_CHANNEL_ID,
            schedule: { at: new Date(Date.now() + 150) },
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#E8500C',
          },
        ],
      });
      return;
    }

    // Browser Notification Fallback
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      new Notification(title, {
        body,
        tag: `bb-${Date.now()}`,
      });
    }
  } catch {
    // Ignore notification schedule error
  }
}
