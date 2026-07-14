import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => {
        if (typeof address === "object" && address) resolve(address.port);
        else reject(new Error("No loopback port was allocated"));
      });
    });
  });
}

test("startServer close stops its loopback listener exactly once", async () => {
  const root = mkdtempSync(join(tmpdir(), "ima2-server-lifecycle-"));
  const port = await freePort();
  const script = `
    import assert from "node:assert/strict";
    const { startServer } = await import("./server.ts");
    const started = await startServer({ oauthChild: null });
    try {
      const response = await fetch("http://127.0.0.1:${port}/api/health");
      assert.equal(response.ok, true);
      await started.close();
      await started.close();
      await assert.rejects(fetch("http://127.0.0.1:${port}/api/health"));
    } finally {
      await started.close();
    }
  `;
  const result = await execFileAsync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      IMA2_CONFIG_DIR: root,
      IMA2_PORT: String(port),
      IMA2_DB_PATH: join(root, "sessions.db"),
      IMA2_GENERATED_DIR: join(root, "generated"),
      IMA2_ADVERTISE_FILE: join(root, "server.json"),
      IMA2_NO_OAUTH_PROXY: "1",
      IMA2_NO_GROK_PROXY: "1",
    },
  });
  assert.match(result.stdout, /Image Gen running/);
});
