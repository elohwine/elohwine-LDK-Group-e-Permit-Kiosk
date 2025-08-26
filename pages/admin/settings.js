import { useEffect, useState } from "react";
import { Box, Typography, TextField, Switch, FormControlLabel, Button, Alert, Paper, Grid } from "@mui/material";
import { getSettings, saveSettings } from "../../lib/permits";

export default function Settings() {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(()=>{ (async()=> setS(await getSettings()))(); },[]);

  if (!s) return null;

  function updateField(k,v){
    setS(prev => ({ ...prev, [k]: v }));
  }

  async function onSave(){
    await saveSettings(s);
    setSaved(true);
    setTimeout(()=>setSaved(false), 2000);
  }

  return (
    <Box sx={{ p:3 }}>
      <Paper elevation={10} sx={{ p:3, borderRadius:3 }}>
        <Typography variant="h5" sx={{ mb:2 }}>Admin Settings</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Mode (online/offline)" value={s.mode} onChange={e=>updateField("mode", e.target.value)} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth label="Site ID" value={s.siteId} onChange={e=>updateField("siteId", e.target.value)} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth type="number" label="Default Hours" value={s.defaultHours} onChange={e=>updateField("defaultHours", parseFloat(e.target.value))} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Permit Prefix" value={s.permitPrefix} onChange={e=>updateField("permitPrefix", e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="API Base" value={s.apiBase} onChange={e=>updateField("apiBase", e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="HMAC Secret" value={s.hmacSecret} onChange={e=>updateField("hmacSecret", e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel control={<Switch checked={!!s.qrEnabled} onChange={e=>updateField("qrEnabled", e.target.checked)} />} label="QR Enabled" />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel control={<Switch checked={!!s.kioskKeyboardEnabled} onChange={e=>updateField("kioskKeyboardEnabled", e.target.checked)} />} label="Kiosk on‑screen keyboard" />
            <FormControlLabel control={<Switch checked={!!s.kioskKeyboardAutoOpen} onChange={e=>updateField("kioskKeyboardAutoOpen", e.target.checked)} />} label="Auto‑open on focus" />
          </Grid>
        </Grid>
        <Box sx={{ mt:2, display:'flex', gap:2 }}>
          <Button variant="contained" onClick={onSave}>Save</Button>
          {saved && <Alert severity="success">Saved</Alert>}
        </Box>
      </Paper>
    </Box>
  );
}
