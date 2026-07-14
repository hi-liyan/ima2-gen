import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { loopbackUrl, waitForHealthyServer } from "../desktop/runtime.ts";

test("loopbackUrl accepts the server URL and rejects a non-loopback URL", () => {
  assert.equal(loopbackUrl("http://localhost:3333"), "http://127.0.0.1:3333/");
  assert.throws(() => loopbackUrl("https://example.com"), /loopback/i);
});

test("waitForHealthyServer resolves after the health endpoint responds ok", async () => {
  const server = createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(typeof address === "object" && address);
  try {
    const url = await waitForHealthyServer(`http://127.0.0.1:${address.port}`, 500, 10);
    assert.equal(url, `http://127.0.0.1:${address.port}/`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("waitForHealthyServer rejects after its deadline", async () => {
  await assert.rejects(waitForHealthyServer("http://127.0.0.1:9", 30, 10), /did not become healthy/i);
});
