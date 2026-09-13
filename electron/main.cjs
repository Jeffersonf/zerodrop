const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const os = require('os');
const net = require('net');
const http = require('http');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

app.setName('ZeroDrop');
const appDataDir = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'ZeroDropEngine');
if (!fs.existsSync(appDataDir)) {
  try { fs.mkdirSync(appDataDir, { recursive: true }); } catch (_) {}
}
try {
  app.setPath('userData', appDataDir);
} catch (e) {
  console.error('userData setPath error:', e);
}

let mainWindow = null;
let tray = null;
let isMonitoring = true;
let currentMode = 'NORMAL'; // 'NORMAL' | 'FAILOVER' | 'BYPASS'
let routeStrategy = 'AUTO'; // 'AUTO' | 'FORCE_MOBILE' | 'FORCE_CABLE'
let failCount = 0;
let recoveryCount = 0;
let primaryAlias = 'Ethernet';
let secondaryAlias = 'Wi-Fi';
let primaryIP = '';
let secondaryIP = '';
let metricsInitialized = false;
let dropsPrevented = 0;
const appStartTime = Date.now();

// Hotspot Auto-Connect Watchdog
let autoConnectHotspot = true;
let targetHotspots = ['S21+ de Jefferson', 'S21+', 'POCO F5 de Jefferson'];
let lastHotspotScan = 0;
let isConnectingHotspot = false;
let activeHotspotName = '';
const hotspotFailureCooldown = new Map();

// Roteamento por Aplicativo (Per-App Rules)
let appRules = [];

// Configurações & Presets
let config = {
  profile: 'balanced',
  checkInterval: 1000,
  failThreshold: 2,
  recoveryThreshold: 3,
  primaryActiveMetric: 10,
  primaryInactiveMetric: 9999,
  secondaryActiveMetric: 10,
  secondaryStandbyMetric: 50,
  targetHost: '1.1.1.1',
  targetPort: 80,
  minimizeToTray: true,
  soundEnabled: true
};

const configFile = path.join(appDataDir, 'config.json');
function loadSavedConfig() {
  try {
    if (fs.existsSync(configFile)) {
      const data = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      if (data.config) config = { ...config, ...data.config };
      if (Array.isArray(data.targetHotspots) && data.targetHotspots.length > 0) {
        targetHotspots = data.targetHotspots;
        if (!targetHotspots.includes('S21+ de Jefferson') && !targetHotspots.includes('S21+')) {
          targetHotspots.unshift('S21+ de Jefferson');
        }
      }
      if (typeof data.autoConnectHotspot === 'boolean') autoConnectHotspot = data.autoConnectHotspot;
      if (Array.isArray(data.appRules)) appRules = data.appRules;
    }
  } catch (e) {
    console.error('Error reading config file:', e);
  }
}
loadSavedConfig();

