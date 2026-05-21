#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

let electron;

try {
  const electronModule = await import("electron");
  electron = electronModule.default;
} catch (error) {
  console.error("Electron runtime was not installed.");
  console.error("请先执行：npm install -g electron");
  console.error("然后重新运行：codex-provider-history-fixer");
  console.error("也可以使用 GitHub Releases 中提供的桌面版压缩包。");
  process.exit(1);
}

if (typeof electron !== "string" || electron.length === 0) {
  console.error("Electron runtime path is invalid.");
  console.error("请尝试重新安装：npm install -g codex-provider-history-fixer");
  process.exit(1);
}

const child = spawn(electron, [appRoot], { stdio: "inherit" });

child.on("error", (error) => {
  console.error(`Failed to start Electron: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
