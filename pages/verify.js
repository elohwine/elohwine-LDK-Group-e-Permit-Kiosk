import { Box } from "@mui/material";
import BrandWatermark from "../components/BrandWatermark";
import VerifyPanel from "../components/VerifyPanel";

export default function Verify() {
  return (
    <Box sx={{ p:3, height: '100%', overflow: 'hidden', position:'relative' }}>
      <BrandWatermark opacity={0.2} />
      <Box sx={{ position:'relative', height: '100%', overflow: 'auto', pr: 1, pb: 'calc(var(--kbd-inset, 0px) + 8px)' }}>
        <VerifyPanel />
      </Box>
    </Box>
  );
}
