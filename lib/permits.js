import { set, get, del, update, keys } from "idb-keyval";
import { hmacSHA256Hex } from "./crypto";
import QRCode from "qrcode";
// Site-specific config baked in at build time by build-and-sign-apk.sh
// Falls back to an empty object so the app still works without a build step.
import _kioskBuildConfig from "../kiosk.config.json";

const DB_PREFIX = "kiosk_permits:";
const VRM_REGISTRY_KEY = "kiosk_known_vrms";
const SYNC_STATE_KEY = "kiosk_sync_state";
const APPLY_DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const APPLY_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

// Direct backend URL for Capacitor (static export has no Next.js server/rewrites)
const REAL_BACKEND = "https://www.ldkgroup.co.uk/api";
// Detect Capacitor native: window.Capacitor.isNativePlatform() or capacitor:// protocol
function isCapacitor() {
  if (typeof window === 'undefined') return false;
  try { if (window.Capacitor?.isNativePlatform?.()) return true; } catch {}
  return window.location.protocol === 'capacitor:';
}
const DEFAULT_API_BASE = isCapacitor() ? REAL_BACKEND : "/backend-api";
const DEFAULT_KIOSK_KEY = "c88ea0a21ca2dbdc72987b58f9d693f4658e579bf93ca7572b5600c1418a9534";

/** Resolve the auth endpoint — direct backend in Capacitor, Next.js proxy otherwise */
function authUrl() {
  return isCapacitor() ? `${REAL_BACKEND}/kiosk/auth` : "/api/kiosk/auth";
}

/**
 * Detect fetch/network transport failures across browsers and Capacitor WebView.
 * Some Android network failures are plain Error (not TypeError), e.g.
 * "Unable to resolve host".
 */
function isLikelyNetworkError(err) {
  if (!err) return false;
  if (err instanceof TypeError) return true;
  const msg = String(err?.message || err).toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network request failed") ||
    msg.includes("networkerror") ||
    msg.includes("unable to resolve host") ||
    msg.includes("name_not_resolved") ||
    msg.includes("could not resolve host") ||
    msg.includes("err_internet_disconnected") ||
    msg.includes("eai_again")
  );
}

/**
 * Build request headers.
 * - GET requests with kiosk key must NOT include Content-Type (backend rejects them).
 * - Bearer token + Content-Type is always fine.
 * - POST/PUT always need Content-Type.
 */
function kioskHeaders(settings, method = 'POST') {
  const isGet = method.toUpperCase() === 'GET';
  const token = settings.firebaseIdToken ||
    (typeof window !== "undefined" ? localStorage.getItem("kiosk_token") : null);
  const key = settings.kioskApiKey || DEFAULT_KIOSK_KEY;

  if (token) {
    // Bearer works with or without Content-Type for all methods
    return {
      ...(isGet ? {} : { "Content-Type": "application/json" }),
      Authorization: `Bearer ${token}`,
    };
  }
  // Kiosk key: GETs must omit Content-Type or backend returns 401
  return {
    ...(isGet ? {} : { "Content-Type": "application/json" }),
    "X-Kiosk-Key": key,
  };
}

/** Kiosk-key-only headers (no Bearer). Respects GET rule. */
function kioskKeyOnlyHeaders(settings, method = 'POST') {
  const isGet = method.toUpperCase() === 'GET';
  return {
    ...(isGet ? {} : { "Content-Type": "application/json" }),
    "X-Kiosk-Key": settings.kioskApiKey || DEFAULT_KIOSK_KEY,
  };
}

/**
 * Attempt to refresh the Bearer token using stored admin credentials.
 * Returns a fresh settings object with the new token, or null on failure.
 */
let _refreshPromise = null;
async function refreshTokenIfPossible() {
  // Deduplicate concurrent refresh calls
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const settings = await getSettings();
      const email = settings.adminEmail;
      const password = settings._kioskPass;
      if (!email || !password) return null;
      const res = await fetch(authUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.token) return null;
      if (typeof window !== "undefined") {
        localStorage.setItem("kiosk_token", data.token);
      }
      const updated = { ...settings, firebaseIdToken: data.token };
      await saveSettings(updated);
      return updated;
    } catch { return null; }
    finally { _refreshPromise = null; }
  })();
  return _refreshPromise;
}

/**
 * Sign in the kiosk operator via the server-side proxy.
 * POSTs { email, password } → /api/kiosk/auth → returns { token, uid, role, siteIds }.
 * Stores the token in localStorage and in settings.firebaseIdToken.
 */
export async function kioskLogin(email, password) {
  const res = await fetch(authUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  if (typeof window !== "undefined") {
    localStorage.setItem("kiosk_token", data.token);
    // Merge into persisted settings so all subsequent calls pick it up
    try {
      const s = JSON.parse(localStorage.getItem("settings") || "{}");
      s.firebaseIdToken = data.token;
      if (data.uid) s.kioskUid = data.uid;
      if (data.role) s.kioskRole = data.role;
      if (data.siteIds) s.kioskSiteIds = data.siteIds;
      localStorage.setItem("settings", JSON.stringify(s));
    } catch {}
  }
  return data;
}

/** Remove stored kiosk token (logout). */
export function kioskLogout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("kiosk_token");
  try {
    const s = JSON.parse(localStorage.getItem("settings") || "{}");
    delete s.firebaseIdToken;
    delete s.kioskUid;
    delete s.kioskRole;
    delete s.kioskSiteIds;
    localStorage.setItem("settings", JSON.stringify(s));
  } catch {}
}

export async function getSettings() {
  if (typeof window === "undefined") return {};
  // Identity values from kiosk.config.json (baked in per-site at build time).
  // These are used as defaults so the kiosk knows who it is from first boot,
  // without any manual admin setup required.
  const buildCfg = _kioskBuildConfig || {};
  const defaults = {
    mode: "online",
    siteId: buildCfg.siteId || "",
    siteName: buildCfg.siteName || "",
    siteDisplayName: buildCfg.siteName || "",
    defaultHours: buildCfg.defaultHours || 24,
    durationOptions: buildCfg.durationOptions || null,
    reRegisterCooldownMinutes: buildCfg.reRegisterCooldownMinutes || 0,
    permitPrefix: "PERMIT",
    apiBase: DEFAULT_API_BASE, // proxied through Next.js rewrites to avoid CORS
    kioskApiKey: DEFAULT_KIOSK_KEY,
    hmacSecret: "dev-secret",
    qrEnabled: true,
  kioskKeyboardEnabled: true,
  kioskKeyboardAutoOpen: true,
  // Admin/kiosk settings (new)
  paymentsEnabled: true,
  assistantEnabled: false,
  siteIconUrl: "",
  siteIconMaskableUrl: "",
  emailPdfEnabled: false,
  subscriptionEnabled: false,
  subscriptionFrequencies: [], // e.g. ['weekly','monthly']
  updateManifestUrl: '/version.json',
  updateCheckMinutes: 10,
  updateRebootDelayMs: 15000,
  // Kiosk device identity — seeded from build config, overrideable via admin settings
  kioskId: buildCfg.kioskId || "",
  kioskName: buildCfg.kioskName || "",
  kioskLocation: "",
  kioskRegistered: !!(buildCfg.kioskId || buildCfg.kioskName),
  firebaseIdToken: "",
  kioskUid: "",
  adminEmail: "",
  };
  try {
    const s = JSON.parse(localStorage.getItem("settings") || "{}");
    // Build config identity fields always win — localStorage cannot override them.
    // This prevents stale saved settings (e.g. old site name) from persisting
    // after a new per-site APK is installed on the device.
    const buildOverrides = {
      ...(buildCfg.siteId    ? { siteId: buildCfg.siteId }                   : {}),
      ...(buildCfg.siteName  ? { siteName: buildCfg.siteName, siteDisplayName: buildCfg.siteName } : {}),
      ...(buildCfg.kioskId   ? { kioskId: buildCfg.kioskId }                 : {}),
      ...(buildCfg.kioskName ? { kioskName: buildCfg.kioskName }             : {}),
      ...(buildCfg.defaultHours ? { defaultHours: buildCfg.defaultHours }   : {}),
      ...(buildCfg.expiryMode !== undefined ? { expiryMode: buildCfg.expiryMode } : {}),
      ...(buildCfg.reRegisterCooldownMinutes !== undefined ? { reRegisterCooldownMinutes: buildCfg.reRegisterCooldownMinutes } : {}),
      ...(buildCfg.durationOptions !== undefined ? { durationOptions: buildCfg.durationOptions } : {}),
    };
    return { ...defaults, ...s, ...buildOverrides };
  } catch (e) {
    return defaults;
  }
}

