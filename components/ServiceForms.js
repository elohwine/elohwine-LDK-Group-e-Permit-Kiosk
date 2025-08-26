import { useEffect, useState } from "react";
import { TextField, Button, Typography, Box, Alert, Paper, Divider, Grid, CircularProgress } from "@mui/material";
import { issuePermit, getSettings } from "../lib/permits";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import FeedbackDialog from "./animated/FeedbackDialog";

export default function ServiceForms() {
  const [vrm, setVrm] = useState("");
  const [email, setEmail] = useState("");
  const [hours, setHours] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Success/Error dialog state
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgType, setDlgType] = useState('success');
  const [dlgMsg, setDlgMsg] = useState('');
  const [dlgDetails, setDlgDetails] = useState(null);

  const [settings, setSettings] = useState({});
  useEffect(()=>{ (async()=> setSettings(await getSettings()))(); },[]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    if (!vrm) { setError("VRM is required"); return; }
    try {
      const { permit, online } = await issuePermit({
        vrm, email: email || undefined, hours: hours ? parseFloat(hours) : undefined
      });
      setResult({ permit, online });
      // Open success dialog with details
      setDlgType('success');
      setDlgMsg('Permit issued successfully');
      setDlgDetails({
        id: permit.id,
        vrm: permit.vrm,
        siteId: permit.siteId,
        start: permit.start,
        end: permit.end,
        mode: online ? 'online' : 'offline'
      });
      setDlgOpen(true);
    } catch (e) {
      const msg = e?.message || "Failed to issue permit";
      setError(msg);
      setDlgType('error');
      setDlgMsg(msg);
      setDlgDetails(null);
      setDlgOpen(true);
    } finally {
      setLoading(false);
    }
  }

  return (
  <Paper elevation={12} sx={{ position:'relative', overflow:'hidden', p: 3, pb: 'calc(var(--kbd-inset, 0px) + 48px)', borderRadius: 3, bgcolor: 'background.paper' }}>
      <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1 }}>
        <QrCode2Icon color="primary"/>
        <Typography variant="h5">Virtual e‑Permits</Typography>
      </Box>
  <Divider sx={{ mb:2, opacity:0.1 }}/>
  <Box component="form" onSubmit={onSubmit} sx={{ maxWidth: 880 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <TextField fullWidth label="Vehicle Registration (VRM)" value={vrm} onChange={e=>setVrm(e.target.value)} required/>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label={`Hours (default ${settings.defaultHours ?? 2})`} type="number" inputMode="decimal" inputProps={{ min: 0.5, step: 0.5 }} value={hours} onChange={e=>setHours(e.target.value)}/>
          </Grid>
          <Grid item xs={12} md={12}>
            <TextField fullWidth label="Email (optional for reminder notifications)" type="email" value={email} onChange={e=>setEmail(e.target.value)}/>
          </Grid>
          <Grid item xs={12} md={12}>
            <Box sx={{ display:'flex', gap:2, flexWrap:'wrap', pt: 1, alignItems:'center' }}>
              <Button type="submit" variant="contained" size="large" disabled={loading}>
                {loading ? (
                  <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                    <CircularProgress size={18} color="inherit"/>
                    Issuing...
                  </Box>
                ) : 'Issue Permit'}
              </Button>
              <Button variant="outlined" href="/verify" size="large">Verify</Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
      {error && <Alert sx={{ mt:2 }} severity="error">{error}</Alert>}

      {/* Success / Error dialog with Lottie */}
      <FeedbackDialog
        open={dlgOpen}
        onClose={()=>setDlgOpen(false)}
        type={dlgType}
        title={dlgType==='success' ? 'Permit Issued' : 'Issuance Failed'}
        message={dlgMsg}
        details={dlgDetails}
  lottiePath={dlgType==='success' ? '/lottie/success.json' : '/lottie/Error.json'}
        onPrimary={()=>setDlgOpen(false)}
        primaryText={dlgType==='success' ? 'Done' : 'Retry'}
      />
    </Paper>
  );
}
