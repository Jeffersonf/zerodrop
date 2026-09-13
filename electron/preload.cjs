const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  setMonitoring: (enabled) => ipcRenderer.send('set-monitoring', enabled),
  setRouteStrategy: (strategy) => ipcRenderer.send('set-route-strategy', strategy),
  setAutoConnectHotspot: (enabled) => ipcRenderer.send('set-auto-connect', enabled),
  setProfile: (profile) => ipcRenderer.send('set-profile', profile),
  setTarget: (target) => ipcRenderer.send('set-target', target),
  resetMetrics: () => ipcRenderer.send('reset-metrics'),
  restartAsAdmin: () => ipcRenderer.send('restart-as-admin'),
  updateSettings: (newSettings) => ipcRenderer.send('update-settings', newSettings),
  flushDNS: () => ipcRenderer.send('flush-dns'),
  addHotspot: (name) => ipcRenderer.send('add-hotspot', name),
  removeHotspot: (name) => ipcRenderer.send('remove-hotspot', name),
  connectHotspot: (name) => ipcRenderer.send('connect-hotspot', name),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  restartAndInstallUpdate: () => ipcRenderer.send('restart-and-install-update'),
  getRunningApps: () => ipcRenderer.invoke('get-running-apps'),
  selectAppFile: () => ipcRenderer.invoke('select-app-file'),
  saveAppRules: (rules) => ipcRenderer.invoke('save-app-rules', rules),
  launchAppBound: (rule) => ipcRenderer.invoke('launch-app-bound', rule),
  onStatusUpdate: (callback) => ipcRenderer.on('status-update', (event, data) => callback(data)),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, data) => callback(data)),
  onLog: (callback) => ipcRenderer.on('log-event', (event, data) => callback(data))
});
