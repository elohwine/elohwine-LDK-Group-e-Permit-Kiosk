import { useState, useMemo, useEffect, useRef } from "react";
import { Box, Paper, Button, IconButton } from "@mui/material";
import { alpha } from "@mui/material/styles";
import BackspaceIcon from "@mui/icons-material/Backspace";
import KeyboardHideIcon from "@mui/icons-material/KeyboardHide";
import OpenInFullIcon from "@mui/icons-material/OpenInFull"; // undock icon
import VerticalAlignBottomIcon from "@mui/icons-material/VerticalAlignBottom"; // dock icon

export default function OnScreenKeyboard({ open, mode = "text", value = "", onChange, onClose, onSize, docked = true, position = {x:16,y:16}, size = { w: 640, h: 360 }, onToggleDock, onDrag, onResize }) {
  const [caps, setCaps] = useState(true);
  const rootRef = useRef(null);
  const heightPx = useMemo(() => {
    const hasWindow = typeof window !== 'undefined';
    const vh = hasWindow ? window.innerHeight : 0;
    // More compact keyboard - reduce from 0.9 to 0.4 of viewport height
    const target = vh ? Math.round(vh * 0.4) : Math.min(size.h, 280);
    return Math.max(200, Math.min(size.h, target));
  }, [size.h]);
  const draggingRef = useRef(null);
  const resizingRef = useRef(null);
  const moveHandlerRef = useRef(null);
  const upHandlerRef = useRef(null);

  const rows = useMemo(() => {
    if (mode === "number") {
      return [
        ["7", "8", "9"],
        ["4", "5", "6"],
        ["1", "2", "3"],
        ["0", ".", "-"],
      ];
    }
    const r1 = ["1","2","3","4","5","6","7","8","9","0"];
    const r2 = ["q","w","e","r","t","y","u","i","o","p"];
    const r3 = ["a","s","d","f","g","h","j","k","l"];
    const r4 = ["z","x","c","v","b","n","m"];
    return [r1, r2, r3, r4];
  }, [mode]);

  // Ensure hooks run unconditionally before any early return
  useEffect(()=>{
    if (!open) return;
    const el = rootRef.current;
    if (!el) return;
    const hasRO = typeof ResizeObserver !== 'undefined';
    const ro = hasRO ? new ResizeObserver(()=>{
      const h = el.getBoundingClientRect().height;
      onSize?.(h);
    }) : null;
    ro?.observe(el);
    // initial
    const h = el.getBoundingClientRect().height;
    onSize?.(h);
  return () => ro?.disconnect();
  }, [open, onSize]);

  // Global pointer listeners cleanup on unmount
  useEffect(()=>{
    return () => {
      if (moveHandlerRef.current) window.removeEventListener('pointermove', moveHandlerRef.current);
      if (upHandlerRef.current) window.removeEventListener('pointerup', upHandlerRef.current);
    };
  },[]);

  if (!open) return null;

  const apply = (ch) => {
    const out = (value || "") + ch;
    onChange?.(out);
  };
  const backspace = () => onChange?.((value || "").slice(0, -1));
  const clear = () => onChange?.("");

  const startGlobalTracking = () => {
    if (moveHandlerRef.current) return; // already tracking
    const onMove = (e) => {
      if (draggingRef.current) {
        const dx = e.clientX - draggingRef.current.startX;
        const dy = e.clientY - draggingRef.current.startY;
        draggingRef.current.startX = e.clientX;
        draggingRef.current.startY = e.clientY;
        onDrag?.(dx, dy);
        return;
      }
      if (resizingRef.current) {
        const dx = e.clientX - resizingRef.current.startX;
        const dy = e.clientY - resizingRef.current.startY;
        resizingRef.current.startX = e.clientX;
        resizingRef.current.startY = e.clientY;
        onResize?.(dx, dy, resizingRef.current.edge);
        return;
      }
    };
    const onUp = (e) => {
      draggingRef.current = null;
      resizingRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      moveHandlerRef.current = null;
      upHandlerRef.current = null;
    };
    moveHandlerRef.current = onMove;
    upHandlerRef.current = onUp;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <Box
      ref={rootRef}
      data-keyboard-element="true"
      sx={{
        position: 'fixed',
        left: docked ? 0 : position.x,
        right: docked ? 0 : 'auto',
        bottom: docked ? 0 : 'auto',
        top: docked ? 'auto' : position.y,
        zIndex: (t) => t.zIndex.modal + 1,
        maxWidth: docked ? '100vw' : 'min(100vw - 24px, 1200px)'
      }}
    >
      <Paper elevation={16} data-keyboard-element="true" sx={{ p: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: docked ? 0 : 16, borderBottomRightRadius: docked ? 0 : 16, bgcolor: 'background.paper', height: `${heightPx}px`, width: docked ? '100%' : `${size.w}px`, display:'flex', flexDirection:'column', boxSizing:'border-box', position:'relative' }}>
        {/* Minimal header with only controls when undocked */}
        {!docked && (
          <Box
            onPointerDown={(e)=>{
              draggingRef.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY };
              startGlobalTracking();
              try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
            }}
            sx={{ display:'flex', justifyContent:'flex-end', alignItems:'center', mb: 0.5, cursor: draggingRef.current ? 'grabbing' : 'grab', userSelect: 'none' }}
          >
            <Box>
              <IconButton size="small" data-keyboard-element="true" onClick={onToggleDock} sx={{ mr: 0.5 }}>
                <VerticalAlignBottomIcon fontSize="small"/>
              </IconButton>
              <IconButton size="small" data-keyboard-element="true" onClick={onClose}><KeyboardHideIcon fontSize="small"/></IconButton>
            </Box>
          </Box>
        )}
        {/* Docked mode: only hide button in top-right */}
        {docked && (
          <Box sx={{ position:'absolute', top: 8, right: 8, zIndex: 10 }}>
            <IconButton size="small" data-keyboard-element="true" onClick={onToggleDock} sx={{ mr: 0.5, bgcolor: (t)=>alpha(t.palette.background.paper, 0.9) }}>
              <OpenInFullIcon fontSize="small"/>
            </IconButton>
            <IconButton size="small" data-keyboard-element="true" onClick={onClose} sx={{ bgcolor: (t)=>alpha(t.palette.background.paper, 0.9) }}><KeyboardHideIcon fontSize="small"/></IconButton>
          </Box>
        )}
        {/* keys */}
        <Box sx={{ display:'grid', gap: 1, overflow:'auto', flex: 1 }}>
          {rows.map((r, idx) => (
            <Box key={idx} sx={{ display:'flex', gap: 1, justifyContent:'center' }}>
              {mode !== 'number' && idx === 2 && (
                <Button variant="outlined" data-keyboard-element="true" onClick={() => setCaps(!caps)} sx={{ minWidth: 80 }}>
                  {caps ? 'Caps' : 'caps'}
                </Button>
              )}
              {r.map((k) => {
                const label = mode === 'number' ? k : (caps ? k.toUpperCase() : k);
                return (
                  <Button key={k} variant="contained" data-keyboard-element="true" onClick={() => apply(label)} sx={{ minWidth: 48, bgcolor: (t)=>`${t.palette.primary.main}b3` , '&:hover': { bgcolor: (t)=>`${t.palette.primary.main}cc` } }}>
                    {label}
                  </Button>
                );
              })}
              {mode !== 'number' && idx === 2 && (
                <IconButton color="primary" data-keyboard-element="true" onClick={backspace} sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <BackspaceIcon />
                </IconButton>
              )}
              {mode === 'number' && idx === rows.length - 1 && (
                <IconButton color="primary" data-keyboard-element="true" onClick={backspace} sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <BackspaceIcon />
                </IconButton>
              )}
            </Box>
          ))}
          <Box sx={{ display:'flex', gap: 1, justifyContent:'center' }}>
            {mode !== 'number' && (
              <Button onClick={() => apply(' ')} data-keyboard-element="true" variant="outlined" sx={{ minWidth: 160, bgcolor: (t)=>`${t.palette.primary.main}4d`, borderColor: 'transparent', '&:hover': { bgcolor: (t)=>`${t.palette.primary.main}66` } }}>Space</Button>
            )}
            <Button color="warning" data-keyboard-element="true" onClick={clear} variant="outlined">Clear</Button>
            <Button onClick={onClose} data-keyboard-element="true" variant="contained" sx={{ bgcolor: (t)=>`${t.palette.primary.main}b3`, '&:hover': { bgcolor: (t)=>`${t.palette.primary.main}cc` } }}>Done</Button>
          </Box>
        </Box>
        {/* Resize handles (visible when undocked for width, always for height if docked) */}
        <Box
          onPointerDown={(e)=>{ resizingRef.current = { edge: 'bottom-right', startX: e.clientX, startY: e.clientY }; startGlobalTracking(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} }}
          sx={{ position:'absolute', width: 18, height: 18, right: 6, bottom: 6, cursor: 'nwse-resize', border: '1px solid', borderColor: 'divider', borderRadius: 1,
            backgroundImage: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.35) 0 2px, transparent 2px 4px)',
            bgcolor: 'action.hover',
            '&:hover': { bgcolor: 'action.selected' }
          }}
          aria-label="Resize"
          role="button"
        />
        {!docked && (
          <>
            <Box onPointerDown={(e)=>{ resizingRef.current = { edge: 'right', startX: e.clientX, startY: e.clientY }; startGlobalTracking(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} }} sx={{ position:'absolute', top: 24, bottom: 24, right: 0, width: 12, cursor: 'ew-resize', bgcolor: 'action.hover', opacity: 0.6, '&:hover': { opacity: 1, bgcolor: 'action.selected' } }} />
            <Box onPointerDown={(e)=>{ resizingRef.current = { edge: 'left', startX: e.clientX, startY: e.clientY }; startGlobalTracking(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} }} sx={{ position:'absolute', top: 24, bottom: 24, left: 0, width: 12, cursor: 'ew-resize', bgcolor: 'action.hover', opacity: 0.6, '&:hover': { opacity: 1, bgcolor: 'action.selected' } }} />
            <Box onPointerDown={(e)=>{ resizingRef.current = { edge: 'top', startX: e.clientX, startY: e.clientY }; startGlobalTracking(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} }} sx={{ position:'absolute', top: 0, left: 24, right: 24, height: 12, cursor: 'ns-resize', bgcolor: 'action.hover', opacity: 0.6, '&:hover': { opacity: 1, bgcolor: 'action.selected' } }} />
          </>
        )}
        {docked && (
          <Box onPointerDown={(e)=>{ resizingRef.current = { edge: 'bottom', startX: e.clientX, startY: e.clientY }; startGlobalTracking(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} }} sx={{ position:'absolute', left: 24, right: 24, bottom: 0, height: 12, cursor: 'ns-resize', bgcolor: 'action.hover', opacity: 0.6, '&:hover': { opacity: 1, bgcolor: 'action.selected' } }} />
        )}
      </Paper>
    </Box>
  );
}
