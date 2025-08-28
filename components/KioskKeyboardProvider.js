import { useEffect, useRef, useState } from "react";
import { Box, Fab, Portal } from "@mui/material";
import KeyboardHideIcon from "@mui/icons-material/KeyboardHide";
import OnScreenKeyboard from "./OnScreenKeyboard";
import { getSettings } from "../lib/permits";

function setNativeValue(element, value) {
  const { set: valueSetter } = Object.getOwnPropertyDescriptor(element, 'value') || {};
  const prototype = Object.getPrototypeOf(element);
  const { set: prototypeValueSetter } = Object.getOwnPropertyDescriptor(prototype, 'value') || {};
  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }
}

export default function KioskKeyboardProvider(){
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('text');
  const [value, setValue] = useState('');
  const [docked, setDocked] = useState(true);
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const [size, setSize] = useState({ w: 640, h: 280 });
  const [showFabPos, setShowFabPos] = useState(null); // {x,y}
  const showFabRef = useRef(null);
  const dragFabRef = useRef(null);
  const targetRef = useRef(null);
  const settingsRef = useRef({ kioskKeyboardEnabled: false, kioskKeyboardAutoOpen: true });

  // Load settings once and whenever storage changes (simple sync)
  useEffect(()=>{
    (async ()=>{ settingsRef.current = await getSettings(); })();
    const onStorage = async (e) => {
      if (e.key === 'settings') settingsRef.current = await getSettings();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  },[]);

  // Load persisted Show FAB position
  useEffect(()=>{
    try {
      const raw = localStorage.getItem('kbdShowFabPos');
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p.x === 'number' && typeof p.y === 'number') setShowFabPos(p);
      }
    } catch {}
  },[]);

  // Start hidden by default; only open when a text input receives focus
  useEffect(()=>{
    setOpen(false);
    try { document.documentElement.style.setProperty('--kbd-inset', '0px'); } catch {}
  },[]);

  useEffect(()=>{
    const handler = (ev) => {
  const s = settingsRef.current || {};
      const el = ev.target;
      if (!el) return;
      if (el.dataset && el.dataset.kioskKbd === 'off') return; // opt-out
      const tag = el.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !el.isContentEditable) return;
      // Determine mode
      const inputType = (el.type || '').toLowerCase();
      const im = (el.inputMode || '').toLowerCase();
      const numeric = inputType === 'number' || im === 'numeric' || im === 'decimal';
      targetRef.current = el;
      setMode(numeric ? 'number' : 'text');
      const currentValue = tag === 'INPUT' || tag === 'TEXTAREA' ? el.value : el.textContent || '';
      setValue(currentValue);
  // Auto-open when an input is focused (keyboard is hidden by default until focus)
  setOpen(true);
    };
    const onFocusOut = (ev) => {
      // Use a small delay to check if focus moved to keyboard buttons
      setTimeout(() => {
        const el = ev.relatedTarget || document.activeElement;
        if (!el) { setOpen(false); return; }
        
        // Check if focus moved to keyboard or its buttons
        const isKeyboardElement = el.closest('[data-keyboard-element]') || 
                                  el.closest('.MuiPaper-root') && el.closest('[role="button"]');
        if (isKeyboardElement) return; // Don't close if focus is on keyboard
        
        const tag = el.tagName;
        const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
        if (!isEditable) setOpen(false);
      }, 50);
    };
    document.addEventListener('focusin', handler);
    document.addEventListener('focusout', onFocusOut);
    const onKeyDown = (e) => {
      // Check keyboard open state directly to avoid stale closure
      if (e.key === 'Enter' && !e.isComposing) {
        // Close keyboard and blur target; allow form submit to proceed
        setOpen(false);
        try { targetRef.current?.blur?.(); } catch {}
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('focusin', handler);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('keydown', onKeyDown);
    };
  },[open]);

  const handleChange = (v) => {
    setValue(v);
    const el = targetRef.current;
    if (!el) return;
    if (el.isContentEditable) {
      el.textContent = v;
    } else {
      setNativeValue(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  // Expose a simple layout hint so pages can add bottom padding
  useEffect(()=>{
    const root = document.documentElement;
    if (open) {
      document.body.classList.add('kbd-open');
      // Enhanced scroll behavior to keep focused element visible
      setTimeout(()=>{
        try { 
          const el = targetRef.current;
          if (el) {
            // Get keyboard height and ensure element is visible above it
            const kbdHeight = parseInt(root.style.getPropertyValue('--kbd-inset') || '0');
            const rect = el.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const availableHeight = viewportHeight - kbdHeight;
            
            // If element is below the available area, scroll it into view
            if (rect.bottom > availableHeight) {
              el.scrollIntoView({ 
                block: 'center', 
                behavior: 'smooth',
                inline: 'nearest'
              });
            }
          }
        } catch {}
      }, 100);
    } else {
      root.style.setProperty('--kbd-inset', '0px');
      document.body.classList.remove('kbd-open');
    }
  }, [open]);

  const onKeyboardSize = (h) => {
    // Only push layout when docked at bottom
    document.documentElement.style.setProperty('--kbd-inset', docked ? `${Math.ceil(h)}px` : '0px');
  };

  const handleToggleDock = () => {
    setDocked(prev => !prev);
    // Reset inset when undocking
    if (docked) document.documentElement.style.setProperty('--kbd-inset', '0px');
  };

  const handleDrag = (dx, dy) => {
    setPos(p => ({ x: Math.max(8, Math.min(window.innerWidth - 280, p.x + dx)), y: Math.max(8, Math.min(window.innerHeight - 120, p.y + dy)) }));
  };

  const handleResize = (dx, dy, edge) => {
    setSize(s => {
      let { w, h } = s;
      if (edge.includes('right')) w += dx;
      if (edge.includes('left')) { w -= dx; setPos(p=>({ ...p, x: p.x + dx })); }
      if (edge.includes('bottom')) h += dy;
      if (edge.includes('top')) { h -= dy; setPos(p=>({ ...p, y: p.y + dy })); }
      w = Math.max(360, Math.min(w, window.innerWidth - 16));
      h = Math.max(240, Math.min(h, window.innerHeight - 16));
      return { w, h };
    });
  };

  return (
    <>
      <OnScreenKeyboard
        open={open}
        mode={mode}
        value={value}
        onChange={handleChange}
        onClose={()=>setOpen(false)}
        onSize={onKeyboardSize}
        docked={docked}
        position={pos}
  size={size}
        onToggleDock={handleToggleDock}
  onDrag={handleDrag}
  onResize={handleResize}
      />
      {open && (
        <Fab
          color="primary"
          variant="extended"
          onClick={()=>setOpen(false)}
          sx={{ position:'fixed', right:16, bottom: docked ? 'calc(var(--kbd-inset, 0px) + 16px)' : 16, zIndex: (t)=>t.zIndex.modal + 2, bgcolor:(t)=>`${t.palette.primary.main}b3`, '&:hover':{ bgcolor:(t)=>`${t.palette.primary.main}cc` } }}
        >
          <KeyboardHideIcon sx={{ mr: 1 }} /> Hide keyboard
        </Fab>
      )}
      {!open && (
        <Portal>
        <Box
          ref={showFabRef}
          onPointerDown={(e)=>{
            const el = showFabRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            dragFabRef.current = {
              id: e.pointerId,
              offsetX: e.clientX - rect.left,
              offsetY: e.clientY - rect.top,
              w: rect.width,
              h: rect.height
            };
            try { el.setPointerCapture(e.pointerId); } catch {}
          }}
          onPointerMove={(e)=>{
            if (!dragFabRef.current) return;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const w = dragFabRef.current.w;
            const h = dragFabRef.current.h;
            let x = e.clientX - dragFabRef.current.offsetX;
            let y = e.clientY - dragFabRef.current.offsetY;
            x = Math.max(8, Math.min(x, vw - w - 8));
            y = Math.max(8, Math.min(y, vh - h - 8));
            setShowFabPos({ x, y });
          }}
          onPointerUp={(e)=>{
            if (!dragFabRef.current) return;
            try { showFabRef.current?.releasePointerCapture(dragFabRef.current.id); } catch {}
            // Persist using actual rect to avoid stale state
            try {
              const rect = showFabRef.current?.getBoundingClientRect();
              if (rect) {
                const vw = window.innerWidth;
                const w = rect.width;
                const leftSnap = 8;
                const rightSnap = vw - w - 8;
                const snapX = (rect.left < vw/2) ? leftSnap : rightSnap;
                const y = Math.max(8, Math.min(rect.top, window.innerHeight - rect.height - 8));
                setShowFabPos({ x: snapX, y });
                localStorage.setItem('kbdShowFabPos', JSON.stringify({ x: snapX, y }));
              }
            } catch {}
            dragFabRef.current = null;
          }}
          sx={{
            position:'fixed',
            left: showFabPos ? `${showFabPos.x}px` : 'auto',
            top: showFabPos ? `${showFabPos.y}px` : 'auto',
            right: showFabPos ? 'auto' : 16,
            bottom: showFabPos ? 'auto' : 16,
            zIndex: (t)=>t.zIndex.modal + 2,
            cursor: dragFabRef.current ? 'grabbing' : 'grab',
            touchAction: 'none'
          }}
          aria-label="Show on-screen keyboard"
        >
          <Fab
            color="primary"
            variant="extended"
            onClick={()=>setOpen(true)}
            sx={{ bgcolor:(t)=>`${t.palette.primary.main}b3`, opacity: showFabPos ? 0.9 : 1, '&:hover':{ bgcolor:(t)=>`${t.palette.primary.main}cc`, opacity: 1 } }}
          >
            {/* Reuse hide icon flipped to suggest show, or could use keyboard icon if added */}
            <KeyboardHideIcon sx={{ mr: 1, transform: 'scaleY(-1)' }} /> Show keyboard
          </Fab>
        </Box>
        </Portal>
      )}
    </>
  );
}
