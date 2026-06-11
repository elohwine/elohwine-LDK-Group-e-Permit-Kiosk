import { forwardRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle, Box, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import successAnimData from '../../public/lottie/success.json';
import errorAnimData from '../../public/lottie/Error.json';

const MotionBox = motion(Box);

function formatUkDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

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
  },
  warning: {
    bg: 'linear-gradient(135deg, #2e1f00, #3b2800)',
    title: 'Saved Offline',
    color: '#ffe0a0'
  }
};

const FeedbackDialog = forwardRef(function FeedbackDialog({ open, onClose, type = 'success', title, message, details, onPrimary, primaryText = 'OK' }, ref){
  const v = variants[type] || variants.success;
  const reduceMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
  const anim = type === 'error' ? errorAnimData : successAnimData;
  return (
    <Dialog 
      ref={ref} 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      sx={{
        zIndex: (theme) => theme.zIndex.modal + 100,
        '& .MuiDialog-container': {
          alignItems: 'center',
          justifyContent: 'center'
        },
        '& .MuiDialog-paper': {
          margin: { xs: 0.5, sm: 1.5 },
          maxHeight: 'calc(100vh - 16px)',
          width: { xs: '92vw', sm: '56vw', md: '40vw' },
          maxWidth: { xs: 360, sm: 440, md: 520 },
          overflow: 'auto',
          background: type === 'success'
            ? 'linear-gradient(135deg, rgba(11,46,19,0.72) 0%, rgba(5,47,27,0.80) 100%)'
            : type === 'warning'
            ? 'linear-gradient(135deg, rgba(46,31,0,0.80) 0%, rgba(59,40,0,0.88) 100%)'
            : 'linear-gradient(135deg, rgba(42,11,11,0.72) 0%, rgba(59,10,10,0.80) 100%)',
          backdropFilter: 'blur(18px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.6)',
          border: type === 'success'
            ? '1px solid rgba(100,220,130,0.18)'
            : type === 'warning'
            ? '1px solid rgba(255,180,0,0.22)'
            : '1px solid rgba(220,80,80,0.18)',
          boxShadow: type === 'success'
            ? '0 8px 32px rgba(0,200,80,0.12), inset 0 1px 0 rgba(255,255,255,0.06)'
            : type === 'warning'
            ? '0 8px 32px rgba(200,140,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 8px 32px rgba(200,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)',
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, textAlign: 'center', fontSize: { xs: '0.92rem', sm: '1.05rem', md: '1.1rem' }, pt: { xs: 0.75, sm: 1.25 }, pb: 0.25, color: 'rgba(255,255,255,0.95)' }}>{title || v.title}</DialogTitle>
      <DialogContent sx={{ pb: { xs: 1, sm: 1.5 }, px: { xs: 1.25, sm: 1.75 } }}>
        <MotionBox
          initial={{ scale: 0.9, rotate: -2, opacity: 0 }}
          animate={reduceMotion ? { scale: 1, rotate: 0, opacity: 1 } : { scale: 1, rotate: 0, opacity: 1 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 18 }}
          sx={{
            borderRadius: 2,
            p: 1,
            mb: 1,
            display: 'grid',
            placeItems: 'center',
            background: (t)=> type==='success' ? `${t.palette.success.main}11` : type==='warning' ? `${t.palette.warning.main}11` : `${t.palette.error.main}11`
          }}
        >
          {anim ? (
            <Lottie autoplay={!reduceMotion} loop={false} animationData={anim} style={{ width: '100%', maxWidth: 120, height: 'auto', aspectRatio: '1' }} aria-label={type === 'success' ? 'Success animation' : 'Error animation'} />
          ) : null}
        </MotionBox>
        {message && <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.70)', mb: 0.75, textAlign: 'center', fontSize: { xs: '0.78rem', sm: '0.88rem' } }}>{message}</Typography>}
        {details && (
          <Box sx={{
            p: { xs: 0.875, sm: 1.25 },
            borderRadius: 2,
            mb: 0.75,
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.18)',
          }}>
            {details.id && <Typography variant="caption" component="p" sx={{ fontSize: { xs: '0.68rem', sm: '0.78rem' }, lineHeight: 1.5, color: 'rgba(255,255,255,0.75)' }}><b style={{color:'rgba(255,255,255,0.95)'}}>ID:</b> {details.id}</Typography>}
            {details.vrm && <Typography variant="caption" component="p" sx={{ fontSize: { xs: '0.68rem', sm: '0.78rem' }, lineHeight: 1.5, color: 'rgba(255,255,255,0.75)' }}><b style={{color:'rgba(255,255,255,0.95)'}}>VRM:</b> {details.vrm}</Typography>}
            {details.siteName && <Typography variant="caption" component="p" sx={{ fontSize: { xs: '0.68rem', sm: '0.78rem' }, lineHeight: 1.5, color: 'rgba(255,255,255,0.75)' }}><b style={{color:'rgba(255,255,255,0.95)'}}>Site Name:</b> {details.siteName}</Typography>}
            {details.kioskName && <Typography variant="caption" component="p" sx={{ fontSize: { xs: '0.68rem', sm: '0.78rem' }, lineHeight: 1.5, color: 'rgba(255,255,255,0.75)' }}><b style={{color:'rgba(255,255,255,0.95)'}}>Kiosk Name:</b> {details.kioskName}</Typography>}
            {details.duration && <Typography variant="caption" component="p" sx={{ fontSize: { xs: '0.68rem', sm: '0.78rem' }, lineHeight: 1.5, color: 'rgba(255,255,255,0.75)' }}><b style={{color:'rgba(255,255,255,0.95)'}}>Duration:</b> {details.duration}</Typography>}
            {details.start && <Typography variant="caption" component="p" sx={{ fontSize: { xs: '0.68rem', sm: '0.78rem' }, lineHeight: 1.5, color: 'rgba(255,255,255,0.75)' }}><b style={{color:'rgba(255,255,255,0.95)'}}>Start:</b> {formatUkDateTime(details.start)}</Typography>}
            {details.end && <Typography variant="caption" component="p" sx={{ fontSize: { xs: '0.68rem', sm: '0.78rem' }, lineHeight: 1.5, color: 'rgba(255,255,255,0.75)' }}><b style={{color:'rgba(255,255,255,0.95)'}}>Valid until:</b> {formatUkDateTime(details.end)}</Typography>}
          </Box>
        )}
        <Box sx={{ display:'flex', justifyContent:'center', gap: 1, pt: 0.25 }}>
          <Button onClick={onClose} variant="outlined" size="small" sx={{ minWidth: { xs: 72, sm: 96 }, fontSize: { xs: '0.78rem', sm: '0.88rem' } }}>Close</Button>
          <Button onClick={onPrimary} variant="contained" size="small" color={type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'error'} sx={{ minWidth: { xs: 72, sm: 96 }, fontSize: { xs: '0.78rem', sm: '0.88rem' } }}>{primaryText}</Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
});

export default FeedbackDialog;
