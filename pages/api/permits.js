let memory = {};

function ok(res, data){ res.status(200).json(data); }
function bad(res, msg){ res.status(400).json({ error: msg }); }

export default function handler(req, res){
  if (req.method === "POST") {
    // Apply: create a new permit
    const b = req.body || {};
    if (!b.vrm || !b.siteId || !b.start || !b.end) return bad(res, "missing fields");
    const id = `API-${Date.now()}`;
    const permit = { vrm: String(b.vrm).toUpperCase().replace(/\s+/g, ''), siteId: b.siteId, start: b.start, end: b.end, email: b.email || null, id, mode: "online" };
    memory[id] = permit;
    return ok(res, permit);
  }
  if (req.method === "PUT") {
    // Renew: extend an existing permit by hours or set explicit end
    const b = req.body || {};
    const id = b.id;
    if (!id) return bad(res, "missing id");
    const existing = memory[id];
    if (!existing) return res.status(404).json({ error: 'not found' });
    const startIso = existing.start;
    const start = new Date(startIso);
    let end;
    if (typeof b.hours === 'number' && isFinite(b.hours) && b.hours > 0) {
      end = new Date(Math.max(Date.now(), new Date(existing.end).getTime()) + b.hours * 3600 * 1000);
    } else if (b.end) {
      end = new Date(b.end);
    } else {
      return bad(res, 'missing renewal info');
    }
    const newId = `API-${Date.now()}`;
    const renewed = { ...existing, id: newId, start: start.toISOString(), end: end.toISOString() };
    memory[newId] = renewed;
    return ok(res, renewed);
  }
  if (req.method === "GET") {
    // Verify: by id or vrm
    const { id, vrm } = req.query || {};
    if (id) {
      const p = memory[id];
      if (!p) return res.status(404).json({ error: "not found" });
      return ok(res, p);
    }
    if (vrm) {
      const v = (vrm+"").toUpperCase().replace(/\s+/g,"");
      const list = Object.values(memory).filter(p => p.vrm === v);
      return ok(res, list);
    }
    return ok(res, { count: Object.keys(memory).length });
  }
  res.status(405).end();
}
