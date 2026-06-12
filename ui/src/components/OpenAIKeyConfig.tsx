import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../i18n";
import type { OpenAIProviderConfig } from "../hooks/useOpenAIProviderConfig";

type Props = {
  maskedKey: string | null;
  keySource: string;
  configured: boolean;
  config: OpenAIProviderConfig | null;
  onSaved: () => void;
};

function sourceLabel(t: (key: string) => string, source: string) {
  if (source === "env") return t("settings.apiKeys.envSource");
  if (source === "config") return t("settings.apiKeys.configSource");
  return t("settings.apiKeys.defaultSource");
}

export function OpenAIKeyConfig({ maskedKey, keySource, configured, config, onSaved }: Props) {
  const { t } = useI18n();
  const [key, setKey] = useState("");
  const [editingKey, setEditingKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isEnvKey = keySource === "env";
  const isEnvBaseUrl = config?.source === "env";
  const showMasked = configured && !editingKey && key.trim().length === 0;
  const keyDirty = key.trim().length > 0;
  const currentBaseUrl = config?.isDefault ? "" : (config?.baseUrl ?? "");
  const baseUrlDirty = baseUrl.trim() !== currentBaseUrl.trim();

  useEffect(() => {
    setBaseUrl(config?.isDefault ? "" : (config?.baseUrl ?? ""));
  }, [config?.baseUrl, config?.isDefault]);

  const handleSave = useCallback(async () => {
    if (!keyDirty && !baseUrlDirty) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      if (baseUrlDirty) {
        if (baseUrl.trim().length === 0) {
          const resetRes = await fetch("/api/providers/openai/config/base-url", { method: "DELETE" });
          const resetJson = await resetRes.json();
          if (!resetRes.ok || !resetJson.ok) throw new Error(resetJson.error || "Failed to reset base URL");
        } else {
          const urlRes = await fetch("/api/providers/openai/config", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ baseUrl: baseUrl.trim() }),
          });
          const urlJson = await urlRes.json();
          if (!urlRes.ok || !urlJson.ok) throw new Error(urlJson.error || "Failed to save base URL");
        }
      }

      if (keyDirty) {
        const keyRes = await fetch("/api/keys/openai", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: key.trim() }),
        });
        const keyJson = await keyRes.json();
        if (!keyRes.ok || !keyJson.ok) throw new Error(keyJson.error || "Failed to save API key");
      }

      setKey("");
      setEditingKey(false);
      setSuccess(true);
      onSaved();
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || "Failed to save OpenAI settings");
    } finally {
      setSaving(false);
    }
  }, [baseUrl, baseUrlDirty, key, keyDirty, onSaved]);

  const handleDeleteKey = useCallback(async () => {
    try {
      const res = await fetch("/api/keys/openai", { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to remove key");
        return;
      }
      setKey("");
      setEditingKey(false);
      onSaved();
    } catch (e: any) {
      setError(e.message || "Failed to remove key");
    }
  }, [onSaved]);

  return (
    <article className="settings-row">
      <div className="settings-row__copy">
        <p className="settings-eyebrow">{sourceLabel(t, keySource)}</p>
        <h4>{t("settings.apiKeys.openai.label")}</h4>
        <p>{t("settings.apiKeys.openai.baseUrlHelp")}</p>

        <div className="api-key-input-group">
          {showMasked ? (
            <input
              type="text"
              className="api-key-input is-masked"
              value={maskedKey || "●●●●●●"}
              readOnly
              onFocus={() => setEditingKey(true)}
              onClick={() => setEditingKey(true)}
            />
          ) : (
            <input
              type="password"
              className={`api-key-input${error ? " is-invalid" : ""}`}
              placeholder={t("settings.apiKeys.openai.placeholder")}
              value={key}
              onChange={(event) => { setKey(event.target.value); setError(null); }}
              readOnly={isEnvKey}
              autoComplete="off"
              autoFocus={editingKey}
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
            />
          )}
        </div>

        <div className="api-key-input-group">
          <input
            type="text"
            className={`api-key-input${error ? " is-invalid" : ""}`}
            placeholder={t("settings.apiKeys.openai.baseUrlPlaceholder")}
            value={baseUrl}
            onChange={(event) => { setBaseUrl(event.target.value); setError(null); }}
            readOnly={!!isEnvBaseUrl}
            spellCheck={false}
          />
        </div>
        <p className="settings-row__microcopy">
          {t("settings.apiKeys.openai.baseUrlStatus", { source: sourceLabel(t, config?.source ?? "default") })}
        </p>

        <div className="api-key-actions" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="settings-action-btn"
            onClick={handleSave}
            disabled={(!keyDirty && !baseUrlDirty) || saving}
          >
            {saving ? t("settings.apiKeys.saving") : success ? t("settings.apiKeys.saved") : t("settings.apiKeys.save")}
          </button>
          {configured && !isEnvKey && (
            <button
              type="button"
              className="settings-action-btn settings-action-btn--danger"
              onClick={handleDeleteKey}
            >
              {t("settings.apiKeys.remove")}
            </button>
          )}
        </div>
        {error && <p className="api-key-error">{error}</p>}
      </div>
      <div className={`settings-status${configured ? " is-ok" : ""}`}>
        <span aria-hidden="true" />
        {configured ? t("settings.apiKeys.status.valid") : t("settings.apiKeys.status.notConfigured")}
      </div>
    </article>
  );
}
