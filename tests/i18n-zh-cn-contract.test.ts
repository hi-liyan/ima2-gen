import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function valueAt(dictionary: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => (
    current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined
  ), dictionary);
}

describe("zh-CN locale contract", () => {
  it("supports zh-CN in the locale switcher and translation dictionary", () => {
    const indexSource = readFileSync("ui/src/i18n/index.ts", "utf-8");
    assert.match(indexSource, /"zh-CN"/);
    assert.ok(existsSync("ui/src/i18n/zh-CN.json"));
    const dict = JSON.parse(readFileSync("ui/src/i18n/zh-CN.json", "utf-8"));
    assert.equal(dict.language["zh-CN"], "简体中文");
  });

  it("translates the settings workspace and account controls", () => {
    const en = JSON.parse(readFileSync("ui/src/i18n/en.json", "utf-8")) as Record<string, unknown>;
    const zh = JSON.parse(readFileSync("ui/src/i18n/zh-CN.json", "utf-8")) as Record<string, unknown>;
    const keys = [
      "settings.title",
      "settings.subtitle",
      "settings.sections.account.title",
      "settings.sections.generation.title",
      "settings.sections.appearance.title",
      "settings.account.oauthBody",
      "settings.quota.title",
      "settings.quota.switchAccount",
      "settings.imageModel.body",
      "settings.apiKeys.accordionTitle",
      "settings.reasoning.title",
      "settings.webSearch.body",
      "settings.grokCompatibility.body",
      "settings.gallery.defaultScopeTitle",
      "settings.appearance.themeTitle",
      "settings.future.body",
      "settings.logs.title",
      "settings.logs.body",
      "settings.logs.clear",
      "workspace.sectionTitle",
      "workspace.defaultDesc",
      "theme.label",
      "readiness.settingsBody",
      "provider.geminiApiCompatBodyLong",
      "gallery.scope.current",
    ];

    for (const key of keys) {
      assert.notEqual(valueAt(zh, key), valueAt(en, key), `${key} must be translated`);
    }
  });
});