function saveCurrentConfig() {
  try {
    fs.writeFileSync(configFile, JSON.stringify({ config, targetHotspots, autoConnectHotspot, appRules }, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving config file:', e);
  }
}

let monitorTimer = null;
function startMonitoringTimer() {
  if (monitorTimer) clearInterval(monitorTimer);
  monitorTimer = setInterval(monitorTick, config.checkInterval || 1000);
}

let isAdmin = false;
function checkAdminStatus() {
  exec('net session', (err) => {
    isAdmin = !err;
  });
}
checkAdminStatus();

// --- AUTO-UPDATER (GitHub Releases) ---
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let updateStatus = {
  state: 'idle', // 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'not-available' | 'error'
  version: '',
  progress: 0,
  bytesPerSecond: 0,
  transferred: 0,
  total: 0,
  error: ''
};

function sendUpdateStatus() {
  sendToWindow('update-status', updateStatus);
}

autoUpdater.on('checking-for-update', () => {
  updateStatus = { ...updateStatus, state: 'checking', error: '' };
  sendUpdateStatus();
  sendLog('info', '🔍 Verificando se há atualizações no GitHub...');
});

autoUpdater.on('update-available', (info) => {
  updateStatus = {
    ...updateStatus,
    state: 'available',
    version: info?.version || '',
    error: ''
  };
  sendUpdateStatus();
  sendLog('switch', `🚀 Nova versão v${info?.version} encontrada! Baixando atualização em segundo plano...`);
});

autoUpdater.on('update-not-available', (info) => {
  updateStatus = {
    ...updateStatus,
    state: 'not-available',
    version: app.getVersion(),
    error: ''
  };
  sendUpdateStatus();
  sendLog('info', `✅ ZeroDrop está na versão mais recente (v${app.getVersion()}).`);
});

autoUpdater.on('download-progress', (progressObj) => {
  updateStatus = {
    ...updateStatus,
    state: 'downloading',
    progress: Math.round(progressObj.percent || 0),
    bytesPerSecond: Math.round(progressObj.bytesPerSecond || 0),
    transferred: progressObj.transferred || 0,
    total: progressObj.total || 0
  };
  sendUpdateStatus();
});

autoUpdater.on('update-downloaded', (info) => {
  updateStatus = {
    ...updateStatus,
    state: 'ready',
    version: info?.version || '',
    progress: 100
  };
  sendUpdateStatus();
  sendLog('success', `🎉 Versão v${info?.version} pronta! Ela será aplicada ao reiniciar.`);
});

autoUpdater.on('error', (err) => {
  const errMsg = err?.message || 'Erro no atualizador';
  updateStatus = { ...updateStatus, state: 'error', error: errMsg };
  sendUpdateStatus();
  if (errMsg.includes('404') || errMsg.includes('net::ERR') || errMsg.includes('ENOTFOUND')) {
    console.warn('[autoUpdater] Repositório sem releases ou offline:', errMsg);
  } else {
    sendLog('warn', `⚠️ Atualizador: ${errMsg.slice(0, 90)}`);
  }
});

function checkForUpdates() {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[autoUpdater] checkForUpdates catch:', err.message);
    });
  } else {
    console.log('[autoUpdater] Modo dev: simulando verificação.');
    sendLog('info', `ℹ️ Modo de Desenvolvimento (v${app.getVersion()}) - Auto-Update ativo quando instalado.`);
  }
}

const primaryHistory = [];
const secondaryHistory = [];
const MAX_HISTORY = 40;

function setInterfaceMetric(alias, metric) {
  if (!alias) return;
  const cmd = `powershell -NoProfile -Command "Set-NetIPInterface -InterfaceAlias '${alias}' -InterfaceMetric ${metric}"`;
  exec(cmd, (err) => {
    if (err) {
      console.error(`Error setting metric for ${alias}:`, err);
      sendLog('fail', `Aviso: Falha de permissão ao alterar rota de ${alias}. Clique em 'Reiniciar como Admin'.`);
    }
  });
}

function resetInterfaceMetric(alias) {
  if (!alias) return;
  const cmd = `powershell -NoProfile -Command "Set-NetIPInterface -InterfaceAlias '${alias}' -AutomaticMetric Enabled"`;
  exec(cmd);
}

function flushDNS() {
  exec('powershell -NoProfile -Command "Clear-DnsClientCache"');
}

// --- ROTEAMENTO POR APLICATIVO & FIREWALL RULES ---

function getRuleInternalName(id) {
  const cleanId = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return `ZeroDrop_App_${cleanId}`;
}

function removeSingleAppRule(ruleId) {
  return new Promise((resolve) => {
    const ruleName = getRuleInternalName(ruleId);
    const cmd = `powershell -NoProfile -Command "Remove-NetFirewallRule -Name '${ruleName}' -ErrorAction SilentlyContinue"`;
    exec(cmd, () => resolve());
  });
}

