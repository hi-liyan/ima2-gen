import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("generation logs retain safe request and response summaries per job", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ima2-generation-log-"));
  process.env.IMA2_DB_PATH = join(dir, "sessions.db");
  const { startJob, finishJob } = await import("../lib/inflight.ts");
  const {
    getGenerationLog,
    clearGenerationLogs,
    finishGenerationLogCall,
    startGenerationLogCall,
  } = await import("../lib/generationLogStore.ts");
  const { closeDb } = await import("../lib/db.ts");

  try {
    startJob({
      requestId: "log_request_1",
      kind: "classic",
      prompt: "A precise neon city skyline at dusk",
      meta: {
        provider: "api",
        model: "gpt-image-2",
        references: ["data:image/png;base64,very-secret-image"],
        apiKey: "sk-secret",
      },
    });
    const firstCall = startGenerationLogCall({
      operationId: "log_request_1",
      provider: "openai-api",
      model: "gpt-image-2",
      stage: "generate-image",
      request: { prompt: "A precise neon city skyline at dusk", authorization: "Bearer secret" },
    });
    const retryCall = startGenerationLogCall({
      operationId: "log_request_1",
      provider: "gemini-api",
      model: "gemini-3.1-flash-image",
      stage: "generate-content",
      request: { references: ["data:image/png;base64,very-secret-image"] },
    });
    finishGenerationLogCall({
      callId: firstCall,
      status: "error",
      httpStatus: 429,
      errorCode: "RATE_LIMITED",
      response: { error: "rate limited" },
    });
    finishGenerationLogCall({
      callId: retryCall,
      status: "completed",
      httpStatus: 200,
      response: { image: "very-secret-output", imageCount: 1 },
    });
    finishJob("log_request_1", {
      status: "completed",
      httpStatus: 200,
      meta: {
        filenames: ["city.png"],
        imageB64: "very-secret-output",
      },
    });

    const log = getGenerationLog("log_request_1");
    assert.ok(log);
    assert.equal(log.status, "completed");
    assert.equal(log.finalHttpStatus, 200);
    assert.equal(log.prompt, "A precise neon city skyline at dusk");
    assert.equal(log.request.prompt, "A precise neon city skyline at dusk");
    assert.equal(log.request.references, "[redacted]");
    assert.equal(log.request.apiKey, "[redacted]");
    assert.equal(log.response.imageB64, "[redacted]");
    assert.deepEqual(log.response.filenames, ["city.png"]);
    assert.equal(log.callCount, 2);
    assert.equal(log.failedCallCount, 1);
    assert.equal(log.calls.length, 2);
    assert.equal(log.calls[0].operationId, "log_request_1");
    assert.equal(log.calls[0].httpStatus, 429);
    assert.equal(log.calls[0].request.authorization, "[redacted]");
    assert.equal(log.calls[1].request.references, "[redacted]");
    assert.equal(log.calls[1].response.image, "[redacted]");
  } finally {
    clearGenerationLogs();
    closeDb();
    await rm(dir, { recursive: true, force: true });
  }
});
