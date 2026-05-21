#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import electron from "electron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const child = spawn(electron, [appRoot], { stdio: "inherit" });

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
