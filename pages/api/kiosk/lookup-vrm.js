const BACKEND_BASE = "https://ldk-group-ltd-website-react-l2km.onrender.com/api";
const AUTH_URL = `${BACKEND_BASE}/kiosk/auth`;
const PERMITS_URL = `${BACKEND_BASE}/permits/by-vrm`;

// Server-side token cache (avoids re-auth on every request)
let cachedToken = null;
let tokenExpiry = 0;

async function getToken(email, password) {
  // Reuse token if still fresh (refresh 5 min before expiry)
  if (cachedToken && Date.now() < tokenExpiry - 5 * 60 * 1000) {
    return cachedToken;
  }
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.token) return null;
  cachedToken = data.token;
  // Firebase tokens last ~1 hour; cache for 50 min
  tokenExpiry = Date.now() + 50 * 60 * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { vrm, siteId } = req.query;
  if (!vrm || !siteId) {
    return res.status(400).json({ error: "vrm and siteId are required" });
  }

  // Use token from client Authorization header first
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  // Try with client token first
  if (token) {
    try {
      const url = `${PERMITS_URL}?vrm=${encodeURIComponent(vrm)}&siteId=${encodeURIComponent(siteId)}`;
      const upstream = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (upstream.ok) {
        const data = await upstream.json();
        return res.status(200).json(data);
      }
    } catch {}
  }

  // Client token failed or missing — try server-side re-auth
  // Read credentials from request body or stored settings passed as headers
  const email = req.headers["x-kiosk-email"];
  const password = req.headers["x-kiosk-pass"];

  if (email && password) {
    try {
      const freshToken = await getToken(email, password);
      if (freshToken) {
        const url = `${PERMITS_URL}?vrm=${encodeURIComponent(vrm)}&siteId=${encodeURIComponent(siteId)}`;
        const upstream = await fetch(url, {
          headers: { Authorization: `Bearer ${freshToken}` },
        });
        if (upstream.ok) {
          const data = await upstream.json();
          // Also return the fresh token so client can update its stored token
          res.setHeader("X-Fresh-Token", freshToken);
          return res.status(200).json(data);
        }
        const errData = await upstream.json().catch(() => ({}));
        return res.status(upstream.status).json(errData);
      }
    } catch (err) {
      console.error("[lookup-vrm] server-side auth failed:", err.message);
    }
  }

  return res.status(401).json({ error: "Unable to authenticate. Please log in again from Settings." });
}
