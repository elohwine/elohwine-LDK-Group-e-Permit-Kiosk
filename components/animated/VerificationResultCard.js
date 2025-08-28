import { Box, Chip, Typography, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import { useEffect, useState } from 'react';

// Local hook to load Lottie JSON from a path
function useLottie(path) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let m = true;
    (async () => {
      try {
        if (!path) { setData(null); return; }
        const res = await fetch(path, { cache: 'force-cache' });
        if (!res.ok) { setData(null); return; }
        const json = await res.json();
        if (m) setData(json);
      } catch { setData(null); }
    })();
    return () => { m = false; };
  }, [path]);
  return data;
}

export default function VerificationResultCard({ status = 'valid', title, subtitle, details }){
  const colors = {
    valid: { chip: 'success', bg: 'linear-gradient(135deg, #0b2e13, #052f1b)' },
    expiring: { chip: 'warning', bg: 'linear-gradient(135deg, #2c250b, #3a2a05)' },
    invalid: { chip: 'error', bg: 'linear-gradient(135deg, #2a0b0b, #3b0a0a)' },
  };
  const v = colors[status] || colors.valid;
  const successAnim = useLottie(status === 'valid' ? '/lottie/success.json' : '/lottie/Success.json');

  return (
    <Paper component={motion.div}
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 16 }}
      elevation={12}
      sx={{ p: 2, borderRadius: 3, background: v.bg, color: '#fff', width: '100%', maxWidth: 560, position: 'relative', overflow: 'hidden' }}
    >
      {status === 'valid' && successAnim && (
        <Box sx={{ position: 'absolute', top: -50, right: -50, width: 240, height: 240, opacity: 0.15, pointerEvents: 'none' }}>
          <Lottie animationData={successAnim} loop={false} />
        </Box>
      )}
      <Box sx={{ position: 'relative' }}>
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
          <Chip color={v.chip} label={status.toUpperCase()} size="small" />
        </Box>
        {subtitle && <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>{subtitle}</Typography>}
        {details && (
          <Box sx={{ bgcolor: 'rgba(0,0,0,0.25)', p: 1.5, borderRadius: 2, fontFamily: 'monospace' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(details, null, 2)}</pre>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
