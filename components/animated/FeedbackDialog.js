import { forwardRef, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, Box, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';

const MotionBox = motion(Box);

const variants = {
  success: {
    bg: 'linear-gradient(135deg, #0b2e13, #052f1b)',
    title: 'Success',
    color: '#c8facc'
  },
  error: {
    bg: 'linear-gradient(135deg, #2a0b0b, #3b0a0a)',
    title: 'Something went wrong',
    color: '#ffd6d6'
  }
};

function useLottie(path){
  const [data, setData] = useState(null);
  useEffect(()=>{
    let m = true;
    (async()=>{
      try{
        if (!path) { setData(null); return; }
        const res = await fetch(path, { cache: 'force-cache' });
        if (!res.ok) { setData(null); return; }
        const json = await res.json();
        if (m) setData(json);
      } catch { setData(null); }
    })();
    return ()=>{ m = false; };
  }, [path]);
  return data;
}

const FeedbackDialog = forwardRef(function FeedbackDialog({ open, onClose, type = 'success', title, message, details, lottiePath, onPrimary, primaryText = 'OK' }, ref){
  const v = variants[type] || variants.success;
  const reduceMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
  // Enforce exact assets: success.json for success, Error.json for error (no fallbacks)
  const anim = useLottie(lottiePath || (type==='success' ? '/lottie/success.json' : '/lottie/Error.json'));
  return (
    <Dialog 
      ref={ref} 
      open={open} 
      onClose={onClose} 
      maxWidth="xs" 
      fullWidth
      sx={{
        zIndex: (theme) => theme.zIndex.modal + 100, // Ensure dialog appears above everything
        '& .MuiDialog-container': {
          alignItems: 'center',
          justifyContent: 'center'
        },
        '& .MuiDialog-paper': {
          margin: 2,
          maxHeight: 'calc(100vh - 64px)', // Prevent dialog from being taller than viewport
          overflow: 'visible'
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, textAlign: 'center' }}>{title || v.title}</DialogTitle>
      <DialogContent sx={{ pb: 3 }}>
        <MotionBox
          initial={{ scale: 0.9, rotate: -2, opacity: 0 }}
          animate={reduceMotion ? { scale: 1, rotate: 0, opacity: 1 } : { scale: 1, rotate: 0, opacity: 1 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 18 }}
          sx={{
            borderRadius: 2,
            p: 2,
            mb: 2,
            display: 'grid',
            placeItems: 'center',
            background: (t)=> type==='success' ? `${t.palette.success.main}11` : `${t.palette.error.main}11`
          }}
        >
          {anim ? (
            <Lottie autoplay={!reduceMotion} loop={false} animationData={anim} style={{ width: 180, height: 180 }} aria-label={type === 'success' ? 'Success animation' : 'Error animation'} />
          ) : (
            <Box sx={{ width:180, height:180, borderRadius:'50%', background:(t)=> type==='success' ? `${t.palette.success.main}22` : `${t.palette.error.main}22` }} />
          )}
        </MotionBox>
        {message && <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1.5, textAlign: 'center' }}>{message}</Typography>}
        {details && (
          <Box sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1, mb: 1.5 }}>
            {details.id && <Typography variant="body2"><b>ID:</b> {details.id}</Typography>}
            {details.vrm && <Typography variant="body2"><b>VRM:</b> {details.vrm}</Typography>}
            {details.siteId && <Typography variant="body2"><b>Site:</b> {details.siteId}</Typography>}
            {details.start && <Typography variant="body2"><b>Start:</b> {new Date(details.start).toLocaleString()}</Typography>}
            {details.end && <Typography variant="body2"><b>End:</b> {new Date(details.end).toLocaleString()}</Typography>}
          </Box>
        )}
        <Box sx={{ display:'flex', justifyContent:'center', gap: 2, pt: 1 }}>
          <Button onClick={onClose} variant="outlined">Close</Button>
          <Button onClick={onPrimary} variant="contained" color={type === 'success' ? 'success' : 'error'}>{primaryText}</Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
});

export default FeedbackDialog;