export async function saveSettings(s) {
  if (typeof window !== "undefined") {
    localStorage.setItem("settings", JSON.stringify(s));
  }
}

// --- VRM Registry: track every VRM the kiosk has interacted with ---

async function getKnownVRMs() {
  try {
    const stored = await get(VRM_REGISTRY_KEY);
    return Array.isArray(stored) ? stored : [];
  } catch { return []; }
}

async function trackVRM(vrm) {
  if (!vrm) return;
  const norm = (vrm + '').toUpperCase().replace(/\s+/g, '');
  const list = await getKnownVRMs();
  if (list.includes(norm)) return;
  list.push(norm);
  if (list.length > 500) list.splice(0, list.length - 500);
  await set(VRM_REGISTRY_KEY, list);
}

function makeOutboxRequestId(settings) {
  const scope = settings.kioskId || settings.kioskName || settings.siteId || 'kiosk';
  return `${scope}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function parseMaybeIsoDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function saveSyncState(patch = {}) {
  if (typeof window === 'undefined') return;
  try {
    const current = JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || '{}');
    const merged = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(merged));
  } catch {}
}

function getSyncState() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

async function getPendingSyncTelemetry() {
  const ks = await keys();
  let pendingSyncCount = 0;
  let oldestPendingAt = null;

  for (const k of ks) {
    const key = String(k || '');

    if (key.startsWith(DB_PREFIX)) {
      const permit = await get(k);
      if (!permit || permit.mode !== 'offline') continue;
      pendingSyncCount += 1;
      const candidate = parseMaybeIsoDate(permit.queuedAt || permit.createdAt || permit.start || null);
      if (candidate && (!oldestPendingAt || candidate < oldestPendingAt)) {
        oldestPendingAt = candidate;
      }
      continue;
    }

    if (key.startsWith(EXTEND_QUEUE_PREFIX)) {
      const queued = await get(k);
      if (!queued) continue;
      pendingSyncCount += 1;
      const candidate = parseMaybeIsoDate(queued.queuedAt || null);
      if (candidate && (!oldestPendingAt || candidate < oldestPendingAt)) {
        oldestPendingAt = candidate;
      }
    }
  }

  return {
    pendingSyncCount,
    oldestPendingAt: oldestPendingAt ? oldestPendingAt.toISOString() : null,
  };
}

const SITES_CACHE_KEY = 'sites';
const SITES_TTL = 10 * 60 * 1000; // 10 min

/**
 * Fetch the list of sites from the backend.
 * Uses /api/kiosk/manage (GET, Bearer) when there's an admin token,
 * otherwise tries /api/sites (GET, X-Kiosk-Key).
 * Falls back to cached data in localStorage.
 * @param {{ forceRefresh?: boolean }} opts
 */
export async function getSites({ forceRefresh = false } = {}) {
  if (typeof window === 'undefined') return [];
  const settings = await getSettings();

  // Return cache if still fresh and not forcing
  if (!forceRefresh) {
    try {
      const raw = JSON.parse(localStorage.getItem(SITES_CACHE_KEY) || 'null');
      if (raw && Array.isArray(raw.list) && raw.list.length && Date.now() - (raw._ts || 0) < SITES_TTL) {
        return raw.list;
      }
    } catch {}
  }

  // Try fetching from backend
  const urls = [
    // Primary: sites list endpoint (kiosk key auth)
    { url: `${settings.apiBase}/sites`, headers: kioskHeaders(settings, 'GET') },
  ];
  // If admin is logged in, also try kiosk manage endpoint which may return sites
  if (settings.firebaseIdToken) {
    urls.unshift({
      url: `${settings.apiBase}/kiosk/manage`,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.firebaseIdToken}` },
    });
  }

  for (const { url, headers } of urls) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const data = await res.json();
      // Normalize: API might return { sites: [...] }, [...], or { data: [...] }
      let list = Array.isArray(data) ? data
        : Array.isArray(data.sites) ? data.sites
        : Array.isArray(data.data) ? data.data
        : null;
      if (list && list.length) {
        // Normalize site shape — backend may use _id/id and name/siteName
        list = list.map(s => ({
          id: s.id || s._id || s.siteId || '',
          name: s.name || s.siteName || s.id || 'Unknown',
          displayName: s.displayName || s.display_name || s.siteName || s.name || s.id || 'Unknown',
          ...s,
        }));
        try { localStorage.setItem(SITES_CACHE_KEY, JSON.stringify({ list, _ts: Date.now() })); } catch {}
        // Also store in IndexedDB as durable backup
        try { await set('kiosk_sites', list); } catch {}
        return list;
      }
    } catch {}
  }

  // Fallback: return whatever is cached (stale) or empty
  try {
    const raw = JSON.parse(localStorage.getItem(SITES_CACHE_KEY) || 'null');
    if (raw && Array.isArray(raw.list)) return raw.list;
  } catch {}
  // Last resort: IndexedDB backup
  try {
    const idbList = await get('kiosk_sites');
    if (Array.isArray(idbList) && idbList.length) return idbList;
  } catch {}
  return [];
}

/** Force-refresh sites from backend and return the new list */
export async function refreshSites() {
  return getSites({ forceRefresh: true });
}

// Convert a Firestore timestamp object { _seconds, _nanoseconds } or plain value to ISO string
function toISO(val) {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && '_seconds' in val) {
    return new Date(val._seconds * 1000).toISOString();
  }
  return new Date(val).toISOString();
}

/**
 * Fetch and normalise vehicle details from the carcheck endpoint.
 * Returns a plain object: { vrm, make, model, colour, year, fuelType, imageUrl, verified, mock, unavailable }
 * Never throws — network/server failures return { vrm, unavailable: true }.
 */
