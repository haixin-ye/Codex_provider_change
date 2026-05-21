import fs from "node:fs";
import path from "node:path";

import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";

import { migrateCodexHistory, scanCodexHistory } from "./historyStore.js";

describe("historyStore", () => {
  it("migrates selected sqlite threads and session metadata with full session backups", async () => {
    const codexHome = await makeCodexHome();

    const before = await scanCodexHistory(codexHome);
    expect(before.configProvider).toBe("ccswitch");
    expect(before.databaseDistribution).toEqual({ codex: 1, OpenAI: 1, openai: 1 });
    expect(before.sessionDistribution).toEqual({ codex: 1, OpenAI: 1, openai: 1 });

    const result = await migrateCodexHistory({
      codexHome,
      targetProvider: "ccswitch",
      sourceProviders: ["openai"]
    });

    expect(result.sourceProviders).toEqual(["openai"]);
    expect(result.updatedThreadRows).toBe(1);
    expect(result.updatedSessionFiles).toBe(1);
    expect(result.after.databaseDistribution).toEqual({ codex: 1, ccswitch: 1, OpenAI: 1 });
    expect(result.after.sessionDistribution).toEqual({ codex: 1, ccswitch: 1, OpenAI: 1 });

    const backupSession = path.join(
      result.backupDir,
      "sessions",
      "2026",
      "05",
      "21",
      "rollout-a.jsonl"
    );
    expect(fs.readFileSync(backupSession, "utf8")).toContain('"model_provider":"openai"');
    const unmodifiedBackupSession = path.join(
      result.backupDir,
      "sessions",
      "2026",
      "05",
      "21",
      "rollout-c.jsonl"
    );
    expect(fs.readFileSync(unmodifiedBackupSession, "utf8")).toContain('"model_provider":"codex"');

    fs.rmSync(codexHome, { recursive: true, force: true });
  });
});

async function makeCodexHome(): Promise<string> {
  const codexHome = fs.mkdtempSync(path.join(process.cwd(), "tmp-codex-"));
  fs.mkdirSync(path.join(codexHome, "sessions", "2026", "05", "21"), { recursive: true });
  fs.writeFileSync(path.join(codexHome, "config.toml"), 'model_provider = "ccswitch"\n');

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("CREATE TABLE threads (id TEXT PRIMARY KEY, model_provider TEXT NOT NULL)");
  db.run("INSERT INTO threads (id, model_provider) VALUES (?, ?)", ["a", "openai"]);
  db.run("INSERT INTO threads (id, model_provider) VALUES (?, ?)", ["b", "OpenAI"]);
  db.run("INSERT INTO threads (id, model_provider) VALUES (?, ?)", ["c", "codex"]);
  fs.writeFileSync(path.join(codexHome, "state_5.sqlite"), Buffer.from(db.export()));
  db.close();

  writeSession(path.join(codexHome, "sessions", "2026", "05", "21", "rollout-a.jsonl"), "a", "openai");
  writeSession(path.join(codexHome, "sessions", "2026", "05", "21", "rollout-b.jsonl"), "b", "OpenAI");
  writeSession(path.join(codexHome, "sessions", "2026", "05", "21", "rollout-c.jsonl"), "c", "codex");
  return codexHome;
}

function writeSession(file: string, id: string, provider: string): void {
  const records = [
    {
      timestamp: "2026-05-21T00:00:00.000Z",
      type: "session_meta",
      payload: { id, model_provider: provider }
    },
    { timestamp: "2026-05-21T00:00:01.000Z", type: "event_msg", payload: {} }
  ];
  fs.writeFileSync(file, records.map((record) => JSON.stringify(record)).join("\n") + "\n");
}
