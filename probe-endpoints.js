#!/usr/bin/env node
// Production endpoint probe — mirrors lib/permits.js request shapes exactly.
//
// Header rules (from lib/permits.js kioskHeaders / kioskKeyOnlyHeaders):
//   GET  + kiosk key  → X-Kiosk-Key only (no Content-Type)
//   POST + kiosk key  → X-Kiosk-Key + Content-Type: application/json
//   Bearer            → Authorization: Bearer <token> + Content-Type (non-GET)
//
// Dispatch payload rules (from lib/permits.js issuePermit):
//   startDate / startTime / endDate / endTime — UK local date + time parts, NOT ISO strings
//   createdBy   = kioskUid || adminEmail || kioskName || "kiosk-self-service"
//   createdByName = kioskName || "Kiosk Self-Service"
//   source = "kiosk", dispatchType = "kiosk"

// ── Real kiosk identity (from kiosk-configs.json: energic-phoenix) ──────────
const BASE        = "https://ldk-group-ltd-website-react-l2km.onrender.com/api";
const KIOSK_KEY   = "c88ea0a21ca2dbdc72987b58f9d693f4658e579bf93ca7572b5600c1418a9534";
const SITE_ID     = "qLDA4aLQO0b9NKNHqjc3";  // Phoenix House — real siteId
const SITE_NAME   = "Phoenix House";
const KIOSK_NAME  = "Energic - Phoenix House";
const TEST_VRM    = "RT45YUI";
const ADMIN_EMAIL = "elowine.tauro@ldkgroup.co.uk";
const ADMIN_PASS  = "Test123!";

// ── Header builders matching lib/permits.js exactly ─────────────────────────
const kkGet  = { "X-Kiosk-Key": KIOSK_KEY };
const kkPost = { "X-Kiosk-Key": KIOSK_KEY, "Content-Type": "application/json" };
const json   = { "Content-Type": "application/json" };
function bearerGet(t)  { return { Authorization: `Bearer ${t}` }; }
function bearerPost(t) { return { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }; }

// ── UK local date/time parts — matches lib/permits.js toUkParts() exactly ───
function toUkParts(d) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(d);
    const get = (type) => parts.find(p => p.type === type)?.value || "00";
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      time: `${get("hour")}:${get("minute")}`,
    };
  } catch {
    const iso = d.toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  }
}

// ── Request helper ───────────────────────────────────────────────────────────
async function req(label, method, path, headers = {}, body) {
  const url = BASE + path;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const t0 = Date.now();
  try {
    const r = await fetch(url, opts);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text.slice(0, 300); }
    const ms = Date.now() - t0;
    const icon = r.ok ? "✅" : "❌";
    console.log(`\n${icon} [${r.status}] ${label} (${ms}ms)`);
    console.log("  →", JSON.stringify(data).slice(0, 400));
    return { status: r.status, ok: r.ok, data };
  } catch (e) {
    console.log(`\n💥 [ERR] ${label}: ${e.message}`);
    return { status: 0, ok: false, data: null };
  }
}