export async function lookupCarCheck(vrm) {
  const norm = (vrm || '').toUpperCase().replace(/\s+/g, '');
  const settings = await getSettings();
  try {
    const url = `${settings.apiBase}/kiosk/carcheck?vrm=${encodeURIComponent(norm)}`;
    const res = await fetch(url, { headers: kioskKeyOnlyHeaders(settings, 'GET') });
    if (!res.ok) return { vrm: norm, unavailable: true };
    const data = await res.json();

    // Mock fallback (no UKVD_API_KEY on server)
    if (data.mock === true) {
      const vi = data.results?.vehicleDetails?.vehicleIdentification || {};
      const hist = data.results?.vehicleDetails?.vehicleHistory?.colourDetails || {};
      return {
        vrm: norm,
        make: vi.dvlaMake || vi.DvlaMake || null,
        model: vi.dvlaModel || vi.DvlaModel || null,
        colour: hist.currentColour || hist.CurrentColour || null,
        year: null, fuelType: null, imageUrl: null,
        verified: false, mock: true, unavailable: false,
      };
    }

    // Real UKVD response — raw passthrough from backend
    const results = data.results || data.Results || {};
    const vd = results.vehicleDetails || results.VehicleDetails || {};
    const ident = vd.vehicleIdentification || vd.VehicleIdentification || {};
    const hist = vd.vehicleHistory || vd.VehicleHistory || {};
    const colour = hist.colourDetails || hist.ColourDetails || {};
    const modelDetails = results.modelDetails || results.ModelDetails || {};
    const modelIdent = modelDetails.modelIdentification || modelDetails.ModelIdentification || {};
    const techDetails = results.technicalDetails || results.TechnicalDetails || {};
    const general = techDetails.general || techDetails.General || {};
    const fuel = general.fuelType || general.FuelType || null;
    const imgSection = results.vehicleImageDetails || results.VehicleImageDetails || {};
    const imgList = imgSection.vehicleImageList || imgSection.VehicleImageList || [];
    const firstImg = imgList[0] || {};
    let imageUrl = firstImg.imageUrl || firstImg.ImageUrl || null;
    // Suppress CDN "missing" placeholder images
    if (imageUrl && imageUrl.includes('/missing')) imageUrl = null;

    const pick = (...vals) => vals.find(v => v && String(v).trim() && String(v).toLowerCase() !== 'unknown') || null;

    const make = pick(ident.dvlaMake, ident.DvlaMake, modelIdent.make, modelIdent.Make);
    const model = pick(ident.dvlaModel, ident.DvlaModel, modelIdent.model, modelIdent.Model);
    const colourVal = pick(colour.currentColour, colour.CurrentColour);
    const year = pick(ident.modelYear, ident.ModelYear, ident.yearOfManufacture, ident.YearOfManufacture);

    return {
      vrm: norm,
      make, model, colour: colourVal, year,
      fuelType: fuel,
      imageUrl,
      verified: !!(make || model),
      mock: false,
      unavailable: false,
    };
  } catch {
    return { vrm: norm, unavailable: true };
  }
}

function parseDateOrNull(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d?.getTime?.()) ? null : d;
  }
  if (typeof value?._seconds === 'number') {
    const d = new Date(value._seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value?.seconds === 'number') {
    const d = new Date(value.seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function findRecentSessionForVrm(normVrm, windowMs = APPLY_DEDUPE_WINDOW_MS) {
  const allKeys = await keys();
  let newest = null;
  for (const key of allKeys) {
    if (!String(key || '').startsWith(DB_PREFIX)) continue;
    const permit = await get(key);
    if (!permit) continue;
    const permitVrm = String(permit.vrm || '').toUpperCase().replace(/\s+/g, '');
    if (permitVrm !== normVrm) continue;
    const status = String(permit.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'declined' || status === 'expired') continue;

    const ts = parseDateOrNull(
      permit.issuedAt
      || permit.queuedAt
      || permit.syncedAt
      || permit.createdAt
      || permit.start
    );
    if (!ts) continue;

    const ageMs = Date.now() - ts.getTime();
    if (ageMs < 0 || ageMs > windowMs) continue;
    if (!newest || ts.getTime() > newest.ts.getTime()) {
      newest = {
        id: permit.id || String(key).replace(DB_PREFIX, ''),
        mode: permit.mode || 'unknown',
        ts,
      };
    }
  }
  return newest;
}

export async function issuePermit({ vrm, email, phone, hours, startISO, vehicleMake, vehicleModel, vehicleColour, vehicleYear }) {
  const settings = await getSettings();
  const outboxRequestId = makeOutboxRequestId(settings);
  const start = startISO ? new Date(startISO) : new Date();
  // hours === null means an indefinite/permanent permit (no end date)
  const isIndefinite = hours === null;
  const resolvedHours = isIndefinite ? null : (hours ?? settings.defaultHours);
  const end = isIndefinite ? null : new Date(start.getTime() + resolvedHours * 3600 * 1000);
  const norm = vrm.toUpperCase().replace(/\s+/g, "");
  trackVRM(norm);

  const recentSession = await findRecentSessionForVrm(norm);
  if (recentSession) {
    throw new Error(`Another session is already in progress (session ${recentSession.id}). Please wait 10 minutes before applying again.`);
  }

  // Backend dispatch.js expects date-only strings ("YYYY-MM-DD") + separate time strings ("HH:MM")
  // in UK local time. Sending a full ISO datetime breaks parseUkStartOfDay on the server.
  function toUkParts(d) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(d);
      const get = (type) => parts.find(p => p.type === type)?.value || '00';
      return {
        date: `${get('year')}-${get('month')}-${get('day')}`,
        time: `${get('hour')}:${get('minute')}`,
      };
    } catch {
      // Fallback: UTC split (should not happen on any modern engine)
      const iso = d.toISOString();
      return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
    }
  }

  const startParts = toUkParts(start);
  const endParts = isIndefinite ? null : toUkParts(end);

  const payload = {
    vrm: norm,
    siteId: settings.siteId,
    siteName: settings.siteName || settings.siteDisplayName || settings.siteId || "",
    startDate: startParts.date,
    startTime: startParts.time,
    ...(isIndefinite ? {} : { endDate: endParts.date, endTime: endParts.time }),
    hours: resolvedHours,
    permitType: isIndefinite ? "permanent" : "temporary",
    source: "kiosk",
    dispatchType: "kiosk",
    createdBy: settings.kioskUid || settings.adminEmail || settings.kioskName || "kiosk-self-service",
    createdByName: settings.kioskName || "Kiosk Self-Service",
    outboxRequestId,
    ...(email ? { recipientEmail: email } : {}),
    ...(phone ? { recipientPhone: phone } : {}),
    ...(vehicleMake ? { vehicleMake } : {}),
    ...(vehicleModel ? { vehicleModel } : {}),
    ...(vehicleColour ? { vehicleColour } : {}),
    ...(vehicleYear ? { vehicleYear } : {}),
  };

  // Try online issuance unless the browser explicitly reports offline.
  const browserOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (settings.mode === "online" && !browserOffline) {
    const headerSets = [kioskHeaders(settings, 'POST'), kioskKeyOnlyHeaders(settings, 'POST')];
    let got401 = false;
    let lastError = null;
    for (const hdrs of headerSets) {
      try {
        const res = await fetch(`${settings.apiBase}/epermits/dispatch`, {
          method: "POST",
          headers: hdrs,
          body: JSON.stringify(payload),
        });
        if (res.status === 401) { got401 = true; continue; }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `API error ${res.status}`);
        }
        const data = await res.json();
        const remoteId = data.id || data.permit?.id || data._id || data.permitId;
        const permit = {
          ...payload,
          id: remoteId,
          mode: "online",
          issuedAt: new Date().toISOString(),
          start: start.toISOString(),
          end: end ? end.toISOString() : null,
          status: data.permit?.status || "active",
        };
        await set(DB_PREFIX + permit.id, permit);
        const qr = await maybeMakeQR(permit, settings);
        return { permit, qrDataUrl: qr, online: true };
      } catch (e) {
        lastError = e;
        console.warn("Online issuance failed:", e);
      }
    }
    // If the server responded with a real error (not a network failure), surface it
    // so the UI can show an error dialog instead of silently falling offline.
    if (!got401 && lastError && !isLikelyNetworkError(lastError)) {
      throw lastError;
    }
    // Token refresh on 401
    if (got401) {
      const refreshed = await refreshTokenIfPossible();
      if (refreshed) {
        try {
          const res = await fetch(`${refreshed.apiBase}/epermits/dispatch`, {
            method: "POST",
            headers: kioskHeaders(refreshed, 'POST'),
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const data = await res.json();
            const remoteId = data.id || data.permit?.id || data._id || data.permitId;
            const permit = {
              ...payload,
              id: remoteId,
              mode: "online",
              issuedAt: new Date().toISOString(),
              start: start.toISOString(),
              end: end ? end.toISOString() : null,
              status: data.permit?.status || "active",
            };
            await set(DB_PREFIX + permit.id, permit);
            const qr = await maybeMakeQR(permit, settings);
            return { permit, qrDataUrl: qr, online: true };
          }
        } catch {}
      }
    }
  }

  // Offline fallback
  const localId = `${settings.permitPrefix}-${Date.now()}`;
  const offline = {
    ...payload,
    id: localId,
    mode: "offline",
    issuedAt: new Date().toISOString(),
    queuedAt: new Date().toISOString(),
    // Ensure start/end fields are always present for local use
    start: start.toISOString(),
    end: end ? end.toISOString() : null,
  };
  const sig = await hmacSHA256Hex(settings.hmacSecret, JSON.stringify({
    vrm: offline.vrm, siteId: offline.siteId, start: offline.start, end: offline.end
  }));
  offline.hmac = sig;
  await set(DB_PREFIX + offline.id, offline);
  const qr = await maybeMakeQR(offline, settings);
  return { permit: offline, qrDataUrl: qr, online: false };
}

