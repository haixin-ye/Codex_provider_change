import { parentPort, workerData } from "node:worker_threads";

import { migrateCodexHistory } from "./core/historyStore.js";
import type { MigrateOptions } from "./core/types.js";

if (!parentPort) {
  throw new Error("Migration worker must run inside a worker thread.");
}

const port = parentPort;

migrateCodexHistory(workerData as MigrateOptions, (progress) => {
  port.postMessage({ type: "progress", progress });
})
  .then((result) => {
    port.postMessage({ type: "result", result });
  })
  .catch((error: unknown) => {
    port.postMessage({
      type: "error",
      error: serializeError(error)
    });
  });

function serializeError(error: unknown): { message: string; code?: string; processes?: unknown } {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  const extra = error as Error & { code?: string; processes?: unknown };
  return {
    message: error.message,
    code: extra.code,
    processes: extra.processes
  };
}
