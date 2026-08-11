import { getSettings } from './permits';
import { KioskPlugin } from './kiosk-plugin';

const DEFAULT_INTERVAL_MINUTES = 10;
const DEFAULT_MANIFEST_URL = '/version.json';
const DEFAULT_REBOOT_DELAY_MS = 15000;

let updaterIntervalId = null;
let checkInFlight = false;

function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asTrimmedString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function compareSemverLike(a, b) {
  const aParts = asTrimmedString(a).split('.').map((p) => parseInt(p, 10));
  const bParts = asTrimmedString(b).split('.').map((p) => parseInt(p, 10));
  const maxLen = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLen; i += 1) {
    const av = Number.isFinite(aParts[i]) ? aParts[i] : 0;
    const bv = Number.isFinite(bParts[i]) ? bParts[i] : 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

async function getInstalledAppInfo() {
  try {
    const info = await KioskPlugin.getAppInfo();
    return {
      versionCode: parseNumber(info?.versionCode),
      versionName: asTrimmedString(info?.versionName),
      packageName: asTrimmedString(info?.packageName),
    };
  } catch {
    const settings = await getSettings();
    return {
      versionCode: parseNumber(settings.appVersionCode),
      versionName: asTrimmedString(settings.appVersion),
      packageName: '',
    };
  }
}

function shouldInstallUpdate(installed, manifest) {
  const targetVersionCode = parseNumber(manifest?.versionCode);
  const targetVersionName = asTrimmedString(manifest?.versionName || manifest?.version);

  if (targetVersionCode !== null && installed.versionCode !== null) {
    return targetVersionCode > installed.versionCode;
  }

  if (targetVersionName && installed.versionName) {
    return compareSemverLike(targetVersionName, installed.versionName) > 0;
  }

  return false;
}

function getVersionTag(manifest) {
  const vc = parseNumber(manifest?.versionCode);
  if (vc !== null) return `vc:${vc}`;
  const vn = asTrimmedString(manifest?.versionName || manifest?.version);
  return vn ? `vn:${vn}` : '';
}

async function fetchUpdateManifest(url) {
  const res = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) throw new Error(`Manifest request failed (${res.status})`);
  return await res.json();
}

async function installUpdate(manifest, settings) {
  const apkUrl = asTrimmedString(manifest?.apkUrl);
  if (!apkUrl) throw new Error('Manifest missing apkUrl');

  const owner = await KioskPlugin.isDeviceOwner();
  if (!owner?.isDeviceOwner) {
    throw new Error('Device is not provisioned as Device Owner');
  }

  try {
    await KioskPlugin.allowLockTaskForSelf();
  } catch {}

  await KioskPlugin.installApkSilent({
    url: apkUrl,
    fallbackInteractive: false,
  });

  const rebootAfterInstall = manifest?.rebootAfterInstall !== false;
  if (!rebootAfterInstall) return;

  const rebootDelayMs = parseNumber(manifest?.rebootDelayMs)
    || parseNumber(settings.updateRebootDelayMs)
    || DEFAULT_REBOOT_DELAY_MS;

  window.setTimeout(async () => {
    try {
      await KioskPlugin.rebootApp();
    } catch {
      window.location.reload();
    }
  }, rebootDelayMs);
}

async function runUpdateCheckOnce() {
  if (checkInFlight || typeof window === 'undefined') return;
  checkInFlight = true;

  try {
    const settings = await getSettings();
    const manifestUrl = asTrimmedString(settings.updateManifestUrl) || DEFAULT_MANIFEST_URL;
    const manifest = await fetchUpdateManifest(manifestUrl);

    const installed = await getInstalledAppInfo();
    const versionTag = getVersionTag(manifest);
    if (!versionTag) return;

    const lastAttemptTag = localStorage.getItem('kiosk_last_update_attempt');
    if (lastAttemptTag === versionTag) return;

    if (!shouldInstallUpdate(installed, manifest)) return;

    localStorage.setItem('kiosk_last_update_attempt', versionTag);
    await installUpdate(manifest, settings);
  } catch {
    // Never crash kiosk flow because updater failed.
  } finally {
    checkInFlight = false;
  }
}

export function startAutoUpdater() {
  if (typeof window === 'undefined') return () => {};

  if (updaterIntervalId) {
    window.clearInterval(updaterIntervalId);
    updaterIntervalId = null;
  }

  runUpdateCheckOnce().catch(() => {});

  getSettings()
    .then((settings) => {
      const mins = parseNumber(settings.updateCheckMinutes) || DEFAULT_INTERVAL_MINUTES;
      const intervalMs = Math.max(1, mins) * 60 * 1000;
      updaterIntervalId = window.setInterval(() => {
        runUpdateCheckOnce().catch(() => {});
      }, intervalMs);
    })
    .catch(() => {
      updaterIntervalId = window.setInterval(() => {
        runUpdateCheckOnce().catch(() => {});
      }, DEFAULT_INTERVAL_MINUTES * 60 * 1000);
    });

  // Also check immediately after each successful heartbeat.
  const onHeartbeat = () => { runUpdateCheckOnce().catch(() => {}); };
  window.addEventListener('kiosk:heartbeat_ok', onHeartbeat);

  return () => {
    if (updaterIntervalId) {
      window.clearInterval(updaterIntervalId);
      updaterIntervalId = null;
    }
    window.removeEventListener('kiosk:heartbeat_ok', onHeartbeat);
  };
}
