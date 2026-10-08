import { useEffect, useRef, useState } from "react";
import {
  Box, Button, TextField, Typography, Paper, Divider,
  CircularProgress, Alert, Collapse, Card, CardActionArea
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import dynamic from "next/dynamic";
import {
  getSettings, getPermitsByVRM, issuePermit, lookupCarCheck, extendPermit,
  getSiteRules, triggerSquarePayment
} from "../lib/permits";
const FeedbackDialog = dynamic(() => import("./animated/FeedbackDialog"), { ssr: false });
const VerificationResultCard = dynamic(() => import("./animated/VerificationResultCard"), { ssr: false });
const VehicleCheckCard = dynamic(() => import("./VehicleCheckCard"), { ssr: false });

/*
  States:
    idle           – VRM input + Check In button
    searching      – loading while looking up VRM
    found          – existing permit found → show VerificationResultCard + extend CTA
    verifying      – loading while carcheck runs (no permit → auto-start)
    vehicle-confirm – carcheck result shown → user confirms or goes back
    confirming-pay – for paid sites: payment summary before Square
    paying         – waiting for Square upstream response
    issuing        – calling issuePermit() or extendPermit()
    success        – FeedbackDialog with permit details
    error          – FeedbackDialog with error
*/

const AUTO_RESET_MS = 30000;

function formatUkTime(value) {
  try {
    return new Date(value).toLocaleTimeString("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

function toCooldownMinutes(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function VrmLookupFlow() {
  const [step, setStep] = useState("idle");
  const [vrm, setVrm] = useState("");
  const [email, setEmail] = useState("");
  const [hours, setHours] = useState("");
  const [indefinitePermit, setIndefinitePermit] = useState(false);
  const [selectedDurationChoice, setSelectedDurationChoice] = useState(null);
  const [settings, setSettings] = useState({});
  const [siteRules, setSiteRules] = useState(null);
  const [foundPermit, setFoundPermit] = useState(null);
  const [vehicleData, setVehicleData] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [initError, setInitError] = useState("");
  // Dashboard kiosk setting, delivered on each heartbeat. Overrides the baked-in value.
  const [dashboardCooldown, setDashboardCooldown] = useState(null);
  const resetTimer = useRef(null);
  const vrmInputRef = useRef(null);

  useEffect(() => {
    function onHeartbeat(e) {
      const value = e?.detail?.kiosk?.reRegisterCooldownMinutes;
      if (value !== undefined && value !== null) setDashboardCooldown(toCooldownMinutes(value));
    }
    window.addEventListener("kiosk:heartbeat_ok", onHeartbeat);
    return () => window.removeEventListener("kiosk:heartbeat_ok", onHeartbeat);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings();
        setSettings(s);
        try {
          const rules = await getSiteRules(s.siteId);
          setSiteRules(rules);
          if (rules?.defaultHours) setHours(String(rules.defaultHours));
          else if (s.defaultHours) setHours(String(s.defaultHours));
        } catch (err) {
          // Site rules failed but settings loaded — use defaults, show warning
          if (s.defaultHours) setHours(String(s.defaultHours));
          setInitError("Could not load site rules — using defaults. The server may be starting up.");
        }
      } catch (err) {
        setInitError("Failed to load settings. Please check your connection.");
      }
    })();
  }, []);

  // Auto-focus VRM input on idle (initial load and after reset)
  useEffect(() => {
    if (step === 'idle') {
      const t = setTimeout(() => { vrmInputRef.current?.focus?.(); }, 150);
      return () => clearTimeout(t);
    }
  }, [step]);

  function scheduleReset() {
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => resetFlow(), AUTO_RESET_MS);
  }

  function resetFlow() {
    clearTimeout(resetTimer.current);
    setStep("idle");
    setVrm("");
    setEmail("");
    setHours(String(siteRules?.defaultHours ?? settings.defaultHours ?? 2));
    setIndefinitePermit(false);
    setSelectedDurationChoice(null);
    setFoundPermit(null);
    setVehicleData(null);
    setResult(null);
    setErrorMsg("");
  }

  // --- Step handlers ---

  async function handleSearch(e) {
    e?.preventDefault?.();
    const trimmed = vrm.trim().toUpperCase().replace(/\s+/g, "");
    if (!trimmed) return;
    setVrm(trimmed);
    setStep("searching");
    try {
      const { permits, online, apiError } = await getPermitsByVRM(trimmed);
      const sitePermits = (permits || []).filter((p) => p.siteId === settings.siteId);
      const now = Date.now();
      // The cooldown counts from the last registration, never from the permit end,
      // so a 24-hour permit can be renewed straight away once the cooldown passes.
      // The live site still reports 0 to neutralise older installed builds, so
      // that value is not used here.
      const cooldownMinutes = dashboardCooldown ?? toCooldownMinutes(settings.reRegisterCooldownMinutes);
      if (cooldownMinutes > 0) {
        const lastRegisteredMs = sitePermits
          .map((p) => new Date(p.start || p.createdAt || p.queuedAt || 0).getTime())
          .filter((ms) => Number.isFinite(ms) && ms > 0 && ms <= now)
          .sort((a, b) => b - a)[0];
        const retryAtMs = lastRegisteredMs ? lastRegisteredMs + cooldownMinutes * 60 * 1000 : 0;
        if (retryAtMs > now) {
          setErrorMsg(`This vehicle was registered at ${formatUkTime(lastRegisteredMs)}. You can register it again from ${formatUkTime(retryAtMs)}.`);
          setStep("error");
          return;
        }
      }
      const active = sitePermits.find(
        (p) =>
          p.status !== 'expired' && p.status !== 'cancelled' &&
          // null/missing end = permanent permit (never expires)
          (p.end === null || p.end === undefined || p.end === '' || new Date(p.end).getTime() > now)
      );
      // An existing permit is renewed from now instead of creating a duplicate.
      if (active) setFoundPermit(active);
      await doCarCheck(trimmed);
    } catch (err) {
      setErrorMsg(err?.message || "Unexpected error looking up VRM");
      setStep("error");
    }
  }

  async function doCarCheck(vrmValue) {
    setStep("verifying");
    try {
      const cd = await lookupCarCheck(vrmValue);
      // Always show the vehicle confirm card — even if no data came back.
      // VehicleCheckCard handles the null/unavailable case gracefully.
      setVehicleData(cd?.unavailable ? null : (cd || null));
      setStep("vehicle-confirm");
    } catch {
      // On unexpected error still show the confirm card with no data
      setVehicleData(null);
      setStep("vehicle-confirm");
    }
  }

  const isPaid = siteRules?.parkingType === "paid" && siteRules?.hourlyRate > 0;
  const parsedHours = indefinitePermit ? null : (parseFloat(hours) || siteRules?.defaultHours || settings.defaultHours || 2);
  const totalCost = isPaid ? (parsedHours * (siteRules?.hourlyRate ?? 0)).toFixed(2) : "0.00";
  const currency = siteRules?.currency || "GBP";
  const currencySymbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;

  function resolveDurationChoice(choice = selectedDurationChoice) {
    if (choice) return choice;
    return {
      hours: parsedHours,
      indefinite: indefinitePermit,
      label: indefinitePermit ? "Indefinite (no expiry)" : `${parsedHours} hour${parsedHours !== 1 ? "s" : ""}`,
    };
  }

  async function handleDurationSelect(option, vehicleDetails = vehicleData) {
    const durationChoice = {
      hours: option.hours,
      indefinite: option.hours === null,
      label: option.hours === null ? "Indefinite (no expiry)" : `${option.hours} hour${option.hours !== 1 ? "s" : ""}`,
    };

    if (option.hours === null) {
      setIndefinitePermit(true);
      setHours("");
    } else {
      setIndefinitePermit(false);
      setHours(String(option.hours));
    }
    setSelectedDurationChoice(durationChoice);

    if (isPaid) {
      setStep("confirming-pay");
      return;
    }

    await doIssue(vehicleDetails, durationChoice);
  }

  async function continueAfterCarCheck(vehicleDetails) {
    if (settings.durationOptions?.length > 1) {
      setStep("duration-select");
      return;
    }

    if (isPaid) {
      setStep("confirming-pay");
    } else {
      await doIssue(vehicleDetails);
    }
  }

  async function handleConfirmPayment() {
    const durationChoice = resolveDurationChoice();
    setStep("paying");
    try {
      await triggerSquarePayment({
        vrm,
        siteId: settings.siteId,
        hours: durationChoice.hours,
        amount: parseFloat(totalCost),
        currency,
        email: email || undefined,
      });
      await doIssue(undefined, durationChoice);
    } catch (err) {
      setErrorMsg(err?.message || "Payment failed");
      setStep("error");
    }
  }

  async function doIssue(vehicleDetails = vehicleData, durationChoice = resolveDurationChoice()) {
    setStep("issuing");
    try {
      if (foundPermit) {
        // Active permit found — extend it silently; no duplicate created
        const h = durationChoice.hours;
        const isIndefinite = h === null;
        const data = await extendPermit({ id: foundPermit.id, hours: h });
        const nowIso = new Date().toISOString();
        const renewedStart = data.start || foundPermit.start || nowIso;
        let newEnd;
        if (isIndefinite) {
          newEnd = null;
        } else {
          // Kiosk renewals start afresh from now, not from previous end.
          const baseMs = new Date(renewedStart).getTime();
          const safeBase = Number.isFinite(baseMs) ? baseMs : Date.now();
          newEnd = data.end || data.endTime || new Date(safeBase + h * 3600 * 1000).toISOString();
        }
        setResult({
          permit: { ...foundPermit, start: renewedStart, end: newEnd },
          online: data.online !== false,
          details: {
            id: foundPermit.id,
            vrm: foundPermit.vrm,
            siteId: foundPermit.siteId,
            siteName: settings.siteName || settings.siteDisplayName || foundPermit.siteName || "",
            kioskName: settings.kioskName || "",
            start: renewedStart,
            end: newEnd,
            duration: durationChoice.label,
            mode: data.online !== false ? "online" : "offline (queued)",
          },
        });
      } else {
        const { permit, online } = await issuePermit({
          vrm,
          email: email || undefined,
          hours: durationChoice.hours,
          vehicleMake: vehicleDetails?.make || undefined,
          vehicleModel: vehicleDetails?.model || undefined,
          vehicleColour: vehicleDetails?.colour || undefined,
          vehicleYear: vehicleDetails?.year || undefined,
        });
        setResult({
          permit,
          online,
          details: {
            id: permit.id,
            vrm: permit.vrm,
            siteId: permit.siteId,
            siteName: settings.siteName || settings.siteDisplayName || permit.siteName || "",
            kioskName: settings.kioskName || "",
            start: permit.start,
            end: permit.end,
            duration: durationChoice.label,
            mode: online ? "online" : "offline",
          },
        });
      }
      setStep("success");
      scheduleReset();
    } catch (err) {
      setErrorMsg(err?.message || "Failed to issue permit");
      setStep("error");
    }
  }

  // Auto-dismiss on-screen keyboard when there is nothing to type
  useEffect(() => {
    const INPUT_STEPS = ["idle"];
    if (!INPUT_STEPS.includes(step)) {
      try { document.activeElement?.blur?.(); } catch {}
    }
  }, [step]);

  // handleExtend — kept for future reuse (e.g. manual extend-select screen).
  // Not used in the main flow: doIssue now handles extension automatically
  // when foundPermit is set (active permit detected at search time).
  /* async function handleExtend(chosenHours) {
    const h = chosenHours === undefined ? extensionHours : chosenHours;
    const isIndefinite = h === null;
    setStep("issuing");
    try {
      const data = await extendPermit({ id: foundPermit.id, hours: h });
      let newEnd;
      if (isIndefinite) {
        newEnd = null;
      } else {
        const baseMs = foundPermit.end ? new Date(foundPermit.end).getTime() : Date.now();
        const safeBase = Number.isFinite(baseMs) ? baseMs : Date.now();
        newEnd = data.end || data.endTime || new Date(safeBase + h * 3600 * 1000).toISOString();
      }
      setResult({
        permit: { ...foundPermit, end: newEnd },
        online: data.online !== false,
        details: {
          id: foundPermit.id,
          vrm: foundPermit.vrm,
          siteId: foundPermit.siteId,
          siteName: settings.siteName || settings.siteDisplayName || foundPermit.siteName || "",
          kioskName: settings.kioskName || "",
          start: foundPermit.start,
          end: newEnd,
          duration: isIndefinite ? "Indefinite (no expiry)" : `+${h} hour${h !== 1 ? "s" : ""}`,
          mode: data.online !== false ? "online" : "offline (queued)",
        },
      });
      setStep("success");
      scheduleReset();
    } catch (err) {
      setErrorMsg(err?.message || "Failed to extend permit");
      setStep("error");
    }
  } */

  // --- Render helpers ---

  const isLoading = step === "searching" || step === "verifying" || step === "issuing" || step === "paying";
  const compactFieldSx = {
    '& .MuiInputLabel-root': {
      fontSize: { xs: '0.78rem', sm: '0.9rem' },
    },
    '& .MuiInputLabel-shrink': {
      fontSize: { xs: '0.7rem', sm: '0.82rem' },
    },
    '& .MuiInputBase-input': {
      fontSize: { xs: '0.88rem', sm: '1.02rem' },
      py: { xs: 1, sm: 1.3 },
    },
  };

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        minHeight: 0,
        px: { xs: 1, sm: 1.5 },
        pt: { xs: 0.5, sm: 0.75 },
        pb: 0,
        overflow: "auto",
      }}
    >
      <Paper
        elevation={8}
        sx={{
          width: "100%",
          maxWidth: 620,
          p: { xs: 1, sm: 1.5 },
          borderRadius: { xs: 2, sm: 3 },
          bgcolor: "background.paper",
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* ─── Site name — centered inside card ─── */}
        {(settings.kioskName || settings.siteDisplayName || settings.siteName) && (
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.05rem', sm: '1.3rem' },
              letterSpacing: '0.01em',
              textAlign: 'center',
              mb: { xs: 0.75, sm: 1 },
              lineHeight: 1.2,
              opacity: 0.92,
            }}
          >
            {settings.kioskName || settings.siteDisplayName || settings.siteName}
          </Typography>
        )}
        <Divider sx={{ mb: { xs: 0.75, sm: 1 }, opacity: 0.12 }} />

        {/* ─── Init error banner ─── */}
        <Collapse in={!!initError}>
          <Alert severity="warning" sx={{ mb: 1, py: 0.25, '& .MuiAlert-message': { fontSize: '0.78rem' } }}>
            {initError}
          </Alert>
        </Collapse>

        {/* ─── IDLE: VRM input ─── */}
        {(step === "idle" || step === "searching") && (
          <Box component="form" onSubmit={handleSearch}>
            <TextField
              fullWidth
              size="small"
              label="Vehicle Registration (VRM)"
              value={vrm}
              onChange={(e) => setVrm(e.target.value.toUpperCase())}
              required
              autoFocus
              inputRef={vrmInputRef}
              inputProps={{
                style: { fontSize: "1rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" },
                autoCapitalize: "characters",
              }}
              sx={{ mb: { xs: 0.5, sm: 0.75 }, ...compactFieldSx, '& .MuiInputBase-root': { minHeight: 36 } }}
            />
            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="small"
              disabled={isLoading || !vrm.trim()}
              startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{ minHeight: 34, fontSize: { xs: '0.82rem', sm: '0.88rem' } }}
            >
              {isLoading ? "Searching…" : "Check In"}
            </Button>
          </Box>
        )}

        {/* ─── DURATION SELECT: choose permit length ─── */}
        <Collapse in={step === "duration-select"} unmountOnExit>
          <Box sx={{ mt: 0.75 }}>
            <Typography
              variant="body2"
              sx={{ textAlign: "center", mb: 1.25, fontWeight: 600, fontSize: { xs: "0.85rem", sm: "0.95rem" }, opacity: 0.75 }}
            >
              Select authorisation duration:
            </Typography>
            <Box sx={{ display: "flex", gap: 1.25, flexDirection: { xs: "column", sm: "row" } }}>
              {(settings.durationOptions || []).map((opt) => (
                <Card
                  key={opt.label}
                  elevation={3}
                  sx={{
                    flex: 1,
                    borderRadius: 2.5,
                    border: "2px solid transparent",
                    transition: "border-color 0.18s, box-shadow 0.18s",
                    "&:hover": { borderColor: "primary.main", boxShadow: 6 },
                  }}
                >
                  <CardActionArea
                    onClick={() => handleDurationSelect(opt)}
                    sx={{ p: { xs: 1.75, sm: 2.25 }, textAlign: "center" }}
                  >
                    <Typography
                      variant="h5"
                      sx={{ fontWeight: 800, fontSize: { xs: "1.45rem", sm: "1.75rem" }, lineHeight: 1.1, mb: 0.5 }}
                    >
                      {opt.label}
                    </Typography>
                    {opt.description && (
                      <Typography variant="body2" sx={{ opacity: 0.6, fontSize: { xs: "0.75rem", sm: "0.83rem" } }}>
                        {opt.description}
                      </Typography>
                    )}
                  </CardActionArea>
                </Card>
              ))}
            </Box>
            <Button
              size="small"
              sx={{ mt: 1.25, fontSize: "0.78rem", opacity: 0.65 }}
              onClick={() => setStep("vehicle-confirm")}
            >
              ← Back
            </Button>
          </Box>
        </Collapse>

        {/* ─── FOUND step — removed from active flow. ─── */}
        {/* Active permits are now detected silently in handleSearch and extended */}
        {/* automatically via doIssue. Kept here (commented) for future reuse.   */}
        {/* <Collapse in={step === "found"} unmountOnExit> ... </Collapse>        */}

        {/* ─── EXTEND SELECT step — removed from active flow.                  ─── */}
        {/* Duration is chosen via the unified duration-select step (same for    */}
        {/* new issues and extensions). Kept here (commented) for future reuse.  */}
        {/* <Collapse in={step === "extend-select"} unmountOnExit> ... </Collapse> */}

        {/* ─── VERIFYING: carcheck spinner ─── */}
        <Collapse in={step === "verifying"} unmountOnExit>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 2.5, gap: 1.5 }}>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.83rem" }}>
              Checking vehicle details…
            </Typography>
          </Box>
        </Collapse>

        {/* ─── VEHICLE CONFIRM: carcheck result card ─── */}
        <Collapse in={step === "vehicle-confirm"} unmountOnExit>
          <Box sx={{ mt: 0.5 }}>
            <VehicleCheckCard
              vehicleData={vehicleData}
              vrm={vrm}
              loading={false}
              onConfirm={() => continueAfterCarCheck(vehicleData)}
              onBack={resetFlow}
            />
          </Box>
        </Collapse>

        {/* ─── CONFIRMING PAYMENT ─── */}
        <Collapse in={step === "confirming-pay"} unmountOnExit>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h6" sx={{ mb: 0.75, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
              Confirm Payment
            </Typography>
            <Paper elevation={0} sx={{ p: 1.25, mb: 1.25, borderRadius: 1.5, bgcolor: "action.hover" }}>
              <Typography variant="body2" sx={{ fontSize: { xs: '0.84rem', sm: '0.9rem' } }}>
                <b>{vrm}</b> — {parsedHours} hr{parsedHours !== 1 ? "s" : ""} parking
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: "primary.main", fontSize: { xs: '1.35rem', sm: '1.6rem' } }}>
                {currencySymbol}{totalCost}
              </Typography>
            </Paper>
            <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
              <Button variant="outlined" size="small" sx={{ minWidth: 88 }} onClick={resetFlow}>
                Back
              </Button>
              <Button variant="contained" size="medium" sx={{ minWidth: 110 }} onClick={handleConfirmPayment}>
                Pay Now
              </Button>
            </Box>
          </Box>
        </Collapse>

        {/* ─── PAYING / ISSUING: loading ─── */}
        <Collapse in={step === "paying" || step === "issuing"} unmountOnExit>
          <Box sx={{ textAlign: "center", py: 2.5 }}>
            <CircularProgress size={40} />
            <Typography variant="body2" sx={{ mt: 1.25, color: "text.secondary", fontSize: '0.85rem' }}>
              {step === "paying" ? "Processing payment…" : "Starting session…"}
            </Typography>
          </Box>
        </Collapse>
      </Paper>

      {/* ─── SUCCESS dialog ─── */}
      <FeedbackDialog
        open={step === "success"}
        onClose={resetFlow}
        type="success"
        title={
          result?.online === false
            ? "Session Saved Offline"
            : "Session Started"
        }
        message={
          result?.online === false
            ? `Session for ${vrm} has been saved in offline mode and will auto-sync when connection returns.`
            : indefinitePermit
            ? `An indefinite session for ${vrm} has been started with no expiry${email ? ". A confirmation has been sent to your email" : ""}.`
            : `Your session for ${vrm} has been started${email ? ". A confirmation has been sent to your email" : ""}.`
        }
        details={result?.details || null}
        lottiePath="/lottie/success.json"
        onPrimary={resetFlow}
        primaryText="Done"
      />

      {/* ─── ERROR dialog ─── */}
      <FeedbackDialog
        open={step === "error"}
        onClose={resetFlow}
        type="error"
        title="Something Went Wrong"
        message={errorMsg}
        lottiePath="/lottie/Error.json"
        onPrimary={() => {
          setErrorMsg("");
          setStep("idle");
        }}
        primaryText="Try Again"
      />
    </Box>
  );
}
