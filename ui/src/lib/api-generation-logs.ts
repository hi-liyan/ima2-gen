import { jsonFetch } from "./api-core";

export type GenerationLog = {
  requestId: string;
  kind: string;
  sessionId: string | null;
  provider: string | null;
  model: string | null;
  status: string;
  prompt: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  submitHttpStatus: number | null;
  finalHttpStatus: number | null;
  errorCode: string | null;
  startedAt: number;
  finishedAt: number | null;
  durationMs: number | null;
  callCount: number;
  failedCallCount: number;
  calls: GenerationLogCall[];
};

export type GenerationLogCall = {
  callId: string;
  operationId: string;
  provider: string | null;
  model: string | null;
  stage: string;
  status: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  httpStatus: number | null;
  errorCode: string | null;
  startedAt: number;
  finishedAt: number | null;
  durationMs: number | null;
};

export async function getGenerationLogs(): Promise<GenerationLog[]> {
  const result = await jsonFetch<{ logs: GenerationLog[] }>("/api/generation-logs?limit=100");
  return result.logs;
}

export async function getGenerationLog(requestId: string): Promise<GenerationLog> {
  const result = await jsonFetch<{ log: GenerationLog }>(`/api/generation-logs/${encodeURIComponent(requestId)}`);
  return result.log;
}

export async function clearGenerationLogs(): Promise<number> {
  const result = await jsonFetch<{ deleted: number }>("/api/generation-logs", { method: "DELETE" });
  return result.deleted;
}
