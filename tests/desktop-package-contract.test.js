import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

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

test("desktop artifact workflow uses matching Windows and macOS runners", () => {
  assert.equal(existsSync(".github/workflows/desktop.yml"), true);
  const workflow = readFileSync(".github/workflows/desktop.yml", "utf8");
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /macos-latest/);
  assert.match(workflow, /node-version: 22\.23\.0/);
  assert.match(workflow, /desktop:dist -- --win --x64/);
  assert.match(workflow, /desktop:dist -- --mac --x64 --arm64/);
});