async function maybeMakeQR(permit, settings) {
  if (!settings.qrEnabled) return null;
  const body = {
    vrm: permit.vrm, siteId: permit.siteId, start: permit.start, end: permit.end
  };
  const hmac = permit.hmac || await hmacSHA256Hex(settings.hmacSecret, JSON.stringify(body));
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(body))));
  const urlPayload = `d=${encoded}&s=${hmac}`;
  const json = { ...body, hmac };
  return await QRCode.toDataURL(JSON.stringify(json));
}

export async function getPermitById(id) {
  const settings = await getSettings();
  try {
    const res = await fetch(
      `${settings.apiBase}/permits?action=verify&id=${encodeURIComponent(id)}`,
      { headers: kioskHeaders(settings, 'GET') }
    );
    if (res.ok) {
      const permit = await res.json();
      if (permit?.vrm) trackVRM(permit.vrm);
      return permit;
    }
  } catch {}
  // fallback local
  const local = await get(DB_PREFIX + id);
  if (local?.vrm) trackVRM(local.vrm);
  return local;
}

export async function getPermitsByVRM(vrm) {
  let settings = await getSettings();
  const norm = (vrm + "").toUpperCase().replace(/\s+/g, "");
  trackVRM(norm);
  let online = false;
  let apiError = null;
  const url = `${settings.apiBase}/permits/by-vrm?vrm=${encodeURIComponent(norm)}&siteId=${encodeURIComponent(settings.siteId)}`;

  // Build ordered list of auth strategies: Bearer → kiosk key (no Content-Type for GET) → refresh token + Bearer
  const attempts = [
    () => kioskHeaders(settings, 'GET'),
    () => kioskKeyOnlyHeaders(settings, 'GET'),
  ];

  for (const getHeaders of attempts) {
    try {
      const res = await fetch(url, { headers: getHeaders() });
      if (res.status === 401) {
        apiError = 'Authentication failed (401)';
        continue;
      }
      if (res.ok) {
        online = true;
        const data = await res.json();
        const raw = Array.isArray(data) ? data : (data.items || data.permits || []);
        const list = raw.map((p) => ({
          ...p,
          id: p.id || p._id || p.permitId,
          start: p.start || p.startDate || null,
          end: p.end || p.endDate || null,
          status: p.status || 'active',
        }));
        if (list.length) {
          for (const p of list) {
            if (p.id) await set(DB_PREFIX + p.id, p);
          }
        }
        return { permits: list, online: true };
      } else {
        apiError = `Server returned ${res.status}`;
      }
    } catch (e) {
      apiError = e.message || 'Network error';
    }
  }

  // All auth methods failed with 401 — try refreshing the token and retry once
  if (apiError && apiError.includes('401')) {
    const refreshed = await refreshTokenIfPossible();
    if (refreshed) {
      settings = refreshed;
      try {
        const res = await fetch(url, { headers: kioskHeaders(settings, 'GET') });
        if (res.ok) {
          const data = await res.json();
          const raw = Array.isArray(data) ? data : (data.items || data.permits || []);
          const list = raw.map((p) => ({
            ...p,
            id: p.id || p._id || p.permitId,
            start: p.start || p.startDate || null,
            end: p.end || p.endDate || null,
            status: p.status || 'active',
          }));
          if (list.length) {
            for (const p of list) {
              if (p.id) await set(DB_PREFIX + p.id, p);
            }
          }
          return { permits: list, online: true };
        }
      } catch {}
    }
  }

  // Fallback: local scan
  const ks = await keys();
  const out = [];
  for (const k of ks) {
    if ((k+"").startsWith(DB_PREFIX)) {
      const p = await get(k);
      const localVrm = (p?.vrm + "").toUpperCase().replace(/\s+/g, "");
      if (p && localVrm === norm) out.push(p);
    }
  }
  return { permits: out, online: false, apiError };
}

export async function verifyOfflineFromQuery(query) {
  const settings = await getSettings();
  const d = query.get("d");
  const s = query.get("s");
  if (!d || !s) return { ok: false, reason: "Missing data" };
  try {
    const json = JSON.parse(decodeURIComponent(escape(atob(d))));
    const recomputed = await hmacSHA256Hex(settings.hmacSecret, JSON.stringify({
      vrm: json.vrm, siteId: json.siteId, start: json.start, end: json.end
    }));
    const ok = (recomputed === s);
    return { ok, payload: json, expected: recomputed, provided: s };
  } catch (e) {
    return { ok: false, reason: "Invalid payload" };
  }
}

// --- Extend an existing permit ---

const EXTEND_QUEUE_PREFIX = "kiosk_extend_queue:";

export async function extendPermit({ id, hours }) {
  let settings = await getSettings();
  const existing = await get(DB_PREFIX + id);
  if (existing?.vrm) trackVRM(existing.vrm);

  const isIndefinite = hours === null;
  const additionalMinutes = typeof hours === "number" ? Math.max(0, Math.round(hours * 60)) : 0;
  // Kiosk renewal semantics: restart from "now" (not additive on existing end time).
  const renewalStartIso = new Date().toISOString();
  const baseMsFromNow = new Date(renewalStartIso).getTime();
  const computedEndIso = isIndefinite ? null : new Date(baseMsFromNow + additionalMinutes * 60000).toISOString();
  const extendPayload = {
    bookingId: id,
    hours,
    additionalMinutes,
    isIndefinite,
    resetFromNow: true,
    newStartTime: renewalStartIso,
    ...(computedEndIso ? { newEndTime: computedEndIso } : {}),
  };

  // Try online — retry with kiosk key on 401, then token refresh
  const headerSets = [kioskHeaders(settings, 'POST'), kioskKeyOnlyHeaders(settings, 'POST')];
  let got401 = false;
  for (const hdrs of headerSets) {
    try {
      const res = await fetch(`${settings.apiBase}/extend-permit`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify(extendPayload),
      });
      if (res.status === 401) { got401 = true; continue; }
      if (res.ok) {
        const data = await res.json();
        const local = await get(DB_PREFIX + id);
        if (local) {
          const resolvedEnd = isIndefinite ? null : (data.end || data.endTime || computedEndIso || local.end || null);
          const updatedLocal = {
            ...local,
            ...data,
            id,
            start: data.start || renewalStartIso,
            end: resolvedEnd,
            syncedAt: new Date().toISOString(),
          };
          if (isIndefinite) {
            updatedLocal.hours = null;
            updatedLocal.permitType = "permanent";
          } else {
            updatedLocal.hours = hours;
            updatedLocal.permitType = "temporary";
          }
          delete updatedLocal._pendingExtend;
          await set(DB_PREFIX + id, updatedLocal);
        }
        return {
          ...data,
          id,
          start: data.start || renewalStartIso,
          end: isIndefinite ? null : (data.end || data.endTime || computedEndIso || existing?.end || null),
          online: true,
        };
      }
    } catch (e) {
      console.warn("Online extend failed, falling back offline:", e);
    }
  }
  // Token refresh on 401
  if (got401) {
    const refreshed = await refreshTokenIfPossible();
    if (refreshed) {
      settings = refreshed;
      try {
        const res = await fetch(`${settings.apiBase}/extend-permit`, {
          method: "POST",
          headers: kioskHeaders(settings, 'POST'),
          body: JSON.stringify(extendPayload),
        });
        if (res.ok) {
          const data = await res.json();
          const local = await get(DB_PREFIX + id);
          if (local) {
            const resolvedEnd = isIndefinite ? null : (data.end || data.endTime || computedEndIso || local.end || null);
            const updatedLocal = {
              ...local,
              ...data,
              id,
              start: data.start || renewalStartIso,
              end: resolvedEnd,
              syncedAt: new Date().toISOString(),
            };
            if (isIndefinite) {
              updatedLocal.hours = null;
              updatedLocal.permitType = "permanent";
            } else {
              updatedLocal.hours = hours;
              updatedLocal.permitType = "temporary";
            }
            delete updatedLocal._pendingExtend;
            await set(DB_PREFIX + id, updatedLocal);
          }
          return {
            ...data,
            id,
            start: data.start || renewalStartIso,
            end: isIndefinite ? null : (data.end || data.endTime || computedEndIso || existing?.end || null),
            online: true,
          };
        }
      } catch {}
    }
  }

  // Offline fallback: optimistically update local permit + queue for sync
  const latest = existing || await get(DB_PREFIX + id);
  if (latest) {
    latest.start = renewalStartIso;
    if (hours === null) {
      // Indefinite extension — clear end date, mark as permanent
      latest.end = null;
      latest.hours = null;
      latest.permitType = "permanent";
    } else {
      latest.end = computedEndIso;
      latest.hours = hours;
      latest.permitType = "temporary";
    }
    latest._pendingExtend = true;
    await set(DB_PREFIX + id, latest);
  }

  // Queue the extension request for later sync
  await set(EXTEND_QUEUE_PREFIX + id + ":" + Date.now(), {
    id,
    hours,
    additionalMinutes,
    isIndefinite,
    resetFromNow: true,
    newStartTime: renewalStartIso,
    newEndTime: computedEndIso,
    queuedAt: new Date().toISOString(),
  });

  return { id, hours, start: renewalStartIso, end: latest?.end, online: false };
}

