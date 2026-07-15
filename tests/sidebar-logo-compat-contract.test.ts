import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sidebarCss = readFileSync("ui/src/styles/sidebar.css", "utf8");

test("左上角 ima2gen 标识保留合并前的主题文字样式", () => {
  assert.match(sidebarCss, /\.logo-title \{[^}]*color: var\(--text\);[^}]*font-size: 15px;/s);
  assert.match(sidebarCss, /\.logo-title--gen \{[^}]*font-size: 14px;[^}]*linear-gradient\(135deg, var\(--blue\), var\(--green\)\)/s);
  assert.doesNotMatch(sidebarCss, /#c8ccd8/);
});
