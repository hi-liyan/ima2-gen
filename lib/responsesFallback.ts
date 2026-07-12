import { logEvent } from "./logger.js";
import type { ParsedResponsesResult } from "./responsesParse.js";
import type { RouteRuntimeContext } from "./runtimeContext.js";
import { imageToolChoice, tools } from "./responsesTools.js";
import { emptyResponseError } from "./responsesErrors.js";
import {
  GENERATE_DEVELOPER_PROMPT,
  GENERATE_NO_SEARCH_DEVELOPER_PROMPT,
  buildUserTextPrompt,
} from "./oauthProxy.js";

type PostResponses = (args: {
  ctx: RouteRuntimeContext;
  provider: string | undefined;
  scope: string;
  payload: unknown;
  requestId?: string | null;
  maxImages?: number;
  signal?: AbortSignal | null;
}) => Promise<ParsedResponsesResult>;

const MAX_RETRIES = 2;

export async function retryPromptOnlyJsonImage({
  postResponses,
  ctx,
  provider,
  prompt,
  mode,
  model,
  quality,
  size,
  moderation,
  requestId,
  signal,
  initial,
  referencesDroppedOnRetry,
  webSearchDroppedOnRetry,
  reasoningEffort,
}: {
  postResponses: PostResponses;
  ctx: RouteRuntimeContext;
  provider: string | undefined;
  prompt: string | undefined;
  mode: string;
  model: string;
  quality?: string;
  size?: string;
  moderation?: string;
  requestId: string | null;
  signal?: AbortSignal | null;
  initial: ParsedResponsesResult;
  referencesDroppedOnRetry: boolean;
  webSearchDroppedOnRetry: boolean;
  reasoningEffort?: string;
}) {
  if (provider === "api") return null;
  const developerPrompt = webSearchDroppedOnRetry
    ? GENERATE_NO_SEARCH_DEVELOPER_PROMPT
    : GENERATE_DEVELOPER_PROMPT;

  // Retry chain: keep the developer prompt for the first MAX_RETRIES attempts
  // (censorship relief), then make one final attempt with the user prompt only
  // so a clean, instruction-free generation gets the last word.
  const attemptPlans = [
    ...Array.from({ length: MAX_RETRIES }, () => ({
      retryKind: "prompt_only_with_developer",
      developerPromptDroppedOnRetry: false,
    })),
    {
      retryKind: "prompt_only_json_image_tool",
      developerPromptDroppedOnRetry: true,
    },
  ];

  const baseMeta = {
    initialEventCount: initial.eventCount,
    initialEventTypes: initial.eventTypes,
    referencesDroppedOnRetry,
    webSearchDroppedOnRetry,
  };
  let retryMeta = { ...baseMeta, ...attemptPlans[attemptPlans.length - 1] };

  let lastRetry: ParsedResponsesResult | null = null;

  for (let attempt = 1; attempt <= attemptPlans.length; attempt++) {
    const plan = attemptPlans[attempt - 1];
    retryMeta = { ...baseMeta, ...plan };
    logEvent("oauth", "retry_attempt", { requestId, attempt, maxRetries: attemptPlans.length, ...retryMeta });
    try {
      lastRetry = await postResponses({
        ctx,
        provider,
        scope: "oauth-fallback",
        requestId,
        maxImages: 1,
        signal,
        payload: {
          model,
          input: [
            ...(plan.developerPromptDroppedOnRetry ? [] : [{ role: "developer", content: developerPrompt }]),
            { role: "user", content: buildUserTextPrompt(prompt, mode, { webSearchEnabled: false, size }) },
          ],
          tools: tools(false, { quality, size, moderation }),
          tool_choice: imageToolChoice(true),
          reasoning: { effort: reasoningEffort || "low" },
          // OAuth/Codex proxy returns empty output[] for non-stream image requests; SSE required.
          stream: true,
        },
      });
    } catch (e) {
      if (attempt === attemptPlans.length) {
        if (e && typeof e === "object") Object.assign(e, retryMeta);
        throw e;
      }
      logEvent("oauth", "retry_error", { requestId, attempt, error: (e as Error).message, status: (e as any).status, code: (e as any).code });
      continue;
    }
    const image = lastRetry.images[0];
    if (image?.b64) {
      logEvent("oauth", "retry_image", { requestId, retryKind: plan.retryKind, attempt, imageChars: image.b64.length });
      return { b64: image.b64, usage: lastRetry.usage, webSearchCalls: initial.webSearchCalls, revisedPrompt: image.revisedPrompt, text: lastRetry.text, ...retryMeta };
    }
    logEvent("oauth", "retry_no_image", { requestId, retryKind: plan.retryKind, attempt, fallbackEventCount: lastRetry.eventCount });
  }

  const diagSource = lastRetry ?? initial;
  throw emptyResponseError("No image data received after retries", diagSource, {
    provider,
    model,
    quality,
    size,
    moderation,
    webSearchEnabled: false,
    refsCount: 0,
    inputImageCount: 0,
    promptChars: typeof prompt === "string" ? prompt.length : 0,
    toolTypes: ["image_generation"],
    toolChoiceKind: "image_generation",
    ...retryMeta,
    fallbackEventCount: diagSource.eventCount,
    fallbackEventTypes: diagSource.eventTypes,
    fallbackImageCallSeen: diagSource.diagnostics.imageCallSeen,
    fallbackImageResultCount: diagSource.diagnostics.imageResultCount,
  });
}
