import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

import type { MigrateOptions, MigrationProgress, MigrationResult } from "./core/types.js";

type WorkerMessage =
  | { type: "progress"; progress: MigrationProgress }
  | { type: "result"; result: MigrationResult }
  | { type: "error"; error: { message: string; code?: string; processes?: unknown } };

export type WorkerLike = {
  on(event: "message", listener: (message: WorkerMessage) => void): WorkerLike;
  on(event: "error", listener: (error: Error) => void): WorkerLike;
  on(event: "exit", listener: (code: number) => void): WorkerLike;
  terminate?: () => unknown;
};

type MigrationWorkerRuntime = {
  workerFactory?: (payload: MigrateOptions) => WorkerLike;
};

export function runMigrationInWorker(
  payload: MigrateOptions,
  onProgress: (progress: MigrationProgress) => void,
  runtime: MigrationWorkerRuntime = {}
): Promise<MigrationResult> {
  const worker = runtime.workerFactory?.(payload) ?? new Worker(defaultWorkerPath(), { workerData: payload });

  return new Promise((resolve, reject) => {
    let settled = false;

    worker.on("message", (message) => {
      if (message.type === "progress") {
        onProgress(message.progress);
        return;
      }
      if (message.type === "result") {
        settled = true;
        resolve(message.result);
        void worker.terminate?.();
        return;
      }
      if (message.type === "error") {
        settled = true;
        reject(workerError(message.error));
        void worker.terminate?.();
      }
    });

    worker.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    worker.on("exit", (code) => {
      if (!settled && code !== 0) {
        reject(new Error(`Migration worker exited with code ${code}`));
      }
    });
  });
}

function defaultWorkerPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const workerPath = path.join(path.dirname(__filename), "migrationWorker.js");
  return workerPath.includes("app.asar")
    ? workerPath.replace("app.asar", "app.asar.unpacked")
    : workerPath;
}

function workerError(serialized: { message: string; code?: string; processes?: unknown }): Error {
  const error = new Error(serialized.message);
  if (serialized.code) {
    Object.assign(error, { code: serialized.code });
  }
  if (serialized.processes) {
    Object.assign(error, { processes: serialized.processes });
  }
  return error;
}
