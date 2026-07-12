import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settings = readFileSync("ui/src/components/SettingsWorkspace.tsx", "utf8");
const viewer = readFileSync("ui/src/components/settings/GenerationLogViewer.tsx", "utf8");
const routes = readFileSync("routes/generationLogs.ts", "utf8");

test("settings groups provider calls under each persistent generation operation", () => {
  assert.match(settings, /SettingsSectionBlock id="logs"/);
  assert.match(settings, /<GenerationLogViewer/);
  assert.match(viewer, /getGenerationLogs\(\)/);
  assert.match(viewer, /getGenerationLog\(requestId\)/);
  assert.match(viewer, /clearGenerationLogs\(\)/);
  assert.match(viewer, /settings\.logs\.request/);
  assert.match(viewer, /settings\.logs\.response/);
  assert.match(viewer, /selected\.calls\.map/);
  assert.match(viewer, /settings\.logs\.providerCalls/);
  assert.match(routes, /app\.get\("\/api\/generation-logs"/);
  assert.match(routes, /app\.delete\("\/api\/generation-logs"/);
});