// --- Site rules (parking type, rate) from upstream API ---

const SITE_RULES_TTL = 5 * 60 * 1000; // 5 min cache

export async function getSiteRules(siteId) {
  if (typeof window === "undefined") return null;
  const settings = await getSettings();
  const cacheKey = `siteRules:${siteId}`;
  const idbKey = `kiosk_siteRules:${siteId}`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (cached && Date.now() - cached._ts < SITE_RULES_TTL) {
      const { _ts, ...rules } = cached;
      return rules;
    }
  } catch {}
  // Fetch from upstream
  try {
    const res = await fetch(
      `${settings.apiBase}/sites/${encodeURIComponent(siteId)}`,
      { headers: kioskHeaders(settings, 'GET') }
    );
    if (res.ok) {
      const rules = await res.json();
      try { localStorage.setItem(cacheKey, JSON.stringify({ ...rules, _ts: Date.now() })); } catch {}
      try { await set(idbKey, rules); } catch {}
      return rules;
    }
  } catch {}
  // Fallback: stale localStorage
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (cached) { const { _ts, ...rules } = cached; return rules; }
  } catch {}
  // Fallback: IndexedDB backup
  try {
    const idbRules = await get(idbKey);
    if (idbRules) return idbRules;
  } catch {}
  // Last resort defaults
  return {
    parkingType: "free",
    hourlyRate: 0,
    maxFreeMinutes: 0,
    reRegisterCooldownMinutes: 0,
    defaultHours: settings.defaultHours ?? 2,
    currency: "GBP",
  };
}

// --- Offline → Online sync ---

/**
 * Push all locally-cached offline permits to the server.
 * Called automatically when the browser comes back online and on app boot.
 * Returns { synced: number, failed: number }.
 */
export async function syncOfflinePermits(onProgress = null) {
  const settings = await getSettings();
  const ks = await keys();
  let synced = 0;
  let failed = 0;
  const offlinePermitKeys = ks.filter((k) => {
    const key = String(k || '');
    return key.startsWith(DB_PREFIX);
  });
  const extensionKeys = ks.filter((k) => {
    const key = String(k || '');
    return key.startsWith(EXTEND_QUEUE_PREFIX);
  });
  const totalSyncItems = offlinePermitKeys.length + extensionKeys.length;
  let processedSyncItems = 0;

  const reportProgress = (message) => {
    if (typeof onProgress !== 'function') return;
    onProgress({
      phase: 'push',
      processed: processedSyncItems,
      total: totalSyncItems,
      synced,
      failed,
      message,
    });
  };

  await saveSyncState({
    lastSyncResult: 'running',
    lastSyncError: '',
    lastSyncAt: new Date().toISOString(),
  });
  reportProgress('Scanning queued offline submissions...');

  // 1. Sync offline-issued permits
  for (const k of ks) {
    if (!(k + "").startsWith(DB_PREFIX)) continue;
    const permit = await get(k);
    if (!permit || permit.mode !== "offline") {
      processedSyncItems++;
      reportProgress('Skipping non-offline record...');
      continue;
    }

    try {
      // Convert stored ISO strings back to UK date/time parts for the backend
      const syncStart = new Date(permit.start || permit.startDate || Date.now());
      const toUkParts = (d) => {
        try {
          const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false,
          }).formatToParts(d);
          const get = (type) => parts.find(p => p.type === type)?.value || '00';
          return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
        } catch { const iso = d.toISOString(); return { date: iso.slice(0, 10), time: iso.slice(11, 16) }; }
      };
      const sp = toUkParts(syncStart);
      const dispatchBody = JSON.stringify({
        vrm: permit.vrm,
        siteId: permit.siteId,
        siteName: permit.siteName || settings.siteName || settings.siteDisplayName || permit.siteId || "",
        startDate: sp.date,
        startTime: sp.time,
        hours: permit.hours ?? settings.defaultHours,
        permitType: permit.permitType || "temporary",
        source: "kiosk",
        dispatchType: "kiosk",
        createdBy: settings.kioskUid || settings.adminEmail || settings.kioskName || "kiosk-self-service",
        createdByName: settings.kioskName || "Kiosk Self-Service",
        outboxRequestId: permit.outboxRequestId || permit.offlineId || permit.id,
        offlineId: permit.id,
        hmac: permit.hmac || null,
        ...(permit.recipientEmail ? { recipientEmail: permit.recipientEmail } : {}),
        ...(permit.recipientPhone ? { recipientPhone: permit.recipientPhone } : {}),
      });

      // Mirror issuePermit: try Bearer first, fall back to kiosk-key-only on 401,
      // then attempt a token refresh if both header sets are rejected.
      let res = null;
      let got401 = false;
      const headerSets = [kioskHeaders(settings, 'POST'), kioskKeyOnlyHeaders(settings, 'POST')];
      for (const hdrs of headerSets) {
        try {
          res = await fetch(`${settings.apiBase}/epermits/dispatch`, { method: "POST", headers: hdrs, body: dispatchBody });
          if (res.status === 401) { got401 = true; res = null; continue; }
          break; // success or non-401 error — stop retrying headers
        } catch { res = null; break; }
      }
      if (!res && got401) {
        const refreshed = await refreshTokenIfPossible();
        if (refreshed) {
          try {
            res = await fetch(`${refreshed.apiBase}/epermits/dispatch`, {
              method: "POST", headers: kioskHeaders(refreshed, 'POST'), body: dispatchBody,
            });
          } catch { res = null; }
        }
      }

      if (!res || !res.ok) { failed++; processedSyncItems++; reportProgress('Failed pushing offline permit.'); continue; }

      const data = await res.json();
      const serverId = data.id || data.permit?.id || data._id || data.permitId;

      await del(k);
      const confirmed = {
        ...permit,
        ...data,
        id: serverId,
        mode: "online",
        start: data.start || data.startDate || permit.start || null,
        end: data.end || data.endTime || permit.end || null,
        syncedAt: new Date().toISOString(),
      };
      await set(DB_PREFIX + serverId, confirmed);
      synced++;
    } catch {
      failed++;
    }
    processedSyncItems++;
    reportProgress('Pushing offline permits...');
  }

  // 2. Sync queued offline extensions
  for (const k of ks) {
    if (!(k + "").startsWith(EXTEND_QUEUE_PREFIX)) continue;
    const ext = await get(k);
    if (!ext) {
      processedSyncItems++;
      reportProgress('Skipping empty extension queue item...');
      continue;
    }

    try {
      const extMinutes = ext.additionalMinutes ?? (typeof ext.hours === "number" ? Math.max(0, Math.round(ext.hours * 60)) : 0);
      const extBody = JSON.stringify({
        bookingId: ext.id,
        hours: ext.hours,
        additionalMinutes: extMinutes,
        isIndefinite: ext.isIndefinite === true || ext.hours === null,
        resetFromNow: ext.resetFromNow === true,
        ...(ext.newStartTime ? { newStartTime: ext.newStartTime } : {}),
        ...(ext.newEndTime ? { newEndTime: ext.newEndTime } : {}),
      });
      let extRes = null;
      let extGot401 = false;
      for (const hdrs of [kioskHeaders(settings, 'POST'), kioskKeyOnlyHeaders(settings, 'POST')]) {
        try {
          extRes = await fetch(`${settings.apiBase}/extend-permit`, { method: "POST", headers: hdrs, body: extBody });
          if (extRes.status === 401) { extGot401 = true; extRes = null; continue; }
          break;
        } catch { extRes = null; break; }
      }
      if (!extRes && extGot401) {
        const refreshed = await refreshTokenIfPossible();
        if (refreshed) {
          try {
            extRes = await fetch(`${refreshed.apiBase}/extend-permit`, {
              method: "POST", headers: kioskHeaders(refreshed, 'POST'), body: extBody,
            });
          } catch { extRes = null; }
        }
      }
      if (!extRes || !extRes.ok) { failed++; processedSyncItems++; reportProgress('Failed pushing extension item.'); continue; }

      const data = await extRes.json();
      // Update local permit with server response
      const local = await get(DB_PREFIX + ext.id);
      if (local) {
        const resolvedEnd = ext.hours === null ? null : (data.end || data.endTime || ext.newEndTime || local.end || null);
        const updatedLocal = {
          ...local,
          ...data,
          id: ext.id,
          start: data.start || ext.newStartTime || local.start || null,
          end: resolvedEnd,
          syncedAt: new Date().toISOString(),
        };
        if (ext.hours === null) {
          updatedLocal.hours = null;
          updatedLocal.permitType = "permanent";
        }
        delete updatedLocal._pendingExtend;
        await set(DB_PREFIX + ext.id, updatedLocal);
      }
      await del(k);
      synced++;
    } catch {
      failed++;
    }
    processedSyncItems++;
    reportProgress('Pushing extension queue...');
  }

  if (synced > 0) {
    console.log(`[sync] Pushed ${synced} offline permit(s)/extension(s) to server (${failed} failed)`);
  }
  await saveSyncState({
    lastSyncResult: failed > 0 ? 'partial' : 'success',
    lastSyncError: failed > 0 ? `${failed} sync item(s) failed` : '',
    lastSyncAt: new Date().toISOString(),
    pushed: synced,
    pushFailed: failed,
  });
  reportProgress('Offline push phase complete.');
  return { synced, failed };
}

