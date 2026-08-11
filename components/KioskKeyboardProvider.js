import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import OnScreenKeyboard from "./OnScreenKeyboard";

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

export default function KioskKeyboardProvider({ children }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Always stacked: keyboard sits below content on all devices (APT-kiosk style)
  const isWideLandscape = false;

  // Theme-driven panel tokens
  const rootBg = isDark
    ? 'radial-gradient(1200px 600px at 20% 0%, #2a303c 0%, #1b202a 40%, #121621 100%)'
    : 'radial-gradient(1200px 600px at 20% 0%, #f2f7ff 0%, #e6f0ff 35%, #d6e8ff 65%, #cce2ff 100%)';
  const panelBg = isDark
    ? 'linear-gradient(170deg, #0d1e35 0%, #0f2444 60%, #091520 100%)'
    : 'linear-gradient(170deg, #eaf3ff 0%, #ddeeff 55%, #cfe5ff 100%)';
  const panelBorder = isDark ? 'rgba(19,116,188,0.22)' : 'rgba(19,116,188,0.3)';
  const headerBg = isDark ? 'rgba(19,116,188,0.09)' : 'rgba(19,116,188,0.07)';
  const headerBorder = isDark ? 'rgba(19,116,188,0.16)' : 'rgba(19,116,188,0.18)';
  const panelShadow = isDark
    ? '0 8px 40px rgba(0,0,0,0.55), 0 2px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)'
    : '0 8px 32px rgba(19,116,188,0.18), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)';

  const [mode, setMode] = useState('text');
  const [value, setValue] = useState('');
  const [hasTarget, setHasTarget] = useState(false);
  const targetRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const onFocusIn = (ev) => {
      const el = ev.target;
      if (!el) return;
      if (el.dataset?.kioskKbd === 'off') return;
      const tag = el.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !el.isContentEditable) return;
      const inputType = (el.type || '').toLowerCase();
      const im = (el.inputMode || '').toLowerCase();
      const numeric = inputType === 'number' || im === 'numeric' || im === 'decimal';

      // Suppress Android system keyboard by setting inputMode="none"
      if (!el._origInputMode) el._origInputMode = el.inputMode || '';
      el.inputMode = 'none';

      targetRef.current = el;
      setMode(numeric ? 'number' : 'text');
      setValue(tag === 'INPUT' || tag === 'TEXTAREA' ? el.value : el.textContent || '');
      setHasTarget(true);
    };

    const onFocusOut = (ev) => {
      setTimeout(() => {
        const active = document.activeElement;
        if (!active) { targetRef.current = null; setHasTarget(false); setArrowY(null); return; }
        if (active.closest?.('[data-keyboard-element]')) return;
        const tag = active.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || active.isContentEditable) return;
        // Restore original inputMode when leaving the field
        if (targetRef.current && targetRef.current._origInputMode !== undefined) {
          targetRef.current.inputMode = targetRef.current._origInputMode;
          delete targetRef.current._origInputMode;
        }
        targetRef.current = null;
        setHasTarget(false);
      }, 50);
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const handleChange = useCallback((v) => {
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
  }, []);

  // Auto-focus first visible input whenever no field is active
  useEffect(() => {
    if (hasTarget) return;
    const timer = setTimeout(() => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      const inputs = Array.from(document.querySelectorAll(
        'input:not([disabled]):not([type="hidden"]):not([data-kiosk-kbd="off"]), textarea:not([disabled])'
      )).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (inputs[0]) inputs[0].focus();
    }, 300);
    return () => clearTimeout(timer);
  }, [hasTarget]);

  // "Next" advances to the next input instead of closing keyboard
  const handleNext = useCallback(() => {
    const el = targetRef.current;
    const inputs = Array.from(document.querySelectorAll(
      'input:not([disabled]):not([type="hidden"]):not([data-kiosk-kbd="off"]), textarea:not([disabled])'
    ));
    const idx = inputs.indexOf(el);
    const next = inputs[idx + 1];
    if (next) {
      next.focus();
    } else if (el) {
      el.blur();
    }
  }, []);

  // "Enter" dispatches a keyboard Enter event and submits the nearest form
  const handleEnter = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
    const form = el.closest?.('form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) submitBtn.click();
      else form.requestSubmit?.();
    }
  }, []);

  return (
    <Box sx={{
      display: 'flex',
      height: '100%',
      minHeight: 0,
      flexDirection: isWideLandscape ? 'row' : 'column',
      overflow: 'hidden',
      background: rootBg,
    }}>
      {/* App content — scrollable so keyboard panel never clips it */}
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>

      {/* Keyboard panel — flat, full-width, fills all remaining height */}
      <Box
        data-keyboard-element="true"
        ref={panelRef}
        sx={{
          flexShrink: 0,
          position: 'relative',
          width: '100%',
          flex: '0 0 auto',
          alignSelf: 'stretch',
          mx: 0,
          mt: 0,
          mb: 0,
          borderRadius: 0,
          background: panelBg,
          border: 'none',
          borderTop: `1px solid ${panelBorder}`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.28)',
          overflow: 'hidden',
        }}
      >

        {/* Inner clipping wrapper */}
        <Box sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Header strip */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.625,
          px: { xs: 1.25, sm: 1.5 },
          py: { xs: 0.375, sm: 0.625 },
          borderBottom: `1px solid ${headerBorder}`,
          bgcolor: headerBg,
          flexShrink: 0,
        }}>
          <KeyboardIcon sx={{ fontSize: '0.8rem', color: hasTarget ? '#1374bc' : isDark ? 'rgba(255,255,255,0.22)' : 'rgba(19,116,188,0.35)', transition: 'color 0.25s' }} />
          <Typography sx={{
            fontSize: '0.625rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: hasTarget
              ? isDark ? 'rgba(255,255,255,0.72)' : '#1374bc'
              : isDark ? 'rgba(255,255,255,0.22)' : 'rgba(19,116,188,0.38)',
            transition: 'color 0.25s',
          }}>
            {hasTarget ? 'Keyboard Active' : 'Tap a field to type'}
          </Typography>
          {hasTarget && (
            <Box sx={{
              ml: 'auto',
              width: 5,
              height: 5,
              borderRadius: '50%',
              bgcolor: '#1374bc',
              boxShadow: '0 0 5px #1374bc',
              animation: 'kbdpulse 1.8s ease-in-out infinite',
              '@keyframes kbdpulse': {
                '0%,100%': { opacity: 1, transform: 'scale(1)' },
                '50%': { opacity: 0.35, transform: 'scale(0.7)' },
              },
            }} />
          )}
        </Box>

        <OnScreenKeyboard
          isDark={isDark}
          mode={mode}
          value={value}
          hasTarget={hasTarget}
          onChange={handleChange}
          onNext={handleNext}
          onEnter={handleEnter}
        />
        </Box>{/* end inner clip */}
      </Box>{/* end panel */}
    </Box>
  );
}
