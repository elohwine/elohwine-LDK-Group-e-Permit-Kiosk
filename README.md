# LDK Group E-Permit Kiosk

On-site parking kiosk for LDK Group sites. A visitor enters a vehicle registration (VRM), the kiosk looks up an existing permit or issues a new one, and the device can keep working offline. Each physical kiosk is a signed Android APK built for one site.

Package: `com.ldk.kiosk`. App name at runtime comes from the site’s `appLabel` in `kiosk-configs.json`.

## Stack

| Layer | What |
| --- | --- |
| UI | Next.js 12 (pages router), React 17, MUI 5 |
| Native shell | Capacitor 7, web assets in `out/` |
| Local store | `idb-keyval` (permits) + `localStorage` (settings, token) |
| Backend | LDK API. Native builds call `https://www.ldkgroup.co.uk/api` directly. Browser dev uses the Next rewrite `/backend-api/*` |
| Auth proxy | `pages/api/kiosk/auth.js` forwards to the Render backend `ldk-group-ltd-website-react-l2km.onrender.com` |

Static export (`next build && next export`) is required. The APK has no Next server, so API routes only exist in `npm run dev` / `next start`.

## How a session works

`pages/index.js` reads settings and picks a home screen:

- **`homeMode: regular`** — `TopBar` plus `components/VrmLookupFlow.js`.
- **`homeMode: qr`** — redirects `/` to `/qr` (`pages/qr.js`), a rotating QR landing page. Refresh interval is `qrRefreshSeconds` (default 60, clamped 10–300).

VRM flow states (`VrmLookupFlow`): idle → searching → found (extend) or verifying (car check) → vehicle-confirm → optional Square pay → issuing → success. The screen resets after 30s. Repeat issues for the same VRM are deduped for 10 minutes.

Admin settings open from the top bar (`pages/admin/settings.js`): site identity, login, kiosk registration, feature flags. They overlay the home screen; they are not a separate route in the APK home flow.

Other routes: `/verify` (permit check), `/share` (Web Share Target landing), `/open-file`.

## Repo map

```
pages/                  routes and the two Next API proxies
components/             kiosk UI (VRM flow, keyboard, chat, verify)
lib/permits.js          settings, permits, sync, heartbeat, payments
lib/kiosk-plugin.js     JS bridge to the Android Kiosk plugin
lib/updater.js          version.json poll + silent APK install
android/                Capacitor Android project (this is the one that builds)
kiosk-configs.json      all site variants (source of truth)
kiosk.config.json       one site, written at APK build time and bundled
build-and-sign-apk.sh   the only supported APK build
```

Ignore the loose `app/`, `build.gradle`, and `settings.gradle` at the repo root. The Capacitor project is `android/`.

Native plugin: `android/app/src/main/java/com/ldk/kiosk/KioskPlugin.java` (`rebootApp`, `installApk`, silent install, device-owner / lock-task). Web stubs in `lib/kiosk-plugin.js` no-op so browser dev does not crash.

## Site config

Add or edit a site in `kiosk-configs.json`. Keys in use include `selwyn-court`, `btp-phoenix`, `puregym-stafford`, `barnaby-house`. Fields the build injects into `kiosk.config.json`:

| Field | Role |
| --- | --- |
| `siteId`, `siteName`, `kioskName`, `kioskId` | Identity. Empty `kioskId` means the device is not pre-registered |
| `appLabel` | Android launcher name (`strings.xml` is patched) |
| `defaultHours` | Permit length when the user does not pick one |
| `expiryMode` | `midnight` rolls expiry to midnight; otherwise duration-based |
| `durationOptions` | `{ label, hours, description }`. `hours: null` is an indefinite permit |
| `reRegisterCooldownMinutes` | Block re-issue of the same VRM |
| `qrRefreshSeconds` | QR home rotation |

`homeMode` is **not** stored per site. Pass `--home-mode qr` or `--home-mode regular` at build time. It is written into `kiosk.config.json` and becomes the default in `getSettings()`.

`kiosk.config.json` in the repo is whatever the last build wrote (currently PureGym Stafford, QR). Do not hand-edit it for a release; the build script overwrites it.

### Duration synchronization

Bundled duration settings are initial/offline defaults. Compatible builds save the complete Firestore duration configuration from heartbeat: default hours, every menu option (including stable codes, labels and descriptions), midnight expiry and the printed QR override. Saved server durations take precedence over bundled values for the same kiosk/site and survive restarts. Menus update while idle, confirming a vehicle or selecting a duration; updates during payment/issuance wait until idle. The printed QR override is retained for configuration consistency; it does not replace the physical kiosk's duration choices.

**Routine changes are made in the website dashboard**, not this JSON: **Kiosks -> Configure -> Save & sync config**. The next startup/reconnect/90-second heartbeat fetches current Firestore settings. **Refresh saved config on kiosk** or the admin **Reload Config** command also requests reapplication on the next poll. The complete configuration is persisted before acknowledging the command; a reload does not start a recursive heartbeat. Content revisions are reported for both saved configuration and the menu loaded by `VrmLookupFlow`, so the dashboard does not mistake a Firestore save for device confirmation. Invalid configurations retain the last good menu, display an error, and report it back.

To synchronize this repository's `kiosk-configs.json` with Firestore, run `npm run kiosks:sync-durations -- ...` **from the website repository**:

```bash
# Preview runtime -> this app's build catalog
npm run kiosks:sync-durations -- --direction firestore-to-kiosk --kiosk-config /absolute/path/to/kiosk-configs.json

# Preview this app's build catalog -> runtime
npm run kiosks:sync-durations -- --direction kiosk-to-firestore --kiosk-config /absolute/path/to/kiosk-configs.json
```

