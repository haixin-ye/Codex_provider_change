import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { readConfigProvider } from "./configProvider.js";

describe("readConfigProvider", () => {
  it("reads model_provider from config.toml", () => {
    const codexHome = fs.mkdtempSync(path.join(process.cwd(), "tmp-config-"));
    fs.writeFileSync(path.join(codexHome, "config.toml"), 'model_provider = "ccswitch"\n');

    expect(readConfigProvider(codexHome)).toBe("ccswitch");

    fs.rmSync(codexHome, { recursive: true, force: true });
  });
});
