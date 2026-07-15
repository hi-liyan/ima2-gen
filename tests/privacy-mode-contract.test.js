import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("privacy mode persists its setting and exposes it in Appearance settings", () => {
  const store = read("ui/src/store/useAppStore.ts");
  const types = read("ui/src/store/storeTypes.ts");
  const persistence = read("ui/src/store/persistenceRegistry.ts");
  const settings = read("ui/src/components/SettingsWorkspace.tsx");

  assert.match(store, /privacyMode: loadPrivacyMode\(\)/);
  assert.match(store, /setPrivacyMode: \(enabled\) => setPrivacyModeImpl\(enabled, set\)/);
  assert.match(types, /privacyMode: boolean/);
  assert.match(types, /setPrivacyMode: \(enabled: boolean\) => void/);
  assert.match(persistence, /"ima2\.privacyMode"/);
  assert.match(settings, /setPrivacyMode/);
  assert.match(settings, /settings\.appearance\.privacyMode\.title/);
});

test("privacy mode shields only the classic preview and restores shielding on release or focus loss", () => {
  const canvas = read("ui/src/components/Canvas.tsx");
  const multimode = read("ui/src/components/MultimodeSequencePreview.tsx");
  const actions = read("ui/src/components/ResultActions.tsx");
  const shield = read("ui/src/components/PrivacyPreviewShield.tsx");
  const hook = read("ui/src/hooks/usePrivacyPreviewHold.ts");
  const previewCss = read("ui/src/styles/result-preview.css");

  assert.match(canvas, /privacyMode/);
  assert.match(canvas, /usePrivacyPreviewHold\(privacyMode\)/);
  assert.match(canvas, /<PrivacyPreviewShield/);
  assert.match(canvas, /showControl=\{false\}/);
  assert.match(actions, /<PrivacyPreviewRevealButton/);
  assert.match(actions, /privacyHold/);
  assert.match(multimode, /privacyMode/);
  assert.match(multimode, /<PrivacyPreviewShield/);
  assert.match(shield, /onPointerDown/);
  assert.match(shield, /onPointerUp/);
  assert.match(shield, /onPointerCancel/);
  assert.match(shield, /className="action-btn privacy-preview-shield__hold"/);
  assert.doesNotMatch(previewCss, /\.privacy-preview-shield__hold\s*\{[\s\S]*?(min-width|border:|background:)/);
  assert.match(hook, /window\.addEventListener\("blur"/);
  assert.match(hook, /document\.addEventListener\("visibilitychange"/);
  assert.match(hook, /document\.hidden/);
});

test("privacy shield explains that privacy mode is enabled while the preview is covered", () => {
  const shield = read("ui/src/components/PrivacyPreviewShield.tsx");
  const css = read("ui/src/styles/result-preview.css");
  const zh = read("ui/src/i18n/zh-CN.json");
  const en = read("ui/src/i18n/en.json");
  const ko = read("ui/src/i18n/ko.json");

  assert.match(shield, /t\("privacyPreview\.protected"\)/);
  assert.match(shield, /className="privacy-preview-shield__message"/);
  assert.match(css, /\.privacy-preview-shield__message\s*\{/);
  assert.match(zh, /"protected": "防窥模式已开启"/);
  assert.match(en, /"protected": "Privacy mode is on"/);
  assert.match(ko, /"protected": "프라이버시 모드가 켜져 있습니다"/);
});
