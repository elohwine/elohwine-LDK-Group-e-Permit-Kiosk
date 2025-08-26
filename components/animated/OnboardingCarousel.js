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
    key: 'probooking',
    title: 'ProBooking',
    desc: 'Fast bookings with animated guidance and kiosk-friendly flows.',
    anim: chatAnim,
    color: (t)=>t.palette.primary.main
  },
  {
    key: 'onsite',
    title: 'Onsite Booking',
    desc: 'Walk-up users can complete actions with a clean, simple UI.',
    anim: loadingAnim,
    color: (t)=>t.palette.info.main
  },
  {
    key: 'payments',
    title: 'Payments',
    desc: 'Secure and streamlined payments at the kiosk.',
    anim: successAnim,
    color: (t)=>t.palette.success.main
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

  const next = () => setI((v)=> Math.min(v+1, slides.length-1));
  const prev = () => setI((v)=> Math.max(v-1, 0));
  const finish = () => onDone?.();

  const slide = slides[i];

  // Auto-advance when idle; pause on any user interaction
  useEffect(()=>{
    if (reduceMotion) return; // respect reduced motion
    const tick = setInterval(()=>{
      const idleFor = Date.now() - lastInteractionRef.current;
      if (idleFor >= autoMs) {
        if (i < slides.length - 1) setI((v)=> Math.min(v+1, slides.length-1));
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
        background: (t)=>`radial-gradient(1200px 700px at 50% 0%, ${t.palette.background.default} 0%, #0a0e17 60%, #070b12 100%)`
      }}
      role="dialog" aria-modal="true" aria-label="Onboarding"
    >
      <Paper elevation={16} sx={{ width:'min(960px, 95vw)', borderRadius: 3, overflow:'hidden', position:'relative' }}>
        {/* Subtle centered brand watermark behind content */}
        <BrandWatermark center opacity={0.08} maxSize={420} />
        <IconButton onClick={finish} sx={{ position:'absolute', top:8, right:8, zIndex:1 }} aria-label="Skip">
          <CloseIcon/>
        </IconButton>
        <Box sx={{ display:'flex', flexDirection:{ xs:'column', md:'row' } }}>
          <Box sx={{ flex:1, p:{ xs:2, md:3 }, display:'grid', placeItems:'center', bgcolor:(t)=>`${(typeof slide.color==='function'?slide.color(t):slide.color) + '11'}` }}>
            <Box sx={{ width:{ xs:240, md:320 }, height:{ xs:240, md:320 } }}>
              {slide.anim && typeof slide.anim === 'object' && Object.keys(slide.anim || {}).length > 0 ? (
                <Lottie autoplay={!reduceMotion} loop={!reduceMotion} animationData={slide.anim} style={{ width:'100%', height:'100%' }} />
              ) : (
                <Box sx={{ width:'100%', height:'100%', borderRadius:'50%', background:(t)=>`${(typeof slide.color==='function'?slide.color(t):slide.color)}33` }} />
              )}
            </Box>
          </Box>
          <Box sx={{ flex:1, p:{ xs:2, md:4 } }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{slide.title}</Typography>
            <Typography variant="body1" sx={{ color:'text.secondary', mb: 3 }}>{slide.desc}</Typography>
            <Box sx={{ display:'flex', gap:1 }}>
              <Button variant="outlined" color="inherit" onClick={finish}>Skip</Button>
              <Button variant="contained" onClick={i===slides.length-1 ? finish : next}>
                {i===slides.length-1 ? 'Done' : 'Next'}
              </Button>
            </Box>
          </Box>
        </Box>
        <MobileStepper
          variant="dots"
          steps={slides.length}
          position="static"
          activeStep={i}
          sx={{ bgcolor:'transparent', px:2, py:1 }}
          nextButton={
            <IconButton onClick={next} disabled={i===slides.length-1} aria-label="Next slide"><ArrowForwardIosIcon/></IconButton>
          }
          backButton={
            <IconButton onClick={prev} disabled={i===0} aria-label="Previous slide"><ArrowBackIosNewIcon/></IconButton>
          }
        />
      </Paper>
    </Box>
  );
}