/**
 * Pull permits from the server for every tracked VRM and cache locally.
 */
export async function cachePermitsForKnownVRMs(onProgress = null) {
  const settings = await getSettings();
  const vrms = await getKnownVRMs();
  if (!vrms.length) return { cached: 0, errors: 0 };

  let cached = 0;
  let errors = 0;
  let processed = 0;

  const reportProgress = (message) => {
    if (typeof onProgress !== 'function') return;
    onProgress({
      phase: 'vrm-cache',
      processed,
      total: vrms.length,
      cached,
      errors,
      message,
    });
  };
  reportProgress('Refreshing tracked VRMs...');

  for (const vrm of vrms) {
    try {
      const url = `${settings.apiBase}/permits/by-vrm?vrm=${encodeURIComponent(vrm)}&siteId=${encodeURIComponent(settings.siteId)}`;
      const res = await fetch(url, { headers: kioskKeyOnlyHeaders(settings, 'GET') });
      if (!res.ok) { errors++; processed++; reportProgress('Failed caching a tracked VRM.'); continue; }
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.items || data.permits || []);
      for (const p of list) {
        const pid = p.id || p._id || p.permitId;
        if (pid) {
          await set(DB_PREFIX + pid, {
            ...p,
            id: pid,
            start: p.start || p.startDate || null,
            end: p.end || p.endDate || null,
            status: p.status || 'active',
          });
          cached++;
        }
      }
    } catch {
      errors++;
    }
    processed++;
    reportProgress('Caching permits for tracked VRMs...');
  }

  if (cached > 0 || errors > 0) {
    console.log(`[sync] Cached ${cached} permit(s) for ${vrms.length} VRM(s) (${errors} errors)`);
  }
  await saveSyncState({
    cached,
    cacheErrors: errors,
    lastSyncAt: new Date().toISOString(),
  });
  reportProgress('Tracked VRM cache phase complete.');
  return { cached, errors };
}

/**
 * Pull ALL active permits for this kiosk's site from the backend and cache locally.
 * Used by sync_allowed_list command and fullSync so the kiosk can verify permits it
 * never issued itself (e.g. permits issued by a different kiosk or the web portal).
 * If the backend endpoint is not available, falls back silently.
 */
export async function pullSitePermits(onProgress = null) {
  const settings = await getSettings();
  if (!settings.siteId) return { cached: 0, errors: 0 };
  let cached = 0;
  let errors = 0;
  const reportProgress = (processed, total, message) => {
    if (typeof onProgress !== 'function') return;
    onProgress({
      phase: 'site-cache',
      processed,
      total,
      cached,
      errors,
      message,
    });
  };
  try {
    const url = `${settings.apiBase}/epermits/kiosk-cache?siteId=${encodeURIComponent(settings.siteId)}`;
    const res = await fetch(url, { headers: kioskKeyOnlyHeaders(settings, 'GET') });
    if (!res.ok) {
      reportProgress(0, 0, 'Site permit pull failed.');
      return { cached: 0, errors: 1 };
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.items || data.permits || []);
    reportProgress(0, list.length, 'Pulling site-wide permits...');
    let processed = 0;
    for (const p of list) {
      const pid = p.id || p._id || p.permitId;
      if (!pid) {
        processed++;
        reportProgress(processed, list.length, 'Pulling site-wide permits...');
        continue;
      }
      const vrm = (p.vrm || "").toUpperCase().replace(/\s+/g, "");
      if (vrm) trackVRM(vrm);
      await set(DB_PREFIX + pid, {
        ...p,
        id: pid,
        start: p.start || p.startDate || null,
        end: p.end || p.endDate || null,
        status: p.status || 'active',
      });
      cached++;
      processed++;
      reportProgress(processed, list.length, 'Pulling site-wide permits...');
    }
    if (cached > 0) console.log(`[sync] Pulled ${cached} site-wide permit(s) for offline verification`);
  } catch (e) {
    errors++;
    reportProgress(0, 0, 'Site permit pull failed.');
  }
  reportProgress(cached, cached, 'Site cache phase complete.');
  return { cached, errors };
}

/**
 * Full bidirectional sync: push offline permits, pull cache for all tracked VRMs,
 * and pull all active site permits for offline verification.
 */
