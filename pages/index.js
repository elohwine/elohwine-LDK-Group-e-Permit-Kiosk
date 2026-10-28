import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Box } from "@mui/material";
import TopBar from "../components/TopBar";
import dynamic from 'next/dynamic';
const VrmLookupFlow = dynamic(() => import('../components/VrmLookupFlow'), { ssr: false });
const AdminSettings = dynamic(() => import('./admin/settings'), { ssr: false });
const QrLandingPage = dynamic(() => import('./qr'), { ssr: false });

import { getSettings } from "../lib/permits";

export default function Home() {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(()=>{
    (async()=> setSettings(await getSettings()))();
  },[]);

  const useQrHome = String(settings?.homeMode || 'regular').toLowerCase() === 'qr';

  useEffect(() => {
    if (useQrHome && router.pathname === '/') {
      router.replace('/qr');
    }
  }, [useQrHome, router]);

  if (useQrHome && router.pathname === '/') {
    return null;
  }

  if (router.pathname === '/qr') {
    return <QrLandingPage />;
  }

  return (
    <Box sx={{ height: '100%', display:'flex', flexDirection:'column', overflow: 'hidden' }}>
      {showSettings ? (
        <AdminSettings onSaved={async()=> setSettings(await getSettings())} />
      ) : useQrHome ? (
        null
      ) : (
        <>
          <TopBar
            siteName={settings?.siteName}
            showSettings={showSettings}
            onOpenSettings={()=> setShowSettings(true)}
            onBackToMain={()=> setShowSettings(false)}
          />
          <Box sx={{ flex:1, display:'flex', flexDirection:'column', minHeight: 0, overflow: 'hidden' }}>
            <VrmLookupFlow />
          </Box>
        </>
      )}
    </Box>
  );
}
