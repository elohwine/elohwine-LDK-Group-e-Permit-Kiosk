import { Box, TextField, IconButton, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import { useState } from "react";

export default function TopBar(){
  const [query, setQuery] = useState("");
  return (
    <Box sx={{
      px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
    }}>
      <Typography variant="subtitle1" sx={{ opacity: 0.8 }}>Hello,&nbsp;<b>Guest</b></Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ position:'relative', width: 420, maxWidth: '50vw' }}>
          <TextField
            fullWidth
            placeholder="Search by name or details"
            value={query}
            onChange={e=>setQuery(e.target.value)}
            InputProps={{ endAdornment: <SearchIcon/> }}
          />
        </Box>
        <IconButton color="inherit" size="large" aria-label="Exit app">
          <PowerSettingsNewIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
