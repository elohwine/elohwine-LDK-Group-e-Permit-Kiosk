// Safe client-side PWA bootstrapping: periodic sync and notifications
export function initPWAClient() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.ready.then(async (reg) => {
    // Periodic Background Sync registration (best-effort)
    try {
      if ('periodicSync' in reg) {
        const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (status.state === 'granted' || status.state === 'prompt') {
          await reg.periodicSync.register('epermit-update', { minInterval: 60 * 60 * 1000 }); // 1 hour
        }
      }
    } catch {}

    // Push Notification permission (best-effort; requires VAPID/server)
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      // Note: actual subscription to push service requires app server keys (VAPID)
    } catch {}
  });
}
