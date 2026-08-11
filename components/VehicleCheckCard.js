import { useState } from "react";
import {
  Box, Button, Typography, Paper, Chip, CircularProgress, Alert,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

/**
 * VehicleCheckCard — shown after carcheck lookup, before permit issuance.
 *
 * Props:
 *   vehicleData  – { vrm, make, model, colour, year, fuelType, imageUrl, verified, mock, unavailable }
 *   vrm          – string (fallback if vehicleData.vrm is empty)
 *   loading      – bool (show spinner state)
 *   onConfirm    – () => void  (user confirmed → advance to apply form)
 *   onBack       – () => void  (user goes back → reset flow)
 */
export default function VehicleCheckCard({ vehicleData, vrm, loading, onConfirm, onBack }) {
  const [imgError, setImgError] = useState(false);

  const displayVrm = vehicleData?.vrm || vrm || "—";
  const verified = vehicleData?.verified === true && !vehicleData?.mock;
  const isMock = vehicleData?.mock === true;
  const unavailable = vehicleData?.unavailable === true;
  const showWarning = !verified || isMock;
  const imageUrl = (!imgError && !isMock && !unavailable) ? (vehicleData?.imageUrl || null) : null;

  // ─── Loading state ───
  if (loading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 3, gap: 1.5 }}>
        <CircularProgress size={36} />
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.85rem" }}>
          Checking vehicle details…
        </Typography>
      </Box>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: verified ? "success.light" : "warning.light",
        bgcolor: verified
          ? (t) => t.palette.mode === "dark" ? "rgba(46,125,50,0.08)" : "rgba(237,247,237,0.9)"
          : (t) => t.palette.mode === "dark" ? "rgba(60,40,0,0.18)" : "rgba(255,248,230,0.95)",
      }}
    >
      {/* ─── Header bar ─── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: { xs: 1.5, sm: 2 },
          py: { xs: 0.75, sm: 1 },
          borderBottom: "1px solid",
          borderColor: verified ? "success.light" : "warning.light",
          bgcolor: verified
            ? (t) => t.palette.mode === "dark" ? "rgba(46,125,50,0.18)" : "rgba(200,230,201,0.6)"
            : (t) => t.palette.mode === "dark" ? "rgba(180,100,0,0.18)" : "rgba(255,224,130,0.45)",
        }}
      >
        {verified
          ? <CheckCircleIcon color="success" sx={{ fontSize: "1.15rem" }} />
          : <WarningAmberIcon color="warning" sx={{ fontSize: "1.15rem" }} />
        }
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: { xs: "0.8rem", sm: "0.875rem" }, flex: 1 }}>
          {verified ? "Vehicle Verified" : isMock ? "Approximate Details" : "Verification Unavailable"}
        </Typography>
        <Chip
          size="small"
          label={verified ? "DVLA VERIFIED" : isMock ? "MOCK DATA" : "UNVERIFIED"}
          color={verified ? "success" : "warning"}
          sx={{ fontSize: "0.65rem", height: 20, fontWeight: 700 }}
        />
      </Box>

      {/* ─── Main body ─── */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: { xs: 0.75, sm: 1 },
          p: { xs: 0.75, sm: 1 },
          alignItems: { xs: "stretch", sm: "flex-start" },
        }}
      >
        {/* Left: plate + details */}
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          {/* UK-style number plate */}
          <Box sx={{ display: "inline-flex", alignItems: "stretch", borderRadius: "5px", overflow: "hidden", border: "2px solid #333", alignSelf: "flex-start", boxShadow: "0 2px 6px rgba(0,0,0,0.22)" }}>
            {/* Blue EU strip */}
            <Box sx={{ bgcolor: "#003399", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", px: "5px", py: "2px", minWidth: 28 }}>
              <Typography sx={{ color: "#f5c900", fontSize: "0.5rem", fontWeight: 700, lineHeight: 1, letterSpacing: 0 }}>★</Typography>
              <Typography sx={{ color: "#fff", fontSize: "0.52rem", fontWeight: 700, lineHeight: 1.1, letterSpacing: 0 }}>GB</Typography>
            </Box>
            {/* Yellow plate */}
            <Box sx={{ bgcolor: "#f5c900", px: { xs: 1.25, sm: 1.75 }, py: { xs: 0.5, sm: 0.625 }, display: "flex", alignItems: "center" }}>
              <Typography
                sx={{
                  fontFamily: "'UKNumberPlate', 'Charles Wright', 'Courier New', monospace",
                  fontWeight: 700,
                  fontSize: { xs: "1.15rem", sm: "1.4rem" },
                  lineHeight: 1,
                  letterSpacing: "0.1em",
                  color: "#1a1a1a",
                  userSelect: "all",
                }}
              >
                {displayVrm}
              </Typography>
            </Box>
          </Box>

          {/* Vehicle detail rows */}
          {(vehicleData?.make || vehicleData?.model || vehicleData?.colour || vehicleData?.year) && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 0.5, sm: 0.75 }, mt: 0.25 }}>
              {[
                vehicleData?.make && { label: "Make", value: vehicleData.make },
                vehicleData?.model && { label: "Model", value: vehicleData.model },
                vehicleData?.colour && { label: "Colour", value: vehicleData.colour },
                vehicleData?.year && { label: "Year", value: vehicleData.year },
                vehicleData?.fuelType && { label: "Fuel", value: vehicleData.fuelType },
              ].filter(Boolean).map(({ label, value }) => (
                <Box
                  key={label}
                  sx={{
                    display: "flex", flexDirection: "column",
                    bgcolor: "background.paper",
                    border: "1px solid", borderColor: "divider",
                    borderRadius: 1.5, px: { xs: 0.75, sm: 1 }, py: { xs: 0.3, sm: 0.4 },
                    minWidth: 54,
                  }}
                >
                  <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "text.disabled", lineHeight: 1.1, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</Typography>
                  <Typography variant="body2" sx={{ fontSize: { xs: "0.78rem", sm: "0.85rem" }, fontWeight: 600, lineHeight: 1.3 }}>{value}</Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Warning alert for unverified/mock */}
          {showWarning && (
            <Alert
              severity="warning"
              icon={<WarningAmberIcon fontSize="small" />}
              sx={{ py: 0, mt: 0.25, "& .MuiAlert-message": { fontSize: "0.75rem" } }}
            >
              {isMock
                ? "Vehicle details are approximate — live lookup is unavailable. You may still apply."
                : "Could not verify vehicle details. You may still apply."}
            </Alert>
          )}
        </Box>

        {/* Right: vehicle image */}
        {imageUrl && (
          <Box
            sx={{
              flexShrink: 0,
              alignSelf: { xs: "center", sm: "flex-start" },
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.default",
              width: { xs: 130, sm: 170, md: 200 },
              height: { xs: 82, sm: 107, md: 125 },
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}
          >
            <Box
              component="img"
              src={imageUrl}
              alt={`${vehicleData?.make || ""} ${vehicleData?.model || ""}`.trim() || "Vehicle"}
              onError={() => setImgError(true)}
              sx={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </Box>
        )}

        {/* Fallback car icon when no image */}
        {!imageUrl && (
          <Box
            sx={{
              flexShrink: 0,
              alignSelf: { xs: "center", sm: "flex-start" },
              borderRadius: 1.5,
              border: "1px dashed",
              borderColor: "divider",
              bgcolor: "action.hover",
              width: { xs: 72, sm: 90 },
              height: { xs: 50, sm: 62 },
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <DirectionsCarIcon sx={{ fontSize: { xs: "1.75rem", sm: "2.2rem" }, color: "text.disabled" }} />
          </Box>
        )}
      </Box>

      {/* ─── Action buttons ─── */}
      <Box
        sx={{
          display: "flex",
          gap: 0.75,
          px: { xs: 0.75, sm: 1.25 },
          pb: { xs: 0.75, sm: 1 },
          pt: 0.25,
          justifyContent: "flex-end",
        }}
      >
        <Button
          variant="outlined"
          size="small"
          onClick={onBack}
          sx={{ minHeight: 32, minWidth: 72, fontSize: { xs: "0.78rem", sm: "0.85rem" } }}
        >
          Back
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={onConfirm}
          endIcon={<ArrowForwardIcon />}
          color={verified ? "primary" : "warning"}
          sx={{ minHeight: 32, fontSize: { xs: "0.82rem", sm: "0.88rem" }, fontWeight: 700 }}
        >
          {verified ? "Confirm & Apply" : "Continue Anyway"}
        </Button>
      </Box>
    </Paper>
  );
}
