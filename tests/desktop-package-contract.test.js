import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const desktopPackage = JSON.parse(readFileSync(new URL("../desktop/package.json", import.meta.url), "utf8"));
const desktopMain = readFileSync(new URL("../desktop/main.ts", import.meta.url), "utf8");
const databaseBinding = readFileSync(new URL("../lib/database-binding.ts", import.meta.url), "utf8");
const desktopRebuild = readFileSync(new URL("../scripts/rebuild-desktop-native.mjs", import.meta.url), "utf8");

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

test("desktop artifact workflow uses matching Windows and macOS runners", () => {
  assert.equal(existsSync(".github/workflows/desktop.yml"), true);
  const workflow = readFileSync(".github/workflows/desktop.yml", "utf8");
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /macos-latest/);
  assert.match(workflow, /node-version: 22\.23\.0/);
  assert.match(workflow, /desktop:dist -- --win --x64/);
  assert.match(workflow, /desktop:dist -- --mac --x64 --arm64/);
});

test("desktop workflow isolates and smoke-checks the Electron native database binding", () => {
  assert.equal(pkg.dependencies["better-sqlite3"], "^12.11.1");
  assert.equal(pkg.allowScripts["better-sqlite3@12.11.1"], true);
  assert.equal(pkg.devDependencies["@electron/rebuild"], "4.2.0");
  assert.equal(lock.packages["node_modules/better-sqlite3"].version, "12.11.1");
  assert.equal(desktopPackage.dependencies["better-sqlite3"], "12.11.1");
  assert.equal(desktopPackage.allowScripts["better-sqlite3@12.11.1"], true);
  assert.match(pkg.scripts["desktop:install-native-deps"], /npm --prefix desktop ci --ignore-scripts/);
  assert.match(pkg.scripts["desktop:rebuild-native"], /node scripts\/rebuild-desktop-native\.mjs/);
  assert.match(desktopRebuild, /projectRootPath: desktopRoot/);
  assert.match(desktopRebuild, /onlyModules: \["better-sqlite3"\]/);
  assert.match(pkg.scripts["desktop:test-native-deps"], /electron tests\/desktop-native-deps\.mjs/);
  assert.match(pkg.scripts["desktop:dev"], /desktop:rebuild-native/);
  assert.match(pkg.scripts["desktop:dev"], /desktop:test-native-deps/);
  assert.match(pkg.scripts["desktop:dist"], /desktop:rebuild-native/);
  assert.match(pkg.scripts["desktop:dist"], /desktop:test-native-deps/);
  assert.equal(existsSync("tests/desktop-native-deps.mjs"), true);
  assert.equal(pkg.build.beforeBuild, "./scripts/skip-root-native-rebuild.mjs");
  assert.ok(pkg.build.files.includes("desktop/node_modules/**/*"));
  assert.match(databaseBinding, /process\.versions\.electron/);
  assert.match(databaseBinding, /desktop\/node_modules\/better-sqlite3/);
});

test("desktop main process shows the window and reports renderer failures", () => {
  const readyToShow = desktopMain.indexOf('window.once("ready-to-show"');
  const loadUrl = desktopMain.indexOf("await window.loadURL(serverOrigin)");

  assert.ok(readyToShow >= 0);
  assert.ok(loadUrl >= 0);
  assert.ok(readyToShow < loadUrl);
  assert.match(desktopMain, /did-fail-load/);
  assert.match(desktopMain, /render-process-gone/);
});
