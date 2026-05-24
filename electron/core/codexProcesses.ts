import { execFileSync } from "node:child_process";
import path from "node:path";

import type { TerminateCodexProcessesResult } from "./types.js";

export type RunningCodexProcess = {
  pid: number;
  name: string;
  path?: string;
};

export function findRunningCodexProcesses(): RunningCodexProcess[] {
  if (process.platform === "win32") {
    return findWindowsCodexProcesses();
  }
  return findUnixCodexProcesses();
}

export type ProcessCommandRuntime = {
  platform?: NodeJS.Platform;
  execFileSync?: (file: string, args: string[]) => void;
  findRunningCodexProcesses?: () => RunningCodexProcess[];
};

export function terminateRunningCodexProcesses(
  processes = findRunningCodexProcesses(),
  runtime: ProcessCommandRuntime = {}
): TerminateCodexProcessesResult {
  const platform = runtime.platform ?? process.platform;
  const run = runtime.execFileSync ?? ((file, args) => execFileSync(file, args, { windowsHide: true }));
  const terminated: RunningCodexProcess[] = [];
  const errors: TerminateCodexProcessesResult["errors"] = [];

  for (const item of processes.filter((process) => isCodexProcessName(process.name))) {
    try {
      if (platform === "win32") {
        run("taskkill", ["/PID", String(item.pid), "/T", "/F"]);
      } else {
        run("kill", ["-9", String(item.pid)]);
      }
      terminated.push(item);
    } catch (error) {
      errors.push({
        process: item,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    terminated,
    errors,
    remaining: (runtime.findRunningCodexProcesses ?? findRunningCodexProcesses)()
  };
}

function findWindowsCodexProcesses(): RunningCodexProcess[] {
  const output = execFileSync("tasklist", ["/FO", "CSV", "/NH"], {
    encoding: "utf8",
    windowsHide: true
  });
  return parseWindowsTaskList(output).filter((item) => isCodexProcessName(item.name));
}

export function parseWindowsTaskList(output: string): RunningCodexProcess[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine)
    .filter((columns) => columns.length >= 2)
    .map((columns) => ({
      name: columns[0],
      pid: Number(columns[1])
    }))
    .filter((item) => Number.isFinite(item.pid));
}

function findUnixCodexProcesses(): RunningCodexProcess[] {
  const output = execFileSync("ps", ["-axo", "pid=,comm=,args="], {
    encoding: "utf8"
  });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseUnixProcessLine)
    .filter((item): item is RunningCodexProcess => Boolean(item))
    .filter((item) => item.pid !== process.pid && isCodexProcessName(item.name));
}

function parseUnixProcessLine(line: string): RunningCodexProcess | null {
  const match = line.match(/^(\d+)\s+(\S+)\s*(.*)$/);
  if (!match) {
    return null;
  }
  const [, pid, command, args] = match;
  const name = path.basename(command);
  return {
    pid: Number(pid),
    name,
    path: args || command
  };
}

function isCodexProcessName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === "codex" || normalized === "codex.exe";
}

function parseCsvLine(line: string): string[] {
  const columns: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      columns.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  columns.push(current);
  return columns;
}
