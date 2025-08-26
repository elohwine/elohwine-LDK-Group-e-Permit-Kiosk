import { set, get, del, update, keys } from "idb-keyval";
import { hmacSHA256Hex } from "./crypto";
import QRCode from "qrcode";

const DB_PREFIX = "kiosk_permits:";

export async function getSettings() {
  if (typeof window === "undefined") return {};
  const defaults = {
    mode: "online",
    siteId: "SITE01",
    defaultHours: 2,
    permitPrefix: "PERMIT",
    apiBase: "/api",
    hmacSecret: "dev-secret",
    qrEnabled: true,
  kioskKeyboardEnabled: false,
  kioskKeyboardAutoOpen: true,
  };
  try {
    const s = JSON.parse(localStorage.getItem("settings") || "{}");
    return { ...defaults, ...s };
  } catch (e) {
    return defaults;
  }
}

export async function saveSettings(s) {
  if (typeof window !== "undefined") {
    localStorage.setItem("settings", JSON.stringify(s));
  }
}

export async function issuePermit({ vrm, email, hours, startISO }) {
  const settings = await getSettings();
  const start = startISO ? new Date(startISO) : new Date();
  const end = new Date(start.getTime() + (hours ?? settings.defaultHours) * 3600 * 1000);

  const payload = {
    vrm: vrm.toUpperCase().replace(/\s+/g, ""),
    siteId: settings.siteId,
    start: start.toISOString(),
    end: end.toISOString(),
    email: email || null,
  };

  // Try online issuance
  if (settings.mode === "online") {
    try {
      const res = await fetch(`${settings.apiBase}/permits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const permit = { ...payload, id: data.id, mode: "online" };
      await set(DB_PREFIX + permit.id, permit);
      const qr = await maybeMakeQR(permit, settings);
      return { permit, qrDataUrl: qr, online: true };
    } catch (e) {
      console.warn("Online issuance failed, falling back offline:", e);
    }
  }

  // Offline fallback
  const localId = `${settings.permitPrefix}-${Date.now()}`;
  const offline = { ...payload, id: localId, mode: "offline" };
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
    const res = await fetch(`${settings.apiBase}/permits?id=${encodeURIComponent(id)}`);
    if (res.ok) return await res.json();
  } catch {}
  // fallback local
  return await get(DB_PREFIX + id);
}

export async function getPermitsByVRM(vrm) {
  const settings = await getSettings();
  const norm = (vrm + "").toUpperCase().replace(/\s+/g, "");
  // Try API first
  try {
    const res = await fetch(`${settings.apiBase}/permits?vrm=${encodeURIComponent(norm)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) return data;
    }
  } catch {}
  // Fallback: local scan
  const ks = await keys();
  const out = [];
  for (const k of ks) {
    if ((k+"").startsWith(DB_PREFIX)) {
      const p = await get(k);
      if (p && p.vrm === norm) out.push(p);
    }
  }
  return out;
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
