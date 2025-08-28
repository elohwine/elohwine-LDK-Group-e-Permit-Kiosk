import { Box, IconButton, Typography, Tooltip } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { keyframes } from "@mui/system";

export default function TopBar({ onOpenSettings, active, onBackToServices, siteName }){
  const pulse = keyframes`
    0% { transform: scale(1); }
    50% { transform: scale(1.06); }
    100% { transform: scale(1); }
  `;
  return (
  <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 0.75, sm: 1 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
      {active === 'settings' ? (
        <Box sx={{ display:'flex', alignItems:'center', gap: 1 }}>
          <Tooltip title="Back to services">
            <IconButton color="inherit" size="large" onClick={onBackToServices} aria-label="Back to services">
              <ArrowBackIosNewIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Box
            component="img"
            src="/img/logo.png"
            alt="Kiosk ePermit"
            sx={{ height: 50, width: 'auto', cursor: 'pointer', animation: `${pulse} 2s ease-in-out infinite` }}
            onClick={onBackToServices}
            role="button"
            aria-label="Back to services"
          />
        </Box>
      ) : (
        <Typography variant="subtitle1" sx={{ opacity: 0.9, fontSize: { xs: 14, sm: 'inherit' } }}>
          Hello, <b>Guest</b> — Welcome to <b>Kiosk ePermit</b>{siteName ? <> — <b>{siteName}</b></> : null}
        </Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', flexWrap:'wrap', justifyContent: { xs: 'space-between', sm: 'flex-end' } }}>
        <Tooltip title="Settings">
          <IconButton color="inherit" size="medium" aria-label="Open settings" onClick={onOpenSettings}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
        <IconButton color="inherit" size="medium" aria-label="Exit app" sx={{ ml: { xs: 'auto', sm: 0 } }}>
          <PowerSettingsNewIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
