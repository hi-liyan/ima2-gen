import Database from "../lib/database-binding.js";

// 在 Electron 主进程中验证原生 SQLite 绑定可以实际创建和查询数据库。
try {
  const database = new Database(":memory:");
  const result = database.prepare("SELECT 1 AS value").get();
  database.close();
  if (result?.value !== 1) throw new Error("SQLite memory query returned an unexpected result");
  console.log("[desktop] better-sqlite3 Electron native smoke check passed");
  process.exit(0);
} catch (error) {
  console.error("[desktop] better-sqlite3 Electron native smoke check failed", error);
  process.exit(1);
}
