import { Box } from "@mui/material";
import VerifyPanel from "../components/VerifyPanel";

export default function Verify() {
  return (
    <Box sx={{ p:3, height: '100%', overflow: 'hidden', position:'relative' }}>
      <Box sx={{ position:'relative', height: '100%', overflowY: 'auto', overflowX:'hidden', pr: 1, pb: 'calc(var(--kbd-inset, 0px) + 12px)' }}>
        <VerifyPanel />
      </Box>
    </Box>
  );
}
