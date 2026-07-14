# Electron Desktop Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide unsigned Windows x64 and macOS x64/arm64 Electron packages that run the existing Express application in an Electron main process while preserving CLI and browser access.

**Architecture:** Add an idempotent close operation to `startServer()` so Electron can own the existing service lifecycle. A small pure Node module waits for `/api/health`; `desktop/main.ts` starts the service, waits for readiness, and loads its loopback URL in a hardened `BrowserWindow`. electron-builder packages the existing compiled Node application without ASAR.

**Tech Stack:** Electron, electron-builder, TypeScript/Node ESM, Express 5, node:test, GitHub Actions.

---

## File Structure

- `server.ts`: expose an idempotent service close operation in `startServer()` without changing CLI signal behavior.
- `desktop/runtime.ts`: loopback URL validation and health polling with no Electron imports.
- `desktop/main.ts`: Electron lifecycle and hardened browser window orchestration.
- `desktop/tsconfig.json`: emit desktop TypeScript alongside its source files.
- `tests/server-lifecycle.test.ts`: real server lifecycle regression test.
- `tests/desktop-runtime.test.ts`: health polling and URL validation tests using a real temporary HTTP server.
- `tests/desktop-package-contract.test.js`: release configuration contract.
- `package.json`, `package-lock.json`: Electron dependencies, scripts and electron-builder config.
- `.github/workflows/desktop.yml`: platform-native desktop artifact workflow.
- `README.md`, `docs/README.zh-CN.md`: desktop build/run and unsigned macOS installation notes.

### Task 1: Expose An Idempotent Server Close Operation

**Files:**
- Modify: `server.ts:395-507`
- Create: `tests/server-lifecycle.test.ts`

- [ ] **Step 1: Write the failing lifecycle test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { config } from "../config.ts";
import { startServer } from "../server.ts";

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
  const port = await freePort();
  const started = await startServer({
    config: {
      ...config,
      server: { ...config.server, host: "127.0.0.1", port },
      oauth: { ...config.oauth, autoStart: false },
      grokProvider: { ...config.grokProvider, autoStart: false },
    },
    oauthChild: null,
  });
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.ok, true);
    await started.close();
    await started.close();
    await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`));
  } finally {
    await started.close();
  }
});
```

- [ ] **Step 2: Run the test and verify it fails because `close` is absent**

Run: `node --import tsx --test tests/server-lifecycle.test.ts`

Expected: FAIL with `started.close is not a function`.

- [ ] **Step 3: Add the minimal lifecycle implementation**

In `startServer()`, replace the signal handler body with a shared idempotent closure and return it with the started service:

```ts
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    unadvertise(ctx);
    try { oauthChild?.stop?.(); } catch {}
    try { oauthChild?.kill?.(); } catch {}
    try { grokChild?.stop?.(); } catch {}
    try { grokChild?.kill?.(); } catch {}
    stopAgentQueueWorker();
    clearInterval(reapTimer);
    await new Promise<void>((resolve) => {
      if (server) server.close(() => resolve()); else resolve();
    });
    closeDb();
  };

  onShutdown(close);
```

Change the final return statement to:

```ts
  return { app, server, oauthChild, ctx, close };
```

Declare `let reapTimer: NodeJS.Timeout | undefined;` and guard timer cleanup with
`if (reapTimer) clearInterval(reapTimer);` so a startup failure can safely call `close()`.

- [ ] **Step 4: Run the lifecycle test and verify it passes**

Run: `node --import tsx --test tests/server-lifecycle.test.ts`

Expected: PASS with one test and zero failures.

- [ ] **Step 5: Commit the lifecycle boundary**

```bash
git add server.ts tests/server-lifecycle.test.ts
git commit -m "feat(server): 暴露可关闭的运行时服务"
```

### Task 2: Implement And Test Service Readiness Helpers

**Files:**
- Create: `desktop/runtime.ts`
- Create: `tests/desktop-runtime.test.ts`

- [ ] **Step 1: Write failing runtime tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { loopbackUrl, waitForHealthyServer } from "../desktop/runtime.ts";

test("loopbackUrl accepts the server URL and rejects a non-loopback URL", () => {
  assert.equal(loopbackUrl("http://localhost:3333"), "http://127.0.0.1:3333/");
  assert.throws(() => loopbackUrl("https://example.com"), /loopback/i);
});