function applySingleAppRule(rule) {
  return new Promise((resolve) => {
    if (!rule || !rule.id || !rule.path) return resolve();
    const ruleName = getRuleInternalName(rule.id);
    const cleanPath = rule.path.replace(/"/g, '`"');
    const appLabel = rule.name || path.basename(rule.path);

    // Remove qualquer regra prévia com esse identificador
    const removeCmd = `powershell -NoProfile -Command "Remove-NetFirewallRule -Name '${ruleName}' -ErrorAction SilentlyContinue"`;
    exec(removeCmd, () => {
      if (!rule.enabled || rule.target === 'BOTH') {
        return resolve();
      }

      let blockedInterface = '';
      let targetDesc = '';
      if (rule.target === 'ETHERNET') {
        // Travado no Cabo -> Bloqueia na placa Wi-Fi/Celular
        blockedInterface = secondaryAlias || 'Wi-Fi';
        targetDesc = 'Apenas Cabo';
      } else if (rule.target === 'WIFI') {
        // Travado no Wi-Fi/Celular -> Bloqueia na placa de Cabo
        blockedInterface = primaryAlias || 'Ethernet';
        targetDesc = 'Apenas Wi-Fi/Celular';
      }

      if (!blockedInterface) return resolve();

      const addCmd = `powershell -NoProfile -Command "New-NetFirewallRule -Name '${ruleName}' -DisplayName 'ZeroDrop [${appLabel}] -> ${targetDesc}' -Group 'ZeroDrop App Rules' -Direction Outbound -Action Block -Program '${cleanPath}' -InterfaceAlias '${blockedInterface}' -ErrorAction SilentlyContinue"`;
      exec(addCmd, (err) => {
        if (err) {
          console.warn(`[Firewall] Erro na regra ${appLabel}:`, err.message);
        }
        resolve();
      });
    });
  });
}

async function syncAllAppRules() {
  if (!Array.isArray(appRules) || appRules.length === 0) return;
  for (const rule of appRules) {
    await applySingleAppRule(rule);
  }
}

// --- MICRO-PROXIES DE INTERFACE (Portas 28081 & 28082) ---
let proxyServerPrimary = null;
let proxyServerSecondary = null;

function startInterfaceProxies() {
  function createBoundProxy(port, getIP, label) {
    const srv = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`ZeroDrop Micro-Proxy (${label}) Ativo\n`);
    });

    srv.on('connect', (req, clientSocket, head) => {
      const [host, portStr] = req.url.split(':');
      const targetPort = parseInt(portStr, 10) || 443;
      const targetHost = host;
      const localIP = getIP();

      const connectOpts = { host: targetHost, port: targetPort };
      if (localIP && !localIP.startsWith('169.254.') && !localIP.startsWith('127.')) {
        connectOpts.localAddress = localIP;
      }

      const serverSocket = net.connect(connectOpts, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head && head.length) serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
      });

      serverSocket.on('error', () => {
        try { clientSocket.end(); } catch (_) {}
      });
      clientSocket.on('error', () => {
        try { serverSocket.end(); } catch (_) {}
      });
    });

    srv.on('error', (err) => {
      console.warn(`[Proxy ${label}] porta ${port}:`, err.message);
    });

    try {
      srv.listen(port, '127.0.0.1', () => {
        console.log(`[Proxy] Micro-proxy ZeroDrop (${label}) escutando em 127.0.0.1:${port}`);
      });
    } catch (e) {
      console.warn(`[Proxy] Falha ao iniciar proxy ${label}:`, e);
    }
    return srv;
  }

  proxyServerPrimary = createBoundProxy(28081, () => primaryIP, 'Cabo');
  proxyServerSecondary = createBoundProxy(28082, () => secondaryIP, 'Wi-Fi');
}

function probeTarget(localIP, host, port, timeout = 1000) {
  return new Promise((resolve) => {
    const start = Date.now();
    let resolved = false;

    const socket = net.createConnection({ host, port, localAddress: localIP }, () => {
      if (!resolved) {
        resolved = true;
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ ok: true, latency });
      }
    });

    socket.setTimeout(timeout);

    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve({ ok: false, latency: null });
      }
    });

    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve({ ok: false, latency: null });
      }
    });
  });
}

async function probeAdapter(ip) {
  if (!ip || ip.startsWith('169.254.') || ip.startsWith('127.')) {
    return { ok: false, latency: null };
  }
  let res = await probeTarget(ip, config.targetHost, config.targetPort, 1000);
  if (res.ok) return res;
  return await probeTarget(ip, '8.8.8.8', 53, 1000);
}

function calculateJitter(history) {
  const valid = history.filter((v) => v !== null && v !== undefined);
  if (valid.length < 2) return 0;
  let sumDiff = 0;
  for (let i = 1; i < valid.length; i++) {
    sumDiff += Math.abs(valid[i] - valid[i - 1]);
  }
  return Math.round(sumDiff / (valid.length - 1));
}

function calculateLoss(history) {
  if (history.length === 0) return 0;
  const lost = history.filter((v) => v === null).length;
  return Math.round((lost / history.length) * 100);
}

function sendToWindow(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}

function sendLog(type, text) {
  const time = new Date().toLocaleTimeString('pt-BR');
  sendToWindow('log-event', { time, type, text });
}