(async () => {
  console.log("=== Kiosk API Endpoint Probe ===");
  console.log(`    Kiosk : ${KIOSK_NAME}`);
  console.log(`    Site  : ${SITE_NAME} (${SITE_ID})\n`);

  // 1. GET permits/by-vrm — kiosk key, no Content-Type (GET rule)
  await req(
    "1. GET permits/by-vrm (kiosk key)",
    "GET",
    `/permits/by-vrm?vrm=${TEST_VRM}&siteId=${encodeURIComponent(SITE_ID)}`,
    kkGet
  );

  // 2. GET permits?action=verify — kiosk key
  await req(
    "2. GET permits?action=verify (kiosk key)",
    "GET",
    `/permits?action=verify&id=cBhXUzxcSGEqawNwjsKX`,
    kkGet
  );

  // 3. POST epermits/dispatch — correct identity, UK date parts (mirrors issuePermit)
  {
    const now    = new Date();
    const end    = new Date(now.getTime() + 2 * 3600 * 1000);
    const sp     = toUkParts(now);
    const ep     = toUkParts(end);
    await req(
      "3. POST epermits/dispatch — correct siteId + kioskName (kiosk key)",
      "POST",
      "/epermits/dispatch",
      kkPost,
      {
        vrm:           "PROBE01",
        siteId:        SITE_ID,
        siteName:      SITE_NAME,
        startDate:     sp.date,
        startTime:     sp.time,
        endDate:       ep.date,
        endTime:       ep.time,
        hours:         2,
        permitType:    "temporary",
        source:        "kiosk",
        dispatchType:  "kiosk",
        createdBy:     KIOSK_NAME,           // kioskName fallback (no uid yet)
        createdByName: KIOSK_NAME,
      }
    );
  }

  // 4. POST epermits/dispatch — intentionally WRONG siteId/siteName to test
  //    Step-1 backend fix: backend must resolve authoritative site from kioskName
  {
    const now = new Date();
    const end = new Date(now.getTime() + 2 * 3600 * 1000);
    const sp  = toUkParts(now);
    const ep  = toUkParts(end);
    await req(
      "4. POST epermits/dispatch — WRONG siteId (backend Step-1 correction test)",
      "POST",
      "/epermits/dispatch",
      kkPost,
      {
        vrm:           "PROBE02",
        siteId:        "SC4zaW84A9m1vB9Maz0X",  // Selwyn Court — intentionally wrong
        siteName:      "Selwyn Court",            // wrong
        startDate:     sp.date,
        startTime:     sp.time,
        endDate:       ep.date,
        endTime:       ep.time,
        hours:         2,
        permitType:    "temporary",
        source:        "kiosk",
        dispatchType:  "kiosk",
        createdBy:     KIOSK_NAME,           // Energic - Phoenix → backend resolves Phoenix House
        createdByName: KIOSK_NAME,
      }
    );
  }

  // 5. POST extend-permit — matches lib/permits.js extendPermit shape
  await req(
    "5. POST extend-permit (kiosk key)",
    "POST",
    "/extend-permit",
    kkPost,
    { bookingId: "cBhXUzxcSGEqawNwjsKX", hours: 1 }
  );

  // 6. GET sites/{siteId} — kiosk key, GET rule
  await req(
    "6. GET sites/{siteId} (kiosk key)",
    "GET",
    `/sites/${encodeURIComponent(SITE_ID)}`,
    kkGet
  );

  // 7. POST payments/square/create-payment — matches lib/permits.js triggerSquarePayment
  await req(
    "7. POST payments/square/create-payment (kiosk key)",
    "POST",
    "/payments/square/create-payment",
    kkPost,
    { vrm: "PROBE01", siteId: SITE_ID, hours: 2, amount: 5.00, currency: "GBP", email: null }
  );

  // 8. POST kiosk/heartbeat — kioskName fallback (no serial/kioskId yet)
  //    Header: X-Kiosk-Key; body includes kioskName for new backend lookup order
  await req(
    "8. POST kiosk/heartbeat — kioskName fallback (kiosk key)",
    "POST",
    "/kiosk/heartbeat",
    kkPost,
    {
      kioskName:  KIOSK_NAME,
      siteId:     SITE_ID,
      status:     "online",
    }
  );

  // ── Bearer-authenticated endpoints ────────────────────────────────────────
  console.log("\n--- Authenticating for Bearer endpoints ---");
  const authRes = await req(
    "9. POST kiosk/auth",
    "POST",
    "/kiosk/auth",
    json,
    { email: ADMIN_EMAIL, password: ADMIN_PASS }
  );
  const token = authRes.data?.token;
  if (!token) {
    console.log("\n🚫 Cannot test Bearer endpoints — auth failed.");
    process.exit(1);
  }

  // 10a. GET kiosk/manage — Bearer, GET rule (no Content-Type)
  await req("10a. GET kiosk/manage (Bearer)", "GET", "/kiosk/manage", bearerGet(token));

  // 10b. POST kiosk/manage — register probe kiosk
  await req(
    "10b. POST kiosk/manage — register (Bearer)",
    "POST",
    "/kiosk/manage",
    bearerPost(token),
    { action: "register", name: "Probe Test", siteId: SITE_ID }
  );

  // 10c. PUT kiosk/manage — lib/permits.js sends { id, ...patch } not kioskId
  await req(
    "10c. PUT kiosk/manage — update (Bearer)",
    "PUT",
    "/kiosk/manage",
    bearerPost(token),
    { id: "probe-kiosk", name: "Probe Test Updated" }
  );

  // 10d. DELETE kiosk/manage
  await req(
    "10d. DELETE kiosk/manage (Bearer)",
    "DELETE",
    "/kiosk/manage?id=probe-kiosk",
    bearerGet(token)
  );

  console.log("\n=== Done ===\n");
})();
