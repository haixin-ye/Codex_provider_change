import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { findRunningCodexProcesses } from "./codexProcesses.js";
import { normalizeCodexHome } from "./codexPaths.js";
import { readConfigProvider } from "./configProvider.js";
import {
  readSessionMetaProvider,
  scanSessionDistribution,
  updateSessionProvider,
  walkJsonlFiles
} from "./sessionFiles.js";
import type {
  MigrateOptions,
  MigrationProgress,
  MigrationResult,
  ProviderDistribution,
  RunningCodexProcess,
  ScanResult
} from "./types.js";

export class CodexProcessesRunningError extends Error {
  readonly code = "CODEX_PROCESSES_RUNNING";
  readonly processes: RunningCodexProcess[];

  constructor(processes: RunningCodexProcess[]) {
    super("Close all Codex CLI and Codex App processes before migrating history.");
    this.name = "CodexProcessesRunningError";
    this.processes = processes;
  }
}

export type MigrationRuntime = {
  findRunningCodexProcesses?: () => RunningCodexProcess[];
};

export async function scanCodexHistory(codexHomeInput?: string | null): Promise<ScanResult> {
  const codexHome = normalizeCodexHome(codexHomeInput);
  const configPath = path.join(codexHome, "config.toml");
  const databasePath = path.join(codexHome, "state_5.sqlite");
  const sessionsPath = path.join(codexHome, "sessions");
  const errors: string[] = [];

  let configProvider: string | null = null;
  let databaseDistribution: ProviderDistribution = {};
  let threadCount = 0;
  let sessionDistribution: ProviderDistribution = {};
  let sessionCount = 0;

  try {
    configProvider = readConfigProvider(codexHome);
  } catch (error) {
    errors.push(`Unable to read config.toml: ${messageFromError(error)}`);
  }

  if (fs.existsSync(databasePath)) {
    try {
      databaseDistribution = readDatabaseDistribution(databasePath);
      threadCount = Object.values(databaseDistribution).reduce((sum, count) => sum + count, 0);
    } catch (error) {
      errors.push(`Unable to read state_5.sqlite: ${messageFromError(error)}`);
    }
  }

  try {
    const sessionScan = scanSessionDistribution(sessionsPath);
    sessionDistribution = sessionScan.distribution;
    sessionCount = sessionScan.count;
  } catch (error) {
    errors.push(`Unable to scan sessions: ${messageFromError(error)}`);
  }

  return {
    codexHome,
    configPath,
    databasePath,
    sessionsPath,
    configProvider,
    databaseExists: fs.existsSync(databasePath),
    sessionsExists: fs.existsSync(sessionsPath),
    databaseDistribution,
    sessionDistribution,
    threadCount,
    sessionCount,
    errors
  };
}

export async function migrateCodexHistory(
  options: MigrateOptions,
  onProgress: (progress: MigrationProgress) => void = () => undefined,
  runtime: MigrationRuntime = {}
): Promise<MigrationResult> {
  const codexHome = normalizeCodexHome(options.codexHome);
  const targetProvider = options.targetProvider.trim();
  if (!targetProvider) {
    throw new Error("Target provider cannot be blank.");
  }

  const runningProcesses = (runtime.findRunningCodexProcesses ?? findRunningCodexProcesses)();
  if (runningProcesses.length) {
    throw new CodexProcessesRunningError(runningProcesses);
  }

  onProgress({ stage: "scan", label: "扫描 Codex 历史", detail: codexHome, current: 1, total: 4 });
  const before = await scanCodexHistory(codexHome);
  if (!before.databaseExists) {
    throw new Error(`Codex state database was not found: ${before.databasePath}`);
  }

  const sourceProviders = resolveSourceProviders(options.sourceProviders, before, targetProvider);
  if (!sourceProviders.length) {
    throw new Error("No source providers were selected for migration.");
  }

  onProgress({ stage: "backup", label: "创建完整备份", detail: before.databasePath, current: 2, total: 4 });
  const backupDir = createBackupDir(codexHome);
  backupDatabase(before.databasePath, backupDir);
  backupSessions(before.sessionsPath, backupDir);
  await yieldToEventLoop();

  onProgress({ stage: "database", label: "更新 state_5.sqlite", detail: targetProvider, current: 3, total: 4 });
  const updatedThreadRows = updateDatabaseProviders(before.databasePath, targetProvider, sourceProviders);
  await yieldToEventLoop();

  const updatedSessionFiles = await updateSessionProviders(
    before.sessionsPath,
    targetProvider,
    sourceProviders,
    onProgress
  );
  onProgress({ stage: "verify", label: "重新扫描验证结果", detail: backupDir, current: 4, total: 4 });
  const after = await scanCodexHistory(codexHome);
  onProgress({
    stage: "done",
    label: "迁移完成",
    detail: `已更新 ${updatedThreadRows} 条线程记录，${updatedSessionFiles} 个 session 文件`,
    current: 4,
    total: 4
  });

  return {
    targetProvider,
    sourceProviders,
    backupDir,
    updatedThreadRows,
    updatedSessionFiles,
    before,
    after
  };
}