Add `--key barnaby-house` to select one kiosk, and `--apply` only after reviewing the preview. Commit reviewed JSON changes here. Changing JSON alone does not update installed APKs. Older builds that do not apply remote durations need a new APK before dashboard menu changes can reach them.

Regression checks: `node --experimental-vm-modules --test lib/kioskDurations.test.mjs lib/kioskHeartbeat.test.mjs`.

## Backend calls

All live in `lib/permits.js`. Native uses `https://www.ldkgroup.co.uk/api`. Browser uses `/backend-api`, rewritten in `next.config.js`.

| Call | Path |
| --- | --- |
| Issue permit | `POST /epermits/dispatch` |
| Extend | `POST /extend-permit` |
| Permits by VRM / id | `GET` helpers in `getPermitsByVRM`, `getPermitById` |
| Car check | `lookupCarCheck` (kiosk key, GET, no `Content-Type`) |
| Heartbeat | `POST /kiosk/heartbeat` |
| Ack command | `POST /kiosk/ack-command` |
| Kiosk CRUD | `/kiosk/manage` |
| Square | `POST /payments/square/create-payment` |
| Login | Browser: `POST /api/kiosk/auth`. Native: `POST {backend}/kiosk/auth` |

Auth header rules (backend is strict):

- Prefer `Authorization: Bearer <firebase token>` when a kiosk login exists.
- Otherwise `X-Kiosk-Key`. A default key is hardcoded in `lib/permits.js`. Do not copy it into docs, commits, or logs.
- GET + kiosk key must **omit** `Content-Type` or the API returns 401.

`pages/api/kiosk/lookup-vrm.js` is a dev proxy. It talks to the Render host, not `www.ldkgroup.co.uk`. If browser lookup and device lookup disagree, that split is why.

## Offline, heartbeat, updates

`pages/_app.js` starts three loops: PWA client, `startOfflineSync()`, `startAutoUpdater()`.

- Permits that fail to dispatch are queued in IndexedDB and retried. Known VRMs are cached for offline verify.
- Heartbeat posts kiosk id, serial, version, status. The response can include `commands`.
- Commands (`executeCommand` in `lib/permits.js`): `reboot_app`, `update_apk`, `display_message`, `set_maintenance`, `clear_maintenance`, `reload_config` / `set_config` / `set_duration`, `sync_allowed_list`. UI listens for `kiosk:*` events. Ack happens after the command finishes.
- `lib/updater.js` polls `updateManifestUrl` (default `/version.json`) about every 10 minutes and can silent-install via the plugin.

Tablets (shortest side ≥ 600px, or longest ≥ 900px) lock landscape.

## Build an APK

From the repo root, always:

```bash
echo n | ./build-and-sign-apk.sh --site selwyn-court --home-mode qr
echo n | ./build-and-sign-apk.sh --site btp-phoenix --home-mode regular
```

- `--site` must be a key in `kiosk-configs.json`. Omit it to print the list.
- `--home-mode` is `qr` or `regular`. Always pass it.
- `echo n` answers the install prompt. Do not install on a connected device unless someone asked.

The script injects `kiosk.config.json`, patches `android/app/src/main/res/values/strings.xml`, runs `npm run build:web`, `npm run native:gen`, `npx cap copy android`, then `./gradlew assembleRelease`, verifies with `apksigner`, and copies `ldk-kiosk-<site-key>.apk` to the repo root. SDK is 33, build-tools `33.0.2`, under `$HOME/Android/Sdk`.

`build-new-sites.sh` batches a fixed site list into `builds/YYYY-MM-DD/`. It does not pass `--home-mode` (script default is `regular`).

Do not drive an APK with raw `gradlew assembleRelease`, `npx cap copy`, or `npm run build:web`. Cursor agents follow `.cursor/rules/apk-builds.mdc`.

## Local dev

```bash
npm install
npm run dev          # next dev, generates icons first
```

`npm run dev` is the browser kiosk. It is not a substitute for a site APK: home mode and site identity come from the current `kiosk.config.json` unless changed in admin settings.

Android Studio / live device (separate from a signed release):

```bash
npx cap run android
```

Needs a device or emulator. Release signing still goes through `build-and-sign-apk.sh`.

## Where to change things

| Task | Touch |
| --- | --- |
| New site or permit duration | `kiosk-configs.json`, then rebuild that site |
| Check-in / payment UI | `components/VrmLookupFlow.js` |
| QR home | `pages/qr.js` |
| API, sync, heartbeat | `lib/permits.js` |
| Remote command behavior | `executeCommand` in `lib/permits.js`, listeners in `pages/_app.js`, native work in `KioskPlugin.java` |
| OTA install | `lib/updater.js` |
| Launcher icon | `public/img/logo_light.png`, then `npm run native:gen` |

## Gotchas

- Two backends. Device traffic uses `www.ldkgroup.co.uk`. The Next auth and VRM proxies use the Render host.
- `pages/api/permits.js` is an in-memory stub. Real issue/extend goes to `/epermits/dispatch` and `/extend-permit`.
- Keystore (`android.keystore`) and the default kiosk API key live in the repo. Treat them as secrets; do not paste them into new docs.
- `twa-manifest.json` describes an older Vercel TWA (`elohwine-ldk-group-e-permit-kiosk.vercel.app`). Shipping kiosks are the Capacitor APK, not that TWA.
- `strings.xml` and `kiosk.config.json` are build outputs. A site build will overwrite them.
