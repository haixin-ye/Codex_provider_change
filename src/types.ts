export type ProviderDistribution = Record<string, number>;

export type RunningCodexProcess = {
  pid: number;
  name: string;
  path?: string;
};

export type TerminateCodexProcessesResult = {
  terminated: RunningCodexProcess[];
  errors: Array<{
    process: RunningCodexProcess;
    message: string;
  }>;
  remaining: RunningCodexProcess[];
};

export type ScanResult = {
  codexHome: string;
  configPath: string;
  databasePath: string;
  sessionsPath: string;
  configProvider: string | null;
  databaseExists: boolean;
  sessionsExists: boolean;
  databaseDistribution: ProviderDistribution;
  sessionDistribution: ProviderDistribution;
  threadCount: number;
  sessionCount: number;
  errors: string[];
};

export type MigrationResult = {
  targetProvider: string;
  sourceProviders: string[];
  backupDir: string;
  updatedThreadRows: number;
  updatedSessionFiles: number;
  before: ScanResult;
  after: ScanResult;
};

export type MigrationProgress = {
  stage: "scan" | "backup" | "database" | "sessions" | "verify" | "done";
  label: string;
  detail?: string;
  current?: number;
  total?: number;
};