let lastWifiCheck = 0;
function updateCurrentWifiInfo() {
  const now = Date.now();
  if (now - lastWifiCheck < 1500) return;
  lastWifiCheck = now;

  exec('netsh wlan show interfaces', (err, stdout) => {
    if (err || !stdout) return;
    const ssidMatch = stdout.match(/^\s*SSID\s*:\s*(.+)$/m);
    const stateMatch = stdout.match(/^\s*Estado\s*:\s*(.+)$/m) || stdout.match(/^\s*State\s*:\s*(.+)$/m);

    if (ssidMatch && ssidMatch[1]) {
      const isConnected = stateMatch && (stateMatch[1].toLowerCase().includes('conectado') || stateMatch[1].toLowerCase().includes('connected'));
      if (isConnected) {
        const detected = ssidMatch[1].trim();
        if (detected && detected !== activeHotspotName) {
          activeHotspotName = detected;
          sendLog('info', `📱 Ponto Wi-Fi conectado: "${detected}"`);
        }
      } else {
        activeHotspotName = '';
      }
    }
  });
}

function checkAndAutoConnectHotspot() {
  if (!autoConnectHotspot || isConnectingHotspot) return;
  const now = Date.now();
  if (now - lastHotspotScan < 2500) return;
  lastHotspotScan = now;

  exec('netsh wlan show networks', (err, stdout) => {
    const rawOutput = stdout || '';

    // Extrai os SSIDs que o Windows realmente detecta no ar
    const visibleSSIDs = new Set();
    const lines = rawOutput.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*SSID\s+\d*\s*:\s*(.+)$/i);
      if (match && match[1]) {
        const ssid = match[1].trim();
        if (ssid) visibleSSIDs.add(ssid);
      }
    }

    // Hotspots configurados que não falharam recentemente
    const availableTargets = targetHotspots.filter((h) => {
      const cooldownUntil = hotspotFailureCooldown.get(h) || 0;
      return now >= cooldownUntil;
    });

    if (availableTargets.length === 0) return;

    // Prioridade 1: Hotspot que está visível no ar neste momento
    let candidate = availableTargets.find((h) => visibleSSIDs.has(h));

    // Prioridade 2: Se nenhum estiver na lista de varredura passiva do Windows,
    // tenta os perfis salvos elegíveis na ordem de preferência
    if (!candidate && availableTargets.length > 0) {
      candidate = availableTargets[0];
    }

    if (!candidate) return;

    isConnectingHotspot = true;
    sendLog('switch', `📱 Tentando conectar ao hotspot "${candidate}"...`);

    exec(`netsh wlan connect name="${candidate}"`, (connectErr, connectStdout, connectStderr) => {
      const output = (connectStdout || '') + (connectStderr || '');
      const isUnavailable =
        connectErr ||
        output.includes('não está disponível') ||
        output.includes('not available') ||
        output.includes('Falha') ||
        output.includes('failed');

      if (isUnavailable) {
        // Coloca este hotspot em cooldown de 25 segundos para não travar os outros
        hotspotFailureCooldown.set(candidate, Date.now() + 25000);
        sendLog('warn', `⚠️ Hotspot "${candidate}" indisponível no ar. Verificando próximo...`);
        isConnectingHotspot = false;

        // Se houver outro hotspot pronto na lista, tenta em 600ms
        const nextReady = targetHotspots.filter((h) => {
          const cd = hotspotFailureCooldown.get(h) || 0;
          return Date.now() >= cd;
        });
        if (nextReady.length > 0) {
          lastHotspotScan = 0;
          setTimeout(checkAndAutoConnectHotspot, 600);
        }
        return;
      }

      // Conexão aceita pelo Windows!
      hotspotFailureCooldown.delete(candidate);
      sendLog('success', `📡 Conexão aceita por "${candidate}". Aguardando IP...`);
      setTimeout(() => {
        isConnectingHotspot = false;
        updateCurrentWifiInfo();
      }, 3500);
    });
  });
}