export async function fullSync() {
  const push = await syncOfflinePermits();
  const pull = await cachePermitsForKnownVRMs();
  const site = await pullSitePermits();
  const result = { pushed: push.synced, pushFailed: push.failed, cached: pull.cached + site.cached, cacheErrors: pull.errors + site.errors };
  await saveSyncState({
    ...result,
    lastSyncResult: result.pushFailed > 0 || result.cacheErrors > 0 ? 'partial' : 'success',
    lastSyncError: result.pushFailed > 0 || result.cacheErrors > 0
      ? `pushFailed=${result.pushFailed}, cacheErrors=${result.cacheErrors}`
      : '',
    lastSyncAt: new Date().toISOString(),
  });
  return result;
}

/**
 * Register online/offline listeners + periodic retry.
 * Call once at app startup. Returns a cleanup function.
 */
export function startOfflineSync() {
  if (typeof window === "undefined") return () => {};

  // Full bidirectional sync + heartbeat on boot if online
  if (navigator.onLine) {
    fullSync().catch(() => {});
    sendHeartbeat().catch(() => {});
  }

  const onOnline = () => {
    console.log("[sync] Browser is online — running full sync…");
    fullSync().catch(() => {});
    sendHeartbeat().catch(() => {});
  };
  window.addEventListener("online", onOnline);

  // Push offline permits every 60s
  const pushInterval = setInterval(() => {
    if (navigator.onLine) syncOfflinePermits().catch(() => {});
  }, 60_000);

  // Pull/cache permits for tracked VRMs every 5 min
  const pullInterval = setInterval(() => {
    if (navigator.onLine) cachePermitsForKnownVRMs().catch(() => {});
  }, 300_000);

  // Heartbeat + command delivery every 90s
  const heartbeatInterval = setInterval(() => {
    if (navigator.onLine) sendHeartbeat().catch(() => {});
  }, 90_000);

  return () => {
    window.removeEventListener("online", onOnline);
    clearInterval(pushInterval);
    clearInterval(pullInterval);
    clearInterval(heartbeatInterval);
  };
}

// --- Admin auth (Firebase email/password → ID token) ---

/**
 * Log in with email + password via the server-side kiosk auth proxy.
 * POSTs { email, password } → /api/kiosk/auth → returns { token, uid, role, siteIds }.
 * Stores the returned token in settings for all subsequent API calls.
 */
export async function loginAdmin(email, password) {
  const settings = await getSettings();
  const res = await fetch(authUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Login failed");
  }
  const token = data.token;
  if (!token) throw new Error("Login succeeded but no token returned");
  if (typeof window !== "undefined") {
    localStorage.setItem("kiosk_token", token);
  }
  const updated = {
    ...settings,
    firebaseIdToken: token,
    adminEmail: data.email || email,
    _kioskPass: password,  // stored for automatic token refresh on 401
    adminLoggedIn: true,
    kioskUid: data.uid || "",
    kioskName: settings.kioskName || data.displayName || "",
    kioskRole: data.role || "",
    kioskSiteIds: data.siteIds || [],
  };
  await saveSettings(updated);
  return updated;
}

/** Clear stored admin credentials */
export async function logoutAdmin() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("kiosk_token");
  }
  const settings = await getSettings();
  const updated = {
    ...settings,
    firebaseIdToken: "",
    adminLoggedIn: false,
    kioskUid: "",
    kioskRole: "",
    kioskSiteIds: [],
  };
  await saveSettings(updated);
}

// --- Kiosk device registration (admin-only, Firebase Bearer token) ---

