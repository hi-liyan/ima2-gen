import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const settings = readFileSync("ui/src/components/SettingsWorkspace.tsx", "utf8");
const types = readFileSync("ui/src/types.ts", "utf8");
const store = readFileSync("ui/src/store/useAppStore.ts", "utf8");
const app = readFileSync("ui/src/App.tsx", "utf8");
const css = readFileSync("ui/src/index.css", "utf8");
const themes = readFileSync("ui/src/styles/theme-families.css", "utf8");

test("设置保留七个分区并继续使用上游 Provider 与统一控件", () => {
  assert.match(types, /SettingsSection = "account" \| "generation" \| "appearance" \| "workspace" \| "language" \| "logs" \| "future"/);
  assert.match(settings, /"account",\s*"generation",\s*"appearance",\s*"workspace",\s*"language",\s*"logs",\s*"future"/s);
  assert.match(settings, /<SettingsSectionBlock id="account"/);
  assert.match(settings, /<SettingsSectionBlock id="generation"/);
  assert.match(settings, /<SettingsSectionBlock id="appearance"/);
  assert.match(settings, /<AccountSettings \/>/);
  assert.match(settings, /<Select/);
  assert.match(store, /activeSettingsSection: "account"/);
});

test("主题状态同步到根节点并提供浅色和主题族 token", () => {
  assert.match(app, /const resolvedTheme = useAppStore\(\(s\) => s\.resolvedTheme\)/);
  assert.match(app, /root\.dataset\.theme = resolvedTheme/);
  assert.match(app, /root\.dataset\.themeFamily = themeFamily/);
  assert.match(css, /:root\[data-theme="light"\]/);
  assert.match(themes, /:root\[data-theme-mode="light"\]\[data-theme-family="gpt"\]/);
});

test("设置打开时不保留历史条的网格布局", () => {
  assert.match(app, /const showHistoryStrip = !settingsOpen && !promptStudioClassic/);
  assert.match(app, /\{showHistoryStrip \? <HistoryStrip \/> : null\}/);
});

test("设置分区导航只滚动设置内容容器", () => {
  assert.match(settings, /const contentRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(settings, /content\.scrollTo\(\{/);
  assert.doesNotMatch(settings, /scrollIntoView\(/);
});
