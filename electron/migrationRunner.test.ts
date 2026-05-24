import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";

import { runMigrationInWorker, type WorkerLike } from "./migrationRunner.js";
import type { MigrateOptions, MigrationProgress } from "./core/types.js";

describe("migrationRunner", () => {
  it("resolves from worker result while forwarding progress asynchronously", async () => {
    const progress: MigrationProgress[] = [];
    const worker = new EventEmitter() as WorkerLike;
    worker.terminate = () => undefined;
    const payload: MigrateOptions = {
      codexHome: "C:\\Users\\hp\\.codex",
      targetProvider: "ccswitch",
      sourceProviders: ["openai"]
    };

    const promise = runMigrationInWorker(payload, (item) => progress.push(item), {
      workerFactory: () => worker
    });
    worker.emit("message", {
      type: "progress",
      progress: { stage: "database", label: "更新数据库" }
    });
    worker.emit("message", {
      type: "result",
      result: {
        targetProvider: "ccswitch",
        sourceProviders: ["openai"],
        backupDir: "backup",
        updatedThreadRows: 1,
        updatedSessionFiles: 0,
        before: {},
        after: {}
      }
    });

    await expect(promise).resolves.toMatchObject({ updatedThreadRows: 1 });
    expect(progress).toEqual([{ stage: "database", label: "更新数据库" }]);
  });
});
