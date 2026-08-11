import { useEffect, useState } from "react";
import { Box, Typography, Alert, TextField, Button, Paper, Divider, Grid } from "@mui/material";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import dynamic from "next/dynamic";

function formatUkDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
import { getPermitById, getPermitsByVRM, verifyOfflineFromQuery } from "../lib/permits";
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

function useLottieData(path) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let m = true;
    (async () => {
      try {
        const res = await fetch(path, { cache: 'force-cache' });
        if (res.ok && m) setData(await res.json());
      } catch {}
    })();
    return () => { m = false; };
  }, [path]);
  return data;
}

function LottieErrorBlock({ message }) {
  const errorAnim = useLottieData('/lottie/Error.json');
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: 2, bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(211,47,47,0.08)' : 'rgba(211,47,47,0.06)', border: '1px solid', borderColor: 'error.main' }}>
      {errorAnim && <Lottie animationData={errorAnim} loop={false} style={{ width: '3rem', height: '3rem', flexShrink: 0 }} />}
      <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600, fontSize: { xs: '0.8rem', sm: '0.9rem' } }}>{message}</Typography>
    </Box>
  );
}

export default function VerifyPanel({ embedded = false }){
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState("id");
  const [vrm, setVrm] = useState("");
  const [id, setId] = useState("");

  useEffect(()=>{
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const q = url.searchParams;
    const hasQR = q.get("d") && q.get("s");
    (async ()=>{
      if (hasQR) {
        const r = await verifyOfflineFromQuery(q);
        setMode("id");
        setResult({ type: "qr", ...r });
      } else if (q.get("id")) {
        const p = await getPermitById(q.get("id"));
        setMode("id");
        setId(q.get("id"));
        setResult({ type:"id", permit: p, ok: !!p });
      } else if (q.get("vrm")) {
        const vrmQ = q.get("vrm");
        const { permits: ps } = await getPermitsByVRM(vrmQ);
        setMode("vrm");
        setVrm(vrmQ);
        setResult({ type:"vrm", permits: ps, ok: ps && ps.length>0 });
      }
    })();
  },[]);

  async function manualLookup(){
    if (mode === "id" && id) {
      const p = await getPermitById(id);
      setResult({ type:"id", permit: p, ok: !!p });
    } else if (mode === "vrm" && vrm) {
      const { permits: ps } = await getPermitsByVRM(vrm);
      setResult({ type:"vrm", permits: ps, ok: ps && ps.length>0 });
    }
  }

  return (
  <Paper elevation={embedded ? 8 : 10} sx={{ p: { xs: 1.5, sm: 2.5, md: 3.5 }, pb: 'calc(var(--kbd-inset, 0px) + 36px)', borderRadius: { xs: 2, sm: 3 }, bgcolor:'background.paper' }}>
      <Box sx={{ display:'flex', alignItems:'center', gap: { xs: 0.5, sm: 1 }, mb: { xs: 0.5, sm: 1 } }}>
        <FactCheckIcon color="error" sx={{ fontSize: { xs: '1.3rem', sm: '1.6rem' } }} />
        <Typography variant="h5" color="error.main" sx={{ fontSize: { xs: '1.05rem', sm: '1.35rem' } }}>Verify</Typography>
      </Box>
      {!embedded && <Typography variant="body2" sx={{ color:'text.secondary', mb: { xs: 1, sm: 2 }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Check a permit by ID, VRM, or QR.</Typography>}
      <Divider sx={{ mb: { xs: 1, sm: 2 }, opacity:0.1 }}/>
      <Box sx={{ display:"flex", gap: { xs: 1, sm: 2 }, mb: { xs: 1, sm: 2 }, flexWrap:'wrap' }}>
        <Button size="medium" variant={mode==="id"?"contained":"outlined"} onClick={()=>setMode("id")}>Permit ID</Button>
        <Button size="medium" variant={mode==="vrm"?"contained":"outlined"} onClick={()=>setMode("vrm")}>VRM Lookup</Button>
      </Box>
      {mode==="id" && (
        <Grid container spacing={{ xs: 1, sm: 2 }} alignItems="center" sx={{ mb: { xs: 1, sm: 2 } }}>
          <Grid item xs={12} md={8}>
            <TextField fullWidth size="small" label="Permit ID" value={id} onChange={e=>setId(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Button fullWidth size="medium" variant="contained" onClick={manualLookup}>Lookup</Button>
          </Grid>
        </Grid>
      )}
      {mode==="vrm" && (
        <Grid container spacing={{ xs: 1, sm: 2 }} alignItems="center" sx={{ mb: { xs: 1, sm: 2 } }}>
          <Grid item xs={12} md={8}>
            <TextField fullWidth size="small" label="VRM" value={vrm} onChange={e=>setVrm(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Button fullWidth size="medium" variant="contained" onClick={manualLookup}>Search</Button>
          </Grid>
        </Grid>
      )}

      {result && (
        <Box>
          {result.type==="qr" && (
            result.ok ? <Alert severity="success">QR OK for {result.payload.vrm} at {result.payload.siteId}</Alert>
                      : <LottieErrorBlock message={`QR invalid: ${result.reason || "signature mismatch"}`} />
          )}
          {result.type==="id" && (
            result.ok ? <Alert severity="success">Found permit {result.permit?.id} for {result.permit?.vrm}</Alert>
                      : <LottieErrorBlock message="No permit found" />
          )}
          {result.type==="vrm" && (
            result.ok ? <Alert severity="success">Found {result.permits.length} for VRM</Alert>
                      : <LottieErrorBlock message="No permits for that VRM" />
          )}
          {result.permits && result.permits.map(p => (
            <Box key={p.id} sx={{ mt: { xs: 1, sm: 2 }, p: { xs: 1, sm: 2 }, border:"1px solid rgba(255,255,255,0.1)", borderRadius:2, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
              <div><b>ID:</b> {p.id}</div>
              <div><b>VRM:</b> {p.vrm}</div>
              <div><b>Site:</b> {p.siteId}</div>
              <div><b>Start:</b> {formatUkDateTime(p.start)}</div>
              <div><b>End:</b> {formatUkDateTime(p.end)}</div>
              <div><b>Mode:</b> {p.mode}</div>
              <div><b>Status:</b> {p.syncedAt ? `Synced to backend at ${formatUkDateTime(p.syncedAt)}` : (p.mode === 'online' ? 'Confirmed by backend' : 'Saved locally, pending sync')}</div>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}
