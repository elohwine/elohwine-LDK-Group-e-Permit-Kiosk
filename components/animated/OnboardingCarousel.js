import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, IconButton, MobileStepper, Paper, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CloseIcon from '@mui/icons-material/Close';
import chatAnim from '../../public/lottie/Livechatbot.json';
import loadingAnim from '../../public/lottie/Loading.json';
// Prefer a known-valid JSON bundled under public for reliability
import successAnim from '../../public/lottie/success.json';
import BrandWatermark from '../BrandWatermark';

const defaultSlides = [
  {
    key: 'checkin',
    title: 'Enter Your Registration',
    desc: 'Type your vehicle registration to check in — quick and simple.',
    anim: loadingAnim,
    color: (t)=>t.palette.primary.main
  },
  {
    key: 'permit',
    title: 'Get Your Permit Instantly',
    desc: 'If you don\u2019t have one yet, apply right here in seconds.',
    anim: successAnim,
    color: (t)=>t.palette.success.main
  },
  {
    key: 'pay',
    title: 'Pay Only When Needed',
    desc: 'Free sites issue permits instantly. Paid sites show the total before checkout.',
    anim: chatAnim,
    color: (t)=>t.palette.info.main
  }
];

export default function OnboardingCarousel({ open = false, onDone, slides = defaultSlides, autoMs = 5000 }){
  const [i, setI] = useState(0);
  const reduceMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
  const lastInteractionRef = useRef(Date.now());
  const containerRef = useRef(null);

  if (!open) return null;

  const next = () => setI((v)=> (v+1) % slides.length);
  const prev = () => setI((v)=> (v-1+slides.length) % slides.length);
  const finish = () => onDone?.();

  const slide = slides[i];

  // Auto-advance when idle; pause on any user interaction
  useEffect(()=>{
    if (reduceMotion) return; // respect reduced motion
  const tick = setInterval(()=>{
      const idleFor = Date.now() - lastInteractionRef.current;
      if (idleFor >= autoMs) {
    setI((v)=> (v+1) % slides.length);
      }
    }, Math.max(1000, Math.min(autoMs, 3000)));
    return ()=>clearInterval(tick);
  }, [i, slides.length, autoMs, reduceMotion]);

  useEffect(()=>{
    const el = containerRef.current;
    if (!el) return;
    const bump = () => { lastInteractionRef.current = Date.now(); };
    const events = ['pointerdown','pointermove','wheel','keydown','touchstart'];
    events.forEach(ev=> el.addEventListener(ev, bump, { passive: true }));
    return ()=> events.forEach(ev=> el.removeEventListener(ev, bump));
  }, [open]);

  return (
    <Box
      ref={containerRef}
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.4 }}
      sx={{
        position:'fixed', inset:0, zIndex:(t)=>t.zIndex.modal+9,
        display:'grid', placeItems:'center', p:2,
        background: (t)=> t.palette.mode === 'dark'
          ? `radial-gradient(1200px 700px at 50% 0%, ${t.palette.background.default} 0%, #0a0e17 60%, #070b12 100%)`
          : `radial-gradient(1200px 700px at 50% 0%, ${t.palette.background.default} 0%, #d6e8ff 60%, #cce0ff 100%)`
      }}
      role="dialog" aria-modal="true" aria-label="Onboarding"
    >
      <Paper elevation={16} sx={{ width:'min(960px, 96vw)', maxHeight: '90vh', borderRadius: { xs: 2, sm: 3 }, overflow:'hidden', position:'relative' }}>
        {/* Subtle centered brand watermark behind content */}
        <BrandWatermark center opacity={0.08} maxSize={320} />
        <IconButton onClick={finish} sx={{ position:'absolute', top: { xs: 6, sm: 10, md: 14 }, right: { xs: 6, sm: 10, md: 14 }, zIndex:1 }} aria-label="Skip">
          <CloseIcon sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem', md: '1.7rem' } }} />
        </IconButton>
        <Box sx={{ display:'flex', flexDirection:{ xs:'column', md:'row' } }}>
          <Box sx={{ flex:1, p:{ xs: 1.5, sm: 2.5, md:3 }, display:'grid', placeItems:'center', bgcolor:(t)=>`${(typeof slide.color==='function'?slide.color(t):slide.color) + '11'}` }}>
            <Box sx={{ width:{ xs: '50vw', sm: 260, md: 340 }, height:{ xs: '40vw', sm: 260, md: 340 }, maxWidth: 360, maxHeight: 360 }}>
              {slide.anim && typeof slide.anim === 'object' && Object.keys(slide.anim || {}).length > 0 ? (
                <Lottie autoplay={!reduceMotion} loop={!reduceMotion} animationData={slide.anim} style={{ width:'100%', height:'100%' }} />
              ) : (
                <Box sx={{ width:'100%', height:'100%', borderRadius:'50%', background:(t)=>`${(typeof slide.color==='function'?slide.color(t):slide.color)}33` }} />
              )}
            </Box>
          </Box>
          <Box sx={{ flex:1, p:{ xs: 1.5, sm: 2.5, md:4 } }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: { xs: 0.5, sm: 1 }, fontSize: { xs: '1.05rem', sm: '1.4rem' } }}>{slide.title}</Typography>
            <Typography variant="body1" sx={{ color:'text.secondary', mb: { xs: 1.5, sm: 3 }, fontSize: { xs: '0.82rem', sm: '0.95rem' } }}>{slide.desc}</Typography>
            <Box sx={{ display:'flex', gap:1 }}>
              <Button variant="outlined" color="inherit" onClick={finish} size="small">Skip</Button>
              <Button variant="contained" onClick={next} size="small">
                Next
              </Button>
            </Box>
          </Box>
        </Box>
    <MobileStepper
          variant="dots"
          steps={slides.length}
          position="static"
          activeStep={i}
          sx={{ bgcolor:'transparent', px: { xs: 1, sm: 2 }, py: { xs: 0.5, sm: 1 } }}
          nextButton={
      <IconButton onClick={next} aria-label="Next slide"><ArrowForwardIosIcon/></IconButton>
          }
          backButton={
      <IconButton onClick={prev} aria-label="Previous slide"><ArrowBackIosNewIcon/></IconButton>
          }
        />
      </Paper>
    </Box>
  );
}
