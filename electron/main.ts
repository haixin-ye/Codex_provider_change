import { app, BrowserWindow, Menu, dialog, ipcMain, shell, type OpenDialogOptions } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defaultCodexHome } from "./core/codexPaths.js";
import { migrateCodexHistory, scanCodexHistory } from "./core/historyStore.js";
import type { MigrateOptions } from "./core/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 980,
    minHeight: 740,
    center: true,
    title: "Codex Provider History Fixer",
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: "#010102",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  Menu.setApplicationMenu(null);

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    console.error("Renderer failed to load", { errorCode, errorDescription, validatedUrl });
  });
  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("Preload failed", { preloadPath, error });
  });
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log("Renderer console", { level, message, line, sourceId });
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function registerIpc(): void {
  ipcMain.handle("codex:get-default-home", () => defaultCodexHome());
  ipcMain.handle("codex:scan", (_event, codexHome?: string) => scanCodexHistory(codexHome));
  ipcMain.handle("codex:migrate", (event, payload: MigrateOptions) =>
    migrateCodexHistory(payload, (progress) => {
      event.sender.send("codex:migration-progress", progress);
    })
  );
  ipcMain.handle("codex:choose-home", async () => {
    const options: OpenDialogOptions = {
      title: "Select Codex home",
      properties: ["openDirectory"]
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("shell:open-path", async (_event, targetPath: string) => {
    await shell.openPath(targetPath);
  });
  ipcMain.handle("window:action", (_event, action: "minimize" | "maximize" | "close") => {
    if (!mainWindow) return;
    if (action === "minimize") {
      mainWindow.minimize();
      return;
    }
    if (action === "maximize") {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      return;
    }
    mainWindow.close();
  });
}