function applyStrategy(strategy) {
  routeStrategy = strategy;
  if (strategy === 'FORCE_MOBILE') {
    currentMode = 'BYPASS';
    setInterfaceMetric(secondaryAlias, config.secondaryActiveMetric);
    setInterfaceMetric(primaryAlias, config.primaryInactiveMetric);
    flushDNS();
    sendLog('switch', '🔓 MODO BYPASS ATIVADO: Tráfego forçado no Celular (Fortinet ignorado)!');
  } else if (strategy === 'FORCE_CABLE') {
    currentMode = 'NORMAL';
    setInterfaceMetric(primaryAlias, config.primaryActiveMetric);
    setInterfaceMetric(secondaryAlias, config.secondaryStandbyMetric);
    flushDNS();
    sendLog('switch', '🌐 Rota travada exclusivamente no Cabo de Rede.');
  } else {
    // AUTO
    routeStrategy = 'AUTO';
    sendLog('info', '🟢 Modo Automático Ativado: Failover com redundância contínua.');
    // Restaura estado com base na saúde atual
    if (primaryIP) {
      currentMode = 'NORMAL';
      setInterfaceMetric(primaryAlias, config.primaryActiveMetric);
      if (secondaryAlias) setInterfaceMetric(secondaryAlias, config.secondaryStandbyMetric);
      flushDNS();
    }
  }
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: `ZeroDrop — ${routeStrategy === 'FORCE_MOBILE' ? '🔓 Bypass (Celular 5G)' : (currentMode === 'NORMAL' ? '🟢 Cabo Ativo' : '🚨 5G Failover')}`, enabled: false },
    { type: 'separator' },
    {
      label: '🟢 Modo Automático (Failover)',
      type: 'radio',
      checked: routeStrategy === 'AUTO',
      click: () => applyStrategy('AUTO')
    },
    {
      label: '📱 Forçar Celular (Bypass Firewall)',
      type: 'radio',
      checked: routeStrategy === 'FORCE_MOBILE',
      click: () => applyStrategy('FORCE_MOBILE')
    },
    {
      label: '🌐 Forçar Cabo (Rede Local)',
      type: 'radio',
      checked: routeStrategy === 'FORCE_CABLE',
      click: () => applyStrategy('FORCE_CABLE')
    },
    { type: 'separator' },
    {
      label: 'Abrir Painel ZeroDrop',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Restaurar Padrões do Windows',
      click: () => {
        if (primaryAlias) resetInterfaceMetric(primaryAlias);
        if (secondaryAlias) resetInterfaceMetric(secondaryAlias);
        flushDNS();
        sendLog('warn', 'Métricas restauradas via bandeja.');
      }
    },
    { type: 'separator' },
    {
      label: 'Encerrar ZeroDrop',
      click: () => app.quit()
    }
  ]);
  tray.setContextMenu(menu);
}

