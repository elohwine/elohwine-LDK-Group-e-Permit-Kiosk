import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Paper, Typography, Chip, TextField, IconButton, Button } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ReplayIcon from '@mui/icons-material/Replay';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';
import { issuePermit, getPermitsByVRM, getPermitById } from '../../lib/permits';
import FeedbackDialog from '../animated/FeedbackDialog';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import VerificationResultCard from '../animated/VerificationResultCard';

// Load Lottie JSON from public to keep assets consistent under /public/lottie
const useLottieAsset = (path) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(path, { cache: 'force-cache' });
        if (!res.ok) return;
        const json = await res.json();
  if (mounted && json && Object.keys(json||{}).length>0) setData(json);
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [path]);
  return data;
};

const BotAvatar = () => {
  // Force a different animation than the header
  const primary = useLottieAsset('/lottie/Robotchat.json');
  const botAnim = primary; // no header fallbacks to avoid matching header
  return (
    <Box sx={{ width: 36, height: 36, borderRadius: '50%', overflow:'hidden', boxShadow: (t)=>`0 0 12px ${t.palette.primary.main}55`, bgcolor: (t)=>`${t.palette.background.paper}` }}>
      {botAnim ? (
        <Lottie autoplay loop animationData={botAnim} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Box sx={{ width: '100%', height: '100%', bgcolor: (t)=>`${t.palette.primary.main}22` }} />
      )}
    </Box>
  );
};

const TypingIndicator = () => {
  const typingPrimary = useLottieAsset('/lottie/Loading.json');
  const typingAlt = useLottieAsset('/lottie/loading.json');
  const typingAnim = typingPrimary || typingAlt; // no success fallback for loading state
  return (
    <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
      {typingAnim ? (
        <Lottie autoplay loop animationData={typingAnim} style={{ width: 36, height: 36 }} />
      ) : (
        <Box sx={{ width:36, height:36, display:'grid', placeItems:'center' }}>
          <Box sx={{ display:'flex', gap:0.5 }}>
            <Box sx={{ width:6, height:6, borderRadius:'50%', bgcolor:(t)=>`${t.palette.primary.main}99` }} />
            <Box sx={{ width:6, height:6, borderRadius:'50%', bgcolor:(t)=>`${t.palette.primary.main}66` }} />
            <Box sx={{ width:6, height:6, borderRadius:'50%', bgcolor:(t)=>`${t.palette.primary.main}33` }} />
          </Box>
        </Box>
      )}
      <Typography variant="body2" sx={{ opacity:0.8 }}>Typing…</Typography>
    </Box>
  );
};

// Bot avatar with Lottie animation from public assets

// Available journeys for the assistant
const journeys = [
  { key: 'apply', label: 'Apply' },
  { key: 'renew', label: 'Renew' },
  { key: 'verify', label: 'Verify' },
];

const CHAT_STATE_KEY = 'kiosk_chat_progress';

