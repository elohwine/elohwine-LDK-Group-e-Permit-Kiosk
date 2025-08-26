import { useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import BrandWatermark from '../BrandWatermark';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';

function useLottie(url){
  const [data, setData] = useState(null);
  useEffect(()=>{
    let mounted = true;
    (async()=>{
      try {
        if (!url) { setData(null); return; }
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) { setData(null); return; }
        const json = await res.json();
        if (mounted) setData(json);
      } catch { setData(null); }
    })();
    return ()=>{ mounted = false; };
  }, [url]);
  return data;
}

export default function SplashScreen({ onDone, autoHideMs = 2200 }){
  const [show, setShow] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const doneRef = useRef(false);
  const anim = useLottie('/lottie/Loading.json');

  useEffect(()=>{
    try {
      if (typeof window !== 'undefined' && window.matchMedia) {
        setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      }
    } catch {}
  },[]);

  useEffect(()=>{
    const t = setTimeout(()=> setShow(false), autoHideMs);
    return ()=> clearTimeout(t);
  }, [autoHideMs]);

  useEffect(()=>{
    if (!show && !doneRef.current) { doneRef.current = true; onDone?.(); }
  }, [show, onDone]);

  if (!show) return null;

  return (
  <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.6 }}
      sx={{ position:'fixed', inset:0, zIndex:(t)=>t.zIndex.modal+10, display:'grid', placeItems:'center',
        background:(t)=>`radial-gradient(1200px 700px at 50% -10%, ${t.palette.background.default} 0%, #0a0f1c 45%, #050914 100%)`,
        color:(t)=>t.palette.primary.contrastText }}
      role="dialog" aria-modal="true" aria-label="Loading"
    >
      <Box sx={{ textAlign:'center', position:'relative' }}>
  <BrandWatermark center maxSize={280} opacity={0.2} paths={["/icons/icon-512.png","/icons/icon-192.png","/reference.png","/img/logo.png","/img/logo.svg","/img/logo.jpg"]} />
        <Box sx={{ width: 220, height: 220, mx:'auto', mb: 2, position:'relative' }}>
          {anim ? (
            <Lottie autoplay={!reduceMotion} loop={!reduceMotion} animationData={anim} style={{ width:'100%', height:'100%' }} />
          ) : (
            <Box component={motion.div} initial={{ scale: 0.95 }} animate={reduceMotion?{scale:1}:{ scale:[0.95,1.05,0.98,1] }} transition={{ duration: reduceMotion?0:1.2 }} sx={{
              width:'100%', height:'100%', borderRadius:'50%',
              background:(t)=>`conic-gradient(from 0deg, ${t.palette.primary.main}, ${t.palette.info.main}, ${t.palette.primary.main})`,
              boxShadow:(t)=>`0 0 40px ${t.palette.primary.main}66`
            }}/>
          )}
          <Box sx={{ position:'absolute', inset:-12, filter:'blur(24px)', opacity:0.4, borderRadius:'50%', background:(t)=>t.palette.primary.main }} />
        </Box>
        <Typography variant="h4" sx={{ fontWeight:800, letterSpacing:1.5, mb: 0.5 }}>e‑Permit</Typography>
        <Typography variant="subtitle1" sx={{ opacity:0.8, mb: 3 }}>Fast • Modern • Kiosk‑ready</Typography>
        <Button onClick={()=>setShow(false)} variant="contained">Skip</Button>
      </Box>
    </Box>
  );
}
