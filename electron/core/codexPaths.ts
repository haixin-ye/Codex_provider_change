import os from "node:os";
import path from "node:path";

export function defaultCodexHome(): string {
  return path.join(os.homedir(), ".codex");
}

export function normalizeCodexHome(input?: string | null): string {
  const value = (input || "").trim();
  return value ? path.resolve(value) : defaultCodexHome();
}
