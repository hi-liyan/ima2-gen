import { getDb } from "./db.js";
import { randomUUID } from "node:crypto";

const LOGGABLE_KINDS = new Set(["classic", "edit", "multimode", "node", "agent_queue"]);
const MAX_TEXT_LENGTH = 20_000;
const MAX_COLLECTION_ITEMS = 50;
const MAX_GENERATION_LOGS = 1_000;
const SENSITIVE_KEY = /(?:api[_-]?key|authorization|cookie|token|password|secret|base64|b64|dataurl|image(?:_url)?|mask|references?)/i;

type LogRow = {
  request_id: string;
  kind: string;
  session_id: string | null;
  provider: string | null;
  model: string | null;
  status: string;
  prompt: string;
  request_json: string;
  response_json: string;
  submit_http_status: number | null;
  final_http_status: number | null;
  error_code: string | null;
  started_at: number;
  finished_at: number | null;
  duration_ms: number | null;
  call_count?: number;
  failed_call_count?: number;
};

type CallRow = {
  call_id: string;
  operation_id: string;
  provider: string | null;
  model: string | null;
  stage: string;
  status: string;
  request_json: string;
  response_json: string;
  http_status: number | null;
  error_code: string | null;
  started_at: number;
  finished_at: number | null;
  duration_ms: number | null;
};

type GenerationLogMeta = Record<string, unknown>;

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

export function startGenerationLog(input: {
  requestId: string;
  kind: string;
  prompt?: string | null;
  meta?: GenerationLogMeta;
  startedAt: number;
}): void {
  const meta = input.meta ?? {};
  const logKind = stringOrNull(meta.kind) ?? input.kind;
  if (!LOGGABLE_KINDS.has(logKind) || !input.requestId) return;
  getDb().prepare(`
    INSERT OR IGNORE INTO generation_logs (
      request_id, kind, session_id, provider, model, status, prompt, request_json, started_at
    ) VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?)
  `).run(
    input.requestId,
    logKind,
    stringOrNull(meta.sessionId),
    stringOrNull(meta.provider),
    stringOrNull(meta.model),
    trimText(input.prompt),
    stringifySafe({ prompt: input.prompt ?? "", ...meta }),
    input.startedAt,
  );
  getDb().prepare(`
    DELETE FROM generation_logs
    WHERE request_id IN (
      SELECT request_id FROM generation_logs
      ORDER BY started_at DESC
      LIMIT -1 OFFSET ?
    )
  `).run(MAX_GENERATION_LOGS);
  getDb().prepare(`
    DELETE FROM generation_log_calls
    WHERE operation_id NOT IN (SELECT request_id FROM generation_logs)
  `).run();
}

export function startGenerationLogCall(input: {
  operationId: string | null | undefined;
  provider?: string | null;
  model?: string | null;
  stage: string;
  request?: GenerationLogMeta;
  startedAt?: number;
}): string | null {
  if (!input.operationId || !input.stage) return null;
  const operation = getDb()
    .prepare("SELECT request_id FROM generation_logs WHERE request_id = ?")
    .get(input.operationId) as { request_id?: string } | undefined;
  if (!operation?.request_id) return null;
  const callId = randomUUID();
  getDb().prepare(`
    INSERT INTO generation_log_calls (
      call_id, operation_id, provider, model, stage, status, request_json, started_at
    ) VALUES (?, ?, ?, ?, ?, 'running', ?, ?)
  `).run(
    callId,
    input.operationId,
    stringOrNull(input.provider),
    stringOrNull(input.model),
    input.stage,
    stringifySafe(input.request ?? {}),
    input.startedAt ?? Date.now(),
  );
  return callId;
}

export function finishGenerationLogCall(input: {
  callId: string | null | undefined;
  status: string;
  httpStatus?: number;
  errorCode?: string;
  response?: GenerationLogMeta;
  finishedAt?: number;
}): void {
  if (!input.callId) return;
  const started = getDb()
    .prepare("SELECT started_at FROM generation_log_calls WHERE call_id = ?")
    .get(input.callId) as { started_at?: number } | undefined;
  if (!started?.started_at) return;
  const finishedAt = input.finishedAt ?? Date.now();
  getDb().prepare(`
    UPDATE generation_log_calls
    SET status = ?, response_json = ?, http_status = ?, error_code = ?, finished_at = ?, duration_ms = ?
    WHERE call_id = ?
  `).run(
    input.status,
    stringifySafe(input.response ?? {}),
    numberOrNull(input.httpStatus),
    input.errorCode ?? null,
    finishedAt,
    finishedAt - Number(started.started_at),
    input.callId,
  );
}

export function markGenerationLogSubmitted(requestId: string | null | undefined, status: number): void {
  if (!requestId) return;
  getDb().prepare(`
    UPDATE generation_logs
    SET submit_http_status = ?
    WHERE request_id = ?
  `).run(status, requestId);
}

