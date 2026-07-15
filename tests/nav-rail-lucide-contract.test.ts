import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const navRail = readFileSync("ui/src/components/NavRail.tsx", "utf8");
const packageJson = readFileSync("ui/package.json", "utf8");

test("左侧导航使用 Lucide 图标而非手写 SVG", () => {
  assert.match(packageJson, /"lucide-react":/);
  assert.match(navRail, /from "lucide-react"/);
  assert.match(navRail, /House, ImagePlus, Workflow, Bot, FolderOpen, Settings/);
  assert.doesNotMatch(navRail, /function Icon(Create|Home|Node|Agent|Settings|Assets)\(/);
});
