import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

describe("zh-CN locale contract", () => {
  it("supports zh-CN in the locale switcher and translation dictionary", () => {
    const indexSource = readFileSync("ui/src/i18n/index.ts", "utf-8");
    assert.match(indexSource, /"zh-CN"/);
    assert.ok(existsSync("ui/src/i18n/zh-CN.json"));
    const dict = JSON.parse(readFileSync("ui/src/i18n/zh-CN.json", "utf-8"));
    assert.equal(dict.language["zh-CN"], "简体中文");
  });
});