async function monitorTick() {
  const interfaces = os.networkInterfaces();

  let foundEthIP = null;
  let foundWifiIP = null;
  let ethName = 'Ethernet';
  let wifiName = 'Wi-Fi';

  for (const [name, addrs] of Object.entries(interfaces)) {
    const ipv4 = addrs.find((a) => a.family === 'IPv4' && !a.internal);
    const n = name.toLowerCase();

    if (n.includes('ethernet')) {
      ethName = name;
      if (ipv4 && !ipv4.address.startsWith('169.254.')) {
        foundEthIP = ipv4.address;
      }
    } else if (n.includes('wi-fi') || n.includes('wlan') || n.includes('celular')) {
      wifiName = name;
      if (ipv4 && !ipv4.address.startsWith('169.254.')) {
        foundWifiIP = ipv4.address;
      }
    }
  }

  primaryAlias = ethName;
  primaryIP = foundEthIP;

  secondaryAlias = wifiName;
  secondaryIP = foundWifiIP;

  if (!secondaryIP) {
    activeHotspotName = '';
    checkAndAutoConnectHotspot();
  } else {
    updateCurrentWifiInfo();
  }

  const primProbe = primaryIP ? await probeAdapter(primaryIP) : { ok: false, latency: null };
  const secProbe = secondaryIP ? await probeAdapter(secondaryIP) : { ok: false, latency: null };

  primaryHistory.push(primProbe.ok ? primProbe.latency : null);
  if (primaryHistory.length > MAX_HISTORY) primaryHistory.shift();

  if (secondaryIP) {
    secondaryHistory.push(secProbe.ok ? secProbe.latency : null);
    if (secondaryHistory.length > MAX_HISTORY) secondaryHistory.shift();
  }

  // Inicialização de métricas na primeira execução
  if (!metricsInitialized && routeStrategy === 'AUTO') {
    if (primProbe.ok) {
      setInterfaceMetric(primaryAlias, config.primaryActiveMetric);
      if (secondaryAlias) setInterfaceMetric(secondaryAlias, config.secondaryStandbyMetric);
    }
    metricsInitialized = true;
  }

  // 3. Lógica com base na Estratégia Escolhida
  if (routeStrategy === 'FORCE_MOBILE') {
    currentMode = 'BYPASS';
    // Modo fixo no celular (Bypass de Firewall) - não alterna sozinho
  } else if (routeStrategy === 'FORCE_CABLE') {
    currentMode = 'NORMAL';
    // Modo fixo no cabo
  } else if (!isMonitoring) {
    currentMode = 'PAUSED';
    // Proteção desativada pelo usuário
  } else {
    // Modo AUTO (Failover Dinâmico)
    if (currentMode === 'NORMAL') {
      if (primProbe.ok) {
        failCount = 0;
      } else {
        if (!primaryIP) {
          failCount = config.failThreshold;
          sendLog('warn', '🚨 CABO DE REDE DESCONECTADO (Link Físico Perdido)!');
        } else {
          failCount++;
          sendLog('warn', `Alerta: Cabo sem resposta (${failCount}/${config.failThreshold})`);
        }

        if (failCount >= config.failThreshold) {
          if (secProbe.ok && secondaryAlias) {
            setInterfaceMetric(primaryAlias, config.primaryInactiveMetric);
            setInterfaceMetric(secondaryAlias, config.secondaryActiveMetric);
            flushDNS();
            currentMode = 'FAILOVER';
            dropsPrevented++;
            recoveryCount = 0;
            sendLog('switch', `⚡ QUEDA DO CABO EVITADA! ZeroDrop transferiu o tráfego para ${activeHotspotName || secondaryAlias} (5G)`);
            updateTrayMenu();
          } else if (secondaryAlias) {
            sendLog('fail', 'Cabo falhou, mas celular também está sem resposta!');
          } else {
            sendLog('fail', 'Cabo falhou e celular não está conectado! Varrendo Hotspot...');
            checkAndAutoConnectHotspot();
          }
        }
      }
    } else if (currentMode === 'FAILOVER') {
      if (primProbe.ok && primaryIP) {
        recoveryCount++;
        sendLog('info', `Cabo respondendo (${primProbe.latency}ms) - Confirmando estabilidade (${recoveryCount}/${config.recoveryThreshold})`);

        if (recoveryCount >= config.recoveryThreshold) {
          setInterfaceMetric(primaryAlias, config.primaryActiveMetric);
          if (secondaryAlias) setInterfaceMetric(secondaryAlias, config.secondaryStandbyMetric);
          flushDNS();
          currentMode = 'NORMAL';
          failCount = 0;
          sendLog('success', '🛡️ CABO DE REDE VOLTOU E ESTABILIZOU! Prioridade restabelecida no Cabo.');
          updateTrayMenu();
        }
      } else {
        recoveryCount = 0;
      }
    }
  }

  const primJitter = calculateJitter(primaryHistory);
  const primLoss = calculateLoss(primaryHistory);
  const secJitter = calculateJitter(secondaryHistory);
  const secLoss = calculateLoss(secondaryHistory);

  sendToWindow('status-update', {
    mode: currentMode,
    routeStrategy,
    isMonitoring,
    primaryAlias,
    primaryIP,
    primaryOnline: primProbe.ok,
    primaryLatency: primProbe.latency,
    primaryJitter: primJitter,
    primaryLoss: primLoss,
    primaryHistory: [...primaryHistory],
    secondaryAlias,
    secondaryIP,
    activeHotspotName: activeHotspotName || '',
    autoConnectHotspot,
    targetHotspots: [...targetHotspots],
    config: { ...config },
    secondaryOnline: secProbe.ok,
    secondaryLatency: secProbe.latency,
    secondaryJitter: secJitter,
    secondaryLoss: secLoss,
    secondaryHistory: [...secondaryHistory],
    failCount,
    recoveryCount,
    dropsPrevented,
    uptimeSeconds: Math.floor((Date.now() - appStartTime) / 1000),
    isAdmin,
    profile: config.profile,
    targetHost: config.targetHost,
    appVersion: app.getVersion(),
    appRules: [...appRules]
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, '../public/icon.png');

  mainWindow = new BrowserWindow({
    title: 'ZeroDrop Engine',
    width: 1020,
    height: 760,
    minWidth: 840,
    minHeight: 640,
    resizable: true,
    center: true,
    frame: false,
    icon: iconPath,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const distPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(distPath);

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show();
    mainWindow.focus();
    startMonitoringTimer();
    sendUpdateStatus();
    setTimeout(checkForUpdates, 3500);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '../public/icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);
    tray.setToolTip('ZeroDrop — Hitless Dual-WAN Engine');
    updateTrayMenu();

    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) mainWindow.focus();
        else mainWindow.show();
      }
    });
  } catch (err) {
    console.error('Tray error:', err);
  }
}

// IPC Handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.on('window-close', () => {
  if (config.minimizeToTray && tray) {
    if (mainWindow) mainWindow.hide();
  } else {
    app.quit();
  }
});

