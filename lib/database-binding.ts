import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type BetterSqlite3 from "better-sqlite3";

const require = createRequire(import.meta.url);
const desktopBinding = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../desktop/node_modules/better-sqlite3",
);

// Electron 使用独立 ABI 绑定，普通 Node 始终从根依赖加载。
const Database = (process.versions.electron
  ? require(desktopBinding)
  : require("better-sqlite3")) as typeof BetterSqlite3;

export default Database;
