# Copilot prompt — Android kiosk remote command execution (Capacitor)

## Context
The LDK parking kiosk app is built with **React + Capacitor** (`@capacitor/android`). It communicates with a Next.js backend. The heartbeat endpoint delivers remote commands alongside kiosk config. You must implement full command execution — currently only `display_message` works because all other commands require native Android code via a Capacitor plugin.

## Heartbeat endpoint contract

**POST** `/api/kiosk/heartbeat`  
**Header:** `X-Kiosk-Key: <KIOSK_API_KEY>`  
**Body:** `{ kioskId, serialNumber, softwareVersion, status, ... }`

**Response shape:**
```json
{
  "success": true,
  "kiosk": {
    "kioskId": "abc",
    "name": "Selwyn Court",
    "defaultDurationHours": 4,
    "expireAtMidnight": false,
    "paymentsEnabled": true,
    "pdfDeliveryEnabled": true,
    "status": "online"
  },
  "commands": [
    {
      "id": "1714000000_abc123",
      "type": "display_message",
      "payload": { "text": "Lot closed", "duration": 5000 },
      "issuedBy": "uid",
      "status": "pending"
    }
  ]
}
```

`commands` may be `[]` — always handle that case.

## Ack endpoint contract

**POST** `/api/kiosk/ack-command`  
**Header:** `X-Kiosk-Key: <KIOSK_API_KEY>`  
**Body:** `{ "kioskId": "abc", "commandId": "1714000000_abc123" }`  
**Response:** `{ "success": true }`  
Idempotent — safe to retry on network failure.

---

## Part 1 — React/JS layer (no native code needed)

### 1a. Read config from every heartbeat response

After every successful heartbeat, apply `response.kiosk` to app state **before** processing commands:

```js
// e.g. in your heartbeat handler / Zustand store / Context
const { kiosk, commands } = await heartbeatResponse.json();

setConfig({
  defaultDurationHours: kiosk.defaultDurationHours ?? 4,
  expireAtMidnight:     kiosk.expireAtMidnight     ?? false,
  paymentsEnabled:      kiosk.paymentsEnabled       ?? true,   // NEW
  pdfDeliveryEnabled:   kiosk.pdfDeliveryEnabled    ?? true,   // NEW
});

for (const cmd of commands ?? []) {
  await executeCommand(cmd);
}
```

### 1b. Gate UI on config flags

```jsx
// Payment button — hide entirely when disabled
{config.paymentsEnabled && <PayButton onClick={...} />}

// PDF email option — disable when off (server also enforces it)
<Checkbox
  checked={wantsPdf && config.pdfDeliveryEnabled}
  disabled={!config.pdfDeliveryEnabled}
  label="Send PDF to email"
/>
```

### 1c. Permit duration — do NOT send explicit endDate from kiosk

The server computes `endDate` from `defaultDurationHours` / `expireAtMidnight` when no `endDate` is in the request body. If the kiosk sends an `endDate` it pre-calculated from stale local state, the server ignores the config. Fix:

```js
// When issuing a kiosk permit, omit endDate entirely:
const body = {
  vrm, siteId, kioskId,
  // NO endDate / endTime — let the server apply defaultDurationHours
};
await fetch('/api/epermits/dispatch', { method: 'POST', body: JSON.stringify(body) });
```

### 1d. executeCommand — JS-only command types

Commands that are pure JS (already work or just need to be wired up):

| type | JS action |
|---|---|
| `display_message` | Show toast/overlay with `payload.text` for `payload.duration` ms — **already works** |
| `set_maintenance` | Show maintenance overlay, display `payload.reason` |
| `clear_maintenance` | Hide maintenance overlay |
| `sync_allowed_list` | Re-fetch VRM allowed list from server |
| `reload_config` | Call `sendHeartbeat()` immediately |

Always ack after execution:
```js
async function ackCommand(commandId) {
  await fetch('/api/kiosk/ack-command', {
    method: 'POST',
    headers: { 'X-Kiosk-Key': KIOSK_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kioskId, commandId }),
  });
}
```

---

## Part 2 — Capacitor native plugin (Java/Kotlin)

Two commands need Android native code: `reboot_app` and `update_apk`. Implement them as a local **Capacitor plugin** — do NOT use raw `@JavascriptInterface` or DOM events for these.

### 2a. Create `KioskPlugin.java` in the Android module

```
android/app/src/main/java/com/ldk/kiosk/KioskPlugin.java
```