function adminHeaders(settings) {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${settings.firebaseIdToken || ""}`,
  };
}

/** Register this kiosk device with the backend */
export async function registerKiosk({ name, siteId, location }) {
  const settings = await getSettings();
  const res = await fetch(`${settings.apiBase}/kiosk/manage`, {
    method: "POST",
    headers: adminHeaders(settings),
    body: JSON.stringify({ name, siteId, location }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || "Failed to register kiosk");
  }
  const data = await res.json();
  const kioskId = data.id || data._id || data.kioskId;
  // Persist into local settings
  const updated = { ...settings, kioskId, kioskName: name, kioskLocation: location || "", kioskRegistered: true };
  // If the server returned an API key for this kiosk, store it
  if (data.apiKey) updated.kioskApiKey = data.apiKey;
  await saveSettings(updated);
  return { ...data, kioskId };
}

/** Update kiosk info on the backend */
export async function updateKiosk(patch) {
  const settings = await getSettings();
  if (!settings.kioskId) throw new Error("Kiosk not registered");
  const res = await fetch(`${settings.apiBase}/kiosk/manage`, {
    method: "PUT",
    headers: adminHeaders(settings),
    body: JSON.stringify({ id: settings.kioskId, ...patch }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || "Failed to update kiosk");
  }
  return await res.json();
}

/** Unregister / delete this kiosk from the backend */
export async function unregisterKiosk() {
  const settings = await getSettings();
  if (!settings.kioskId) throw new Error("Kiosk not registered");
  const res = await fetch(
    `${settings.apiBase}/kiosk/manage?id=${encodeURIComponent(settings.kioskId)}`,
    { method: "DELETE", headers: adminHeaders(settings) }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || "Failed to unregister kiosk");
  }
  const updated = { ...settings, kioskId: "", kioskName: "", kioskLocation: "", kioskRegistered: false };
  await saveSettings(updated);
  return true;
}

/** Fetch this kiosk's info from the backend */
export async function getKioskInfo() {
  const settings = await getSettings();
  if (!settings.kioskId) return null;
  try {
    const res = await fetch(
      `${settings.apiBase}/kiosk/manage?id=${encodeURIComponent(settings.kioskId)}`,
      { headers: adminHeaders(settings) }
    );
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

// ── Heartbeat & Remote Command Delivery ────────────────────────────────────

function heartbeatUrl() {
  return isCapacitor() ? `${REAL_BACKEND}/kiosk/heartbeat` : `/backend-api/kiosk/heartbeat`;
}
function ackCommandUrl() {
  return isCapacitor() ? `${REAL_BACKEND}/kiosk/ack-command` : `/backend-api/kiosk/ack-command`;
}

/**
 * Return a stable device identifier stored in localStorage.
 * Used as kioskName fallback when the kiosk has not yet been formally registered.
 */
function getOrCreateDeviceId() {
  try {
    let id = localStorage.getItem('kiosk_device_id');
    if (!id) {
      id = 'kiosk-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
      localStorage.setItem('kiosk_device_id', id);
    }
    return id;
  } catch {
    return 'kiosk-unknown';
  }
}

/** Execute a delivered command locally, dispatching the appropriate DOM event or native action. */
async function executeCommand(cmd) {
  if (typeof window === 'undefined') return;
  switch (cmd.type) {
    case 'reboot_app': {
      try {
        const { KioskPlugin } = await import('./kiosk-plugin');
        await KioskPlugin.rebootApp();
      } catch { window.location.reload(); }
      break;
    }
    case 'update_apk': {
      if (cmd.payload?.url) {
        try {
          const { KioskPlugin } = await import('./kiosk-plugin');
          await KioskPlugin.installApk({ url: cmd.payload.url });
        } catch {}
      }
      break;
    }
    case 'display_message': {
      const text = cmd.payload?.message || cmd.payload?.text || '';
      const duration = cmd.payload?.duration ?? 5000;
      window.dispatchEvent(new CustomEvent('kiosk:display_message', { detail: { text, duration } }));
      break;
    }
    case 'set_maintenance': {
      const reason = cmd.payload?.reason || '';
      window.dispatchEvent(new CustomEvent('kiosk:set_maintenance', { detail: { reason } }));
      break;
    }
    case 'clear_maintenance': {
      window.dispatchEvent(new CustomEvent('kiosk:clear_maintenance'));
      break;
    }
    case 'reload_config':
    case 'set_config':
    case 'set_duration': {
      window.dispatchEvent(new CustomEvent('kiosk:reload_config', { detail: cmd.payload }));
      break;
    }
    case 'sync_allowed_list': {
      // Run a full command-driven sync and only return when work is complete.
      // ACK is sent by sendHeartbeat after this function resolves successfully.
      if (cmd.payload?.vrms && Array.isArray(cmd.payload.vrms)) {
        for (const v of cmd.payload.vrms) {
          try { trackVRM(String(v).toUpperCase().replace(/\s+/g, "")); } catch {}
        }
      }

      const emitSyncProgress = ({ progress, message }) => {
        window.dispatchEvent(new CustomEvent('kiosk:command_processing', {
          detail: {
            active: true,
            type: cmd.type,
            commandId: cmd.id,
            stage: 'running',
            progress,
            message,
          },
        }));
      };

      emitSyncProgress({ progress: 5, message: 'Starting sync pipeline...' });
      window.dispatchEvent(new CustomEvent('kiosk:sync_started'));

      const push = await syncOfflinePermits((p) => {
        const ratio = p.total > 0 ? p.processed / p.total : 1;
        const progress = Math.min(65, Math.round(5 + ratio * 55));
        emitSyncProgress({ progress, message: p.message || 'Pushing offline queue...' });
      });
      emitSyncProgress({ progress: 66, message: 'Offline queue push complete.' });

      const site = await pullSitePermits((p) => {
        const ratio = p.total > 0 ? p.processed / p.total : 1;
        const progress = Math.min(85, Math.round(66 + ratio * 19));
        emitSyncProgress({ progress, message: p.message || 'Pulling site-wide permits...' });
      });
      emitSyncProgress({ progress: 86, message: 'Site-wide cache refresh complete.' });

      const cache = await cachePermitsForKnownVRMs((p) => {
        const ratio = p.total > 0 ? p.processed / p.total : 1;
        const progress = Math.min(99, Math.round(86 + ratio * 13));
        emitSyncProgress({ progress, message: p.message || 'Refreshing tracked VRMs...' });
      });

      const summary = {
        pushed: Number(push?.synced || 0),
        pushFailed: Number(push?.failed || 0),
        cached: Number(site?.cached || 0) + Number(cache?.cached || 0),
        cacheErrors: Number(site?.errors || 0) + Number(cache?.errors || 0),
      };
      emitSyncProgress({ progress: 100, message: 'Sync command finished.' });
      window.dispatchEvent(new CustomEvent('kiosk:sync_finished', { detail: summary }));
      if (summary.pushFailed > 0 || summary.cacheErrors > 0) {
        throw new Error(`sync_allowed_list partial failure: pushFailed=${summary.pushFailed}, cacheErrors=${summary.cacheErrors}`);
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Send a heartbeat to the backend, pick up any pending commands,
 * execute them, and ack each one back to the server.
 */
export async function sendHeartbeat() {
  if (typeof window === 'undefined') return;
  try {
    const settings = await getSettings();
    const kioskId = settings.kioskId;
    // Use kioskName if registered, otherwise fall back to a stable device ID so
    // heartbeat fires (and commands are delivered) even on unregistered devices.
    const kioskName = settings.kioskName || getOrCreateDeviceId();

    const key = settings.kioskApiKey || DEFAULT_KIOSK_KEY;
    const pending = await getPendingSyncTelemetry();
    const syncState = getSyncState();
    const body = {
      ...(kioskId ? { kioskId } : {}),
      ...(kioskName ? { kioskName } : {}),
      ...(settings.appVersion ? { softwareVersion: settings.appVersion } : {}),
      syncTelemetry: {
        pendingSyncCount: pending.pendingSyncCount || 0,
        oldestPendingAt: pending.oldestPendingAt || null,
        lastSyncAt: syncState.lastSyncAt || null,
        lastSyncResult: syncState.lastSyncResult || null,
        lastSyncError: syncState.lastSyncError || null,
        pushed: Number(syncState.pushed || 0),
        pushFailed: Number(syncState.pushFailed || 0),
        cached: Number(syncState.cached || 0),
        cacheErrors: Number(syncState.cacheErrors || 0),
      },
    };

    const res = await fetch(heartbeatUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kiosk-Key': key },
      body: JSON.stringify(body),
    });
    if (!res.ok) return;

    const data = await res.json();

    // If the backend returned its Firestore doc ID and we don't have it stored yet,
    // persist it so future heartbeats (and ACKs) use the faster kioskId lookup.
    const returnedDocId = data.kiosk?.id;
    if (returnedDocId && !settings.kioskId) {
      try {
        const current = JSON.parse(localStorage.getItem("settings") || "{}");
        current.kioskId = returnedDocId;
        localStorage.setItem("settings", JSON.stringify(current));
      } catch {}
    }

    // Notify UI components that a heartbeat was received successfully
    window.dispatchEvent(new CustomEvent('kiosk:heartbeat_ok', {
      detail: { timestamp: Date.now(), online: true, kiosk: data.kiosk || null },
    }));

    const commands = Array.isArray(data.commands) ? data.commands : [];
    // kiosk.id is the Firestore document ID — required by ack-command endpoint
    const firestoreDocId = returnedDocId || settings.kioskId;
    if (!firestoreDocId || commands.length === 0) return;

    // Commands that destroy the JS context on execution (reboot, APK install).
    // These must be ACK'd BEFORE execution or the server will never receive the ACK.
    const DESTRUCTIVE = new Set(['reboot_app', 'update_apk']);

    for (const cmd of commands) {
      window.dispatchEvent(new CustomEvent('kiosk:command_processing', {
        detail: {
          active: true,
          type: cmd.type,
          commandId: cmd.id,
          stage: 'started',
          message: 'Processing remote command...',
        },
      }));

      if (DESTRUCTIVE.has(cmd.type)) {
        // ACK first — app will not survive the command execution
        try {
          await fetch(ackCommandUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Kiosk-Key': key },
            body: JSON.stringify({ kioskId: firestoreDocId, commandId: cmd.id }),
          });
        } catch {}
        try {
          await executeCommand(cmd);
          window.dispatchEvent(new CustomEvent('kiosk:command_processing', {
            detail: {
              active: false,
              type: cmd.type,
              commandId: cmd.id,
              stage: 'success',
              message: 'Remote command applied.',
            },
          }));
        } catch (error) {
          window.dispatchEvent(new CustomEvent('kiosk:command_processing', {
            detail: {
              active: false,
              type: cmd.type,
              commandId: cmd.id,
              stage: 'failed',
              message: error?.message || 'Remote command failed.',
            },
          }));
        }
      } else {
        // Execute first, then ACK — confirms the command was actually carried out
        let executed = false;
        try {
          await executeCommand(cmd);
          executed = true;
        } catch (error) {
          window.dispatchEvent(new CustomEvent('kiosk:command_processing', {
            detail: {
              active: false,
              type: cmd.type,
              commandId: cmd.id,
              stage: 'failed',
              message: error?.message || 'Remote command failed.',
            },
          }));
        }
        if (executed) {
          try {
            await fetch(ackCommandUrl(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Kiosk-Key': key },
              body: JSON.stringify({ kioskId: firestoreDocId, commandId: cmd.id }),
            });
          } catch {}
          window.dispatchEvent(new CustomEvent('kiosk:command_processing', {
            detail: {
              active: false,
              type: cmd.type,
              commandId: cmd.id,
              stage: 'success',
              message: 'Remote command applied.',
            },
          }));
        }
      }
    }
  } catch {
    // Silently ignore — heartbeat errors must never crash the kiosk app
  }
}

// --- Trigger upstream Square payment ---

export async function triggerSquarePayment({ vrm, siteId, hours, amount, currency, email }) {
  const settings = await getSettings();
  const res = await fetch(`${settings.apiBase}/payments/square/create-payment`, {
    method: "POST",
    headers: kioskHeaders(settings, 'POST'),
    body: JSON.stringify({ vrm, siteId, hours, amount, currency, email: email || null }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || "Payment request failed");
  }
  return await res.json(); // { status, reference, ... }
}
