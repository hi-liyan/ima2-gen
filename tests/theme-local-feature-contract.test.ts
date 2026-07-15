import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("上游同步后仍保留本地主题切换与持久化实现", () => {
  assert.equal(existsSync("ui/src/components/ThemeToggle.tsx"), true);

  const persistence = readFileSync("ui/src/store/storePersistence.ts", "utf8");
  const uiStore = readFileSync("ui/src/store/storeUIImpl.ts", "utf8");
  const appStore = readFileSync("ui/src/store/useAppStore.ts", "utf8");
  assert.match(persistence, /export function loadThemePreference/);
  assert.match(persistence, /export function loadThemeFamily/);
  assert.match(persistence, /export function resolveThemePreference/);
  assert.match(uiStore, /export function setThemeImpl/);
  assert.match(uiStore, /export function setThemeFamilyImpl/);
  assert.match(appStore, /theme:\s*loadThemePreference\(\)/);
  assert.match(appStore, /resolvedTheme:\s*resolveThemePreference\(loadThemePreference\(\)\)/);
  assert.match(appStore, /themeFamily:\s*loadThemeFamily\(\)/);
});