function readDatabaseDistribution(databasePath: string): ProviderDistribution {
  const db = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    db.pragma("busy_timeout = 5000");
    const rows = db.prepare(`
    SELECT model_provider AS provider, COUNT(*) AS count
    FROM threads
    GROUP BY model_provider
    ORDER BY model_provider COLLATE NOCASE
  `).all() as Array<{ provider: string; count: number }>;
    return Object.fromEntries(rows.map((row) => [row.provider, row.count]));
  } finally {
    db.close();
  }
}

function updateDatabaseProviders(databasePath: string, targetProvider: string, sourceProviders: string[]): number {
  const selected = buildProviderWhereClause(sourceProviders);
  const db = new Database(databasePath, { fileMustExist: true });
  let updatedThreadRows = 0;

  try {
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = ON");
    const countRow = db.prepare(`SELECT COUNT(*) AS count FROM threads WHERE ${selected.where}`).get(selected.params) as
      | { count: number }
      | undefined;
    updatedThreadRows = Number(countRow?.count ?? 0);

    const update = db.transaction(() => {
      db.prepare(`UPDATE threads SET model_provider = $target WHERE ${selected.where}`).run({
        ...selected.params,
        target: targetProvider
      });
    });
    update();
    db.pragma("wal_checkpoint(TRUNCATE)");
  } finally {
    db.close();
  }

  removeSqliteSidecars(databasePath);
  return updatedThreadRows;
}

function createBackupDir(codexHome: string): string {
  const timestamp = timestampForPath();
  const root = path.join(codexHome, "backups");
  let backupDir = path.join(root, `provider-migration-${timestamp}`);
  let suffix = 1;
  while (fs.existsSync(backupDir)) {
    suffix += 1;
    backupDir = path.join(root, `provider-migration-${timestamp}-${suffix}`);
  }
  fs.mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

function backupDatabase(databasePath: string, backupDir: string): void {
  fs.copyFileSync(databasePath, path.join(backupDir, path.basename(databasePath)));
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${databasePath}${suffix}`;
    if (fs.existsSync(sidecar)) {
      fs.copyFileSync(sidecar, path.join(backupDir, path.basename(sidecar)));
    }
  }
}

function backupSessions(sessionsPath: string, backupDir: string): void {
  if (!fs.existsSync(sessionsPath)) {
    return;
  }
  fs.cpSync(sessionsPath, path.join(backupDir, "sessions"), {
    recursive: true,
    force: true,
    errorOnExist: false
  });
}

async function updateSessionProviders(
  sessionsPath: string,
  targetProvider: string,
  sourceProviders: string[],
  onProgress: (progress: MigrationProgress) => void
): Promise<number> {
  let updated = 0;
  const files = walkJsonlFiles(sessionsPath);
  const selected = new Set(sourceProviders);
  onProgress({
    stage: "sessions",
    label: "更新 Session Metadata",
    detail: "准备同步 sessions/**/*.jsonl",
    current: 3,
    total: 4
  });

  for (const [index, file] of files.entries()) {
    const result = updateSessionProviderIfSelected(file, targetProvider, selected);
    if (result) {
      updated += 1;
    }

    if (index % 20 === 0 || index === files.length - 1) {
      const sessionRatio = files.length ? (index + 1) / files.length : 1;
      onProgress({
        stage: "sessions",
        label: "更新 Session Metadata",
        detail: `${updated} 个文件需要迁移`,
        current: 3 + sessionRatio,
        total: 4
      });
      await yieldToEventLoop();
    }
  }
  return updated;
}

function updateSessionProviderIfSelected(
  file: string,
  targetProvider: string,
  selected: Set<string>
): boolean {
  const currentProvider = readSessionMetaProvider(file);
  if (currentProvider === null || currentProvider === targetProvider || !selected.has(currentProvider)) {
    return false;
  }

  const update = updateSessionProvider(file, targetProvider);
  if (!update.changed) {
    throw new Error(`Session update failed for ${file}`);
  }
  return true;
}

function resolveSourceProviders(
  input: string[] | undefined,
  scan: ScanResult,
  targetProvider: string
): string[] {
  const allProviders = new Set([
    ...Object.keys(scan.databaseDistribution),
    ...Object.keys(scan.sessionDistribution)
  ]);
  const requested = (input ?? [])
    .map((provider) => provider.trim())
    .filter((provider) => provider && provider !== targetProvider);
  const providers = requested.length
    ? requested.filter((provider) => allProviders.has(provider))
    : [...allProviders].filter((provider) => provider !== targetProvider);
  return [...new Set(providers)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function buildProviderWhereClause(sourceProviders: string[]): {
  where: string;
  params: Record<string, string>;
} {
  const params: Record<string, string> = {};
  const placeholders = sourceProviders.map((provider, index) => {
    const key = `source${index}`;
    params[key] = provider;
    return `$${key}`;
  });
  return {
    where: `model_provider IN (${placeholders.join(", ")})`,
    params
  };
}

function removeSqliteSidecars(databasePath: string): void {
  for (const suffix of ["-wal", "-shm"]) {
    fs.rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

function timestampForPath(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
