import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import TopBar from "../components/TopBar";
import dynamic from 'next/dynamic';
const VrmLookupFlow = dynamic(() => import('../components/VrmLookupFlow'), { ssr: false });
const AdminSettings = dynamic(() => import('./admin/settings'), { ssr: false });

import { getSettings } from "../lib/permits";

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(()=>{
    (async()=> setSettings(await getSettings()))();
  },[]);

  return (
    <Box sx={{ height: '100%', display:'flex', flexDirection:'column', overflow: 'hidden' }}>
      <TopBar
        siteName={settings?.siteName}
        showSettings={showSettings}
        onOpenSettings={()=> setShowSettings(true)}
        onBackToMain={()=> setShowSettings(false)}
      />
      <Box sx={{ flex:1, display:'flex', flexDirection:'column', minHeight: 0, overflow: 'hidden' }}>
        {showSettings ? (
          <AdminSettings onSaved={async()=> setSettings(await getSettings())} />
        ) : (
          <VrmLookupFlow />
        )}
      </Box>
    </Box>
  );
}
