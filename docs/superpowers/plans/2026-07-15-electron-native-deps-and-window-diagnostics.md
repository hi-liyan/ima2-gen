# Electron Native Dependencies And Window Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Electron desktop workflow rebuild and verify `better-sqlite3`, while reliably showing and diagnosing its main window.

**Architecture:** Package scripts own an isolated Electron ABI rebuild under `desktop/node_modules` and a dedicated smoke command. The smoke entry runs inside Electron and performs a real in-memory SQLite query. A runtime binding loader keeps ordinary Node on the root dependency while Electron uses the isolated copy. The main process registers display and renderer failure listeners before navigation.

**Tech Stack:** Node.js ESM, Electron 42, `@electron/rebuild`, `better-sqlite3`, node:test, TypeScript.

---

### Task 1: Specify Desktop Dependency And Lifecycle Contracts

**Files:**
- Modify: `tests/desktop-package-contract.test.js`
- Test: `tests/desktop-package-contract.test.js`

- [ ] **Step 1: Add failing package and source assertions**

Assert `better-sqlite3` is `^12.11.1`, each dependency root approves `better-sqlite3@12.11.1`, Electron rebuild targets the isolated `desktop` dependency root, desktop scripts call rebuild and smoke verification, and `ready-to-show` appears before `loadURL` in `desktop/main.ts`.

- [ ] **Step 2: Run the contract test**

Run: `node --test tests/desktop-package-contract.test.js`

Expected: FAIL because the package still declares 12.9.0 and the main-process event registration order is incorrect.

### Task 2: Add Electron Native Smoke Verification

**Files:**
- Create: `tests/desktop-native-deps.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the Electron smoke entry**

Import `better-sqlite3`, open `:memory:`, assert `SELECT 1 AS value` returns `1`, close the database, and exit with code 0. On any error, write a contextual error and exit with code 1.

- [ ] **Step 2: Add scripts and direct rebuild dependency**

Add `desktop:install-native-deps`, `desktop:rebuild-native`, and `desktop:test-native-deps`; make both desktop entry scripts execute build, isolated install, rebuild, smoke, then their existing final command. Add `@electron/rebuild` as an exact development dependency.

### Task 3: Fix Window Visibility And Add Diagnostics

**Files:**
- Modify: `desktop/main.ts`

- [ ] **Step 1: Register lifecycle handlers before navigation**

Register `ready-to-show` before `loadURL()` so the one-shot event cannot be missed. Record main-frame `did-fail-load` details and `render-process-gone` details to standard error.

- [ ] **Step 2: Run targeted verification**

Run: `node --test tests/desktop-package-contract.test.js`, `npm run typecheck`, `npm run typecheck:tests`, and `npm run desktop:test-native-deps` after Electron rebuild.

### Task 4: Refresh Dependency Lock And Validate

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Update the package manifest and lockfile**

Use npm to synchronize the direct dependency, `better-sqlite3@12.11.1`, and install-script approval with the existing lockfile update.

- [ ] **Step 2: Run project verification**

Run: `npm run test:install-policy`, `npm run test:native-deps`, `npm test`, `npm run desktop:dev`.

Expected: host tests pass before Electron rebuild; desktop workflow rebuilds its native module, smoke-checks it, opens a visible window, and logs renderer failures explicitly.
