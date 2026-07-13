import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { readStoreBundle } from "./_storeBundle.mjs";

const store = readStoreBundle();
const historyStore = readFileSync("ui/src/store/storeHistoryImpl.ts", "utf8");
const strip = readFileSync("ui/src/components/HistoryStrip.tsx", "utf8");
const css = readFileSync("ui/src/styles/progress-composer.css", "utf8");
const registry = readFileSync("ui/src/store/persistenceRegistry.ts", "utf8");

test("persists which history images have been previewed", () => {
  assert.match(registry, /"ima2\.seenHistoryItemKeys"/);
  assert.match(store, /seenHistoryItemKeys:\s*loadSeenHistoryItemKeys\(\)/);
  assert.match(store, /markHistoryItemsSeen:/);
  assert.match(historyStore, /markHistoryItemsSeen\(\[target\]\)/);
  assert.match(historyStore, /markHistoryItemsSeen\(items\)/);
});

test("shows NEW only on history thumbnails that have not been previewed", () => {
  assert.match(strip, /const seenHistoryItemKeys = useAppStore\(\(s\) => s\.seenHistoryItemKeys\)/);
  assert.match(strip, /isHistoryItemUnseen\(item, seenHistoryItemKeys\)/);
  assert.match(strip, /history-thumb__new-badge/);
  assert.match(css, /\.history-thumb__new-badge/);
});