test("waitForHealthyServer resolves after the health endpoint responds ok", async () => {
  const server = createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(typeof address === "object" && address);
  try {
    const url = await waitForHealthyServer(`http://127.0.0.1:${address.port}`, 500, 10);
    assert.equal(url, `http://127.0.0.1:${address.port}/`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("waitForHealthyServer rejects after its deadline", async () => {
  await assert.rejects(waitForHealthyServer("http://127.0.0.1:9", 30, 10), /not healthy/i);
});
```

- [ ] **Step 2: Run the tests and verify the missing module failure**

Run: `node --import tsx --test tests/desktop-runtime.test.ts`

Expected: FAIL with `Cannot find module '../desktop/runtime.ts'`.

- [ ] **Step 3: Implement the smallest pure Node helper module**

```ts
export function loopbackUrl(value: string): string {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error(`Desktop server URL must be loopback HTTP: ${value}`);
  }
  url.hostname = "127.0.0.1";
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export async function waitForHealthyServer(value: string, timeoutMs = 15_000, retryMs = 100): Promise<string> {
  const url = loopbackUrl(value);
  const healthUrl = new URL("/api/health", url).toString();
  const deadline = Date.now() + timeoutMs;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(Math.min(retryMs, 1_000)) });
      const body = await response.json() as { ok?: boolean };
      if (response.ok && body.ok === true) return url;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, retryMs));
  }
  throw new Error(`Desktop server did not become healthy: ${lastError}`);
}
```

- [ ] **Step 4: Run the runtime tests and verify they pass**

Run: `node --import tsx --test tests/desktop-runtime.test.ts`

Expected: PASS with three tests and zero failures.

- [ ] **Step 5: Commit the readiness module**

```bash
git add desktop/runtime.ts tests/desktop-runtime.test.ts
git commit -m "feat(desktop): 添加本地服务就绪检测"
```

### Task 3: Add Electron Main Process And Packaging Configuration

**Files:**
- Create: `desktop/main.ts`
- Create: `desktop/tsconfig.json`
- Create: `tests/desktop-package-contract.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write the failing packaging contract**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("desktop distribution preserves Node runtime files and targets requested platforms", () => {
  assert.equal(pkg.main, "desktop/main.js");
  assert.match(pkg.scripts["desktop:build"], /build:server/);
  assert.match(pkg.scripts["desktop:dist"], /electron-builder/);
  assert.equal(pkg.build.asar, false);
  assert.deepEqual(pkg.build.win.target, [{ target: "nsis", arch: ["x64"] }]);
  assert.deepEqual(pkg.build.mac.target, [
    { target: "dmg", arch: ["x64", "arm64"] },
    { target: "zip", arch: ["x64", "arm64"] },
  ]);
  assert.ok(pkg.devDependencies.electron);
  assert.ok(pkg.devDependencies["electron-builder"]);
});
```

- [ ] **Step 2: Run the contract and verify it fails**

Run: `node --test tests/desktop-package-contract.test.js`

Expected: FAIL because `main`, desktop scripts and the `build` configuration do not exist.

- [ ] **Step 3: Add the Electron entry point and TypeScript build configuration**

Create `desktop/main.ts`:

```ts
import { app, BrowserWindow, dialog, shell } from "electron";
import { startServer } from "../server.js";
import { loopbackUrl, waitForHealthyServer } from "./runtime.js";

let started: Awaited<ReturnType<typeof startServer>> | null = null;
let serverOrigin = "";

function isServerNavigation(url: string): boolean {
  try { return loopbackUrl(url) === serverOrigin; } catch { return false; }
}

async function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!isServerNavigation(url)) event.preventDefault();
  });
  await window.loadURL(serverOrigin);
  window.once("ready-to-show", () => window.show());
}

async function boot() {
  started = await startServer();
  serverOrigin = await waitForHealthyServer(started.ctx.serverUrl);
  await createMainWindow();
}

