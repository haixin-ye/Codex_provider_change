import fs from "node:fs";
import path from "node:path";
import * as toml from "toml";

export function readConfigProvider(codexHome: string): string | null {
  const configPath = path.join(codexHome, "config.toml");
  if (!fs.existsSync(configPath)) {
    return null;
  }

  const content = fs.readFileSync(configPath, "utf8");
  try {
    const parsed = toml.parse(content) as { model_provider?: unknown };
    if (typeof parsed.model_provider === "string" && parsed.model_provider.trim()) {
      return parsed.model_provider.trim();
    }
  } catch {
    const match = content.match(/^\s*model_provider\s*=\s*["']([^"']+)["']/m);
    return match?.[1]?.trim() || null;
  }

  return null;
}
