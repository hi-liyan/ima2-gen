import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const persistencePath = "ui/src/store/referenceImagePersistence.ts";

test("main composer reference images have a dedicated IndexedDB persistence module", () => {
  assert.equal(existsSync(persistencePath), true, "reference image persistence module is missing");

  const source = readFileSync(persistencePath, "utf8");
  assert.match(source, /indexedDB\.open/);
  assert.match(source, /export async function loadPersistedReferenceImages/);
  assert.match(source, /export async function savePersistedReferenceImages/);
});

test("the app restores persisted main composer references after capabilities load", () => {
  const app = readFileSync("ui/src/App.tsx", "utf8");
  const store = readFileSync("ui/src/store/useAppStore.ts", "utf8");

  assert.match(app, /hydrateReferenceImages/);
  assert.match(store, /hydrateReferenceImages:/);
});

test("all main composer reference mutations synchronize the persisted array", () => {
  const refs = readFileSync("ui/src/store/storeReferenceImpl.ts", "utf8");
  const ui = readFileSync("ui/src/store/storeUIImpl.ts", "utf8");

  assert.match(refs, /savePersistedReferenceImages/);
  assert.match(ui, /savePersistedReferenceImages/);
  assert.match(refs, /clearPersistedReferenceImages/);
});
