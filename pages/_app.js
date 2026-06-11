  import '../styles/globals.css'
import Head from 'next/head'
  import { CssBaseline, Box, IconButton, Tooltip, Snackbar, Alert, CircularProgress, Typography, LinearProgress } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import theme, { ColorModeProvider, useColorMode } from '../lib/theme'
import Brightness6Icon from '@mui/icons-material/Brightness6'
import BrandWatermark from '../components/BrandWatermark'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { initPWAClient } from '../lib/pwa'
import { startOfflineSync, sendHeartbeat } from '../lib/permits'
import { startAutoUpdater } from '../lib/updater'

const KioskKeyboardProvider = dynamic(() => import('../components/KioskKeyboardProvider'), { ssr: false });

function ModeToggle() {
  const { toggle } = useColorMode();
  return (
    <Tooltip title="Toggle light/dark mode">
  <IconButton color="inherit" onClick={toggle} sx={{ position:'fixed', right: { xs: 8, sm: 12, md: 16 }, bottom: { xs: 8, sm: 12, md: 16 }, zIndex: (t)=>t.zIndex.tooltip + 1, bgcolor: 'transparent', '&:hover': { bgcolor: 'action.hover' } }} aria-label="toggle color mode">
        <Brightness6Icon sx={{ fontSize: { xs: '1rem', sm: '1.2rem', md: '1.3rem' } }} />
      </IconButton>
    </Tooltip>
  );
}

