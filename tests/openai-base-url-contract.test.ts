import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerGenerateRoutes } from "../routes/generate.ts";
import { registerHealthRoutes } from "../routes/health.ts";
import { mountKeyRoutes } from "../routes/keys.ts";
import { config } from "../config.js";
import type { RouteRuntimeContext } from "../lib/runtimeContext.js";

const FINAL_B64 = Buffer.from("final image").toString("base64");

let originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function sseResponse(events: unknown[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  }), { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
}

function imageEvents(images = [FINAL_B64]) {
  return [
    ...images.map((result) => ({
      type: "response.output_item.done",
      item: { type: "image_generation_call", result, revised_prompt: "revised" },
    })),
    { type: "response.completed", response: { usage: { total_tokens: 3 } } },
  ];
}

async function withOpenAiConfigApp(
  fn: (args: { baseUrl: string; configFile: string; ctx: Record<string, unknown> }) => Promise<void>,
  {
    apiKey = "sk-test",
    openaiBaseUrl = "https://api.openai.com/v1",
    openaiBaseUrlSource = "default",
  }: {
    apiKey?: string | null;
    openaiBaseUrl?: string;
    openaiBaseUrlSource?: "default" | "config" | "env";
  } = {},
) {
  const rootDir = await mkdtemp(join(tmpdir(), "ima2-openai-base-url-"));
  const generatedDir = join(rootDir, "generated");
  const configFile = join(rootDir, "config.json");
  const ctx: RouteRuntimeContext = {
    rootDir,
    apiKey,
    apiKeySource: apiKey ? "config" : "none",
    hasApiKey: !!apiKey,
    openaiBaseUrl,
    openaiBaseUrlSource,
    config: {
      ...config,
      storage: { ...config.storage, generatedDir, configFile },
      log: { ...config.log, level: "silent" },
    },
    packageVersion: "test",
  };
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  registerGenerateRoutes(app, ctx);
  registerHealthRoutes(app, ctx);
  mountKeyRoutes(app, ctx as any);
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const addr = server.address() as import("node:net").AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  try {
    await fn({ baseUrl, configFile, ctx });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(rootDir, { recursive: true, force: true });
  }
}

describe("OpenAI base URL contract", () => {
  it("generate provider=api uses ctx.openaiBaseUrl for Responses requests", async () => {
    const calls: string[] = [];
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("http://127.0.0.1:")) return originalFetch(url, init);
      calls.push(String(url));
      return sseResponse(imageEvents());
    };

    await withOpenAiConfigApp(async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "custom relay", provider: "api" }),
      });
      assert.equal(res.status, 200);
      assert.equal(calls[0], "https://proxy.example.com/v1/responses");
    }, { openaiBaseUrl: "https://proxy.example.com/v1", openaiBaseUrlSource: "config" });
  });

  it("PUT /api/providers/openai/config persists normalized baseUrl and hot-updates subsequent api generation", async () => {
    const calls: string[] = [];
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("http://127.0.0.1:")) return originalFetch(url, init);
      calls.push(String(url));
      if (String(url).endsWith("/models")) {
        return Response.json({ data: [{ id: "gpt-5.4-mini" }] });
      }
      return sseResponse(imageEvents());
    };

    await withOpenAiConfigApp(async ({ baseUrl, configFile }) => {
      const saveRes = await fetch(`${baseUrl}/api/providers/openai/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: "https://relay.example.com/" }),
      });
      assert.equal(saveRes.status, 200);

      const saved = JSON.parse(await readFile(configFile, "utf-8"));
      assert.equal(saved.apiProvider.baseUrl, "https://relay.example.com/v1");

      const genRes = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "after save", provider: "api" }),
      });
      assert.equal(genRes.status, 200);
      assert.ok(calls.includes("https://relay.example.com/v1/models"));
      assert.ok(calls.includes("https://relay.example.com/v1/responses"));
    });
  });

  it("/api/providers exposes openai base URL metadata", async () => {
    await withOpenAiConfigApp(async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/api/providers`);
      assert.equal(res.status, 200);
      const body = await res.json() as Record<string, unknown>;
      assert.equal(body.openaiBaseUrl, "https://proxy.example.com/v1");
      assert.equal(body.openaiBaseUrlSource, "config");
      assert.equal(body.openaiCustomBaseUrl, true);
    }, { openaiBaseUrl: "https://proxy.example.com/v1", openaiBaseUrlSource: "config" });
  });
});
