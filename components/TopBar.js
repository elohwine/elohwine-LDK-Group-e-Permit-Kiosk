import { Box, IconButton, Typography, Tooltip } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { useTheme } from "@mui/material/styles";
import Image from "next/image";
import { useEffect, useState } from "react";

// Kiosk online/heartbeat status dot — self-contained, no prop drilling needed
function KioskStatusDot() {
  const [lastHb, setLastHb] = useState(null); // timestamp of last heartbeat_ok
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onHb = (e) => setLastHb(e.detail?.timestamp ?? Date.now());
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('kiosk:heartbeat_ok', onHb);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('kiosk:heartbeat_ok', onHb);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Recompute colour every 30s so stale indicators turn amber automatically
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const ageMs = lastHb ? Date.now() - lastHb : null;
  let color, label;
  if (!browserOnline) {
    color = '#f44336'; label = 'Offline — no network';
  } else if (ageMs === null) {
    color = '#ff9800'; label = 'Waiting for first heartbeat…';
  } else if (ageMs < 3 * 60 * 1000) {
    color = '#4caf50'; label = `Heartbeat OK — ${Math.round(ageMs / 1000)}s ago`;
  } else {
    color = '#ff9800'; label = `Heartbeat stale — ${Math.round(ageMs / 60000)} min ago`;
  }

  return (
    <Tooltip title={label} arrow>
      <Box
        sx={{
          width: 10, height: 10, borderRadius: '50%',
          bgcolor: color,
          flexShrink: 0,
          boxShadow: `0 0 0 2px ${color}44`,
          cursor: 'default',
        }}
        aria-label={label}
      />
    </Tooltip>
  );
}

export default function TopBar({ onOpenSettings, showSettings, onBackToMain, siteName }){
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (showSettings) {
    return (
      <Box sx={{ px: { xs: 1.5, sm: 2.5 }, py: { xs: 0.5, sm: 0.75 }, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="Back">
          <IconButton color="inherit" size="large" onClick={onBackToMain} aria-label="Back">
            <ArrowBackIosNewIcon fontSize="medium" />
          </IconButton>
        </Tooltip>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Settings</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2 }, py: { xs: 0.5, sm: 0.75 }, display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ position: 'relative', width: { xs: 48, sm: 60, md: 68 }, height: { xs: 48, sm: 60, md: 68 }, flexShrink: 0 }}>
        <Image
          src={isDark ? '/img/logo.png' : '/img/logo_light.png'}
          alt="LDK ePERMIT"
          layout="fill"
          objectFit="contain"
          priority
        />
      </Box>
      <KioskStatusDot />
    </Box>
  );
}
