import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

test("selected history thumbnails propagate active state to their lazy wrapper", () => {
  const strip = readFileSync(join(root, "ui/src/components/HistoryStrip.tsx"), "utf8");
  const css = readFileSync(join(root, "ui/src/styles/progress-composer.css"), "utf8");

  assert.match(
    strip,
    /const renderLazyThumb = \(key: string, content: ReactNode, active = false\) =>/,
  );
  assert.match(strip, /className=\{`history-thumb\$\{active \? " history-thumb--active-wrapper" : ""\}`\}/);
  const wrapperRule = /\.history-thumb--active-wrapper\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
  assert.match(wrapperRule, /opacity:\s*1/);
  assert.doesNotMatch(wrapperRule, /border/);
  assert.match(strip, /const collectionActive = multimodePreviewFlightId === `history:\$\{item\.sequenceId\}`;/);
  assert.match(strip, /renderLazyThumb\(`coll-\$\{item\.sequenceId\}`, \([\s\S]*?\), collectionActive\)/);
  assert.match(strip, /renderLazyThumb\(seqKey, \([\s\S]*?\), seqActive\)/);
  assert.match(strip, /renderLazyThumb\(key, \([\s\S]*?\), active\)/);
});
