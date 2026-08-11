/**
 * Capacitor plugin bridge for native Android kiosk operations.
 * - rebootApp(): kills the Android process (proper reboot, not just WebView reload)
 * - installApk({ url }): downloads and launches the system APK installer
 *
 * Web stubs are no-ops so the app works in browser dev mode without crashing.
 * The actual Java implementation lives in android/app/src/main/java/com/ldk/kiosk/KioskPlugin.java
 */
import { registerPlugin } from '@capacitor/core';

export const KioskPlugin = registerPlugin('Kiosk', {
  web: {
    rebootApp:  async () => { console.warn('[KioskPlugin/web] rebootApp — falling back to window.location.reload()'); window.location.reload(); },
    installApk: async ({ url } = {}) => { console.warn('[KioskPlugin/web] installApk noop — url:', url); },
    isDeviceOwner: async () => ({ isDeviceOwner: false }),
    getAppInfo: async () => ({ packageName: '', versionCode: 0, versionName: '0.0.0' }),
    allowLockTaskForSelf: async () => ({ allowlisted: false }),
    installApkSilent: async ({ url, fallbackInteractive = true } = {}) => {
      console.warn('[KioskPlugin/web] installApkSilent noop — url:', url, 'fallbackInteractive:', fallbackInteractive);
      return { queued: false, silent: false };
    },
  },
});
