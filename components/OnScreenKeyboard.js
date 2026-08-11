import { useState, useMemo } from "react";
import { Box, ButtonBase } from "@mui/material";
import BackspaceIcon from "@mui/icons-material/Backspace";

/**
 * ATM-style on-screen keyboard.
 * Always rendered inside the side panel. Uses brand navy/blue palette.
 * Props: { mode, value, hasTarget, onChange, onNext }
 */
export default function OnScreenKeyboard({ isDark = true, mode = "text", value = "", hasTarget = false, onChange, onNext, onEnter }) {
  const [caps, setCaps] = useState(true);

  const qRow1 = useMemo(() => ['Q','W','E','R','T','Y','U','I','O','P'], []);
  const qRow2 = useMemo(() => ['A','S','D','F','G','H','J','K','L'], []);
  const qRow3 = useMemo(() => ['Z','X','C','V','B','N','M'], []);

  const numRows = useMemo(() => [
    ["1","2","3"],
    ["4","5","6"],
    ["7","8","9"],
    ["0",".",null],
  ], []);

  const apply = (ch) => { if (hasTarget) onChange?.((value || "") + ch); };
  const backspace = () => { if (hasTarget) onChange?.((value || "").slice(0, -1)); };
  const clear = () => { if (hasTarget) onChange?.(""); };

  // Brand-aligned color tokens — light/dark reactive
  const KEY_BG        = isDark ? '#162d4a' : '#d8ecff';
  const KEY_BG_HOVER  = isDark ? '#1c3a5f' : '#c0dfff';
  const KEY_TEXT      = isDark ? '#e8f0fc' : '#0d2a4a';
  const KEY_BORDER    = isDark ? 'rgba(19,116,188,0.18)' : 'rgba(19,116,188,0.3)';
  const KEY_ACTIVE    = '#1374bc';
  const BKSP_BG       = isDark ? '#0e1e30' : '#b8d4f4';
  const DONE_BG       = '#1374bc';
  const DONE_HOVER    = '#0e5fa0';
  const CAPS_ON_BG    = '#1374bc';
  const CAPS_OFF_BG   = isDark ? '#162d4a' : '#c8e2ff';
  const CLEAR_BG      = isDark ? '#4a2010' : '#fff0e8';
  const CLEAR_COLOR   = isDark ? '#ffa060' : '#e06020';

  const opacity = hasTarget ? 1 : 0.45;

  const tileSx = {
    borderRadius: 'clamp(5px, 0.8dvh, 9px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    bgcolor: KEY_BG,
    color: KEY_TEXT,
    fontWeight: 700,
    fontSize: 'clamp(0.85rem, 2.3dvh, 1.5rem)',
    fontFamily: "'Roboto', sans-serif",
    letterSpacing: '0.02em',
    border: `1px solid ${KEY_BORDER}`,
    boxShadow: '0 2px 4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07)',
    transition: 'transform 0.07s, background-color 0.1s, opacity 0.2s',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    cursor: hasTarget ? 'pointer' : 'default',
    minHeight: 'clamp(44px, 8dvh, 88px)',
    opacity,
    '&:active': hasTarget ? {
      bgcolor: KEY_ACTIVE,
      transform: 'scale(0.91)',
      boxShadow: `0 0 0 2px ${KEY_ACTIVE}55`,
    } : {},
  };

  const bkspSx = {
    ...tileSx,
    bgcolor: BKSP_BG,
    '&:active': hasTarget ? { bgcolor: '#c0392b', transform: 'scale(0.91)' } : {},
  };

  const actionSx = (variant) => ({
    borderRadius: 'clamp(6px, 1dvh, 10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    letterSpacing: '0.04em',
    fontSize: 'clamp(0.62rem, 1.5dvh, 1rem)',
    color: variant === 'clear' ? CLEAR_COLOR : variant === 'done' || variant === 'caps' ? '#e8f0fc' : KEY_TEXT,
    border: `1px solid ${KEY_BORDER}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    transition: 'transform 0.07s, background-color 0.1s, opacity 0.2s',
    cursor: hasTarget ? 'pointer' : 'default',
    opacity,
    minHeight: 'clamp(36px, 6dvh, 68px)',
    ...(variant === 'done' ? {
      bgcolor: DONE_BG,
      border: '1px solid rgba(19,116,188,0.5)',
      opacity: 1, // done always full opacity
      cursor: 'pointer',
      '&:active': { bgcolor: DONE_HOVER, transform: 'scale(0.97)' },
    } : variant === 'caps' ? {
      bgcolor: caps ? CAPS_ON_BG : CAPS_OFF_BG,
      border: caps ? '1px solid rgba(19,116,188,0.5)' : '1px solid rgba(19,116,188,0.18)',
      color: isDark ? (caps ? '#a8d4ff' : '#8099bb') : (caps ? '#ffffff' : '#1374bc'),
      '&:active': hasTarget ? { transform: 'scale(0.97)' } : {},
    } : variant === 'clear' ? {
      bgcolor: CLEAR_BG,
      border: '1px solid rgba(200,80,0,0.3)',
      '&:active': hasTarget ? { bgcolor: '#7a3018', transform: 'scale(0.97)' } : {},
    } : {
      bgcolor: KEY_BG,
      '&:active': hasTarget ? { bgcolor: KEY_BG_HOVER, transform: 'scale(0.97)' } : {},
    }),
  });

  /* ═══ NUMBER PAD ═══ */
  if (mode === "number") {
    return (
      <Box
        data-keyboard-element="true"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          px: 'clamp(6px, 1.2vw, 16px)',
          py: 'clamp(4px, 0.7dvh, 12px)',
          gap: 'clamp(4px, 0.6dvh, 12px)',
        }}
      >
        {/* Numpad grid */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 'clamp(3px, 0.45dvh, 8px)',
        }}>
          {numRows.flat().map((key, i) =>
            key === null ? (
              <ButtonBase key="bksp" data-keyboard-element="true" onClick={backspace} sx={bkspSx}>
                <BackspaceIcon sx={{ fontSize: { xs: '1.1rem', sm: '1.4rem' } }} />
              </ButtonBase>
            ) : (
              <ButtonBase key={key} data-keyboard-element="true" onClick={() => apply(key)} sx={tileSx}>
                {key}
              </ButtonBase>
            )
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1.4fr', gap: 'clamp(3px, 0.45dvh, 8px)' }}>
          <ButtonBase data-keyboard-element="true" onClick={clear} sx={actionSx('clear')}>
            Clear
          </ButtonBase>
          <ButtonBase data-keyboard-element="true" onClick={onEnter} sx={actionSx('done')}>
            ↵ Enter
          </ButtonBase>
          <ButtonBase data-keyboard-element="true" onClick={onNext} sx={actionSx('done')}>
            Next →
          </ButtonBase>
        </Box>
      </Box>
    );
  }

  /* ═══ TEXT / ALPHA-NUMERIC — QWERTY ═══ */
  const kbGap = 'clamp(5px, 1dvh, 14px)';
  return (
    <Box
      data-keyboard-element="true"
      sx={{
        display: 'flex',
        flex: 1,
        gap: 'clamp(6px, 1.2vw, 18px)',
        px: 'clamp(10px, 1.8vw, 24px)',
        py: 'clamp(8px, 1.5dvh, 22px)',
      }}
    >
      {/* ── QWERTY section ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: kbGap, minWidth: 0 }}>
        {/* Row 1: Q-P (10 keys) */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: kbGap }}>
          {qRow1.map((k) => {
            const label = caps ? k : k.toLowerCase();
            return (
              <ButtonBase key={k} data-keyboard-element="true" onClick={() => apply(label)} sx={tileSx}>
                {label}
              </ButtonBase>
            );
          })}
        </Box>

        {/* Row 2: A-L centered (9 keys + half-key spacers each side) */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '0.5fr repeat(9, 1fr) 0.5fr', gap: kbGap }}>
          <Box />
          {qRow2.map((k) => {
            const label = caps ? k : k.toLowerCase();
            return (
              <ButtonBase key={k} data-keyboard-element="true" onClick={() => apply(label)} sx={tileSx}>
                {label}
              </ButtonBase>
            );
          })}
          <Box />
        </Box>

        {/* Row 3: Z-M + ⌫ */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr repeat(7, 1fr) 1.6fr 0.4fr', gap: kbGap }}>
          <Box />
          {qRow3.map((k) => {
            const label = caps ? k : k.toLowerCase();
            return (
              <ButtonBase key={k} data-keyboard-element="true" onClick={() => apply(label)} sx={tileSx}>
                {label}
              </ButtonBase>
            );
          })}
          <ButtonBase data-keyboard-element="true" onClick={backspace} sx={bkspSx}>
            <BackspaceIcon sx={{ fontSize: { xs: '1.1rem', sm: '1.3rem' } }} />
          </ButtonBase>
          <Box />
        </Box>

        {/* Row 4: Caps | Clear | Space | Enter | Next */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 3fr 1.6fr 1.4fr', gap: kbGap }}>
          <ButtonBase data-keyboard-element="true" onClick={() => setCaps(!caps)} sx={actionSx('caps')}>
            {caps ? 'ABC' : 'abc'}
          </ButtonBase>
          <ButtonBase data-keyboard-element="true" onClick={clear} sx={actionSx('clear')}>
            Clear
          </ButtonBase>
          <ButtonBase data-keyboard-element="true" onClick={() => apply(' ')} sx={actionSx('space')}>
            Space
          </ButtonBase>
          <ButtonBase data-keyboard-element="true" onClick={onEnter} sx={actionSx('done')}>
            ↵ Enter
          </ButtonBase>
          <ButtonBase data-keyboard-element="true" onClick={onNext} sx={actionSx('done')}>
            Next →
          </ButtonBase>
        </Box>
      </Box>

      {/* ── Number pad ── */}
      <Box sx={{ width: 'clamp(100px, 20vw, 160px)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: kbGap }}>
        {/* 7-9, 4-6, 1-3 */}
        {[['7','8','9'],['4','5','6'],['1','2','3']].map((row, ri) => (
          <Box key={ri} sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: kbGap }}>
            {row.map((k) => (
              <ButtonBase key={k} data-keyboard-element="true" onClick={() => apply(k)} sx={tileSx}>
                {k}
              </ButtonBase>
            ))}
          </Box>
        ))}
        {/* 0 + DELETE */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: kbGap, flex: 1 }}>
          <ButtonBase data-keyboard-element="true" onClick={() => apply('0')} sx={tileSx}>
            0
          </ButtonBase>
          <ButtonBase data-keyboard-element="true" onClick={backspace} sx={{ ...bkspSx, fontSize: 'clamp(0.6rem, 1.5dvh, 0.9rem)', fontWeight: 700 }}>
            DELETE
          </ButtonBase>
        </Box>
      </Box>
    </Box>
  );
}