import { useEffect, useMemo, useState } from 'react';
import { Box, IconButton, Stack, Typography, useMediaQuery } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { getSettings } from '../lib/permits';
import buildConfig from '../kiosk.config.json';

// Fallback identity comes from the per-site build config, never a hardcoded site.
const FALLBACK_SITE_NAME = buildConfig?.siteName || buildConfig?.kioskName || 'LDK ePermit';
const FALLBACK_KIOSK_NAME = buildConfig?.kioskName || buildConfig?.siteName || 'LDK ePermit';

const QR_REFRESH_SECONDS = 60;

export default function QrLandingPage() {
  const compact = useMediaQuery('(max-width: 480px)');
  const [settings, setSettings] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clockMs, setClockMs] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await getSettings();
        if (active) setSettings(s);
      } catch {
        if (active) setSettings({ siteName: FALLBACK_SITE_NAME, kioskName: FALLBACK_KIOSK_NAME });
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onHeartbeat = async () => {
      try {
        const s = await getSettings();
        setSettings(s);
      } catch {}
    };
    window.addEventListener('kiosk:heartbeat_ok', onHeartbeat);
    return () => window.removeEventListener('kiosk:heartbeat_ok', onHeartbeat);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    sync();
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const siteName = settings?.siteName || settings?.siteDisplayName || FALLBACK_SITE_NAME;
  const kioskName = settings?.kioskName || settings?.siteName || FALLBACK_KIOSK_NAME;
  const qrRefreshSeconds = useMemo(() => {
    const raw = Number(settings?.qrRefreshSeconds);
    if (Number.isFinite(raw) && raw >= 10 && raw <= 300) {
      return Math.floor(raw);
    }
    return QR_REFRESH_SECONDS;
  }, [settings?.qrRefreshSeconds]);
  const serverClockSkewMs = useMemo(() => {
    const raw = Number(settings?.serverClockSkewMs);
    return Number.isFinite(raw) ? raw : 0;
  }, [settings?.serverClockSkewMs]);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockMs(Date.now());
    }, 250);
    return () => clearInterval(timer);
  }, []);

  const alignedNowMs = useMemo(() => clockMs + serverClockSkewMs, [clockMs, serverClockSkewMs]);
  const currentSlot = useMemo(
    () => Math.floor((alignedNowMs / 1000) / qrRefreshSeconds),
    [alignedNowMs, qrRefreshSeconds]
  );
  const slotEndsAtMs = useMemo(
    () => (currentSlot + 1) * qrRefreshSeconds * 1000,
    [currentSlot, qrRefreshSeconds]
  );
  const secondsLeft = useMemo(
    () => Math.max(0, Math.ceil((slotEndsAtMs - alignedNowMs) / 1000)),
    [slotEndsAtMs, alignedNowMs]
  );

  const targetUrl = useMemo(() => {
    const baseUrl = 'https://ldkgroup.co.uk';
    const params = new URLSearchParams({
      kioskName,
      siteName,
      dynamic: '1',
      intervalSec: String(qrRefreshSeconds),
      qrSlot: String(currentSlot),
    });
    return `${baseUrl}/kiosk-apply?${params.toString()}`;
  }, [kioskName, siteName, qrRefreshSeconds, currentSlot]);

  const qrImageUrl = useMemo(() => {
    const apiBase = 'https://ldkgroup.co.uk/api/kiosk/qr';
    const params = new URLSearchParams({
      kioskName,
      siteName,
      target: targetUrl,
      dynamic: '1',
      intervalSec: String(qrRefreshSeconds),
      slot: String(currentSlot),
      format: 'png',
    });
    return `${apiBase}?${params.toString()}`;
  }, [kioskName, siteName, targetUrl, qrRefreshSeconds, currentSlot]);

  const toggleFullscreen = async () => {
    if (typeof document === 'undefined') return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Ignore browser fullscreen restrictions.
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        background: 'radial-gradient(circle at top, #112845 0%, #091a2d 35%, #050d17 100%)',
        color: '#eef6ff',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
        overflowY: 'visible',
        pb: 4,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(8, 28, 46, 0.58)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <IconButton
          component="a"
          href="/"
          aria-label="Close"
          sx={{
            color: '#fff',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.2, py: 0.45, borderRadius: 2, background: 'rgba(13, 34, 63, 0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Box component="img" src="/img/logo_light.png" alt="LDK logo" sx={{ width: 28, height: 18, objectFit: 'contain', display: 'block' }} />
          <Typography sx={{ fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', fontSize: compact ? 18 : 22 }}>
            Dynamic QR
          </Typography>
        </Box>

        <IconButton
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onClick={toggleFullscreen}
          sx={{
            color: '#fff',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
        </IconButton>
      </Stack>

      <Box sx={{ px: 1.5, pt: 1.2, pb: 1.2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 0.4, py: 0.7, borderBottom: '2px solid #e43848' }}>
          <Stack direction="row" alignItems="center" spacing={1.1}>
            <Box component="img" src="/img/logo_light.png" alt="LDK logo" sx={{ width: 38, height: 24, objectFit: 'contain', display: 'block' }} />
            <Typography sx={{ fontWeight: 700, fontSize: compact ? 16 : 20, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              {siteName}
            </Typography>
          </Stack>
          <Box sx={{ px: 1.5, py: 0.5, borderRadius: 999, background: 'rgba(98,120,255,0.18)', border: '1px solid rgba(120,154,255,0.45)', color: '#e9f0ff', fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
            Live access
          </Box>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, py: 1.5, minHeight: 0, pb: 5 }}>
        <Box sx={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25, pb: 1 }}>
          <Box
            sx={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#ffffff',
              borderRadius: 2,
              p: compact ? 1.1 : 1.3,
              boxShadow: '0 12px 20px rgba(0,0,0,0.18)',
              width: 'fit-content',
              height: 'fit-content',
              maxWidth: 'min(78vw, 360px)',
            }}
          >
            <Box component="img" src={qrImageUrl} alt="Dynamic QR code" sx={{ display: 'block', width: 'min(72vw, 330px)', height: 'auto', objectFit: 'contain', borderRadius: 1 }} />
            <Box component="img" src="/img/logo_light.png" alt="LDK logo" sx={{ position: 'absolute', width: 62, height: 36, objectFit: 'contain', display: 'block', background: '#fff', borderRadius: 2, padding: '4px 6px', border: '3px solid #fff', boxShadow: '0 8px 16px rgba(0,0,0,0.14)' }} />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 0.7, borderRadius: 999, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', background: '#ffb648', boxShadow: '0 0 0 6px rgba(255,182,72,0.18)' }} />
            <Typography sx={{ fontWeight: 800, fontSize: compact ? 14 : 16, color: '#edf4ff', letterSpacing: 0.6 }}>
              QR code valid for {secondsLeft}s
            </Typography>
          </Box>

          <Typography
            sx={{
              textAlign: 'center',
              fontSize: compact ? 13 : 15,
              lineHeight: 1.4,
              color: 'rgba(238,246,255,0.78)',
              maxWidth: 360,
              px: 1,
            }}
          >
            Scan before the timer runs out. When it reaches zero, a new QR code appears automatically — please scan the new one.
          </Typography>

        </Box>
      </Box>
    </Box>
  );
}
