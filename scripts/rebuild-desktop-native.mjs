import { rebuild } from "@electron/rebuild";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const desktopRoot = resolve(root, "desktop");
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

// projectRootPath 阻止 electron-rebuild 向上遍历并触碰根 node_modules。
await rebuild({
  buildPath: desktopRoot,
  projectRootPath: desktopRoot,
  electronVersion: manifest.devDependencies.electron,
  onlyModules: ["better-sqlite3"],
  force: true,
  mode: "sequential",
});

console.log("[desktop] isolated better-sqlite3 rebuild completed");
