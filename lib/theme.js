import { createTheme } from "@mui/material/styles";

// Harmonize with user's v4 preset and current app look (MUI v5 compliant)
const primaryColor = "#1374bc"; // uniform primary color from provided palette (blue)
const dangerColor = "#f44336";  // danger red

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: primaryColor },
    secondary: { main: "#2ea6ff" },
  error: { main: dangerColor },
  warning: { main: "#ff9800" },
  success: { main: "#4caf50" },
  info: { main: "#00acc1" },
    text: { primary: "#E6EAF2", secondary: "#A7AFBF" },
    background: {
      default: "#161a22",
      paper: "rgba(24,28,36,0.9)",
    },
  },
  // v4 -> v5: typography and spacing migrated
  typography: {
    // Restore previous default font used before theme change
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    h1: { fontFamily: "Nunito", fontSize: "2.5rem", fontWeight: 800, lineHeight: 1.2, letterSpacing: "0.02em", marginBottom: "1.5rem" },
    h2: { fontFamily: "Nunito", fontSize: "2.25rem", fontWeight: 700, lineHeight: 1.3, letterSpacing: "0.02em", marginBottom: "1.25rem" },
    h3: { fontFamily: "Nunito", fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.3, letterSpacing: "0.02em", marginBottom: "1rem" },
    h4: { fontFamily: "Nunito", fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.4, letterSpacing: "0.02em", marginBottom: "0.75rem" },
    h5: { fontFamily: "Nunito", fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.4, letterSpacing: "0.01em", marginBottom: "0.5rem" },
    h6: { fontFamily: "Nunito", fontSize: "1.1rem", fontWeight: 600, lineHeight: 1.5, letterSpacing: "0.01em", marginBottom: "0.5rem" },
    body1: { fontSize: "1.125rem", fontWeight: 400, lineHeight: 1.7, letterSpacing: "0.01em" },
    body2: { fontSize: "1rem", fontWeight: 400, lineHeight: 1.7, letterSpacing: "0.01em" },
  button: { fontFamily: "Nunito", fontSize: "1rem", fontWeight: 500, letterSpacing: "0.02em", textTransform: "none" },
    caption: { fontSize: "0.875rem", fontWeight: 400, lineHeight: 1.6, letterSpacing: "0.02em" },
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
    // v4 overrides -> v5 components.styleOverrides
    MuiButton: {
      styleOverrides: {
        root: {
          padding: "0.75rem 2rem",
          fontSize: "1rem",
          fontWeight: 500,
          letterSpacing: "0.02em",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          borderRadius: 12,
          '&:hover': {
            transform: "translateY(-2px)",
            boxShadow: "0 7px 14px rgba(50, 50, 93, 0.1), 0 3px 6px rgba(0, 0, 0, 0.08)",
          },
        },
      },
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
    MuiTextField: { styleOverrides: { root: { background: 'rgba(0,0,0,0.2)', borderRadius: 12 } } },
  },
});

export default theme;
