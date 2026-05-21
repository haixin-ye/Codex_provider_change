import { app, BrowserWindow, Menu, dialog, ipcMain, screen, shell, type OpenDialogOptions } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defaultCodexHome } from "./core/codexPaths.js";
import { migrateCodexHistory, scanCodexHistory } from "./core/historyStore.js";
import type { MigrateOptions } from "./core/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const { width: workAreaWidth, height: workAreaHeight } = screen.getPrimaryDisplay().workAreaSize;
  const minWidth = Math.min(980, Math.max(900, workAreaWidth - 32));
  const minHeight = Math.min(680, Math.max(640, workAreaHeight - 32));
  const initialWidth = Math.min(1360, Math.max(minWidth, workAreaWidth - 96));
  const initialHeight = Math.min(900, Math.max(minHeight, workAreaHeight - 96));

  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    minWidth,
    minHeight,
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
