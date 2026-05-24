const { contextBridge, ipcRenderer } = require("electron");

const api = {
  getDefaultHome: () => ipcRenderer.invoke("codex:get-default-home"),
  scan: (codexHome) => ipcRenderer.invoke("codex:scan", codexHome),
  checkCodexProcesses: () => ipcRenderer.invoke("codex:check-processes"),
  terminateCodexProcesses: () => ipcRenderer.invoke("codex:terminate-processes"),
  migrate: (payload) => ipcRenderer.invoke("codex:migrate", payload),
  onMigrationProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("codex:migration-progress", listener);
    return () => ipcRenderer.removeListener("codex:migration-progress", listener);
  },
  chooseHome: () => ipcRenderer.invoke("codex:choose-home"),
  openPath: (targetPath) => ipcRenderer.invoke("shell:open-path", targetPath),
  windowAction: (action) => ipcRenderer.invoke("window:action", action)
};

contextBridge.exposeInMainWorld("codexProviderFixer", api);
