const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

type BaseUrlSource = "env" | "config" | "default";

type BaseUrlResult = {
  baseUrl: string;
  source: BaseUrlSource;
};

type NormalizeOk = {
  ok: true;
  baseUrl: string;
};

type NormalizeError = {
  ok: false;
  code: string;
  error: string;
};

export function defaultOpenAIBaseUrl() {
  return DEFAULT_OPENAI_BASE_URL;
}

export function normalizeOpenAIBaseUrl(value: string | null | undefined): NormalizeOk | NormalizeError {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { ok: true, baseUrl: DEFAULT_OPENAI_BASE_URL };
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, code: "INVALID_OPENAI_BASE_URL", error: "OpenAI base URL must be a valid absolute URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, code: "INVALID_OPENAI_BASE_URL_SCHEME", error: "OpenAI base URL must use http or https" };
  }
  if (!parsed.host) {
    return { ok: false, code: "INVALID_OPENAI_BASE_URL_HOST", error: "OpenAI base URL must include a host" };
  }
  if (parsed.search) {
    return { ok: false, code: "INVALID_OPENAI_BASE_URL_QUERY", error: "OpenAI base URL cannot include a query string" };
  }
  if (parsed.hash) {
    return { ok: false, code: "INVALID_OPENAI_BASE_URL_HASH", error: "OpenAI base URL cannot include a fragment" };
  }
  const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/" || pathname === "") parsed.pathname = "/v1";
  else if (pathname === "/v1") parsed.pathname = "/v1";
  else {
    return { ok: false, code: "INVALID_OPENAI_BASE_URL_PATH", error: "OpenAI base URL must end at /v1" };
  }
  return { ok: true, baseUrl: parsed.toString().replace(/\/$/, "") };
}

export function loadOpenAIBaseUrlFromSources(
  envValue: string | undefined,
  fileValue: string | undefined,
): BaseUrlResult {
  if (typeof envValue === "string" && envValue.trim()) {
    const normalized = normalizeOpenAIBaseUrl(envValue);
    return { baseUrl: normalized.ok ? normalized.baseUrl : DEFAULT_OPENAI_BASE_URL, source: "env" };
  }
  if (typeof fileValue === "string" && fileValue.trim()) {
    const normalized = normalizeOpenAIBaseUrl(fileValue);
    return { baseUrl: normalized.ok ? normalized.baseUrl : DEFAULT_OPENAI_BASE_URL, source: "config" };
  }
  return { baseUrl: DEFAULT_OPENAI_BASE_URL, source: "default" };
}
