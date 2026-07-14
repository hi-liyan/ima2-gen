/**
 * 将服务地址限制为本机回环 HTTP，避免桌面窗口意外导航到远程地址。
 */
export function loopbackUrl(value: string): string {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error(`Desktop server URL must be loopback HTTP: ${value}`);
  }
  url.hostname = "127.0.0.1";
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

/**
 * 在限定时间内轮询现有服务健康端点，服务可用后返回规范化的窗口地址。
 */
export async function waitForHealthyServer(value: string, timeoutMs = 15_000, retryMs = 100): Promise<string> {
  const url = loopbackUrl(value);
  const healthUrl = new URL("/api/health", url).toString();
  const deadline = Date.now() + timeoutMs;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(Math.min(retryMs, 1_000)) });
      const body = await response.json() as { ok?: boolean };
      if (response.ok && body.ok === true) return url;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, retryMs));
  }
  throw new Error(`Desktop server did not become healthy: ${lastError}`);
}
