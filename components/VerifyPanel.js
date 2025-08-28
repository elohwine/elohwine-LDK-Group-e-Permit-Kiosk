import { useEffect, useState } from "react";
import { Box, Typography, Alert, TextField, Button, Paper, Divider, Grid } from "@mui/material";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import { getPermitById, getPermitsByVRM, verifyOfflineFromQuery } from "../lib/permits";

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
        const ps = await getPermitsByVRM(vrmQ);
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
      const ps = await getPermitsByVRM(vrm);
      setResult({ type:"vrm", permits: ps, ok: ps && ps.length>0 });
    }
  }

  return (
  <Paper elevation={embedded ? 8 : 10} sx={{ p: { xs: 2, sm: 3 }, pb: 'calc(var(--kbd-inset, 0px) + 48px)', borderRadius:3, bgcolor:'background.paper' }}>
      <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1 }}>
        <FactCheckIcon color="error"/>
        <Typography variant="h5" color="error.main">Verify</Typography>
      </Box>
      {!embedded && <Typography variant="body2" sx={{ color:'text.secondary', mb:2 }}>Check a permit by ID, VRM, or QR.</Typography>}
      <Divider sx={{ mb:2, opacity:0.1 }}/>
      <Box sx={{ display:"flex", gap:2, mb:2, flexWrap:'wrap' }}>
        <Button size="large" variant={mode==="id"?"contained":"outlined"} onClick={()=>setMode("id")}>Permit ID</Button>
        <Button size="large" variant={mode==="vrm"?"contained":"outlined"} onClick={()=>setMode("vrm")}>VRM Lookup</Button>
      </Box>
      {mode==="id" && (
        <Grid container spacing={2} alignItems="center" sx={{ mb:2 }}>
          <Grid item xs={12} md={8}>
            <TextField fullWidth label="Permit ID" value={id} onChange={e=>setId(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Button fullWidth size="large" variant="contained" onClick={manualLookup}>Lookup</Button>
          </Grid>
        </Grid>
      )}
      {mode==="vrm" && (
        <Grid container spacing={2} alignItems="center" sx={{ mb:2 }}>
          <Grid item xs={12} md={8}>
            <TextField fullWidth label="VRM" value={vrm} onChange={e=>setVrm(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Button fullWidth size="large" variant="contained" onClick={manualLookup}>Search</Button>
          </Grid>
        </Grid>
      )}

      {result && (
        <Box>
          {result.type==="qr" && (
            result.ok ? <Alert severity="success">QR OK for {result.payload.vrm} at {result.payload.siteId}</Alert>
                      : <Alert severity="error">QR invalid: {result.reason || "signature mismatch"}</Alert>
          )}
          {result.type==="id" && (
            result.ok ? <Alert severity="success">Found permit {result.permit?.id} for {result.permit?.vrm}</Alert>
                      : <Alert severity="error">No permit found</Alert>
          )}
          {result.type==="vrm" && (
            result.ok ? <Alert severity="success">Found {result.permits.length} for VRM</Alert>
                      : <Alert severity="error">No permits for that VRM</Alert>
          )}
          {result.permits && result.permits.map(p => (
            <Box key={p.id} sx={{ mt:2, p:2, border:"1px solid rgba(255,255,255,0.1)", borderRadius:2 }}>
              <div><b>ID:</b> {p.id}</div>
              <div><b>VRM:</b> {p.vrm}</div>
              <div><b>Site:</b> {p.siteId}</div>
              <div><b>Start:</b> {new Date(p.start).toLocaleString()}</div>
              <div><b>End:</b> {new Date(p.end).toLocaleString()}</div>
              <div><b>Mode:</b> {p.mode}</div>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}
