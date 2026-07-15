import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sidebarCss = readFileSync("ui/src/styles/sidebar.css", "utf8");

test("左上角 ima2gen 标识与合并的上游样式一致", () => {
  assert.match(sidebarCss, /\.logo-title \{[^}]*font-family: var\(--font-display, 'Clash Display', system-ui, sans-serif\);[^}]*font-size: 16px;[^}]*color: transparent;[^}]*#c8ccd8/s);
  assert.match(sidebarCss, /\.logo-title--gen \{[^}]*font-size: 13px;[^}]*linear-gradient\(180deg, #c8ccd8 0%, #6f7484 50%, #e8eaf1 100%\)/s);
  assert.doesNotMatch(sidebarCss, /linear-gradient\(135deg, var\(--blue\), var\(--green\)\)/);
});
