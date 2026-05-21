/// <reference types="vite/client" />

type ScanResult = import("./types").ScanResult;
type MigrationResult = import("./types").MigrationResult;
type MigrationProgress = import("./types").MigrationProgress;
type MigratePayload = {
  codexHome: string;
  targetProvider: string;
  sourceProviders?: string[];
};

type CodexProviderFixerApi = {
  getDefaultHome: () => Promise<string>;
  scan: (codexHome?: string) => Promise<ScanResult>;
  migrate: (payload: MigratePayload) => Promise<MigrationResult>;
  onMigrationProgress: (callback: (progress: MigrationProgress) => void) => () => void;
  chooseHome: () => Promise<string | null>;
  openPath: (targetPath: string) => Promise<void>;
  windowAction: (action: "minimize" | "maximize" | "close") => Promise<void>;
};

declare global {
  interface Window {
    codexProviderFixer?: CodexProviderFixerApi;
  }
}

export {};
