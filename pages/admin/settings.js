import { useEffect, useState } from "react";
import { Box, Typography, TextField, Switch, FormControlLabel, Button, Alert, Paper, Grid, Divider, Chip, Select, MenuItem, InputLabel, FormControl } from "@mui/material";
import { getSettings, saveSettings, getSites } from "../../lib/permits";
import dynamic from 'next/dynamic';
const ManagerAssistant = dynamic(() => import('../../components/chat/ManagerAssistant'), { ssr: false });

export default function Settings({ onSaved }) {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  const [sites, setSites] = useState([]);
  useEffect(()=>{ (async()=> {
    setS(await getSettings());
    setSites(await getSites());
  })(); },[]);

  if (!s) return null;

  function updateField(k,v){
    setS(prev => ({ ...prev, [k]: v }));
  }

  async function onSave(){
    await saveSettings(s);
    setSaved(true);
  try { onSaved && onSaved(s); } catch {}
    setTimeout(()=>setSaved(false), 2000);
  }

  return (
    <Box sx={{ p:3, height: '100%', display:'flex', flexDirection:'column', minHeight: 0, overflow:'hidden' }}>
      <Grid container spacing={2} sx={{ flex:1, minHeight: 0 }}>
        <Grid item xs={12} md={7} sx={{ height:'100%', display:'flex', flexDirection:'column', minHeight:0 }}>
          <Paper elevation={10} sx={{ p:0, borderRadius:3, width: '100%', bgcolor:'background.paper', overflow:'auto', flex:1, minHeight:0 }}>
            <Box sx={{ position:'sticky', top:0, zIndex:1, bgcolor:'background.paper', borderBottom:(t)=>`1px solid ${t.palette.divider}`, px:3, py:2, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Admin Settings</Typography>
              <Box sx={{ display:'flex', gap:1 }}>
                <Button size="small" variant="outlined" onClick={()=>setS(prev=>({ ...(prev||{}), ...s }))}>Reset</Button>
                <Button size="small" variant="contained" onClick={onSave}>Save</Button>
              </Box>
            </Box>
            <Box sx={{ px:3, py:3 }}>
            <Grid container spacing={2}>
          {/* Site selection */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel id="site-select-label">Site</InputLabel>
              <Select
                labelId="site-select-label"
                label="Site"
                value={s.siteId || ''}
                onChange={(e)=>{
                  const sel = sites.find(x=>x.id===e.target.value);
                  updateField('siteId', e.target.value);
                  if (sel) updateField('siteName', sel.name);
                }}
              >
                {sites.map(site => (
                  <MenuItem key={site.id} value={site.id}>{site.name} ({site.id})</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
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

          {/* New: Site branding icons */}
          <Grid item xs={12}>
            <Divider textAlign="left"><Chip label="Branding" size="small" /></Divider>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Site Icon URL" value={s.siteIconUrl || ''} onChange={e=>updateField("siteIconUrl", e.target.value)} helperText="Shown in various places; hosted URL or /icons/..." />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Maskable Icon URL" value={s.siteIconMaskableUrl || ''} onChange={e=>updateField("siteIconMaskableUrl", e.target.value)} helperText="For PWA maskable icons" />
          </Grid>

          {/* New: Payments visibility */}
          <Grid item xs={12}>
            <Divider textAlign="left"><Chip label="Modules" size="small" /></Divider>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel control={<Switch checked={!!s.paymentsEnabled} onChange={e=>updateField("paymentsEnabled", e.target.checked)} />} label="Payments enabled (show card)" />
          </Grid>

          {/* New: ePermit delivery + subscriptions */}
          <Grid item xs={12}>
            <Divider textAlign="left"><Chip label="e‑Permit Delivery" size="small" /></Divider>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel control={<Switch checked={!!s.emailPdfEnabled} onChange={e=>updateField("emailPdfEnabled", e.target.checked)} />} label="Email PDF on issue" />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel control={<Switch checked={!!s.subscriptionEnabled} onChange={e=>updateField("subscriptionEnabled", e.target.checked)} />} label="Subscriptions enabled" />
          </Grid>
          {s.subscriptionEnabled && (
            <>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Subscription frequencies (comma separated)" value={(s.subscriptionFrequencies||[]).join(',')} onChange={e=>updateField("subscriptionFrequencies", e.target.value.split(',').map(x=>x.trim()).filter(Boolean))} helperText="e.g. weekly, monthly" />
              </Grid>
            </>
          )}
            </Grid>
            <Box sx={{ mt:2, display:'flex', gap:2, flexWrap:'wrap' }}>
              {saved && <Alert severity="success">Saved</Alert>}
            </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={5} sx={{ height:'100%', display:'flex', flexDirection:'column', minHeight:0 }}>
          <ManagerAssistant
            settings={s}
            onUpdate={(patch)=> setS(prev=>({ ...prev, ...patch }))}
            onSave={onSave}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
