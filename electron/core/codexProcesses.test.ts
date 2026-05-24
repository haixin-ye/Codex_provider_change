import { describe, expect, it } from "vitest";

import { parseWindowsTaskList, terminateRunningCodexProcesses } from "./codexProcesses.js";

describe("codexProcesses", () => {
  it("terminates selected Codex processes with forced tree kill on Windows", () => {
    const commands: Array<{ file: string; args: string[] }> = [];
    const processes = parseWindowsTaskList('"codex.exe","1234","Console","1","42,000 K"\n"node.exe","55","Console","1","1 K"');

    const result = terminateRunningCodexProcesses(processes, {
      platform: "win32",
      execFileSync: (file, args) => {
        commands.push({ file, args });
      }
    });

    expect(result.terminated).toEqual([{ pid: 1234, name: "codex.exe" }]);
    expect(result.errors).toEqual([]);
    expect(commands).toEqual([{ file: "taskkill", args: ["/PID", "1234", "/T", "/F"] }]);
  });

  it("rechecks remaining Codex processes after termination", () => {
    const result = terminateRunningCodexProcesses(
      [{ pid: 1234, name: "codex.exe" }],
      {
        platform: "win32",
        execFileSync: () => undefined,
        findRunningCodexProcesses: () => [{ pid: 1234, name: "codex.exe" }]
      }
    );

    expect(result.remaining).toEqual([{ pid: 1234, name: "codex.exe" }]);
  });
});
