import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const zhCN = JSON.parse(readFileSync("ui/src/i18n/zh-CN.json", "utf8"));
const grid = readFileSync("ui/src/components/assets/AssetsGrid.tsx", "utf8");

test("Assets 工作区在中文 locale 下提供完整中文文案", () => {
  assert.equal(zhCN.assets?.title, "资源库");
  assert.equal(zhCN.assets?.searchPlaceholder, "搜索资源...");
  assert.equal(zhCN.assets?.kindImage, "图像");
  assert.equal(zhCN.assets?.emptyTitle, "暂无资源");
  assert.equal(zhCN.assets?.clearAll, "清空全部");
  assert.equal(zhCN.assets?.clearConfirm, "删除所有已保存的资源？此操作无法撤销。");
});

test("Assets 卡片使用翻译后的资源类型", () => {
  assert.match(grid, /t\(\`assets\.kind\$\{item\.kind\[0\]\.toUpperCase\(\)\}\$\{item\.kind\.slice\(1\)\}\`\)/);
});