ipcMain.on('update-settings', (event, newSettings) => {
  if (newSettings.config) {
    const prevInterval = config.checkInterval;
    config = { ...config, ...newSettings.config };
    if (config.checkInterval !== prevInterval) {
      startMonitoringTimer();
    }
  }
  if (Array.isArray(newSettings.targetHotspots)) {
    targetHotspots = newSettings.targetHotspots;
  }
  if (typeof newSettings.autoConnectHotspot === 'boolean') {
    autoConnectHotspot = newSettings.autoConnectHotspot;
  }
  saveCurrentConfig();
  sendLog('info', '⚙️ Configurações salvas e aplicadas.');
});

ipcMain.on('flush-dns', () => {
  flushDNS();
  sendLog('success', '🧹 Cache DNS do Windows limpo com sucesso.');
});

ipcMain.on('add-hotspot', (event, name) => {
  if (name && typeof name === 'string') {
    const trimmed = name.trim();
    if (trimmed && !targetHotspots.includes(trimmed)) {
      targetHotspots.push(trimmed);
      saveCurrentConfig();
      sendLog('info', `📱 Hotspot "${trimmed}" adicionado à lista.`);
    }
  }
});

ipcMain.on('remove-hotspot', (event, name) => {
  targetHotspots = targetHotspots.filter((h) => h !== name);
  saveCurrentConfig();
  sendLog('info', `📱 Hotspot "${name}" removido da lista.`);
});

ipcMain.on('connect-hotspot', (event, name) => {
  if (!name || typeof name !== 'string') return;
  const target = name.trim();
  sendLog('info', `📡 Solicitando conexão ao hotspot "${target}"...`);
  isConnectingHotspot = true;
  exec(`netsh wlan connect name="${target}"`, (err, stdout, stderr) => {
    const output = (stdout || '') + (stderr || '');
    if (err || output.includes('não está disponível') || output.includes('not available')) {
      sendLog('warn', `⚠️ Hotspot "${target}" não está disponível no ar.`);
      hotspotFailureCooldown.set(target, Date.now() + 15000);
      isConnectingHotspot = false;
    } else {
      sendLog('success', `📡 Conectando ao hotspot "${target}"...`);
      hotspotFailureCooldown.delete(target);
      setTimeout(() => {
        isConnectingHotspot = false;
        updateCurrentWifiInfo();
      }, 3500);
    }
  });
});

ipcMain.on('set-monitoring', (event, enabled) => {
  isMonitoring = enabled;
  if (!enabled) {
    currentMode = 'PAUSED';
    if (primaryAlias) resetInterfaceMetric(primaryAlias);
    if (secondaryAlias) resetInterfaceMetric(secondaryAlias);
    flushDNS();
    sendLog('warn', '⚪ Proteção ZeroDrop DESATIVADA. Métricas de rede restauradas ao padrão do Windows.');
  } else {
    currentMode = 'NORMAL';
    if (primaryAlias) setInterfaceMetric(primaryAlias, config.primaryActiveMetric);
    if (secondaryAlias) setInterfaceMetric(secondaryAlias, config.secondaryStandbyMetric);
    flushDNS();
    sendLog('success', '🟢 Proteção ZeroDrop ATIVADA! Redundância automática em operação.');
  }
  updateTrayMenu();
});

ipcMain.on('set-route-strategy', (event, strategy) => {
  applyStrategy(strategy);
});

ipcMain.on('set-auto-connect', (event, enabled) => {
  autoConnectHotspot = enabled;
  sendLog('info', enabled ? 'Auto-Conexão de Hotspots ativada.' : 'Auto-Conexão de Hotspots desativada.');
});

ipcMain.on('set-profile', (event, profileName) => {
  config.profile = profileName;
  if (profileName === 'gamer') {
    config.checkInterval = 500;
    config.failThreshold = 1;
    config.recoveryThreshold = 3;
    sendLog('info', 'Perfil ativado: Modo Gamer (Troca ultra-rápida em 500ms).');
  } else if (profileName === 'conservative') {
    config.checkInterval = 1500;
    config.failThreshold = 3;
    config.recoveryThreshold = 4;
    sendLog('info', 'Perfil ativado: Modo Conservador (Filtro anti-flapping).');
  } else {
    config.profile = 'balanced';
    config.checkInterval = 1000;
    config.failThreshold = 2;
    config.recoveryThreshold = 3;
    sendLog('info', 'Perfil ativado: Modo Equilibrado (1.2s).');
  }
  startMonitoringTimer();
  saveCurrentConfig();
});