function MyApp({ Component, pageProps }) {
  const [remoteMsg, setRemoteMsg] = useState(null);        // { text, duration }
  const [maintenance, setMaintenance] = useState(null);    // null | string reason
  const [commandProcessing, setCommandProcessing] = useState(null); // { active, type, stage, message, progress, commandId }

  useEffect(() => {
    initPWAClient();
    const cleanupSync = startOfflineSync();
    const cleanupUpdater = startAutoUpdater();
    // Lock landscape only on tablets (≥600px wide) — phones use their natural orientation
    try {
      const isTablet = Math.min(screen.width, screen.height) >= 600 || Math.max(screen.width, screen.height) >= 900;
      if (isTablet) screen.orientation.lock('landscape').catch(() => {});
    } catch {}

    // Remote command event listeners
    const onMsg = (e) => setRemoteMsg(e.detail);
    const onMaintOn  = (e) => setMaintenance(e.detail?.reason || 'Maintenance in progress');
    const onMaintOff = ()  => setMaintenance(null);
    const onCommandProcessing = (e) => {
      const detail = e?.detail || {};
      if (detail.active) {
        setCommandProcessing((prev) => ({
          active: true,
          type: detail.type || prev?.type || 'command',
          commandId: detail.commandId || prev?.commandId || null,
          stage: detail.stage || prev?.stage || 'started',
          message: detail.message || prev?.message || 'Applying remote command...',
          progress: Number.isFinite(Number(detail.progress))
            ? Math.max(0, Math.min(100, Number(detail.progress)))
            : (Number.isFinite(Number(prev?.progress)) ? Number(prev.progress) : null),
        }));
        return;
      }
      if (detail.stage === 'failed') {
        setCommandProcessing({
          active: false,
          type: detail.type || 'command',
          commandId: detail.commandId || null,
          stage: 'failed',
          message: detail.message || 'Remote command failed.',
          progress: Number.isFinite(Number(detail.progress)) ? Math.max(0, Math.min(100, Number(detail.progress))) : null,
        });
      } else {
        setCommandProcessing({
          active: false,
          type: detail.type || 'command',
          commandId: detail.commandId || null,
          stage: 'success',
          message: detail.message || 'Remote command complete.',
          progress: Number.isFinite(Number(detail.progress)) ? Math.max(0, Math.min(100, Number(detail.progress))) : 100,
        });
      }
      setTimeout(() => setCommandProcessing(null), 2500);
    };
    // reload_config / set_config / set_duration — pull fresh config from server immediately
    const onReloadConfig = () => { sendHeartbeat().catch(() => {}); };
    window.addEventListener('kiosk:display_message',  onMsg);
    window.addEventListener('kiosk:set_maintenance',  onMaintOn);
    window.addEventListener('kiosk:clear_maintenance', onMaintOff);
    window.addEventListener('kiosk:reload_config', onReloadConfig);
    window.addEventListener('kiosk:command_processing', onCommandProcessing);

    return () => {
      cleanupSync();
      cleanupUpdater();
      window.removeEventListener('kiosk:display_message',  onMsg);
      window.removeEventListener('kiosk:set_maintenance',  onMaintOn);
      window.removeEventListener('kiosk:clear_maintenance', onMaintOff);
      window.removeEventListener('kiosk:reload_config', onReloadConfig);
      window.removeEventListener('kiosk:command_processing', onCommandProcessing);
    };
  }, []);
  return (
    <ColorModeProvider>
      <CssBaseline />
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json"/>
      </Head>
      <ThemeColorUpdater />
      {/* ─── Remote command: display_message overlay ─── */}
      <Snackbar
        open={!!remoteMsg}
        autoHideDuration={remoteMsg?.duration ?? 5000}
        onClose={() => setRemoteMsg(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ zIndex: (t) => t.zIndex.modal + 10 }}
      >
        <Alert severity="info" onClose={() => setRemoteMsg(null)} sx={{ width: '100%', fontWeight: 600 }}>
          {remoteMsg?.text}
        </Alert>
      </Snackbar>
      {/* ─── Remote command: maintenance overlay ─── */}
      {maintenance && (
        <Box sx={{
          position: 'fixed', inset: 0, zIndex: (t) => t.zIndex.modal + 20,
          bgcolor: 'background.default', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 4,
        }}>
          <Alert severity="warning" sx={{ maxWidth: 480, fontSize: '1rem', fontWeight: 700 }}>
            {maintenance}
          </Alert>
        </Box>
      )}
      {commandProcessing && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: (t) => t.zIndex.modal + 30,
            bgcolor: 'rgba(0, 0, 0, 0.52)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}
        >
          <Box sx={{
            width: 'min(92vw, 480px)',
            bgcolor: '#fff',
            borderRadius: 2,
            p: 3,
            boxShadow: 6,
            textAlign: 'center',
          }}>
            {commandProcessing.active && commandProcessing.type !== 'sync_allowed_list' ? <CircularProgress size={34} sx={{ mb: 1.5 }} /> : null}
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              {commandProcessing.active ? 'Applying Remote Command' : 'Remote Command Result'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#444', mb: 0.75 }}>
              {commandProcessing.message}
            </Typography>
            {commandProcessing.type === 'sync_allowed_list' && Number.isFinite(Number(commandProcessing.progress)) ? (
              <Box sx={{ mt: 1, mb: 1.25 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(0, Math.min(100, Number(commandProcessing.progress)))}
                  sx={{ height: 10, borderRadius: 999, backgroundColor: '#e8eef5' }}
                />
                <Typography variant="caption" sx={{ color: '#1b5e20', fontWeight: 700 }}>
                  {Math.round(Number(commandProcessing.progress))}% complete
                </Typography>
              </Box>
            ) : null}
            <Typography variant="caption" sx={{ color: '#666', fontFamily: 'monospace' }}>
              {commandProcessing.type}
            </Typography>
          </Box>
        </Box>
      )}
      <KioskKeyboardProvider>
        <Box
          sx={(t)=>({
            height: '100%',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            pt: 'calc(env(safe-area-inset-top, 0px) + 4px)',
            pb: 'calc(env(safe-area-inset-bottom, 0px) + 4px)',
            pl: 'calc(env(safe-area-inset-left, 0px) + 4px)',
            pr: 'calc(env(safe-area-inset-right, 0px) + 4px)'
          })}
        >
          <BrandWatermark opacity={0.15} maxSize={300} />
          <Component {...pageProps} />
        </Box>
      </KioskKeyboardProvider>
      <ModeToggle />
    </ColorModeProvider>
  )
}

function ThemeColorUpdater() {
  const theme = useTheme();
  const color = theme.palette.mode === 'dark' ? '#121621' : '#e6f0ff';
  return (
    <Head>
      <meta name="theme-color" content={color} />
    </Head>
  );
}

export default MyApp
