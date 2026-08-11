import { useEffect, useState } from "react";
import { Box, Typography, TextField, Switch, FormControlLabel, Button, Alert, Paper, Grid, Divider, Chip, Select, MenuItem, InputLabel, FormControl } from "@mui/material";
import dynamic from "next/dynamic";
import { getSettings, saveSettings, getSites, refreshSites, getSiteRules, registerKiosk, unregisterKiosk, loginAdmin, logoutAdmin } from "../../lib/permits";
const LottiePlayer = dynamic(() => import("lottie-react"), { ssr: false });

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

function LottieErrorInline({ message }) {
  const errorAnim = useLottieData('/lottie/Error.json');
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0, flex: 1 }}>
      {errorAnim && <LottiePlayer animationData={errorAnim} loop={false} style={{ width: '1.75rem', height: '1.75rem', flexShrink: 0 }} />}
      <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.82rem' } }}>{message}</Typography>
    </Box>
  );
}


export default function Settings({ onSaved }) {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  const [sites, setSites] = useState([]);
  const [kioskBusy, setKioskBusy] = useState(false);
  const [kioskError, setKioskError] = useState("");
  const [kioskSuccess, setKioskSuccess] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [sitesBusy, setSitesBusy] = useState(false);
  const [sitesError, setSitesError] = useState("");
  useEffect(()=>{ (async()=> {
    setS(await getSettings());
    try {
      const list = await getSites();
      setSites(list);
      if (!list.length) setSitesError('No sites returned — server may be starting up. Tap Refresh.');
    } catch (err) {
      setSitesError('Could not load sites: ' + (err.message || 'network error'));
    }
  })(); },[]);

  async function handleRefreshSites() {
    setSitesBusy(true); setSitesError('');
    try {
      const list = await refreshSites();
      setSites(list);
      if (!list.length) setSitesError('No sites returned from server');
    } catch (err) {
      setSitesError(err.message || 'Failed to fetch sites');
    } finally {
      setSitesBusy(false);
    }
  }

  async function handleSiteChange(siteId) {
    updateField('siteId', siteId);
    const sel = sites.find(x => (x.id || x._id || x.siteId) === siteId);
    if (sel) {
      const displayName = sel.displayName || sel.display_name || sel.siteName || sel.name || siteId;
      updateField('siteName', displayName);
      updateField('siteDisplayName', displayName);
    }
    // Auto-fetch site rules/data from backend
    try {
      const rules = await getSiteRules(siteId);
      if (rules) {
        if (rules.defaultHours) updateField('defaultHours', rules.defaultHours);
        const ruleName = rules.displayName || rules.display_name || rules.siteName || rules.name;
        if (ruleName) {
          updateField('siteName', ruleName);
          updateField('siteDisplayName', ruleName);
        }
      }
    } catch {}
  }

  if (!s) return null;

  function updateField(k,v){
    setS(prev => ({ ...prev, [k]: v }));
  }

  async function onSave(){
    await saveSettings(s);
    setSaved(true);
    try { onSaved && onSaved(s); } catch {}
    // If admin is logged in and kiosk is registered, push updated settings to backend
    if (s.adminLoggedIn && s.kioskRegistered && s.kioskId) {
      try {
        const { updateKiosk } = await import('../../lib/permits');
        await updateKiosk({
          name: s.kioskName,
          siteId: s.siteId,
          location: s.kioskLocation,
          siteName: s.siteDisplayName || s.siteName,
        });
      } catch (err) {
        console.warn('Failed to sync kiosk settings to backend:', err.message);
      }
    }
    setTimeout(()=>setSaved(false), 2000);
  }

  return (
    <Box sx={{ p:{ xs: 1.5, sm: 2, md: 3 }, height: '100%', display:'flex', flexDirection:'column', minHeight: 0, overflow:'hidden' }}>
      <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ flex:1, minHeight: 0 }}>
        <Grid item xs={12} sx={{ height:'100%', display:'flex', flexDirection:'column', minHeight:0 }}>
          <Paper elevation={10} sx={{ p:0, borderRadius:{ xs: 2, sm: 3 }, width: '100%', bgcolor:'background.paper', overflow:'auto', flex:1, minHeight:0 }}>
            <Box sx={{ position:'sticky', top:0, zIndex:1, bgcolor:'background.paper', borderBottom:(t)=>`1px solid ${t.palette.divider}`, px:{ xs: 2, sm: 3 }, py:{ xs: 1.25, sm: 2 }, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.1rem' } }}>Admin Settings</Typography>
              <Box sx={{ display:'flex', gap:1 }}>
                <Button size="small" variant="outlined" onClick={()=>setS(prev=>({ ...(prev||{}), ...s }))}>Reset</Button>
                <Button size="small" variant="contained" onClick={onSave}>Save</Button>
              </Box>
            </Box>
            <Box sx={{ px:{ xs: 2, sm: 3 }, py:{ xs: 2, sm: 3 } }}>
            <Grid container spacing={{ xs: 1.5, sm: 2 }}>
          {/* Site selection */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel id="site-select-label">Site</InputLabel>
              <Select
                labelId="site-select-label"
                label="Site"
                value={s.siteId || ''}
                onChange={(e) => handleSiteChange(e.target.value)}
              >
                {sites.map(site => {
                  const id = site.id || site._id || site.siteId;
                  const label = site.displayName || site.display_name || site.siteName || site.name || id;
                  return <MenuItem key={id} value={id}>{label}</MenuItem>;
                })}
                {sites.length === 0 && <MenuItem disabled value=""><em>No sites — click Refresh</em></MenuItem>}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', height: '100%' }}>
              <Button
                variant="outlined"
                size="small"
                disabled={sitesBusy}
                onClick={handleRefreshSites}
              >
                {sitesBusy ? 'Loading…' : 'Refresh Sites'}
              </Button>
              {sitesError && <LottieErrorInline message={sitesError} />}
              {!sitesError && sites.length > 0 && <Typography variant="caption" color="text.secondary">{sites.length} site(s) loaded</Typography>}
            </Box>
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
            <FormControlLabel control={<Switch checked={!!s.paymentsEnabled} onChange={e=>updateField("paymentsEnabled", e.target.checked)} />} label="Payments enabled" />
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

          {/* Kiosk Device Registration */}
          <Grid item xs={12}>
            <Divider textAlign="left"><Chip label="Kiosk Registration" size="small" /></Divider>
          </Grid>
          {/* --- Admin Login --- */}
          <Grid item xs={12}>
            {!s.adminLoggedIn ? (
              <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, fontSize: { xs: '0.82rem', sm: '0.9rem' } }}>Admin Login</Typography>
                <Grid container spacing={{ xs: 1, sm: 1.5 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="Email" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoComplete="email" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="Password" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} autoComplete="current-password" />
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Button
                        variant="contained"
                        size="small"
                        disabled={loginBusy || !loginEmail || !loginPassword}
                        onClick={async () => {
                          setLoginBusy(true); setLoginError('');
                          try {
                            const updated = await loginAdmin(loginEmail, loginPassword);
                            setS(updated);
                            setLoginPassword('');
                            // Auto-refresh sites after login
                            try {
                              const freshSites = await refreshSites();
                              setSites(freshSites);
                              // Auto-select first site if none selected
                              if (!updated.siteId && freshSites.length > 0) {
                                const first = freshSites[0];
                                const firstId = first.id || first._id || first.siteId;
                                await handleSiteChange(firstId);
                              }
                            } catch {}
                            // Kiosk registration is manual — admin clicks Register after login
                          } catch (err) {
                            setLoginError(err.message || 'Login failed');
                          } finally {
                            setLoginBusy(false);
                          }
                        }}
                      >
                        {loginBusy ? 'Signing in…' : 'Sign In'}
                      </Button>
                      {loginError && <LottieErrorInline message={loginError} />}
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            ) : (
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Chip label={`Signed in as ${s.adminEmail || 'admin'}`} color="success" size="small" variant="outlined" />
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={async () => {
                    await logoutAdmin();
                    setS(await getSettings());
                  }}
                >
                  Sign Out
                </Button>
              </Box>
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField fullWidth size="small" label="Kiosk API Key" value={s.kioskApiKey || ''} onChange={e => updateField('kioskApiKey', e.target.value)} helperText="X-Kiosk-Key header value" />
          </Grid>

          {/* --- Kiosk Device --- */}
          <Grid item xs={12} md={6}>
            <TextField fullWidth size="small" label="Kiosk Name" value={s.kioskName || ''} onChange={e => updateField('kioskName', e.target.value)} helperText="Friendly name for this device" />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth size="small" label="Kiosk Location" value={s.kioskLocation || ''} onChange={e => updateField('kioskLocation', e.target.value)} helperText="Physical location" />
          </Grid>
          {s.kioskRegistered && s.kioskId && (
            <Grid item xs={12} md={6}>
              <TextField fullWidth size="small" label="Kiosk ID" value={s.kioskId} InputProps={{ readOnly: true }} helperText="Assigned by server" />
            </Grid>
          )}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              {!s.kioskRegistered ? (
                <Button
                  variant="contained"
                  size="small"
                  disabled={kioskBusy || !s.adminLoggedIn || !s.kioskName}
                  onClick={async () => {
                    setKioskBusy(true); setKioskError(''); setKioskSuccess('');
                    try {
                      await saveSettings(s);
                      const result = await registerKiosk({ name: s.kioskName, siteId: s.siteId, location: s.kioskLocation });
                      setS(await getSettings());
                      setKioskSuccess(`Registered as ${result.kioskId}`);
                    } catch (err) {
                      setKioskError(err.message || 'Registration failed');
                    } finally {
                      setKioskBusy(false);
                    }
                  }}
                >
                  {kioskBusy ? 'Registering…' : 'Register Kiosk'}
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  disabled={kioskBusy || !s.adminLoggedIn}
                  onClick={async () => {
                    setKioskBusy(true); setKioskError(''); setKioskSuccess('');
                    try {
                      await saveSettings(s);
                      await unregisterKiosk();
                      setS(await getSettings());
                      setKioskSuccess('Kiosk unregistered');
                    } catch (err) {
                      setKioskError(err.message || 'Unregister failed');
                    } finally {
                      setKioskBusy(false);
                    }
                  }}
                >
                  {kioskBusy ? 'Removing…' : 'Unregister Kiosk'}
                </Button>
              )}
              <Chip
                label={s.kioskRegistered ? 'Registered' : 'Not registered'}
                color={s.kioskRegistered ? 'success' : 'default'}
                size="small"
                variant="outlined"
              />
              {!s.adminLoggedIn && !s.kioskRegistered && <Typography variant="caption" color="text.secondary">Sign in above to register</Typography>}
              {kioskError && <LottieErrorInline message={kioskError} />}
              {kioskSuccess && <Alert severity="success" sx={{ py: 0, flex: 1 }}>{kioskSuccess}</Alert>}
            </Box>
          </Grid>
            </Grid>
            <Box sx={{ mt:2, display:'flex', gap:2, flexWrap:'wrap' }}>
              {saved && <Alert severity="success">Saved</Alert>}
            </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