ipcMain.on('set-target', (event, host) => {
  config.targetHost = host || '1.1.1.1';
  saveCurrentConfig();
  sendLog('info', `Servidor de teste de rota alterado para: ${config.targetHost}`);
});

ipcMain.on('reset-metrics', () => {
  routeStrategy = 'AUTO';
  if (primaryAlias) resetInterfaceMetric(primaryAlias);
  if (secondaryAlias) resetInterfaceMetric(secondaryAlias);
  flushDNS();
  sendLog('warn', 'Métricas do Windows restauradas para o automático.');
  updateTrayMenu();
});

ipcMain.on('restart-as-admin', () => {
  const electronExe = process.execPath;
  const projectDir = path.resolve(__dirname, '..');
  const psCmd = `Start-Process -FilePath '${electronExe}' -ArgumentList '.' -WorkingDirectory '${projectDir}' -Verb RunAs`;
  exec(`powershell -NoProfile -Command "${psCmd}"`, (err) => {
    if (!err) {
      setTimeout(() => {
        app.quit();
      }, 500);
    }
  });
});

ipcMain.on('check-for-updates', () => {
  checkForUpdates();
});

ipcMain.on('restart-and-install-update', () => {
  if (updateStatus.state === 'ready') {
    sendLog('switch', '⚡ Reiniciando o ZeroDrop para aplicar a atualização...');
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 800);
  }
});

ipcMain.handle('get-running-apps', async () => {
  return new Promise((resolve) => {
    const psCmd = `Get-Process | Where-Object { $_.Path -and $_.Path -notmatch 'Windows\\\\System32|Windows\\\\SysWOW64' } | Select-Object -Unique ProcessName, Path | Sort-Object ProcessName | ConvertTo-Json -Compress`;
    exec(`powershell -NoProfile -Command "${psCmd}"`, { maxBuffer: 1024 * 1024 * 2 }, (err, stdout) => {
      if (err || !stdout || !stdout.trim()) {
        return resolve([]);
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const formatted = list
          .filter((p) => p && p.Path && p.ProcessName)
          .map((p) => ({
            name: p.ProcessName,
            path: p.Path
          }));
        resolve(formatted);
      } catch (e) {
        resolve([]);
      }
    });
  });
});

ipcMain.handle('select-app-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar Executável para Roteamento',
    properties: ['openFile'],
    filters: [
      { name: 'Aplicativos (.exe)', extensions: ['exe'] },
      { name: 'Todos os Arquivos', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }

  const selectedPath = result.filePaths[0];
  const filename = path.basename(selectedPath, path.extname(selectedPath));
  return {
    name: filename,
    path: selectedPath
  };
});

ipcMain.handle('save-app-rules', async (event, newRules) => {
  if (Array.isArray(newRules)) {
    appRules = newRules;
    saveCurrentConfig();
    await syncAllAppRules();
    sendLog('info', `🔒 Regras de aplicativos atualizadas (${appRules.length} cadastradas).`);
    return { ok: true, rules: appRules };
  }
  return { ok: false, error: 'Lista inválida' };
});

ipcMain.handle('launch-app-bound', async (event, rule) => {
  if (!rule || !rule.path) return { ok: false, error: 'Caminho inválido' };
  try {
    const isBrowser = /chrome|msedge|brave|opera/i.test(rule.path);
    const args = [];

    if (isBrowser && rule.target === 'WIFI') {
      args.push('--proxy-server=http://127.0.0.1:28082');
    } else if (isBrowser && rule.target === 'ETHERNET') {
      args.push('--proxy-server=http://127.0.0.1:28081');
    }

    const child = spawn(rule.path, args, { detached: true, stdio: 'ignore' });
    child.unref();

    const desc = rule.target === 'WIFI' ? 'Apenas Celular/Wi-Fi' : rule.target === 'ETHERNET' ? 'Apenas Cabo' : 'Dinâmico';
    sendLog('switch', `🚀 Executando ${rule.name || 'aplicativo'} travado em [${desc}]...`);
    return { ok: true };
  } catch (e) {
    sendLog('fail', `Erro ao iniciar aplicativo: ${e.message}`);
    return { ok: false, error: e.message };
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  startInterfaceProxies();
  syncAllAppRules();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  if (primaryAlias) resetInterfaceMetric(primaryAlias);
  if (secondaryAlias) resetInterfaceMetric(secondaryAlias);
  flushDNS();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
