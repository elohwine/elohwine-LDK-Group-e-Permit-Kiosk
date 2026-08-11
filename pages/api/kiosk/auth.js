const BACKEND_AUTH_URL =
  "https://ldk-group-ltd-website-react-l2km.onrender.com/api/kiosk/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const upstream = await fetch(BACKEND_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await upstream.json();

    if (!upstream.ok || !data.ok) {
      return res
        .status(upstream.ok ? 401 : upstream.status)
        .json({ error: data.error || "invalid_credentials" });
    }

    return res.status(200).json({
      token: data.token,
      uid: data.uid,
      role: data.role,
      siteIds: data.siteIds,
      displayName: data.displayName,
      email: data.email,
    });
  } catch (err) {
    console.error("[kiosk/auth]", err);
    return res.status(502).json({ error: "upstream_unavailable" });
  }
}