export function finishGenerationLog(input: {
  requestId: string | null | undefined;
  status: string;
  finalHttpStatus?: number;
  errorCode?: string;
  meta?: GenerationLogMeta;
  finishedAt: number;
}): void {
  if (!input.requestId) return;
  const started = getDb()
    .prepare("SELECT started_at FROM generation_logs WHERE request_id = ?")
    .get(input.requestId) as { started_at?: number } | undefined;
  if (!started?.started_at) return;
  getDb().prepare(`
    UPDATE generation_logs
    SET status = ?, response_json = ?, final_http_status = ?, error_code = ?, finished_at = ?, duration_ms = ?
    WHERE request_id = ?
  `).run(
    input.status,
    stringifySafe({
      status: input.status,
      httpStatus: input.finalHttpStatus ?? null,
      errorCode: input.errorCode ?? null,
      ...(input.meta ?? {}),
    }),
    numberOrNull(input.finalHttpStatus),
    input.errorCode ?? null,
    input.finishedAt,
    input.finishedAt - Number(started.started_at),
    input.requestId,
  );
}

export function listGenerationLogs(limit = 50): GenerationLog[] {
  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit) || 50, 200));
  return getDb().prepare(`
    SELECT generation_logs.*,
      (SELECT COUNT(*) FROM generation_log_calls WHERE operation_id = generation_logs.request_id) AS call_count,
      (SELECT COUNT(*) FROM generation_log_calls WHERE operation_id = generation_logs.request_id AND status IN ('error', 'canceled')) AS failed_call_count
    FROM generation_logs
    ORDER BY started_at DESC LIMIT ?
  `).all(boundedLimit).map((row) => toLog(row as LogRow, false));
}

export function getGenerationLog(requestId: string): GenerationLog | null {
  const row = getDb().prepare("SELECT * FROM generation_logs WHERE request_id = ?").get(requestId) as LogRow | undefined;
  if (!row) return null;
  const calls = getDb().prepare(`
    SELECT * FROM generation_log_calls WHERE operation_id = ? ORDER BY started_at ASC
  `).all(requestId).map((call) => toCall(call as CallRow));
  return { ...toLog(row, true), callCount: calls.length, failedCallCount: calls.filter(isFailedCall).length, calls };
}

export function clearGenerationLogs(): number {
  const db = getDb();
  const deleted = db.transaction(() => {
    db.prepare("DELETE FROM generation_log_calls").run();
    return Number(db.prepare("DELETE FROM generation_logs").run().changes || 0);
  })();
  return deleted;
}

function toLog(row: LogRow, includeDetails: boolean): GenerationLog {
  return {
    requestId: row.request_id,
    kind: row.kind,
    sessionId: row.session_id,
    provider: row.provider,
    model: row.model,
    status: row.status,
    prompt: row.prompt,
    request: includeDetails ? parseObject(row.request_json) : {},
    response: includeDetails ? parseObject(row.response_json) : {},
    submitHttpStatus: numberOrNull(row.submit_http_status),
    finalHttpStatus: numberOrNull(row.final_http_status),
    errorCode: row.error_code,
    startedAt: Number(row.started_at),
    finishedAt: numberOrNull(row.finished_at),
    durationMs: numberOrNull(row.duration_ms),
    callCount: Number(row.call_count || 0),
    failedCallCount: Number(row.failed_call_count || 0),
    calls: [],
  };
}

function toCall(row: CallRow): GenerationLogCall {
  return {
    callId: row.call_id,
    operationId: row.operation_id,
    provider: row.provider,
    model: row.model,
    stage: row.stage,
    status: row.status,
    request: parseObject(row.request_json),
    response: parseObject(row.response_json),
    httpStatus: numberOrNull(row.http_status),
    errorCode: row.error_code,
    startedAt: Number(row.started_at),
    finishedAt: numberOrNull(row.finished_at),
    durationMs: numberOrNull(row.duration_ms),
  };
}

function isFailedCall(call: GenerationLogCall): boolean {
  return call.status === "error" || call.status === "canceled";
}

function stringifySafe(value: unknown): string {
  return JSON.stringify(sanitize(value, "", 0));
}

function sanitize(value: unknown, key: string, depth: number): unknown {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    if (/^data:image\//i.test(value)) return "[redacted:image-data]";
    return trimText(value);
  }
  if (depth >= 5) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, MAX_COLLECTION_ITEMS).map((item) => sanitize(item, "", depth + 1));
  if (typeof value !== "object") return String(value);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, MAX_COLLECTION_ITEMS)
      .map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey, depth + 1)]),
  );
}

function parseObject(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function trimText(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX_TEXT_LENGTH) : "";
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
