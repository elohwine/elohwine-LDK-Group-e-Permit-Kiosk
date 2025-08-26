import { Box, TextField, IconButton, Typography, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import { useState } from "react";

export default function TopBar(){
  const [query, setQuery] = useState("");
  return (
  <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
      <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
        Hello, <b>Guest</b> — Welcome to <b>Kiosk ePermit</b>
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ position:'relative', width: { xs: '100%', sm: 420 }, maxWidth: { xs: '100%', sm: '50vw' } }}>
          <TextField
            fullWidth
            placeholder="Search by name or details"
            value={query}
            onChange={e=>setQuery(e.target.value)}
            InputProps={{ endAdornment: (
              <InputAdornment position="end">
                <SearchIcon/>
              </InputAdornment>
            ) }}
          />
        </Box>
        <IconButton color="inherit" size="large" aria-label="Exit app">
          <PowerSettingsNewIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
