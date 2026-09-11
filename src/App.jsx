import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Zap,
  Cable,
  Smartphone,
  Minus,
  Square,
  X,
  Play,
  Pause,
  RotateCcw,
  Activity,
  Trash2,
  Layers,
  ArrowRight,
  Server,
  Laptop,
  Volume2,
  VolumeX,
  Radio,
  Radar,
  Unlock,
  Lock,
  Globe,
  ShieldAlert,
  AlertTriangle,
  Settings,
  Sliders,
  Wifi,
  Check,
  Plus,
  RefreshCw,
  CheckCircle2,
  SlidersHorizontal,
  Info,
  Shield,
  Download,
  Sparkles,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  BookOpen
} from 'lucide-react';

function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'failover' || type === 'bypass') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'recovered' || type === 'auto') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch (e) {}
}

export default function App() {
  const [state, setState] = useState({
    mode: 'NORMAL',
    routeStrategy: 'AUTO',
    isMonitoring: true,
    autoConnectHotspot: true,
    targetHotspots: ['S21+ de Jefferson', 'S21+', 'POCO F5 de Jefferson'],
    activeHotspotName: '',
    primaryAlias: 'Ethernet',
    primaryIP: '10.180.124.98',
    primaryOnline: true,
    primaryLatency: 1,
    primaryJitter: 0,
    primaryLoss: 0,
    primaryHistory: [],
    secondaryAlias: 'Wi-Fi',
    secondaryIP: '172.21.167.107',
    secondaryOnline: true,
    secondaryLatency: 35,
    secondaryJitter: 3,
    secondaryLoss: 0,
    secondaryHistory: [],
    failCount: 0,
    recoveryCount: 0,
    dropsPrevented: 0,
    uptimeSeconds: 0,
    isAdmin: true,
    profile: 'balanced',
    targetHost: '1.1.1.1',
    config: {
      profile: 'balanced',
      checkInterval: 1000,
      failThreshold: 2,
      recoveryThreshold: 3,
      primaryActiveMetric: 10,
      primaryInactiveMetric: 9999,
      secondaryActiveMetric: 10,
      secondaryStandbyMetric: 50,
      targetHost: '1.1.1.1',
      minimizeToTray: true,
      soundEnabled: true
    }
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('failover'); // 'failover' | 'hotspots' | 'routes' | 'system'
  const [newHotspotInput, setNewHotspotInput] = useState('');
  const [customTargetHost, setCustomTargetHost] = useState('');

  const [logs, setLogs] = useState([
    { id: 1, time: new Date().toLocaleTimeString('pt-BR'), type: 'success', text: 'ZeroDrop Engine inicializado com seletor de rota em tempo real.' },
    { id: 2, time: new Date().toLocaleTimeString('pt-BR'), type: 'switch', text: 'Dica: Use "Forçar Celular (Bypass Firewall)" para navegar sem restrições.' }
  ]);

  const [updateStatus, setUpdateStatus] = useState({
    state: 'idle',
    version: '',
    progress: 0,
    bytesPerSecond: 0,
    transferred: 0,
    total: 0,
    error: ''
  });

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => {
    try {
      return !localStorage.getItem('zerodrop_tutorial_seen');
    } catch {
      return false;
    }
  });
  const [onboardingStep, setOnboardingStep] = useState(0);

  const handleFinishOnboarding = () => {
    setIsOnboardingOpen(false);
    try {
      localStorage.setItem('zerodrop_tutorial_seen', 'true');
    } catch (_) {}
  };

  const tutorialSteps = [
    {
      badge: 'Proteção Dual-WAN Hitless',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: ShieldCheck,
      iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      title: 'Adeus às Quedas de Conexão',
      desc: 'O ZeroDrop monitora seu Cabo de Rede e o Wi-Fi em tempo real. Se o cabo for puxado ou a rede cair, o tráfego salta para o seu celular em milissegundos sem derrubar chamadas, streams, jogos ou downloads.',
      highlights: [
        { label: 'Monitoramento Contínuo', val: 'Pings de 500ms na placa de rede' },
        { label: 'Comutação Sem Queda', val: 'Transição imperceptível (Hitless)' },
        { label: 'Retorno Automático', val: 'Volta ao cabo assim que estabilizar' }
      ]
    },
    {
      badge: 'Bypass Inteligente de Firewall',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: Unlock,
      iconColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      title: 'Acesse Shopee e Sites Bloqueados',
      desc: 'Redes de empresas (como Fortinet no IP 10.x.x.x) costumam bloquear determinados sites. Com o botão "Forçar Celular (Bypass)", você navega direto pelo seu 5G sem precisar tirar o cabo da máquina!',
      highlights: [
        { label: '1 Clique para Desbloquear', val: 'Prioriza a rota do celular na hora' },
        { label: 'Limpeza de Cache DNS', val: 'Flush DNS automático do Windows' },
        { label: 'Retorno Imediato', val: 'Volte ao cabo com 1 clique quando quiser' }
      ]
    },
    {
      badge: 'Radar de Celular no Ar',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      icon: Smartphone,
      iconColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      title: 'Auto-Conexão do seu Smartphone',
      desc: 'Ao ligar o Ponto de Acesso (Roteador Wi-Fi) no seu celular, o radar do ZeroDrop detecta o sinal no ar e conecta sozinho em segundo plano, deixando a reserva 5G pronta para qualquer emergência.',
      highlights: [
        { label: 'Aparelhos Pré-Cadastrados', val: 'S21+ e POCO F5 já configurados' },
        { label: 'Multi-Dispositivo', val: 'Adicione quantos celulares quiser em ⚙️' },
        { label: 'Conexão Sob Demanda', val: 'Botão "Conectar" manual disponível' }
      ]
    },
    {
      badge: 'Atualizações Automáticas & Sensibilidade',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: Zap,
      iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      title: 'Perfis de Troca e Auto-Updates',
      desc: 'Ajuste a velocidade de reação para o seu uso: Modo Gamer (500ms), Equilibrado ou Seguro. Além disso, o ZeroDrop recebe novidades e melhorias diretamente pelo GitHub Releases sem você precisar reinstalar!',
      highlights: [
        { label: 'Modo Gamer', val: 'Troca ultra-rápida (1 falha = 500ms)' },
        { label: 'GitHub Auto-Update', val: 'Atualizações transparentes e gratuitas' },
        { label: 'Ajuda a Qualquer Momento', val: 'Clique no botão (?) no topo para rever' }
      ]
    }
  ];

  const lastModeRef = useRef('NORMAL');
  const logEndRef = useRef(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onStatusUpdate((newState) => {
        setState((prev) => {
          if (soundEnabled && lastModeRef.current !== newState.mode) {
            if (newState.mode === 'FAILOVER') playSound('failover');
            else if (newState.mode === 'BYPASS') playSound('bypass');
            else if (newState.mode === 'NORMAL' && lastModeRef.current !== 'NORMAL') playSound('recovered');
            lastModeRef.current = newState.mode;
          }
          return { ...prev, ...newState };
        });
      });

      window.electronAPI.onUpdateStatus?.((status) => {
        setUpdateStatus(status);
      });

      window.electronAPI.onLog((newLog) => {
        setLogs((prev) => [...prev.slice(-120), { id: Date.now() + Math.random(), ...newLog }]);
      });

      window.electronAPI.isMaximized().then(setIsMaximized);
    }
  }, [soundEnabled]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => {
    window.electronAPI?.maximize();
    setIsMaximized(!isMaximized);
  };
  const handleClose = () => window.electronAPI?.close();

  const handleRestartAsAdmin = () => {
    window.electronAPI?.restartAsAdmin();
  };

  const handleUpdateConfig = (partial) => {
    const updated = { ...(state.config || {}), ...partial };
    setState((prev) => ({ ...prev, config: updated, profile: updated.profile || prev.profile }));
    window.electronAPI?.updateSettings({ config: updated });
  };

  const handleAddHotspot = () => {
    if (!newHotspotInput.trim()) return;
    const name = newHotspotInput.trim();
    if (!state.targetHotspots?.includes(name)) {
      const updated = [...(state.targetHotspots || []), name];
      setState((prev) => ({ ...prev, targetHotspots: updated }));
      window.electronAPI?.addHotspot(name);
      setNewHotspotInput('');
    }
  };

  const handleRemoveHotspot = (name) => {
    const updated = (state.targetHotspots || []).filter((h) => h !== name);
    setState((prev) => ({ ...prev, targetHotspots: updated }));
    window.electronAPI?.removeHotspot(name);
  };

  const handleFlushDNS = () => {
    window.electronAPI?.flushDNS();
  };

  const handleSetRouteStrategy = (strategy) => {
    setState((prev) => ({ ...prev, routeStrategy: strategy }));
    window.electronAPI?.setRouteStrategy(strategy);
    if (soundEnabled) {
      if (strategy === 'FORCE_MOBILE') playSound('bypass');
      else playSound('auto');
    }
  };

  const hasCable = Boolean(state.primaryIP);
  const hasCellular = Boolean(state.secondaryIP);
  const isDualConnected = hasCable && hasCellular;

  const handleToggleMonitoring = () => {
    if (!isDualConnected && !state.isMonitoring) {
      return;
    }
    const next = !state.isMonitoring;
    setState((prev) => ({ ...prev, isMonitoring: next }));
    window.electronAPI?.setMonitoring(next);
    if (soundEnabled) {
      if (next) playSound('recovered');
      else playSound('auto');
    }
  };

  const handleSetProfile = (profileName) => {
    setState((prev) => ({ ...prev, profile: profileName }));
    window.electronAPI?.setProfile(profileName);
  };

  const handleResetMetrics = () => window.electronAPI?.resetMetrics();
  const handleClearLogs = () => setLogs([]);

  const isBypass = state.routeStrategy === 'FORCE_MOBILE' || state.mode === 'BYPASS';
  const isFailover = state.mode === 'FAILOVER';

  const formatUptime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#09090b] text-[#f4f4f5] select-none border border-white/10 overflow-hidden font-sans">
      {/* 1. Custom TitleBar */}
      <header
        className="h-11 flex items-center justify-between px-4 bg-[#101014] border-b border-white/10 shrink-0"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 via-blue-600 to-emerald-500 shadow-md shadow-cyan-500/20">
            <Zap className="w-3.5 h-3.5 text-white" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#101014] ${
                isBypass
                  ? 'bg-purple-400 animate-pulse'
                  : isFailover
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-emerald-400'
              }`}
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              ZeroDrop
            </span>
            <span className="text-[11px] text-zinc-400 font-medium">Dual-WAN & Firewall Bypass</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-cyan-300 font-mono">
            {isBypass
              ? '🔓 BYPASS FIREWALL'
              : isFailover
              ? '⚡ 5G FAILOVER'
              : !state.isMonitoring
              ? '⚪ DESATIVADO'
              : !isDualConnected
              ? '🔒 AGUARDANDO 2ª REDE'
              : '🟢 AUTO PROTEGIDO'}
          </span>
        </div>

        {/* Window controls & Audio */}
        <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={() => {
              setOnboardingStep(0);
              setIsOnboardingOpen(true);
            }}
            className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-cyan-300 hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutorial de Primeiro Acesso (Guia)"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Configurações do ZeroDrop"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer ${
              soundEnabled ? 'text-cyan-400 hover:bg-white/10' : 'text-zinc-500 hover:bg-white/10'
            }`}
            title={soundEnabled ? 'Alerta Sonoro Ativo' : 'Alerta Sonoro Silenciado'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          <div className="w-[1px] h-4 bg-white/10 mx-1" />
          <button
            onClick={handleMinimize}
            className="w-8 h-7 flex items-center justify-center rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-8 h-7 flex items-center justify-center rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={handleClose}
            className="w-8 h-7 flex items-center justify-center rounded hover:bg-rose-500 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Update Downloading Banner */}
      {updateStatus.state === 'downloading' && (
        <div className="bg-cyan-500/15 border-b border-cyan-500/30 px-4 py-2 flex items-center justify-between gap-3 text-cyan-200 text-xs shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2 flex-1">
            <Download className="w-4 h-4 text-cyan-400 shrink-0 animate-bounce" />
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span>
                  <strong>Atualização Automática:</strong> Baixando nova versão <strong>v{updateStatus.version}</strong> do GitHub...
                </span>
                <span className="font-mono font-bold text-cyan-300">{updateStatus.progress}%</span>
              </div>
              <div className="w-full h-1 bg-cyan-950/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${updateStatus.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Ready Banner */}
      {updateStatus.state === 'ready' && (
        <div className="bg-emerald-500/20 border-b border-emerald-500/40 px-4 py-2 flex items-center justify-between gap-3 text-emerald-100 text-xs shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
            <span>
              <strong>Nova Versão Pronta!</strong> O ZeroDrop <strong>v{updateStatus.version}</strong> foi baixado e está pronto para ser aplicado.
            </span>
          </div>
          <button
            onClick={() => window.electronAPI?.restartAndInstallUpdate()}
            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            ⚡ Reiniciar e Atualizar Agora
          </button>
        </div>
      )}

      {/* Elevation Notice Banner */}
      {!state.isAdmin && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between gap-3 text-amber-200 text-xs shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Permissão Necessária:</strong> O Windows exige privilégios de Administrador para alternar as rotas de rede.
            </span>
          </div>
          <button
            onClick={handleRestartAsAdmin}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            ⚡ Reiniciar como Administrador
          </button>
        </div>
      )}

      {/* 2. Main Workspace (Fluid Responsive Layout) */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col items-center">
        <div className="max-w-6xl w-full flex flex-col gap-4">
          {/* MASTER PROTECTION STATUS & DUAL-NETWORK ACTIVATION BAR */}
          <div className={`glass-card rounded-xl p-3.5 border transition-all duration-300 shadow-lg shadow-black/40 ${
            state.isMonitoring && isDualConnected
              ? 'border-emerald-500/30 bg-emerald-500/[0.03] shadow-emerald-950/20'
              : !isDualConnected
              ? 'border-amber-500/20 bg-amber-500/[0.02]'
              : 'border-white/10 bg-zinc-900/40'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              {/* Left: Info, Lock & Warning */}
              <div className="flex items-center gap-3 min-w-[280px]">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 transition-all ${
                  state.isMonitoring && isDualConnected
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-md shadow-emerald-500/20'
                    : !isDualConnected
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-zinc-800 text-zinc-400 border-white/10'
                }`}>
                  {!isDualConnected ? (
                    <Lock className="w-4 h-4 text-amber-400" />
                  ) : state.isMonitoring ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Shield className="w-5 h-5 text-zinc-400" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white tracking-wide">
                      Proteção Dual-WAN ZeroDrop
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                      state.isMonitoring && isDualConnected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                        : !isDualConnected
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-zinc-800 text-zinc-400 border-white/10'
                    }`}>
                      {state.isMonitoring && isDualConnected
                        ? '🟢 ATIVADO'
                        : !isDualConnected
                        ? '🔒 BLOQUEADO (REQUER 2 REDES)'
                        : '⚪ DESATIVADO'}
                    </span>
                  </div>

                  {/* Dynamic explanatory warning */}
                  <div className="text-[11px] mt-0.5 font-sans">
                    {!isDualConnected ? (
                      <span className="text-amber-300/90 font-medium flex items-center gap-1.5 flex-wrap">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        {!hasCable && !hasCellular
                          ? 'Aviso: Conecte o Cabo de Rede e a Segunda Rede (Celular) para liberar o botão de ativação.'
                          : !hasCable
                          ? 'Aviso: Conecte o Cabo de Rede para liberar o botão de ativação da redundância.'
                          : 'Aviso: Conecte o Celular (Wi-Fi/Hotspot) para liberar o botão de ativação da redundância.'}
                      </span>
                    ) : state.isMonitoring ? (
                      <span className="text-emerald-300/90 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        Cabo e Celular conectados. Redundância em alta precisão ({state.config?.checkInterval || 500}ms).
                      </span>
                    ) : (
                      <span className="text-zinc-400">
                        Cabo e Celular prontos. Clique no botão ao lado para ativar a proteção de tráfego.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Network status pills + ATIVADO / DESATIVADO button */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono">
                  <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                    hasCable ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                  }`}>
                    {hasCable ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />} Cabo {hasCable ? 'Online' : 'Off'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                    hasCellular ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                  }`}>
                    {hasCellular ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />} Celular {hasCellular ? 'Online' : 'Off'}
                  </span>
                </div>

                <button
                  onClick={handleToggleMonitoring}
                  disabled={!isDualConnected}
                  title={!isDualConnected ? 'Conecte o Cabo e o Celular para poder ativar' : 'Clique para alternar a Proteção ZeroDrop'}
                  className={`relative inline-flex items-center h-8 rounded-full transition-all duration-300 px-1 border select-none ${
                    !isDualConnected
                      ? 'opacity-50 cursor-not-allowed bg-zinc-800 border-white/5 w-32'
                      : state.isMonitoring
                      ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/40 w-32 cursor-pointer shadow-lg shadow-emerald-600/30'
                      : 'bg-zinc-800 hover:bg-zinc-700 border-white/10 w-32 cursor-pointer'
                  }`}
                >
                  <span className={`text-[11px] font-bold tracking-wider uppercase px-2 w-full flex items-center justify-between ${
                    !isDualConnected
                      ? 'text-zinc-500'
                      : state.isMonitoring
                      ? 'text-white'
                      : 'text-zinc-400'
                  }`}>
                    {state.isMonitoring && isDualConnected ? (
                      <>
                        <span className="pl-1">Ativado</span>
                        <div className="w-5 h-5 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-md">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-5 h-5 rounded-full bg-zinc-600 text-zinc-300 flex items-center justify-center shadow-md">
                          {!isDualConnected ? <Lock className="w-2.5 h-2.5" /> : <X className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="pr-1">{!isDualConnected ? 'Travado' : 'Desativado'}</span>
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* QUICK 1-CLICK ROUTE SELECTOR BAR */}
          <div className="glass-card rounded-xl p-3 border border-white/10 flex items-center justify-between flex-wrap gap-2.5 shadow-lg shadow-black/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" /> Rota Ativa com 1 Clique:
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Option 1: Auto Failover */}
              <button
                onClick={() => handleSetRouteStrategy('AUTO')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  state.routeStrategy === 'AUTO'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
                title="Usa o Cabo normalmente. Se o cabo oscilar ou cair, transfere para o Celular instantaneamente."
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                🟢 Modo Automático (Cabo + 5G)
              </button>

              {/* Option 2: Force Mobile / Bypass Fortinet */}
              <button
                onClick={() => handleSetRouteStrategy('FORCE_MOBILE')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  state.routeStrategy === 'FORCE_MOBILE'
                    ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-md shadow-purple-500/20 animate-pulse'
                    : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/20'
                }`}
                title="Força todo o tráfego pelo Celular 5G. Ignora o firewall Fortinet e navega livremente!"
              >
                <Unlock className="w-3.5 h-3.5 text-purple-400" />
                🔓 Forçar Celular (Bypass Firewall)
              </button>

              {/* Option 3: Force Cable */}
              <button
                onClick={() => handleSetRouteStrategy('FORCE_CABLE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  state.routeStrategy === 'FORCE_CABLE'
                    ? 'bg-blue-600/25 text-blue-200 border border-blue-500/40 shadow-sm'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
                title="Trava todo o tráfego exclusivamente no Cabo de Rede."
              >
                <Cable className="w-3.5 h-3.5 text-blue-400" />
                🌐 Forçar Cabo
              </button>
            </div>
          </div>

          {/* DYNAMIC FLOW TOPOLOGY (Well-proportioned, visual) */}
          <div className="glass-card rounded-xl p-3.5 border border-white/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" /> Fluxo de Conexão em Tempo Real
              </span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  isBypass
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : isFailover
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {isBypass
                  ? 'ROTA ATIVA: CELULAR 5G (BYPASS LIBERADO)'
                  : isFailover
                  ? 'ROTA ATIVA: CELULAR 5G (FAILOVER)'
                  : 'ROTA ATIVA: CABO DE REDE (ETHERNET)'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 py-1">
              {/* Box 1: Computer */}
              <div className="flex-1 flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.03] border border-white/10 min-h-[75px]">
                <Laptop className="w-5 h-5 text-zinc-300 mb-1" />
                <span className="text-xs font-semibold text-zinc-200">Seu Computador</span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {state.primaryIP || state.secondaryIP || 'Conectado'}
                </span>
              </div>

              {/* Arrow 1 */}
              <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />

              {/* Box 2: ZeroDrop Core */}
              <div
                className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border relative shadow-lg min-h-[75px] ${
                  isBypass
                    ? 'bg-purple-950/30 border-purple-500/40 shadow-purple-500/10'
                    : 'bg-cyan-950/30 border-cyan-500/30 shadow-cyan-500/10'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Radio className={`w-4 h-4 ${isBypass ? 'text-purple-400' : 'text-cyan-400'}`} />
                  <span className={`text-xs font-bold ${isBypass ? 'text-purple-300' : 'text-cyan-300'}`}>
                    ZeroDrop Core
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {isBypass ? 'Bypass Ativo' : isFailover ? 'Failover Ativo' : 'Cabo Monitorado'}
                </span>
              </div>

              {/* Arrow 2 */}
              <ArrowRight
                className={`w-4 h-4 shrink-0 animate-pulse ${isBypass ? 'text-purple-400' : 'text-emerald-400'}`}
              />

              {/* Box 3: Internet Destination */}
              <div
                className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border min-h-[75px] ${
                  isBypass
                    ? 'bg-purple-950/20 border-purple-500/30 text-purple-300'
                    : 'bg-white/[0.03] border-white/10 text-zinc-200'
                }`}
              >
                <Globe className={`w-5 h-5 mb-1 ${isBypass ? 'text-purple-400' : 'text-emerald-400'}`} />
                <span className="text-xs font-semibold">
                  {isBypass ? 'Internet Sem Bloqueios' : 'Internet Global'}
                </span>
                <span className={`text-[10px] font-mono ${isBypass ? 'text-purple-400' : 'text-emerald-400'}`}>
                  {isBypass ? 'Bypass Firewall Ativo' : isFailover ? 'Via 5G Mobile' : 'Via Cabo / Fortinet'}
                </span>
              </div>
            </div>
          </div>

          {/* TELEMETRY BAR */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass-card rounded-xl p-3 border border-white/10 flex flex-col justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Quedas Evitadas</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-bold text-white font-mono">{state.dropsPrevented}</span>
                <span className="text-[10px] text-emerald-400 font-medium">interceptadas</span>
              </div>
            </div>

            <div className="glass-card rounded-xl p-3 border border-white/10 flex flex-col justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Uptime Contínuo</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-bold text-cyan-400 font-mono">{formatUptime(state.uptimeSeconds)}</span>
              </div>
            </div>

            <div className="glass-card rounded-xl p-3 border border-white/10 flex flex-col justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Jitter (Cabo / 5G)</span>
              <div className="flex items-baseline gap-2 mt-1 font-mono">
                <span className="text-sm font-bold text-cyan-400">{state.primaryJitter}ms</span>
                <span className="text-zinc-600">/</span>
                <span className="text-sm font-bold text-amber-400">{state.secondaryJitter}ms</span>
              </div>
            </div>

            <div className="glass-card rounded-xl p-3 border border-white/10 flex flex-col justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Radar de Hotspots</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xs font-bold text-emerald-400 truncate font-mono">
                  {state.secondaryOnline ? 'Conectado' : 'Varrendo Ar...'}
                </span>
              </div>
            </div>
          </div>

          {/* TWO CONNECTION CARDS (BALANCED) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cabo Ethernet Card */}
            <div
              className={`glass-card rounded-xl p-4 flex flex-col justify-between border transition-all ${
                !isFailover && !isBypass && state.primaryOnline
                  ? 'border-cyan-500/40 shadow-lg shadow-cyan-500/5'
                  : 'border-white/10'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg border ${
                      state.primaryOnline
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      <Cable className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-zinc-100">Cabo de Rede (Ethernet)</h2>
                        {state.primaryIP?.startsWith('10.') && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 tracking-wide font-mono">
                            Fortinet
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {state.primaryIP?.startsWith('10.') ? 'Fortinet' : (state.primaryIP ? 'Rede Local' : 'Desconectado')}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                      state.primaryOnline
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                    }`}
                  >
                    {state.primaryOnline ? `ONLINE (${state.primaryLatency || 1} ms)` : 'CABO DESCONECTADO'}
                  </span>
                </div>

                <div className="space-y-2 mt-3 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-zinc-500">Endereço IP:</span>
                    <span className={state.primaryIP ? 'text-zinc-200' : 'text-rose-400 font-bold'}>
                      {state.primaryIP || 'Desconectado (Sem IP)'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-zinc-500">Latência do Cabo:</span>
                    <span className={state.primaryOnline ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {state.primaryOnline ? `${state.primaryLatency || 1} ms (±${state.primaryJitter}ms)` : 'Offline'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-500">Métrica do Windows:</span>
                    <span className="font-semibold">
                      {!isFailover && !isBypass && state.primaryOnline ? (
                        <span className="text-emerald-400">Métrica 10 (Rota Ativa)</span>
                      ) : (
                        <span className="text-zinc-500">Métrica 9999 (Rebaixada)</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${state.primaryIP ? 'bg-cyan-400' : 'bg-rose-500'}`} />
                  {state.primaryIP ? 'Placa Intel Gigabit' : 'Cabo Desplugado'}
                </span>
                <span className="text-zinc-500 font-mono text-[10px]">
                  {state.primaryIP?.startsWith('10.') ? 'Fortinet' : 'Ethernet'}
                </span>
              </div>
            </div>

            {/* Celular 5G Card */}
            <div
              className={`glass-card rounded-xl p-4 flex flex-col justify-between border transition-all ${
                isBypass
                  ? 'border-purple-500/50 shadow-lg shadow-purple-500/10 bg-purple-950/10'
                  : isFailover
                  ? 'border-amber-500/50 shadow-lg shadow-amber-500/10 bg-amber-950/10'
                  : 'border-white/10'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg border ${
                      isBypass
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : isFailover
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-zinc-100">Celular (5G Hotspot / Wi-Fi)</h2>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {state.activeHotspotName || state.secondaryAlias || (state.targetHotspots || []).join(' / ')}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                      state.secondaryOnline
                        ? isBypass
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : isFailover
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-zinc-800 text-zinc-400 border-white/10'
                    }`}
                  >
                    {state.secondaryOnline
                      ? isBypass
                        ? `BYPASS ATIVO (${state.secondaryLatency} ms)`
                        : isFailover
                        ? `ASSUMIU O TRÁFEGO (${state.secondaryLatency} ms)`
                        : `STANDBY PRONTO (${state.secondaryLatency} ms)`
                      : 'Varrendo no ar...'}
                  </span>
                </div>

                <div className="space-y-2 mt-3 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-zinc-500">Ponto Conectado:</span>
                    <span className="text-emerald-400 font-bold truncate max-w-[180px]">
                      {state.secondaryOnline
                        ? (state.activeHotspotName || state.secondaryAlias || 'Celular')
                        : `Procurando ${(state.targetHotspots || []).join(' / ')}`}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-zinc-500">IP / Latência:</span>
                    <span className="text-zinc-200">
                      {state.secondaryIP ? `${state.secondaryIP} (${state.secondaryLatency}ms)` : 'Aguardando sinal'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-500">Métrica do Windows:</span>
                    <span className="font-semibold">
                      {isBypass || isFailover ? (
                        <span className="text-emerald-400">Métrica 10 (Rota Principal)</span>
                      ) : (
                        <span className="text-zinc-400">Métrica 50 (Standby)</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                  <Radar className="w-3.5 h-3.5 animate-spin" />
                  Auto-Conexão Hotspot Ativa
                </span>
                <span className="text-purple-400 font-mono text-[10px]">Sem Bloqueios de Rede</span>
              </div>
            </div>
          </div>

          {/* CONTROLS & SETTINGS */}
          <div className="glass-card rounded-xl p-3 border border-white/10 flex items-center justify-between flex-wrap gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">Sensibilidade:</span>
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                <button
                  onClick={() => handleSetProfile('gamer')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                    state.profile === 'gamer'
                      ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Troca ultra-rápida em 500ms (1 falha)"
                >
                  ⚡ Gamer (500ms)
                </button>
                <button
                  onClick={() => handleSetProfile('balanced')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                    state.profile === 'balanced'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Troca em 1.2s (2 falhas)"
                >
                  ⚖️ Equilibrado (1.2s)
                </button>
                <button
                  onClick={() => handleSetProfile('conservative')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                    state.profile === 'conservative'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Troca em 3s (3 falhas)"
                >
                  🛡️ Seguro (3s)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleMonitoring}
                disabled={!isDualConnected}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all select-none ${
                  !isDualConnected
                    ? 'opacity-50 cursor-not-allowed bg-zinc-800 text-zinc-500 border border-white/5'
                    : state.isMonitoring
                    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 cursor-pointer'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 cursor-pointer'
                }`}
                title={!isDualConnected ? 'Requer Cabo de Rede e Celular conectados simultaneamente' : 'Alternar Proteção ZeroDrop'}
              >
                {!isDualConnected ? (
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                ) : state.isMonitoring ? (
                  <Pause className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                {!isDualConnected ? 'Proteção Bloqueada' : state.isMonitoring ? 'Proteção Ativada' : 'Ativar Proteção'}
              </button>

              <button
                onClick={handleResetMetrics}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all cursor-pointer"
                title="Restaura a tabela de rotas do Windows para o automático"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar Windows
              </button>
            </div>
          </div>

          {/* TELEMETRY TERMINAL LOG */}
          <div className="flex flex-col bg-[#0c0c10] border border-white/10 rounded-xl overflow-hidden min-h-[130px] max-h-[180px]">
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-white/[0.02] border-b border-white/10">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                Registro de Telemetria e Chaveamentos
              </div>
              <button
                onClick={handleClearLogs}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Limpar
              </button>
            </div>

            <div className="flex-1 p-2.5 overflow-y-auto font-mono text-xs space-y-1.5">
              {logs.map((item) => {
                let badgeStyle = 'text-zinc-400 bg-white/5 border-white/10';
                if (item.type === 'success') badgeStyle = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                if (item.type === 'switch') badgeStyle = 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30 font-bold';
                if (item.type === 'fail') badgeStyle = 'text-rose-400 bg-rose-500/15 border-rose-500/30 font-bold';
                if (item.type === 'warn') badgeStyle = 'text-amber-400 bg-amber-500/10 border-amber-500/20';

                return (
                  <div key={item.id} className="flex items-start gap-2.5 leading-relaxed">
                    <span className="text-zinc-600 text-[11px] shrink-0">{item.time}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded border uppercase shrink-0 ${badgeStyle}`}>
                      {item.type}
                    </span>
                    <span
                      className={
                        item.type === 'switch'
                          ? 'text-cyan-300 font-semibold'
                          : item.type === 'fail'
                          ? 'text-rose-300 font-semibold'
                          : item.type === 'success'
                          ? 'text-emerald-300'
                          : 'text-zinc-300'
                      }
                    >
                      {item.text}
                    </span>
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </main>

      {/* 3. SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
          <div className="glass-card rounded-2xl border border-white/15 w-full max-w-2xl overflow-hidden shadow-2xl shadow-black/90 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-white/[0.03] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Configurações do ZeroDrop</h3>
                  <p className="text-[11px] text-zinc-400">Personalize failover, hotspots móveis, métricas de rede e sistema</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-1 px-5 pt-2.5 border-b border-white/10 bg-black/20 text-xs overflow-x-auto">
              {[
                { id: 'failover', label: '⚡ Failover & Tolerância', icon: Sliders },
                { id: 'hotspots', label: '📱 Hotspots Móveis', icon: Wifi },
                { id: 'routes', label: '🌐 Rotas & DNS', icon: Globe },
                { id: 'system', label: '💻 Sistema & Janela', icon: Shield }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSettingsTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-lg font-semibold transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                    settingsTab === tab.id
                      ? 'text-cyan-400 border-cyan-400 bg-white/[0.04]'
                      : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-white/[0.02]'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* TAB 1: FAILOVER */}
              {settingsTab === 'failover' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-zinc-300 font-semibold mb-1.5">Perfil de Velocidade de Resposta</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'gamer', title: '⚡ Gamer (500ms)', desc: '1 falha para acionar (Ultra-rápido)' },
                        { id: 'balanced', title: '⚖️ Equilibrado (1s)', desc: '2 falhas (Recomendado)' },
                        { id: 'conservative', title: '🛡️ Seguro (1.5s)', desc: '3 falhas (Anti-oscilação)' }
                      ].map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleSetProfile(p.id)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            (state.config?.profile || state.profile) === p.id
                              ? 'border-cyan-500/50 bg-cyan-500/15 text-white shadow-sm'
                              : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20'
                          }`}
                        >
                          <div className="font-bold text-zinc-100">{p.title}</div>
                          <div className="text-[10px] text-zinc-400 mt-1">{p.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="glass-pill rounded-xl p-3 border border-white/10">
                      <label className="block text-zinc-300 font-semibold mb-1">Tolerância a Falhas do Cabo</label>
                      <p className="text-[10px] text-zinc-400 mb-2">Quantos pings sem resposta antes de transferir para o 5G</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={state.config?.failThreshold || 2}
                          onChange={(e) => handleUpdateConfig({ failThreshold: Number(e.target.value) })}
                          className="flex-1 accent-cyan-400"
                        />
                        <span className="font-mono font-bold text-cyan-300 w-7 text-right">
                          {state.config?.failThreshold || 2}x
                        </span>
                      </div>
                    </div>

                    <div className="glass-pill rounded-xl p-3 border border-white/10">
                      <label className="block text-zinc-300 font-semibold mb-1">Confirmação de Retorno ao Cabo</label>
                      <p className="text-[10px] text-zinc-400 mb-2">Pings com sucesso para voltar a priorizar o cabo</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="1"
                          max="6"
                          value={state.config?.recoveryThreshold || 3}
                          onChange={(e) => handleUpdateConfig({ recoveryThreshold: Number(e.target.value) })}
                          className="flex-1 accent-emerald-400"
                        />
                        <span className="font-mono font-bold text-emerald-300 w-7 text-right">
                          {state.config?.recoveryThreshold || 3}x
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-pill rounded-xl p-3 border border-white/10">
                    <label className="block text-zinc-300 font-semibold mb-1">Servidor de Teste de Conexão (Ping Host)</label>
                    <p className="text-[10px] text-zinc-400 mb-2">Endereço IP usado para checar a saúde da internet</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {['1.1.1.1', '8.8.8.8', '9.9.9.9'].map((ip) => (
                        <button
                          key={ip}
                          onClick={() => {
                            handleUpdateConfig({ targetHost: ip });
                            window.electronAPI?.setTarget(ip);
                          }}
                          className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-semibold cursor-pointer transition-all ${
                            (state.config?.targetHost || state.targetHost) === ip
                              ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200'
                              : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {ip} {ip === '1.1.1.1' ? '(Cloudflare)' : ip === '8.8.8.8' ? '(Google)' : '(Quad9)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: HOTSPOTS */}
              {settingsTab === 'hotspots' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div>
                      <span className="font-semibold text-zinc-200 block">Radar e Auto-Conexão de Hotspots</span>
                      <span className="text-[10px] text-zinc-400">Conecta automaticamente ao ligar o ponto de acesso no celular</span>
                    </div>
                    <button
                      onClick={() => {
                        const next = !state.autoConnectHotspot;
                        setState((prev) => ({ ...prev, autoConnectHotspot: next }));
                        window.electronAPI?.setAutoConnectHotspot(next);
                      }}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                        state.autoConnectHotspot ? 'bg-emerald-500' : 'bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          state.autoConnectHotspot ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-semibold mb-2">Redes Móveis Cadastradas para Busca</label>
                    <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                      {(state.targetHotspots || []).map((hotspot) => (
                        <div
                          key={hotspot}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-white/10 bg-white/[0.02]"
                        >
                          <div className="flex items-center gap-2">
                            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="font-semibold text-zinc-200">{hotspot}</span>
                            {state.activeHotspotName === hotspot && (
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.2 rounded-full">
                                Conectado Agora
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {state.activeHotspotName !== hotspot && (
                              <button
                                onClick={() => window.electronAPI?.connectHotspot(hotspot)}
                                className="px-2 py-1 text-[10px] font-semibold bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-lg transition-colors cursor-pointer"
                                title="Conectar a este hotspot agora"
                              >
                                Conectar
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveHotspot(hotspot)}
                              className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Remover este hotspot da lista"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add New Hotspot */}
                    <div className="flex items-center gap-2 mt-3">
                      <input
                        type="text"
                        placeholder="Nome do Hotspot (ex: POCO F5 de Jefferson, S21+ de Jefferson)..."
                        value={newHotspotInput}
                        onChange={(e) => setNewHotspotInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddHotspot()}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-cyan-500 placeholder:text-zinc-600 font-sans"
                      />
                      <button
                        onClick={handleAddHotspot}
                        className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm shadow-cyan-600/20 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ROUTES & DNS */}
              {settingsTab === 'routes' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="glass-pill rounded-xl p-3 border border-white/10">
                      <span className="text-zinc-500 text-[10px] block">Métrica do Cabo (Ativo)</span>
                      <span className="text-base font-bold text-emerald-400 font-mono">10</span>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">Prioridade Total</span>
                    </div>
                    <div className="glass-pill rounded-xl p-3 border border-white/10">
                      <span className="text-zinc-500 text-[10px] block">Métrica 5G (Standby)</span>
                      <span className="text-base font-bold text-amber-400 font-mono">50</span>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">Pronto para assumir</span>
                    </div>
                    <div className="glass-pill rounded-xl p-3 border border-white/10">
                      <span className="text-zinc-500 text-[10px] block">Métrica Inativa</span>
                      <span className="text-base font-bold text-zinc-400 font-mono">9999</span>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">Tráfego silenciado</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-2.5">
                    <span className="font-semibold text-zinc-200 block">Ferramentas de Rede do Windows</span>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        onClick={handleFlushDNS}
                        className="px-3.5 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Limpar Cache DNS (Flush DNS)
                      </button>
                      <button
                        onClick={handleResetMetrics}
                        className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restaurar Métricas Automáticas do Windows
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SYSTEM */}
              {settingsTab === 'system' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div>
                      <span className="font-semibold text-zinc-200 block">Minimizar para a Bandeja ao Fechar</span>
                      <span className="text-[10px] text-zinc-400">O botão [X] oculta a janela e mantém o ZeroDrop ativo na bandeja</span>
                    </div>
                    <button
                      onClick={() => handleUpdateConfig({ minimizeToTray: !(state.config?.minimizeToTray ?? true) })}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                        (state.config?.minimizeToTray ?? true) ? 'bg-cyan-600' : 'bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          (state.config?.minimizeToTray ?? true) ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div>
                      <span className="font-semibold text-zinc-200 block">Alertas Sonoros de Comutação</span>
                      <span className="text-[10px] text-zinc-400">Emite aviso sonoro sutil quando a rota transfere de conexão</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => playSound('bypass')}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 cursor-pointer"
                      >
                        Testar Som
                      </button>
                      <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                          soundEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            soundEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-zinc-200 block">Privilégios de Administrador</span>
                      <span className="text-[10px] text-zinc-400">
                        {state.isAdmin
                          ? 'ZeroDrop está em Modo Elevado (Controle total de métricas e rotas).'
                          : 'Permissão limitada. Algumas alterações podem requerer elevação.'}
                      </span>
                    </div>
                    {state.isAdmin ? (
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        🛡️ Elevado
                      </span>
                    ) : (
                      <button
                        onClick={handleRestartAsAdmin}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs transition-all cursor-pointer"
                      >
                        ⚡ Elevar
                      </button>
                    )}
                  </div>

                  {/* Seção Atualizações Automáticas (GitHub) */}
                  <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="font-semibold text-zinc-200 block flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-cyan-400" />
                          Atualizações Automáticas (GitHub)
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          Versão atual: <span className="text-cyan-300 font-mono font-bold">v{state.appVersion || '1.0.0'}</span>
                        </span>
                      </div>
                      <div>
                        {updateStatus.state === 'ready' ? (
                          <button
                            onClick={() => window.electronAPI?.restartAndInstallUpdate()}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Instalar v{updateStatus.version}
                          </button>
                        ) : (
                          <button
                            onClick={() => window.electronAPI?.checkForUpdates()}
                            disabled={updateStatus.state === 'checking' || updateStatus.state === 'downloading'}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${updateStatus.state === 'checking' ? 'animate-spin text-cyan-400' : ''}`} />
                            {updateStatus.state === 'checking' ? 'Verificando...' : 'Buscar Atualizações'}
                          </button>
                        )}
                      </div>
                    </div>

                    {updateStatus.state === 'downloading' && (
                      <div className="mt-2 space-y-1 bg-white/5 p-2 rounded-lg border border-cyan-500/20">
                        <div className="flex justify-between text-[10px] text-cyan-300 font-mono">
                          <span>Baixando v{updateStatus.version} do GitHub...</span>
                          <span>{updateStatus.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                            style={{ width: `${updateStatus.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {updateStatus.state === 'not-available' && (
                      <div className="text-[10px] text-emerald-400/90 flex items-center gap-1 mt-1 font-sans">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        O ZeroDrop já está na versão mais recente disponível no GitHub.
                      </div>
                    )}

                    {updateStatus.state === 'error' && (
                      <div className="text-[10px] text-zinc-400 flex items-center gap-1 mt-1 font-sans">
                        <Info className="w-3 h-3 text-zinc-400" />
                        Repositório conectado via GitHub Releases. Novas versões serão detectadas automaticamente.
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-zinc-200 block">Tutorial de Boas-Vindas</span>
                      <span className="text-[10px] text-zinc-400">Rever a apresentação de recursos e atalhos do ZeroDrop</span>
                    </div>
                    <button
                      onClick={() => {
                        setOnboardingStep(0);
                        setIsOnboardingOpen(true);
                        setIsSettingsOpen(false);
                      }}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                      Rever Tutorial
                    </button>
                  </div>

                  <div className="pt-2 text-center text-zinc-500 text-[11px]">
                    ZeroDrop Engine v{state.appVersion || '1.0.0'} • Proteção Dual-WAN & Bypass Fortinet
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-white/[0.02] border-t border-white/10 flex justify-end">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg text-xs transition-all shadow-sm shadow-cyan-600/20 cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARDING TUTORIAL MODAL */}
      {isOnboardingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#101014] border border-white/15 rounded-2xl w-full max-w-xl shadow-2xl shadow-cyan-950/40 overflow-hidden flex flex-col animate-scaleUp">
            
            {/* Header com indicador de progresso */}
            <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  Tutorial de Primeiro Acesso
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-zinc-500 font-semibold">
                  {onboardingStep + 1} de {tutorialSteps.length}
                </span>
                <button
                  onClick={handleFinishOnboarding}
                  className="text-zinc-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                  title="Fechar Tutorial"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conteúdo do Slide */}
            <div className="p-6 space-y-4">
              {/* Badge da funcionalidade */}
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${tutorialSteps[onboardingStep].badgeColor}`}>
                  {tutorialSteps[onboardingStep].badge}
                </span>
                {/* Dots de navegação */}
                <div className="flex items-center gap-1.5">
                  {tutorialSteps.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setOnboardingStep(idx)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        idx === onboardingStep
                          ? 'w-6 bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-sm shadow-cyan-400/50'
                          : 'w-1.5 bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Título com ícone em destaque */}
              <div className="flex items-start gap-4 pt-1">
                {(() => {
                  const IconComp = tutorialSteps[onboardingStep].icon;
                  return (
                    <div className={`p-3.5 rounded-2xl border shrink-0 ${tutorialSteps[onboardingStep].iconColor}`}>
                      <IconComp className="w-7 h-7" />
                    </div>
                  );
                })()}
                <div>
                  <h3 className="text-lg font-bold text-white tracking-wide">
                    {tutorialSteps[onboardingStep].title}
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed mt-1.5">
                    {tutorialSteps[onboardingStep].desc}
                  </p>
                </div>
              </div>

              {/* Destaques / Benefícios principais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2">
                {tutorialSteps[onboardingStep].highlights.map((item, i) => (
                  <div key={i} className="p-2.5 rounded-xl border border-white/10 bg-white/[0.03]">
                    <div className="text-[10px] text-zinc-400 font-medium">{item.label}</div>
                    <div className="text-xs font-semibold text-cyan-200 mt-0.5">{item.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer com botões de navegação */}
            <div className="px-6 py-4 bg-white/[0.02] border-t border-white/10 flex items-center justify-between">
              <button
                onClick={handleFinishOnboarding}
                className="text-xs text-zinc-500 hover:text-zinc-300 font-semibold cursor-pointer transition-colors"
              >
                Pular Introdução
              </button>

              <div className="flex items-center gap-2">
                {onboardingStep > 0 && (
                  <button
                    onClick={() => setOnboardingStep((s) => s - 1)}
                    className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                  </button>
                )}

                {onboardingStep < tutorialSteps.length - 1 ? (
                  <button
                    onClick={() => setOnboardingStep((s) => s + 1)}
                    className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/20 cursor-pointer"
                  >
                    Próximo <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleFinishOnboarding}
                    className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-500/25 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Começar a Usar o ZeroDrop
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
