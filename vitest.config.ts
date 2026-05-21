import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["electron/**/*.test.ts"],
    exclude: ["dist/**", "dist-electron/**", "node_modules/**"]
  }
});
