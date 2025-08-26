import { useEffect, useState } from "react";
import { Box, Typography, Grid, Paper } from "@mui/material";
import LocalParkingIcon from "@mui/icons-material/LocalParking";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import PaymentIcon from "@mui/icons-material/Payment";
import DirectionsBusFilledIcon from "@mui/icons-material/DirectionsBusFilled";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import TopBar from "../components/TopBar";
import ServiceForms from "../components/ServiceForms";
import ServiceCard from "../components/ServiceCard";
import VerifyPanel from "../components/VerifyPanel";
import dynamic from 'next/dynamic';
const PermitChatAssistant = dynamic(() => import('../components/chat/PermitChatAssistant'), { ssr: false });
const SplashScreen = dynamic(() => import('../components/animated/SplashScreen'), { ssr: false });
const OnboardingCarousel = dynamic(() => import('../components/animated/OnboardingCarousel'), { ssr: false });

export default function Home() {
  const [active, setActive] = useState("assistant");
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(()=>{
    // Optional: only show once per session
  if (typeof window === 'undefined') return;
  if (sessionStorage.getItem('splashSeen')) { setShowSplash(false); return; }
  // mark seen when we hide
  const onHide = () => { try { sessionStorage.setItem('splashSeen', '1'); } catch {} };
  if (!showSplash) onHide();
  return () => onHide();
  },[]);

  // Inactivity-driven onboarding: show after 30s idle; hide on any interaction and re-arm
  useEffect(()=>{
    if (typeof window === 'undefined') return;
    let idleTimer = null;
    const IDLE_MS = 30000;
    const onActivity = () => {
      setShowOnboarding(false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(()=> setShowOnboarding(true), IDLE_MS);
    };
    idleTimer = setTimeout(()=> setShowOnboarding(true), IDLE_MS);
    const events = ['pointerdown','pointermove','keydown','wheel','touchstart'];
    events.forEach(ev=>window.addEventListener(ev, onActivity, { passive: true }));
    return ()=>{ events.forEach(ev=>window.removeEventListener(ev, onActivity)); clearTimeout(idleTimer); };
  },[]);

  const cards = [
    { key: "pay", title: "Pay to Park", icon: <LocalParkingIcon fontSize="large"/> , color:"default" },
    { key: "epermit", title: "Virtual e‑Permits", icon: <QrCode2Icon fontSize="large"/> , color:"primary" },
    { key: "verify", title: "Verify", icon: <FactCheckIcon fontSize="large"/> , color:"default" },
    { key: "assistant", title: "Assistant", icon: <DirectionsBusFilledIcon fontSize="large"/> , color:"default" },
    { key: "payments", title: "Payments", icon: <PaymentIcon fontSize="large"/> , color:"default" },
  ];

  return (
  <Box sx={{ height:'100vh', display:'flex', flexDirection:'column', minHeight: 0, overflow: 'hidden' }}>
      {showSplash && (
        <SplashScreen autoHideMs={4500} onDone={()=>{ try { sessionStorage.setItem('splashSeen','1'); } catch {} ; setShowSplash(false); }} />
      )}
      {showOnboarding && (
        <OnboardingCarousel open onDone={()=>{ setShowOnboarding(false); try { localStorage.setItem('onboardingSeen','1'); } catch {} }} />
      )}
      <TopBar/>
  <Box sx={{ px:3, pb:3, flex:1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY:'auto' }}>
        <Grid container spacing={3} sx={{ flex:1, minHeight: 0 }}>
          {/* Left: Services cards */}
          <Grid item xs={12} md={5} sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ mb:2, color:'text.secondary', flexShrink: 0 }}>Services</Typography>
            <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <Grid container spacing={2}>
                {cards.map(c => (
                  <Grid item xs={6} key={c.key}>
                    <ServiceCard
                      title={c.title}
                      icon={c.icon}
                      color={c.color}
                      active={active === c.key}
                      onClick={() => setActive(c.key)}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Grid>

          {/* Right: Active panel */}
          <Grid item xs={12} md={7} sx={{ height: '100%', display:'flex', flexDirection:'column', minHeight: 0, overflow: 'hidden' }}>
            <Box sx={{ 
              flex: 1, 
              minHeight: 0, 
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden', 
              pr: 1, 
              pb: 'calc(var(--kbd-inset, 0px) + 16px)' 
            }}>
              {active === "epermit" && (
                <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  <ServiceForms/>
                </Box>
              )}
              {active === "verify" && (
                <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  <VerifyPanel embedded />
                </Box>
              )}
              {active === "assistant" && (
                <Box sx={{ flex: 1, minHeight: 0, display:'flex', flexDirection:'column', overflowY: 'auto' }}>
                  <PermitChatAssistant />
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
