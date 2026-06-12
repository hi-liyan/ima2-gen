import { useCallback, useEffect, useState } from "react";

export type OpenAIProviderConfig = {
  baseUrl: string;
  source: "env" | "config" | "default";
  isDefault: boolean;
  hasApiKey: boolean;
  apiKeySource: "none" | "env" | "config";
};

export function useOpenAIProviderConfig() {
  const [data, setData] = useState<OpenAIProviderConfig | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/providers/openai/config");
      const json: OpenAIProviderConfig = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  return { data, error, mutate: fetchConfig };
}
