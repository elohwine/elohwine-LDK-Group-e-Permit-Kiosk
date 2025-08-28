import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Paper, Typography, Chip, TextField, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ReplayIcon from '@mui/icons-material/Replay';
import { alpha } from '@mui/material/styles';
import Lottie from 'lottie-react';

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
  const primary = useLottieAsset('/lottie/Robotchat.json');
  const botAnim = primary;
  return (
    <Box sx={{ width: 32, height: 32, borderRadius: '50%', overflow:'hidden', boxShadow: (t)=>`0 0 10px ${t.palette.primary.main}44`, bgcolor: (t)=>`${t.palette.background.paper}`, flexShrink: 0 }}>
      {botAnim ? (
        <Lottie autoplay loop animationData={botAnim} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Box sx={{ width: '100%', height: '100%', bgcolor: (t)=>`${t.palette.primary.main}22` }} />
      )}
    </Box>
  );
};

export default function ManagerAssistant({ settings, onUpdate, onSave }) {
  const [history, setHistory] = useState([]); // {side:'bot'|'user', text, ts}
  const [input, setInput] = useState('');
  const [awaiting, setAwaiting] = useState(null); // 'apiBase' | 'iconUrl'
  const scrollRef = useRef(null);

  useEffect(() => {
    // greet once
    setHistory([
      { side: 'bot', text: 'Hi Manager! I can help you configure this kiosk. Try one of the quick actions below or type a command.' , ts: Date.now() },
    ]);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const id = setTimeout(() => { try { el.scrollTop = el.scrollHeight; } catch {} }, 30);
    return () => clearTimeout(id);
  }, [history]);

  const append = (msgs) => {
    const arr = Array.isArray(msgs) ? msgs : [msgs];
    setHistory(h => [...h, ...arr.map(m => ({ ts: Date.now(), ...m }))]);
  };

  const suggestions = useMemo(() => [
    'Toggle Payments',
    settings?.qrEnabled ? 'Disable QR' : 'Enable QR',
    settings?.kioskKeyboardEnabled ? 'Disable Keyboard' : 'Enable Keyboard',
    settings?.kioskKeyboardAutoOpen ? 'Disable Auto-Open' : 'Enable Auto-Open',
    'Set API Base',
    'Set Site Icon',
    'Set Maskable Icon',
    'Set Subscription Frequencies',
    settings?.emailPdfEnabled ? 'Disable Email PDF' : 'Enable Email PDF',
    'Save',
    'Help',
  ], [settings]);

  const handleSuggestion = (s) => {
    if (s === 'Toggle Payments') return handleCommand('toggle payments');
    if (s === 'Enable QR') return handleCommand('enable qr');
    if (s === 'Disable QR') return handleCommand('disable qr');
  if (s === 'Enable Keyboard') return handleCommand('enable keyboard');
  if (s === 'Disable Keyboard') return handleCommand('disable keyboard');
  if (s === 'Enable Auto-Open') return handleCommand('enable auto-open');
  if (s === 'Disable Auto-Open') return handleCommand('disable auto-open');
    if (s === 'Set API Base') return handleCommand('set api base');
  if (s === 'Set Site Icon') return handleCommand('set site icon');
  if (s === 'Set Maskable Icon') return handleCommand('set maskable icon');
  if (s === 'Set Subscription Frequencies') return handleCommand('set subscription frequencies');
  if (s === 'Enable Email PDF') return handleCommand('enable email pdf');
  if (s === 'Disable Email PDF') return handleCommand('disable email pdf');
    if (s === 'Save') return handleCommand('save');
    if (s === 'Help') return handleCommand('help');
  };

  const handleSend = () => {
    const val = (input || '').trim();
    if (!val) return;
    append({ side: 'user', text: val });
    setInput('');
    handleCommand(val);
  };

  const handleCommand = (raw) => {
    const text = raw.toLowerCase();
    // awaiting input flows
    if (awaiting === 'apiBase') {
      onUpdate && onUpdate({ apiBase: raw.trim() });
      append({ side: 'bot', text: `API base set to: ${raw.trim()}. Don’t forget to Save.` });
      setAwaiting(null);
      return;
    }
    if (awaiting === 'iconUrl') {
      onUpdate && onUpdate({ siteIconUrl: raw.trim() });
      append({ side: 'bot', text: `Site icon updated. Don’t forget to Save.` });
      setAwaiting(null);
      return;
    }
    if (awaiting === 'maskIconUrl') {
      onUpdate && onUpdate({ siteIconMaskableUrl: raw.trim() });
      append({ side: 'bot', text: `Maskable icon updated. Don’t forget to Save.` });
      setAwaiting(null);
      return;
    }
    if (awaiting === 'subFreq') {
      const list = raw.split(',').map(x=>x.trim()).filter(Boolean);
      onUpdate && onUpdate({ subscriptionFrequencies: list });
      append({ side: 'bot', text: `Subscription frequencies set to: ${list.join(', ') || 'none'}. Don’t forget to Save.` });
      setAwaiting(null);
      return;
    }

    // quick commands
    if (/^help$/.test(text)) {
      append({ side: 'bot', text: 'You can say: "toggle payments", "enable/disable qr", "enable/disable keyboard", "enable/disable auto-open", "enable/disable email pdf", "set api base", "set site icon", "set maskable icon", "set subscription frequencies", or "save".' });
      return;
    }
    if (/toggle\s+payments/.test(text)) {
      const next = !(settings?.paymentsEnabled ?? true);
      onUpdate && onUpdate({ paymentsEnabled: next });
      append({ side: 'bot', text: `Payments have been ${next ? 'enabled (card shown)' : 'disabled (card hidden)'}. Save to persist.` });
      return;
    }
    if (/enable\s+qr/.test(text)) {
      onUpdate && onUpdate({ qrEnabled: true });
      append({ side: 'bot', text: 'QR codes enabled. Save to persist.' });
      return;
    }
    if (/disable\s+qr/.test(text)) {
      onUpdate && onUpdate({ qrEnabled: false });
      append({ side: 'bot', text: 'QR codes disabled. Save to persist.' });
      return;
    }
    if (/(enable|disable)\s+(kiosk\s*)?keyboard/.test(text)) {
      const enable = /enable/.test(text);
      onUpdate && onUpdate({ kioskKeyboardEnabled: enable });
      append({ side: 'bot', text: `Kiosk keyboard ${enable ? 'enabled' : 'disabled'}. Save to persist.` });
      return;
    }
    if (/(enable|disable)\s+(auto[-\s]?open|keyboard\s+auto\s*open)/.test(text)) {
      const enable = /enable/.test(text);
      onUpdate && onUpdate({ kioskKeyboardAutoOpen: enable });
      append({ side: 'bot', text: `Keyboard auto-open ${enable ? 'enabled' : 'disabled'}. Save to persist.` });
      return;
    }
    if (/set\s+api(\s+base)?/.test(text)) {
      append({ side: 'bot', text: `Enter new API base (current: ${settings?.apiBase || '/api'})` });
      setAwaiting('apiBase');
      return;
    }
    if (/set\s+(site\s+)?icon/.test(text)) {
      append({ side: 'bot', text: `Paste the site icon URL (current: ${settings?.siteIconUrl || 'not set'})` });
      setAwaiting('iconUrl');
      return;
    }
    if (/set\s+(maskable\s+)?icon/.test(text)) {
      append({ side: 'bot', text: `Paste the maskable icon URL (current: ${settings?.siteIconMaskableUrl || 'not set'})` });
      setAwaiting('maskIconUrl');
      return;
    }
    if (/set\s+(subscription|subs|plan)\s+freq(uencies)?/.test(text)) {
      const current = (settings?.subscriptionFrequencies || []).join(', ');
      append({ side: 'bot', text: `Enter comma-separated frequencies (current: ${current || 'none'}) e.g. weekly, monthly` });
      setAwaiting('subFreq');
      return;
    }
    if (/(enable|disable)\s+email\s+pdf/.test(text)) {
      const enable = /enable/.test(text);
      onUpdate && onUpdate({ emailPdfEnabled: enable });
      append({ side: 'bot', text: `Email PDF ${enable ? 'enabled' : 'disabled'}. Save to persist.` });
      return;
    }
    if (/^save$/.test(text)) {
      if (onSave) onSave();
      append({ side: 'bot', text: 'Saving… If successful, settings will be applied.' });
      return;
    }

    append({ side: 'bot', text: "I didn’t catch that. Type 'help' to see available commands." });
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Paper elevation={8} sx={{ p: 2, borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {/* Header with Lottie */}
        <HeaderWithLottie onReset={()=>setHistory([])} />

        {/* Suggestions */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1, flexShrink: 0 }}>
          {suggestions.map(s => (<Chip key={s} label={s} size="small" onClick={() => handleSuggestion(s)} />))}
        </Box>

        {/* Chat area */}
        <Box ref={scrollRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', py: 1, pr: 0.5, overscrollBehavior: 'contain' }}>
          {history.map((m, i) => (
            <Box key={i} sx={{ display: 'flex', mb: 1.25, justifyContent: m.side === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 1 }}>
              {m.side !== 'user' && <BotAvatar />}
              <Box sx={{ maxWidth: '80%', bgcolor: (t)=> m.side==='user' ? alpha(t.palette.primary.main, 0.15) : alpha(t.palette.background.paper, 0.7), border: (t)=>`1px solid ${alpha(t.palette.divider, 0.4)}`, px: 1.25, py: 0.75, borderRadius: 2 }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {/* Input */}
        <Box sx={{ mt: 1, display: 'flex', gap: 1, bgcolor: 'background.paper', py: 1, borderTop: (t)=>`1px solid ${alpha(t.palette.divider, 0.4)}`, flexShrink: 0 }}>
          <TextField fullWidth placeholder="Type a command…" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if (e.key==='Enter') handleSend(); }} />
          <IconButton color="primary" onClick={handleSend}><SendIcon/></IconButton>
        </Box>
      </Paper>
    </Box>
  );
}

function HeaderWithLottie({ onReset }) {
  const headerAnimPrimary = useLottieAsset('/lottie/live-chatbot.json');
  const headerAnimNameAlt = useLottieAsset('/lottie/Livechatbot.json');
  const headerAnimRobotFallback = useLottieAsset('/lottie/Robotchat.json');
  const headerAnim = headerAnimPrimary || headerAnimNameAlt || headerAnimRobotFallback;
  return (
    <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', mb: 1, flexShrink: 0, position:'relative' }}>
      <Box sx={{ display:'flex', alignItems:'center', flexDirection:'column', gap: 0.75 }}>
        <Box sx={{ width: 88, height: 88, borderRadius: '50%', overflow:'hidden', boxShadow: (t)=>`0 0 24px ${t.palette.primary.main}66`, bgcolor: (t)=>`${t.palette.background.paper}`, flexShrink: 0 }}>
          {headerAnim ? (
            <Lottie autoplay loop animationData={headerAnim} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Box sx={{ width: '100%', height: '100%', bgcolor: (t)=>`${t.palette.primary.main}22` }} />
          )}
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, textAlign:'center' }}>Manager Assistant</Typography>
      </Box>
      <IconButton size="small" color="inherit" onClick={onReset} sx={{ position:'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}>
        <ReplayIcon />
      </IconButton>
    </Box>
  );
}