```java
package com.ldk.kiosk;

import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.*;
import java.net.URL;

@CapacitorPlugin(name = "Kiosk")
public class KioskPlugin extends Plugin {

    /** Ack first in JS, then call this — kills the process so Android restarts it */
    @PluginMethod
    public void rebootApp(PluginCall call) {
        call.resolve();
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            android.os.Process.killProcess(android.os.Process.myPid());
        }, 500);
    }

    /**
     * Downloads an APK from payload.url and launches the system installer.
     * Requires: android.permission.REQUEST_INSTALL_PACKAGES in AndroidManifest.xml
     * Requires: FileProvider configured in AndroidManifest.xml (authority = packageName + ".provider")
     */
    @PluginMethod
    public void installApk(PluginCall call) {
        String apkUrl = call.getString("url");
        if (apkUrl == null || apkUrl.isEmpty()) {
            call.reject("url is required");
            return;
        }

        new Thread(() -> {
            try {
                // Download APK to cache dir
                File apkFile = new File(getContext().getCacheDir(), "update.apk");
                try (InputStream in  = new URL(apkUrl).openStream();
                     OutputStream out = new FileOutputStream(apkFile)) {
                    byte[] buf = new byte[4096];
                    int n;
                    while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
                }

                // Launch installer intent via FileProvider (required Android 7+)
                Uri apkUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".provider",
                    apkFile
                );
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);

                call.resolve();
            } catch (Exception e) {
                call.reject("APK install failed: " + e.getMessage(), e);
            }
        }).start();
    }
}
```

### 2b. Register the plugin in `MainActivity.java`

The existing `MainActivity.java` already extends `BridgeActivity`. Add ONE line — `registerPlugin` must come **before** `super.onCreate`:

```java
import com.ldk.kiosk.KioskPlugin;

// Inside onCreate, BEFORE super.onCreate(savedInstanceState):
registerPlugin(KioskPlugin.class);
super.onCreate(savedInstanceState);
```

### 2c. Add required permissions to `AndroidManifest.xml`

Only ONE permission is missing from the existing manifest — add it inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
```

**Do NOT add** `INTERNET`, `FileProvider`, or `file_paths.xml` — they already exist in the project.

The existing FileProvider authority is `${applicationId}.fileprovider` (NOT `.provider`).
Update `KioskPlugin.java` accordingly:

```java
Uri apkUri = FileProvider.getUriForFile(
    getContext(),
    getContext().getPackageName() + ".fileprovider",  // matches existing AndroidManifest
    apkFile
);
```

### 2d. Register and call from JavaScript

```js
// kiosk-plugin.js  (shared module)
import { registerPlugin } from '@capacitor/core';

export const KioskPlugin = registerPlugin('Kiosk', {
  web: {
    // Stub for browser dev — no-ops
    rebootApp:  async () => { console.warn('[web] rebootApp noop'); },
    installApk: async () => { console.warn('[web] installApk noop'); },
  },
});
```

### 2e. Wire into executeCommand

```js
import { KioskPlugin } from './kiosk-plugin';

async function executeCommand(cmd) {
  try {
    switch (cmd.type) {
      case 'display_message':
        showToast(cmd.payload.text, cmd.payload.duration);
        break;

      case 'reboot_app':
        await ackCommand(cmd.id);        // MUST ack before killing process
        await KioskPlugin.rebootApp();   // process dies here
        return;                          // won't reach further

      case 'update_apk':
        await KioskPlugin.installApk({ url: cmd.payload.url });
        break;

      case 'set_maintenance':
        setMaintenanceMode(true, cmd.payload?.reason);
        break;

      case 'clear_maintenance':
        setMaintenanceMode(false);
        break;

      case 'sync_allowed_list':
        await fetchAllowedList();
        break;

      case 'reload_config':
        await sendHeartbeat();
        return; // heartbeat already acks within its own flow if needed
        
      default:
        console.warn('Unknown command type:', cmd.type);
    }

    await ackCommand(cmd.id);
  } catch (err) {
    console.error('executeCommand failed:', cmd.type, err);
    // Do NOT ack on failure — server keeps the command as delivered.
    // Next heartbeat won't re-deliver (it's already marked delivered),
    // but at least we don't falsely confirm a broken action.
  }
}
```

---

## Summary: what each command needs

| Command | Where the work happens | Native plugin? |
|---|---|---|
| `display_message` | React — toast/overlay | No — **already works** |
| `set_maintenance` | React — overlay state | No |
| `clear_maintenance` | React — overlay state | No |
| `sync_allowed_list` | React — fetch call | No |
| `reload_config` | React — call `sendHeartbeat()` | No |
| `reboot_app` | **`KioskPlugin.rebootApp()`** | **Yes** — `killProcess()` |
| `update_apk` | **`KioskPlugin.installApk()`** | **Yes** — download + install Intent |
| `paymentsEnabled` | React — gate payment UI | No — read from `kiosk.*` in heartbeat |
| `pdfDeliveryEnabled` | React — gate PDF checkbox | No — read from `kiosk.*` in heartbeat |
| permit duration | React — omit `endDate` from request | No — server applies `defaultDurationHours` |

## Rules
- `set_duration` / `set_config` are **never** in `commands[]`. New values arrive in `kiosk.*` on the next heartbeat. No ack needed.
- Process commands in order. Do not skip a command when one fails.
- Commands are one-shot — if the app crashes before acking, the command is gone (server won't re-deliver). Only ack after the action succeeds.
- Exception: `reboot_app` — ack first, then kill process.
- Default all config booleans to `true` so kiosks without those fields set in Firestore keep full functionality.
