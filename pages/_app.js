import '../styles/globals.css'
import Head from 'next/head'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import theme from '../lib/theme'
import dynamic from 'next/dynamic'

const KioskKeyboardProvider = dynamic(() => import('../components/KioskKeyboardProvider'), { ssr: false });

function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="manifest" href="/manifest.json"/>
        <meta name="theme-color" content="#1374bc"/>
      </Head>
      <Box
        sx={{
          minHeight: '100%',
          background: 'radial-gradient(1200px 600px at 20% 0%, #2a303c 0%, #1b202a 40%, #121621 100%)'
        }}
      >
        <Component {...pageProps} />
  {/* Auto-open on-screen keyboard when kiosk mode is enabled in settings */}
  <KioskKeyboardProvider />
      </Box>
    </ThemeProvider>
  )
}

export default MyApp
