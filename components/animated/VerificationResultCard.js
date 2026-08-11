import { Box, Chip, Typography, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import successAnimData from '../../public/lottie/success.json';

export default function VerificationResultCard({ status = 'valid', title, subtitle, details, compact = false }){
  const colors = {
    valid: { chip: 'success', bg: (t)=> t.palette.mode === 'dark' ? 'linear-gradient(135deg, #0b2e13, #052f1b)' : 'linear-gradient(135deg, #e8f5e9, #c8e6c9)' },
    expiring: { chip: 'warning', bg: (t)=> t.palette.mode === 'dark' ? 'linear-gradient(135deg, #2c250b, #3a2a05)' : 'linear-gradient(135deg, #fff8e1, #ffecb3)' },
    invalid: { chip: 'error', bg: (t)=> t.palette.mode === 'dark' ? 'linear-gradient(135deg, #2a0b0b, #3b0a0a)' : 'linear-gradient(135deg, #ffebee, #ffcdd2)' },
  };
  const v = colors[status] || colors.valid;
  const visibleDetailEntries = details ? Object.entries(details).filter(([, value]) => Boolean(value)) : [];

  return (
    <Paper component={motion.div}
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 16 }}
      elevation={12}
      sx={{ p: { xs: 1, sm: 1.75, md: 2.5 }, borderRadius: 2, background: (t)=> (typeof v.bg === 'function' ? v.bg(t) : v.bg), color: (t)=> t.palette.mode === 'dark' ? '#fff' : t.palette.text.primary, width: '100%', maxWidth: { xs: '100%', sm: 460, md: 520 } }}
    >
      {status === 'valid' && !compact && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 0.25, sm: 0.5 } }}>
          <Lottie animationData={successAnimData} loop={false} style={{ width: 72, height: 72, maxWidth: '100%' }} />
        </Box>
      )}
      <Box sx={{ position: 'relative' }}>
        <Box sx={{ display:'flex', alignItems:{ xs: 'flex-start', sm: 'center' }, justifyContent:'space-between', mb: 0.75, gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '0.82rem', sm: '1rem', md: '1.15rem' }, lineHeight: 1.2, pr: 0.5 }}>{title}</Typography>
          <Chip color={v.chip} label={status.toUpperCase()} size="small" sx={{ height: { xs: 22, sm: 24 } }} />
        </Box>
        {subtitle && <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5, fontSize: { xs: '0.68rem', sm: '0.82rem', md: '0.9rem' }, lineHeight: 1.3 }}>{subtitle}</Typography>}
        {visibleDetailEntries.length > 0 && (
          <Box sx={{ bgcolor: (t)=> t.palette.mode === 'dark' ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.06)', p: { xs: 0.5, sm: 0.875 }, borderRadius: 1.5 }}>
            {visibleDetailEntries.map(([k, v]) => (
              <Typography key={k} variant="caption" component="p" sx={{ fontSize: { xs: '0.68rem', sm: '0.78rem' }, lineHeight: 1.4, textTransform: 'capitalize' }}>
                <b>{k}:</b> {String(v)}
              </Typography>
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  );
}