export default function PermitChatAssistant(){
  const [history, setHistory] = useState([]); // {id?, side:'bot'|'user', text, type?, status?, timestamp}
  const [input, setInput] = useState('');
  const [stage, setStage] = useState('start'); // start -> pickJourney -> apply/renew/verify stages -> done
  const [journey, setJourney] = useState(null);
  const [context, setContext] = useState({});
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgType, setDlgType] = useState('success');
  const [dlgMsg, setDlgMsg] = useState('');
  const [dlgDetails, setDlgDetails] = useState(null);
  const scrollRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const typingRef = useRef(false);
  // Use the original heading animation and fall back safely
  const headerAnimPrimary = useLottieAsset('/lottie/live-chatbot.json');
  const headerAnimNameAlt = useLottieAsset('/lottie/Livechatbot.json');
  const headerAnimRobotFallback = useLottieAsset('/lottie/Robotchat.json');
  const headerAnim = headerAnimNameAlt ;

  const append = (msgs) => {
    const arr = Array.isArray(msgs) ? msgs : [msgs];
    const stamped = arr.map(m => ({ timestamp: Date.now(), ...m }));
    setHistory(h => [...h, ...stamped]);
  };

  // Auto-scroll on new messages (after animations/layout) and focus input after load
  useEffect(()=>{
    const el = scrollRef.current;
    if (!el) return;
    const id = setTimeout(()=>{ try{ el.scrollTop = el.scrollHeight; } catch {} }, 60);
    return ()=>clearTimeout(id);
  }, [history]);

  // Focus input field after chat loads (like normal chat apps)
  const inputRef = useRef(null);
  useEffect(()=>{
    if (loaded && inputRef.current) {
      setTimeout(() => {
        try { inputRef.current.focus(); } catch {}
      }, 100);
    }
  }, [loaded]);

  // Load saved progress
  useEffect(()=>{
    (async ()=>{
      try {
        const saved = await idbGet(CHAT_STATE_KEY);
        if (saved && saved.stage && saved.history) {
          setHistory(saved.history);
          setStage(saved.stage);
          setJourney(saved.journey || null);
          setContext(saved.context || {});
        } else {
          append({ side:'bot', text: 'Hey! What would you like to do today?' });
          setStage('pickJourney');
        }
      } catch {
        append({ side:'bot', text: 'Hey! What would you like to do today?' });
        setStage('pickJourney');
      } finally {
        setLoaded(true);
      }
    })();
  },[]);

  // Persist progress
  useEffect(()=>{
    if (!loaded) return;
    const payload = { history, stage, journey, context };
    idbSet(CHAT_STATE_KEY, payload).catch(()=>{});
  }, [history, stage, journey, context, loaded]);

  // Helpers to manage history with ticks and typing indicator
  const markLastUserDelivered = () => {
    setHistory(h => {
      const out = [...h];
      for (let i = out.length - 1; i >= 0; i--) {
        if (out[i]?.side === 'user' && out[i]?.status !== 'delivered') { out[i] = { ...out[i], status: 'delivered' }; break; }
      }
      return out;
    });
  };

  const addBotTyping = () => {
    if (typingRef.current) return;
    typingRef.current = true;
    append({ side:'bot', type:'typing', text:'' });
  };
  const clearBotTyping = () => {
    if (!typingRef.current) return;
    typingRef.current = false;
    setHistory(h => h.filter(m => m.type !== 'typing'));
  };

  const chip = (j) => (
    <Chip key={j.key} label={j.label} color={j.key==='apply'?'primary':(j.key==='verify'?'success':'default')} onClick={()=>chooseJourney(j.key)} sx={{ mr: 1, mb: 1 }} />
  );

  const chooseJourney = (j) => {
    setJourney(j);
    append({ side:'user', text: journeys.find(x=>x.key===j)?.label || j, status:'sent' });
    if (j==='apply') {
      setStage('apply_vrm');
      append({ side:'bot', text:'Great! What vehicle registration (VRM) is this for?' });
    } else if (j==='renew') {
      setStage('renew_id');
      append({ side:'bot', text:'Let’s renew. What is your permit ID?' });
    } else if (j==='verify') {
      setStage('verify_vrm');
      append({ side:'bot', text:'Enter a VRM to verify permit status.' });
    }
  };

  const handleSend = async () => {
    const val = (input||'').trim();
    if (!val) return;
    append({ side:'user', text: val, status:'sent' });
    setInput('');
    if (stage==='apply_vrm') {
      setContext(c=>({ ...c, vrm: val }));
      setStage('apply_hours');
      markLastUserDelivered();
      append({ side:'bot', text:'How many hours should the permit last?' });
    } else if (stage==='apply_hours') {
      const hours = parseInt(val, 10);
      if (!Number.isFinite(hours) || hours <= 0) { append({ side:'bot', text:'Please enter a valid number of hours (e.g., 2).' }); return; }
      setContext(c=>({ ...c, hours }));
  setStage('apply_email');
  markLastUserDelivered();
  append({ side:'bot', text:'Optional: enter an email to receive reminder notifications (Or type skip.' });
    } else if (stage==='apply_email') {
      const email = /@/.test(val.toLowerCase()) ? val : null;
      setContext(c=>({ ...c, email }));
      setStage('apply_issue');
      const { vrm, hours } = { ...context, email };
      try {
        addBotTyping();
        const res = await issuePermit({ vrm, hours, email });
        clearBotTyping();
        markLastUserDelivered();
        append({ side:'bot', text:`Done! Permit ${res.permit.id} issued for ${vrm}.` });
        setDlgType('success');
        setDlgMsg('Permit issued successfully');
        setDlgDetails({ id: res.permit.id, vrm, siteId: res.permit.siteId, start: res.permit.start, end: res.permit.end });
        setDlgOpen(true);
        setStage('done');
        // Auto-reset after successful completion
        setTimeout(() => reset(), 8000);
      } catch (e){
        clearBotTyping();
        const msg = e?.message || 'Sorry, I could not issue it right now.';
        append({ side:'bot', text: msg });
        setDlgType('error');
        setDlgMsg(msg);
        setDlgDetails(null);
        setDlgOpen(true);
        setStage('start');
      }
    } else if (stage==='renew_id') {
      const id = val;
      addBotTyping();
      const res = await getPermitById(id);
      clearBotTyping();
      if (!res) { append({ side:'bot', text:'I could not find that permit. Try again?' }); return; }
      setContext(c=>({ ...c, id }));
      setStage('renew_confirm');
      markLastUserDelivered();
      append({ side:'bot', text:`Found permit ${id} for ${res.vrm}. Extend by how many hours?` });
    } else if (stage==='renew_confirm') {
      const hours = parseInt(val, 10);
      if (!Number.isFinite(hours) || hours <= 0) { append({ side:'bot', text:'Please enter a valid number of hours (e.g., 2).' }); return; }
      const id = context.id;
      addBotTyping();
      const existing = await getPermitById(id);
      if (!existing) { clearBotTyping(); append({ side:'bot', text:'Could not reload permit. Try again.' }); return; }
  const res = await issuePermit({ vrm: existing.vrm, hours, email: existing.email });
      clearBotTyping();
      markLastUserDelivered();
  append({ side:'bot', text:`Renewed: new permit ${res.permit.id} for ${existing.vrm}.` });
  setDlgType('success');
  setDlgMsg('Permit renewed successfully');
  setDlgDetails({ id: res.permit.id, vrm: existing.vrm, siteId: res.permit.siteId, start: res.permit.start, end: res.permit.end });
  setDlgOpen(true);
      setStage('done');
      // Auto-reset after successful completion
      setTimeout(() => reset(), 8000);
    } else if (stage==='verify_vrm') {
      const vrm = val;
      addBotTyping();
      const list = await getPermitsByVRM(vrm);
      clearBotTyping();
      if (!list || !list.length) { 
        append({ side:'bot', text:`No permits found for ${vrm}.` });
        setDlgType('error');
        setDlgMsg(`No permits found for vehicle ${vrm}`);
        setDlgDetails(null);
        setDlgOpen(true);
        return; 
      }
      const latest = list[list.length-1];
      const now = Date.now();
      const end = new Date(latest.end).getTime();
      const start = new Date(latest.start).getTime();
      let status = 'invalid';
      if (now>=start && now<=end) { const remMin = Math.floor((end-now)/60000); status = remMin < 30 ? 'expiring' : 'valid'; }
      markLastUserDelivered();
      append([
        { side:'bot', text:`Found ${list.length} permit(s) for ${vrm}. Latest: ${latest.id}` },
        { side:'bot', type:'card', text: <VerificationResultCard status={status} title={`Permit ${latest.id}`} subtitle={`${latest.vrm} @ ${latest.siteId}`} details={latest} /> },
      ]);
      
      // Show success dialog for verification
      setDlgType('success');
      setDlgMsg('Verification completed successfully');
      setDlgDetails({ id: latest.id, vrm, siteId: latest.siteId, start: latest.start, end: latest.end, status: status });
      setDlgOpen(true);
      
      setStage('done');
      // Auto-reset after successful verification
      setTimeout(() => reset(), 8000);
    }
  };

  const reset = () => {
    setHistory([]);
    setJourney(null);
    setStage('pickJourney');
    setContext({});
    append({ side:'bot', text:'What would you like to do next?' });
    idbDel(CHAT_STATE_KEY).catch(()=>{});
  };

  // Quick reply suggestions by stage
  const suggestions = useMemo(()=>{
    if (stage==='apply_hours' || stage==='renew_confirm') return ['1','2','4'];
    if (stage==='apply_email') return ['skip'];
    if (stage==='pickJourney') return journeys.map(j=>j.label);
    return [];
  }, [stage]);

  const handleSuggestion = (s) => {
    if (stage==='pickJourney') {
      const j = journeys.find(j=>j.label===s);
      if (j) return chooseJourney(j.key);
    }
    setInput(s);
    setTimeout(()=>handleSend(), 0);
  };

  return (
    <Box sx={{ height:'100%', display:'flex', flexDirection:'column', minHeight: 0, overflow: 'hidden' }}>
  <Paper elevation={8} sx={{ p: 2, borderRadius: 3, height:'100%', display:'flex', flexDirection:'column', minHeight: 0, overflow: 'hidden' }}>
    {/* Header: centered icon with title below */}
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', mb: 1, flexShrink: 0, position: 'relative' }}>
          <Box sx={{ display:'flex', alignItems:'center', flexDirection:'column', gap: 0.75 }}>
      <Box sx={{ width: 88, height: 88, borderRadius: '50%', overflow:'hidden', boxShadow: (t)=>`0 0 24px ${t.palette.primary.main}66`, bgcolor: (t)=>`${t.palette.background.paper}`, flexShrink: 0 }}>
              {headerAnim ? (
                <Lottie autoplay loop animationData={headerAnim} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Box sx={{ width: '100%', height: '100%', bgcolor: (t)=>`${t.palette.primary.main}22` }} />
              )}
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, textAlign:'center' }}>Assistant</Typography>
          </Box>
          <Button size="small" startIcon={<ReplayIcon/>} onClick={reset} color="inherit" sx={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}>Start over</Button>
        </Box>
        
        {/* Journey chips */}
        <Box sx={{ display:'flex', gap: 1, flexWrap:'wrap', mb: 1, flexShrink: 0 }}>
          {journey ? <Chip label={journey.toUpperCase()} color="info"/> : journeys.map(chip)}
        </Box>
        
        {/* Chat messages - scrollable area */}
        <Box 
          ref={scrollRef} 
          sx={{ 
            flex: 1, 
            minHeight: 0, 
            overflowY: 'auto', 
            overflowX: 'hidden',
            py: 1, 
            pr: 0.5, 
            overscrollBehavior: 'contain', 
            WebkitOverflowScrolling: 'touch',
            // Ensure messages don't get cut off by keyboard
            paddingBottom: 'calc(var(--kbd-inset, 0px) + 8px)'
          }}
        >
          <AnimatePresence>
            {history.map((m, idx) => (
              <Box key={m.id || idx} component={motion.div} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ type:'spring', stiffness:180, damping:18 }} sx={{ display:'flex', mb:1.25, alignItems:'flex-end', justifyContent: m.side==='user' ? 'flex-end' : 'flex-start', gap:1 }}>
                {m.side==='bot' && <BotAvatar/>}
                <Box sx={{ maxWidth:'72%', display:'flex', flexDirection:'column', alignItems: m.side==='user' ? 'flex-end' : 'flex-start' }}>
                  <Paper elevation={0} sx={{ px:1.25, py:0.75, borderRadius:2, bgcolor: m.side==='user' ? (t)=>alpha(t.palette.primary.main, 0.15) : (t)=>alpha(t.palette.background.paper, 0.7), border: (t)=>`1px solid ${alpha(t.palette.divider, 0.4)}` }}>
                    {m.type==='typing' && (
                      <TypingIndicator />
                    )}
                    {!m.type || m.type==='text' ? (
                      <Typography variant="body2" sx={{ whiteSpace:'pre-wrap' }}>{m.text}</Typography>
                    ) : null}
                    {m.type==='qr' && (
                      <Box sx={{ textAlign:'center' }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>Scan this QR to view the permit</Typography>
                        <Box sx={{ display:'grid', placeItems:'center' }}>
                          <img src={m.text} alt="Permit QR" style={{ width: 200, height: 200 }} />
                        </Box>
                      </Box>
                    )}
                    {m.type==='card' && (
                      <Box sx={{ width: 320, maxWidth: '80vw' }}>
                        {m.text}
                      </Box>
                    )}
                  </Paper>
                  <Box sx={{ display:'flex', alignItems:'center', gap:0.75, mt:0.5, px:0.5, color:(t)=>alpha(t.palette.text.secondary, 0.7) }}>
                    <Typography variant="caption" sx={{ lineHeight:1 }}>{new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography>
                    {m.side==='user' && (
                      <Box sx={{ display:'flex', alignItems:'center', gap:0.25 }}>
                        {!m.status && <AccessTimeIcon fontSize="inherit" />}
                        {m.status==='sent' && <DoneIcon fontSize="inherit" />}
                        {m.status==='delivered' && <DoneAllIcon fontSize="inherit" color="primary" />}
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            ))}
          </AnimatePresence>
        </Box>
        
        {/* Suggestions - fixed at bottom */}
        <Box sx={{ mt: 1, display:'flex', alignItems:'center', gap:1, flexWrap:'wrap', flexShrink: 0 }}>
          {suggestions.map(s => (<Chip key={s} label={s} size="small" onClick={()=>handleSuggestion(s)} />))}
          {(stage==='done' || stage==='pickJourney') && (
            <Chip label="Start over" color="default" size="small" onClick={reset} icon={<ReplayIcon/>} />
          )}
        </Box>
        
        {/* Input area - fixed at bottom */}
        <Box sx={{ 
          mt: 1, 
          display:'flex', 
          gap: 1, 
          bgcolor:'background.paper', 
          py: 1, 
          borderTop: (t)=>`1px solid ${alpha(t.palette.divider, 0.4)}`,
          flexShrink: 0
        }}>
          <TextField 
            ref={inputRef} 
            fullWidth 
            placeholder="Type a message" 
            value={input} 
            onChange={e=>setInput(e.target.value)} 
            onKeyDown={e=>{ if (e.key==='Enter') handleSend(); }}
            onFocus={() => {
              // Auto-scroll to bottom when input is focused to ensure it's visible
              setTimeout(() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
              }, 100);
            }}
          />
          <IconButton color="primary" onClick={handleSend}><SendIcon/></IconButton>
        </Box>
      </Paper>

      <FeedbackDialog
        open={dlgOpen}
        onClose={()=>setDlgOpen(false)}
        type={dlgType}
        title={dlgType==='success' ? 'Permit Issued' : 'Action Failed'}
        message={dlgMsg}
        details={dlgDetails}
        lottiePath={dlgType==='success' ? '/lottie/success.json' : '/lottie/Error.json'}
        onPrimary={()=>{ setDlgOpen(false); if (stage==='done') reset(); }}
        primaryText={dlgType==='success' ? 'Done' : 'Retry'}
      />
    </Box>
  );
}
