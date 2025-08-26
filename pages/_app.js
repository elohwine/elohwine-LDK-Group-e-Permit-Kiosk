import '../styles/globals.css'
import Head from 'next/head'
import { CssBaseline, Box, IconButton, Tooltip } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import theme, { ColorModeProvider, useColorMode } from '../lib/theme'
import Brightness6Icon from '@mui/icons-material/Brightness6'
import BrandWatermark from '../components/BrandWatermark'
import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { initPWAClient } from '../lib/pwa'

const KioskKeyboardProvider = dynamic(() => import('../components/KioskKeyboardProvider'), { ssr: false });

function ModeToggle() {
  const { toggle } = useColorMode();
  return (
    <Tooltip title="Toggle light/dark mode">
      <IconButton color="inherit" onClick={toggle} sx={{ position:'fixed', right: 12, bottom: 12, zIndex: (t)=>t.zIndex.tooltip + 1 }} aria-label="toggle color mode">
        <Brightness6Icon />
      </IconButton>
    </Tooltip>
  );
}

function MyApp({ Component, pageProps }) {
  useEffect(() => { initPWAClient(); }, []);
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
    <Box
        sx={(t)=>({
          minHeight: '100%',
          position: 'relative',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: t.palette.mode === 'dark'
            ? 'radial-gradient(1200px 600px at 20% 0%, #2a303c 0%, #1b202a 40%, #121621 100%)'
            : 'radial-gradient(1200px 600px at 20% 0%, #f2f7ff 0%, #e6f0ff 35%, #d6e8ff 65%, #cce2ff 100%)'
        })}
      >
        <BrandWatermark opacity={0.15} />
        <Component {...pageProps} />
  {/* Auto-open on-screen keyboard when kiosk mode is enabled in settings */}
  <KioskKeyboardProvider />
        <ModeToggle />
      </Box>
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
