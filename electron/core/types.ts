export type ProviderDistribution = Record<string, number>;

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

export type MigrateOptions = {
  codexHome: string;
  targetProvider: string;
  sourceProviders?: string[];
};