app.whenReady().then(boot).catch(async (error: unknown) => {
  console.error("[desktop] startup failed", error);
  await started?.close();
  await dialog.showMessageBox({ type: "error", title: "ima2-gen", message: "Desktop service failed to start", detail: error instanceof Error ? error.message : String(error) });
  app.quit();
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", (event) => {
  if (!started) return;
  event.preventDefault();
  const closing = started;
  started = null;
  void closing.close().finally(() => app.quit());
});
```

Create `desktop/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": { "noEmit": false, "outDir": "..", "rootDir": "..", "types": ["node", "electron"] },
  "include": ["./**/*.ts"]
}
```

Update root `package.json` with these fields:

```json
{
  "main": "desktop/main.js",
  "scripts": {
    "desktop:build": "npm run ui:build && npm run build:server && npm run build:cli && tsc -p desktop/tsconfig.json",
    "desktop:dev": "npm run desktop:build && electron .",
    "desktop:dist": "npm run desktop:build && electron-builder"
  },
  "build": {
    "appId": "io.github.lidge-jun.ima2gen",
    "productName": "ima2-gen",
    "asar": false,
    "files": ["!tests/**", "!site/**", "!docs/**", "!devlog/**", "!structure/**", "!scripts/**", "!ui/src/**", "!ui/node_modules/**", "!**/*.ts", "!tsconfig*.json"],
    "win": { "target": [{ "target": "nsis", "arch": ["x64"] }] },
    "mac": { "target": [{ "target": "dmg", "arch": ["x64", "arm64"] }, { "target": "zip", "arch": ["x64", "arm64"] }] }
  }
}
```

Install exact development dependencies with `npm install -D electron electron-builder`, then preserve the generated lockfile update. Add `desktop/**/*.ts` to the `include` list in `tsconfig.json` so `npm run typecheck` covers the main process.

- [ ] **Step 4: Run static verification and the Windows package build**

Run: `node --test tests/desktop-package-contract.test.js && npm run typecheck && npm run typecheck:tests && npm run desktop:dist -- --win --x64`

Expected: package contract, both typechecks and the NSIS build pass; artifacts are written beneath `dist/`.

- [ ] **Step 5: Commit Electron packaging support**

```bash
git add desktop/main.ts desktop/tsconfig.json tests/desktop-package-contract.test.js package.json package-lock.json tsconfig.json
git commit -m "feat(desktop): 增加 Electron 桌面打包入口"
```

### Task 4: Add Native-Platform Artifact CI And User Documentation

**Files:**
- Create: `.github/workflows/desktop.yml`
- Modify: `README.md`
- Modify: `docs/README.zh-CN.md`
- Modify: `tests/desktop-package-contract.test.js`

- [ ] **Step 1: Extend the failing packaging contract for the release workflow**

```js
import { existsSync, readFileSync } from "node:fs";

test("desktop artifact workflow uses matching Windows and macOS runners", () => {
  const workflow = readFileSync(".github/workflows/desktop.yml", "utf8");
  assert.equal(existsSync(".github/workflows/desktop.yml"), true);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /macos-latest/);
  assert.match(workflow, /desktop:dist -- --win --x64/);
  assert.match(workflow, /desktop:dist -- --mac --x64 --arm64/);
});
```

- [ ] **Step 2: Run the contract and verify the workflow assertion fails**

Run: `node --test tests/desktop-package-contract.test.js`

Expected: FAIL because `.github/workflows/desktop.yml` does not exist.

- [ ] **Step 3: Add the artifact workflow and documented manual commands**

Create `.github/workflows/desktop.yml`:

```yaml
name: Desktop Artifacts
on:
  workflow_dispatch:
  push:
    tags: ["desktop-v*"]
permissions:
  contents: read
jobs:
  package:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: windows-latest
            command: npm run desktop:dist -- --win --x64
            name: ima2-gen-windows-x64
          - os: macos-latest
            command: npm run desktop:dist -- --mac --x64 --arm64
            name: ima2-gen-macos-universal
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm --prefix ui ci --no-audit --no-fund
      - run: npm run typecheck
      - run: npm run typecheck:tests
      - run: ${{ matrix.command }}
      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.name }}
          path: dist/
          if-no-files-found: error
```

Append this section to both README files, translated to their existing language:

```markdown
### Desktop application

Build a local desktop package with `npm run desktop:dist`. The Windows x64
build produces an NSIS installer. Run the macOS build on macOS to produce x64
and Apple Silicon DMG/ZIP artifacts. These first-release artifacts are unsigned:
macOS users must explicitly allow the application in System Settings before
opening it. The desktop app starts the same local server as `ima2 serve`; the
CLI and browser workflow remain available.
```

- [ ] **Step 4: Run the contract and documentation checks**

Run: `node --test tests/desktop-package-contract.test.js && npm run test:inventory && npm test`

Expected: desktop package contract passes, test inventory is current, and all repository tests pass.

- [ ] **Step 5: Commit the cross-platform distribution workflow**

```bash
git add .github/workflows/desktop.yml README.md docs/README.zh-CN.md tests/desktop-package-contract.test.js docs/migration/runtime-test-inventory.md
git commit -m "ci(desktop): 构建多平台 Electron 安装包"
```

## Final Verification

- [ ] Run `npm run typecheck` and `npm run typecheck:tests`.
- [ ] Run `npm run test:inventory` and commit its generated inventory if it changes.
- [ ] Run `npm test`.
- [ ] Run `npm run ui:build`.
- [ ] Run `npm run desktop:dist -- --win --x64` on Windows and inspect the NSIS artifact in `dist/`.
- [ ] Trigger `.github/workflows/desktop.yml` and retain Windows x64 plus macOS x64/arm64 artifacts for manual smoke testing.
