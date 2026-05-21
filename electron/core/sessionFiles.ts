import fs from "node:fs";
import path from "node:path";

import type { ProviderDistribution } from "./types.js";

type SessionUpdate = {
  changed: boolean;
  provider: string | null;
};

export function walkJsonlFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const found: string[] = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        found.push(fullPath);
      }
    }
  }
  return found.sort();
}

export function scanSessionDistribution(sessionsPath: string): {
  distribution: ProviderDistribution;
  count: number;
} {
  const distribution: ProviderDistribution = {};
  let count = 0;

  for (const file of walkJsonlFiles(sessionsPath)) {
    const provider = readSessionMetaProvider(file);
    if (provider !== null) {
      distribution[provider] = (distribution[provider] || 0) + 1;
      count += 1;
    }
  }

  return { distribution, count };
}

export function readSessionMetaProvider(file: string): string | null {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    try {
      const record = JSON.parse(line) as {
        type?: unknown;
        payload?: { model_provider?: unknown };
      };
      if (record.type !== "session_meta") {
        continue;
      }
      const provider = record.payload?.model_provider;
      return typeof provider === "string" ? provider : null;
    } catch {
      continue;
    }
  }
  return null;
}

export function updateSessionProvider(file: string, targetProvider: string): SessionUpdate {
  const raw = fs.readFileSync(file, "utf8");
  const trailingNewline = raw.endsWith("\n");
  const lines = raw.split(/\r?\n/);
  if (trailingNewline && lines[lines.length - 1] === "") {
    lines.pop();
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }

    try {
      const record = JSON.parse(line) as {
        type?: unknown;
        payload?: { model_provider?: unknown };
      };
      if (record.type !== "session_meta") {
        continue;
      }
      if (!record.payload || typeof record.payload !== "object") {
        return { changed: false, provider: null };
      }

      const currentProvider =
        typeof record.payload.model_provider === "string" ? record.payload.model_provider : null;
      if (currentProvider === targetProvider) {
        return { changed: false, provider: currentProvider };
      }

      record.payload.model_provider = targetProvider;
      lines[index] = JSON.stringify(record);
      fs.writeFileSync(file, lines.join("\n") + (trailingNewline ? "\n" : ""), "utf8");
      return { changed: true, provider: currentProvider };
    } catch {
      continue;
    }
  }

  return { changed: false, provider: null };
}
