# Kiosk ePermit (Next.js + PWA)

- JS only (no TS)
- PWA-ready via `next-pwa`
- Tablet-friendly kiosk layout: service cards on the right, active service on the left
- Admin Settings: `/admin/settings` stored in `localStorage`
- Hybrid issuance: online (mock API) → offline fallback (IndexedDB + HMAC) with optional QR
- Verification modes: `/verify?id=ID`, `/verify?vrm=VRM`, `/verify?d=<base64>&s=<hmac>`
- Kiosk mode: launch Chrome with `--kiosk --app=http://localhost:3000`

## Dev
```bash
npm i
npm run dev
```
