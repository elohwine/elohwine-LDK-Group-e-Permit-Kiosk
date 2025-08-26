import { useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';

// Tries multiple logo paths and renders the first that loads; otherwise renders nothing.
export default function BrandWatermark({ paths = ['/icons/icon-512.png', '/icons/icon-192.png', '/reference.png', '/img/logo.png', '/img/logo.svg', '/img/logo.jpg'], maxSize = 360, opacity = 0.3, center = true }){
  const [src, setSrc] = useState(null);
  const triedRef = useRef({});

  useEffect(()=>{
    let cancelled = false;
    const tryNext = async (i=0) => {
      if (cancelled || i >= paths.length) return;
      const url = paths[i];
      if (!url || triedRef.current[url]) return tryNext(i+1);
      triedRef.current[url] = true;
      try {
        const res = await fetch(url, { method: 'HEAD', cache: 'force-cache' });
        if (!cancelled && res.ok) { setSrc(url); return; }
      } catch {}
      if (!cancelled) return tryNext(i+1);
    };
    setSrc(null);
    triedRef.current = {};
    tryNext(0);
    return ()=>{ cancelled = true; };
  }, [paths.join('|')]);

  if (!src) return null;

  const Img = (
    <Box component="img" alt="Brand watermark" src={src}
      sx={(t)=>({ width: '100%', height: '100%', objectFit: 'contain', opacity, mixBlendMode: t.palette.mode === 'dark' ? 'screen' : 'multiply' })} />
  );

  if (center) {
    return (
      <Box aria-hidden sx={{ position:'absolute', inset:0, display:'grid', placeItems:'center', pointerEvents:'none', zIndex: 0 }}>
        <Box sx={{ width: maxSize, maxWidth: '60vw', aspectRatio: '1 / 1' }}>
          {Img}
        </Box>
      </Box>
    );
  }
  return (
    <Box aria-hidden sx={{ position:'absolute', top: 8, left: 8, width: maxSize, opacity, pointerEvents:'none', zIndex: 0 }}>
      {Img}
    </Box>
  );
}
