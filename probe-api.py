#!/usr/bin/env python3
import json, urllib.request, urllib.error

BASE = "https://www.ldkgroup.co.uk/api"
KIOSK_KEY = "c88ea0a21ca2dbdc72987b58f9d693f4658e579bf93ca7572b5600c1418a9534"

def req(method, path, headers=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as res:
            text = res.read().decode()
            try:
                return res.status, json.loads(text)
            except:
                return res.status, text[:300]
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        try:
            return e.code, json.loads(text)
        except:
            return e.code, text[:300]

# 1. Auth
print("=== 1. POST /kiosk/auth ===")
code, data = req("POST", "/kiosk/auth", body={"email": "elowine.tauro@ldkgroup.co.uk", "password": "Test123!"})
print(f"HTTP {code}")
print(json.dumps(data, indent=2) if isinstance(data, dict) else data)
TOKEN = data.get("token", "") if isinstance(data, dict) else ""
print(f"Token OK: {len(TOKEN) > 0}")

BEARER = {"Authorization": f"Bearer {TOKEN}"}
BEARER_KK = {"Authorization": f"Bearer {TOKEN}", "X-Kiosk-Key": KIOSK_KEY}
KK_ONLY = {"X-Kiosk-Key": KIOSK_KEY}

# 2. VRM lookup variations
for label, path, headers in [
    ("2. GET /permits/by-vrm (Bearer only)", "/permits/by-vrm?vrm=RT45TYU&siteId=SC4zaW84A9m1vB9Maz0X", BEARER),
    ("3. GET /permits/by-vrm (Bearer+KK)", "/permits/by-vrm?vrm=RT45TYU&siteId=SC4zaW84A9m1vB9Maz0X", BEARER_KK),
    ("4. GET /permits/by-vrm (KK only)", "/permits/by-vrm?vrm=RT45TYU&siteId=SC4zaW84A9m1vB9Maz0X", KK_ONLY),
]:
    print(f"\n=== {label} ===")
    code, data = req("GET", path, headers=headers)
    print(f"HTTP {code}")
    print(json.dumps(data, indent=2) if isinstance(data, dict) else data)

# 3. Issue endpoint probes
ISSUE_PAYLOAD = {"vrm": "KIOSK_PROBE_TEST", "siteId": "SC4zaW84A9m1vB9Maz0X", "hours": 1}
for label, path, headers in [
    ("5. POST /epermits/dispatch (Bearer only)", "/epermits/dispatch", BEARER),
    ("6. POST /epermits/dispatch (Bearer+KK)", "/epermits/dispatch", BEARER_KK),
    ("7. POST /epermits/dispatch (KK only)", "/epermits/dispatch", KK_ONLY),
    ("8. POST /epermits (Bearer only)", "/epermits", BEARER),
    ("9. POST /permits (Bearer only)", "/permits", BEARER),
    ("10. POST /kiosk/issue (Bearer only)", "/kiosk/issue", BEARER),
    ("11. POST /kiosk/epermit (Bearer only)", "/kiosk/epermit", BEARER),
    ("12. GET /kiosks (Bearer only)", "/kiosks", BEARER),
]:
    print(f"\n=== {label} ===")
    method = "GET" if label.startswith(("12.",)) else "POST"
    body = None if method == "GET" else ISSUE_PAYLOAD
    code, data = req(method, path, headers=headers, body=body)
    print(f"HTTP {code}")
    print(json.dumps(data, indent=2) if isinstance(data, dict) else str(data)[:400])
