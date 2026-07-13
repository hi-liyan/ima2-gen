import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("root development runner watches the TypeScript server source", () => {
  const devRunner = readFileSync("scripts/dev.mjs", "utf8");

  assert.match(devRunner, /\["run", "dev:server"\]/);
  assert.doesNotMatch(devRunner, /\["--watch", "server\.js"\]/);
});
