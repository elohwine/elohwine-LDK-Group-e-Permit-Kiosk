import { useEffect, useState } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export default function SharePage(){
  const [data, setData] = useState({ title: '', text: '', url: '' });
  useEffect(()=>{
    if (typeof window === 'undefined' || !('launchQueue' in window)) return;
    window.launchQueue.setConsumer(async (launchParams) => {
      const formData = launchParams?.files ? null : null;
      // Note: In web contexts, reading POST body is not directly available; this page serves as a landing.
    });
    try {
      const url = new URL(window.location.href);
      setData({ title: url.searchParams.get('title')||'', text: url.searchParams.get('text')||'', url: url.searchParams.get('url')||'' });
    } catch {}
  },[]);
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ display:'flex', alignItems:'center', gap:1 }}>
        Received Share
        <Tooltip title="Opened from Web Share Target; certain payloads may not be visible due to browser limitations."><InfoOutlinedIcon fontSize="small"/></Tooltip>
      </Typography>
      <Box sx={{ mt:2 }}>
        <div><b>Title:</b> {data.title || '—'}</div>
        <div><b>Text:</b> {data.text || '—'}</div>
        <div><b>URL:</b> {data.url || '—'}</div>
      </Box>
    </Box>
  );
}
import { useEffect, useState } from 'react';

export default function ShareTarget() {
  const [data, setData] = useState(null);
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const title = url.searchParams.get('title') || '';
      const text = url.searchParams.get('text') || '';
      const link = url.searchParams.get('url') || '';
      setData({ title, text, url: link });
    } catch {}
  }, []);
  return (
    <main style={{ padding: 16 }}>
      <h1>Share Target</h1>
      <pre aria-label="shared-data">{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
