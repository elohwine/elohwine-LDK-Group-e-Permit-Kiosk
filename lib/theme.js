import { createTheme, ThemeProvider } from "@mui/material/styles";
import { createContext, useContext, useMemo, useState, useEffect } from 'react';

// Harmonize with user's v4 preset and current app look (MUI v5 compliant)
const primaryColor = "#1374bc"; // uniform primary color from provided palette (blue)
const dangerColor = "#f44336";  // danger red

const base = (mode = 'dark') => createTheme({
  palette: {
    mode,
    primary: { main: primaryColor },
    secondary: { main: "#2ea6ff" },
    error: { main: dangerColor },
    warning: { main: "#ff9800" },
    success: { main: "#4caf50" },
    info: { main: "#00acc1" },
    text: mode === 'dark' 
      ? { primary: "#E6EAF2", secondary: "#A7AFBF" }
      : { primary: "#1a1a1a", secondary: "#666666" },
    background: mode === 'dark'
      ? { default: "#161a22", paper: "rgba(24,28,36,0.9)" }
      : { default: "#f5f7fb", paper: "#ffffff" },
  },
  // v4 -> v5: typography and spacing migrated
  typography: {
    // Restore previous default font used before theme change
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    h1: { fontFamily: "Nunito", fontSize: "2.6rem", fontWeight: 800, lineHeight: 1.15, letterSpacing: "0.01em", marginBottom: "1.5rem" },
    h2: { fontFamily: "Nunito", fontSize: "2.2rem", fontWeight: 700, lineHeight: 1.25, letterSpacing: "0.01em", marginBottom: "1.25rem" },
    h3: { fontFamily: "Nunito", fontSize: "1.8rem", fontWeight: 700, lineHeight: 1.25, letterSpacing: "0.01em", marginBottom: "1rem" },
    h4: { fontFamily: "Nunito", fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.3, letterSpacing: "0.01em", marginBottom: "0.75rem" },
    h5: { fontFamily: "Nunito", fontSize: "1.3rem", fontWeight: 600, lineHeight: 1.35, letterSpacing: "0.005em", marginBottom: "0.5rem" },
    h6: { fontFamily: "Nunito", fontSize: "1.15rem", fontWeight: 600, lineHeight: 1.4, letterSpacing: "0.005em", marginBottom: "0.5rem" },
    body1: { fontSize: "1.125rem", fontWeight: 400, lineHeight: 1.7, letterSpacing: "0.01em" },
    body2: { fontSize: "1.025rem", fontWeight: 400, lineHeight: 1.7, letterSpacing: "0.01em" },
    button: { fontFamily: "Nunito", fontSize: "1.05rem", fontWeight: 600, letterSpacing: "0.02em", textTransform: "none" },
    caption: { fontSize: "0.9rem", fontWeight: 400, lineHeight: 1.6, letterSpacing: "0.02em" },
  },
  spacing: (factor) => `${0.5 * factor}rem`,
  shape: { borderRadius: 8 },
  transitions: {
    easing: {
      easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
      sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
    },
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
      complex: 375,
      enteringScreen: 225,
      leavingScreen: 195,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (theme) => ({
        html: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility',
          overscrollBehavior: 'none',
        },
        body: {
          backgroundColor: theme.palette.background?.default || (theme.palette.mode==='dark' ? '#161a22' : '#f5f7fb'),
          color: theme.palette.text?.primary || (theme.palette.mode==='dark' ? '#E6EAF2' : '#1a1a1a'),
          WebkitTapHighlightColor: 'transparent',
        },
        '*, *::before, *::after': { boxSizing: 'border-box' },
        '::selection': { background: `${primaryColor}66` },
        '::-webkit-scrollbar': { width: 10, height: 10 },
        '::-webkit-scrollbar-thumb': { background: theme.palette.mode==='dark' ? '#4a5362' : '#aeb9cc', borderRadius: 999 },
        '::-webkit-scrollbar-track': { background: theme.palette.mode==='dark' ? '#1c2230' : '#dde6f5' },
      })
    },
    // v4 overrides -> v5 components.styleOverrides
    MuiButton: {
      defaultProps: { size: 'large', disableElevation: true },
      styleOverrides: {
        root: {
          padding: "0.875rem 2rem",
          minHeight: 48,
          fontSize: "1.05rem",
          fontWeight: 600,
          letterSpacing: "0.02em",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          borderRadius: 14,
          '&:hover': {
            transform: "translateY(-2px)",
            boxShadow: "0 7px 14px rgba(50, 50, 93, 0.1), 0 3px 6px rgba(0, 0, 0, 0.08)",
          },
          '&:active': { transform: 'translateY(0)' },
          '&.Mui-disabled': { opacity: 0.6 },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          width: 48,
          height: 48,
          '& .MuiSvgIcon-root': { fontSize: 28 },
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          '&:hover': {
            transform: "translateY(-4px)",
            boxShadow: "0 7px 14px rgba(50, 50, 93, 0.1), 0 3px 6px rgba(0, 0, 0, 0.08)",
          },
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          '&::before': { display: 'none' },
          boxShadow: 'none',
          '&.Mui-expanded': { margin: 0 },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          minHeight: 'auto',
          '&.Mui-expanded': { minHeight: 'auto' },
        },
      },
    },
    // Keep the subtle blur from the original theme
    MuiPaper: { styleOverrides: { root: { backdropFilter: 'blur(4px)' } } },
    MuiTextField: {
      defaultProps: { size: 'medium' },
      styleOverrides: { 
        root: ({ theme }) => ({ 
          background: theme.palette.mode==='dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)', 
          borderRadius: 12 
        }) 
      }
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
        input: {
          padding: '14px 14px',
          fontSize: '1.05rem',
          lineHeight: 1.6,
        }
      }
    },
    MuiFormControlLabel: {
      styleOverrides: { root: { marginRight: 16 } }
    },
    MuiCheckbox: { styleOverrides: { root: { width: 28, height: 28 } } },
    MuiRadio: { styleOverrides: { root: { width: 28, height: 28 } } },
    MuiSwitch: { styleOverrides: { root: { padding: 10 } } },
    MuiListItemButton: { styleOverrides: { root: { minHeight: 56 } } },
    MuiTooltip: { styleOverrides: { tooltip: { fontSize: '0.95rem', padding: '8px 12px', borderRadius: 8 } } },
  },
});

// Color mode context for toggling light/dark
const ColorModeContext = createContext({ mode: 'dark', toggle: () => {} });
export const useColorMode = () => useContext(ColorModeContext);

export function ColorModeProvider({ children }){
  const [mode, setMode] = useState('dark');
  useEffect(()=>{
    try {
      const saved = localStorage.getItem('epermit-color-mode');
      if (saved === 'light' || saved === 'dark') setMode(saved);
      else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) setMode('light');
    } catch {}
  },[]);
  const value = useMemo(()=>({
    mode,
    toggle: ()=> setMode(m => { const next = m==='dark'?'light':'dark'; try{ localStorage.setItem('epermit-color-mode', next);}catch{} return next; })
  }), [mode]);
  const theme = useMemo(()=> base(mode), [mode]);
  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default base('dark');
