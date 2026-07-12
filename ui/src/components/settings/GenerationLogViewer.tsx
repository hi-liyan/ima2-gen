import { useCallback, useEffect, useState } from "react";
import {
  clearGenerationLogs,
  getGenerationLog,
  getGenerationLogs,
  type GenerationLogCall,
  type GenerationLog,
} from "../../lib/api-generation-logs";
import { useI18n } from "../../i18n";

function statusKey(status: string): string {
  if (status === "completed") return "completed";
  if (status === "canceled") return "canceled";
  if (status === "running") return "running";
  return "error";
}

function kindKey(kind: string): string {
  if (kind === "edit" || kind === "multimode" || kind === "node" || kind === "agent_queue") return kind;
  return "classic";
}

function httpStatus(log: GenerationLog): string {
  const submit = log.submitHttpStatus;
  const final = log.finalHttpStatus;
  if (submit && final && submit !== final) return `${submit} -> ${final}`;
  return String(final ?? submit ?? "-");
}

function callHttpStatus(call: GenerationLogCall): string {
  return String(call.httpStatus ?? "-");
}

export function GenerationLogViewer() {
  const { t, locale } = useI18n();
  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [selected, setSelected] = useState<GenerationLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const next = await getGenerationLogs();
      setLogs(next);
      setSelected((current) => next.find((log) => log.requestId === current?.requestId) ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectLog = async (requestId: string) => {
    try {
      setSelected(await getGenerationLog(requestId));
    } catch {
      setError(true);
    }
  };

  const clear = async () => {
    if (!window.confirm(t("settings.logs.clearConfirm"))) return;
    try {
      await clearGenerationLogs();
      setLogs([]);
      setSelected(null);
    } catch {
      setError(true);
    }
  };

  return (
    <div className="generation-log-viewer">
      <div className="generation-log-viewer__toolbar">
        <button type="button" className="settings-action-btn" onClick={() => void refresh()} disabled={loading}>
          {t("settings.logs.refresh")}
        </button>
        <button type="button" className="settings-action-btn settings-action-btn--danger" onClick={() => void clear()} disabled={logs.length === 0}>
          {t("settings.logs.clear")}
        </button>
      </div>
      {loading ? <p className="generation-log-viewer__state">{t("common.loading")}</p> : null}
      {error ? <p className="generation-log-viewer__state is-error">{t("settings.logs.loadFailed")}</p> : null}
      {!loading && !error && logs.length === 0 ? <p className="generation-log-viewer__state">{t("settings.logs.empty")}</p> : null}
      {logs.length > 0 ? (
        <div className="generation-log-viewer__list" role="list" aria-label={t("settings.logs.listAria")}>
          {logs.map((log) => (
            <button
              key={log.requestId}
              type="button"
              className={`generation-log-viewer__row${selected?.requestId === log.requestId ? " is-selected" : ""}`}
              onClick={() => void selectLog(log.requestId)}
              aria-pressed={selected?.requestId === log.requestId}
            >
              <span className="generation-log-viewer__row-main">
                <strong>{t(`settings.logs.kind.${kindKey(log.kind)}`)}</strong>
                <span>{new Date(log.startedAt).toLocaleString(locale)}</span>
              </span>
              <span className="generation-log-viewer__row-meta">
                <span className={`generation-log-viewer__status is-${statusKey(log.status)}`}>{t(`settings.logs.status.${statusKey(log.status)}`)}</span>
                <span>{t("settings.logs.http", { status: httpStatus(log) })}</span>
                <span>{t("settings.logs.calls", { count: log.callCount, failed: log.failedCallCount })}</span>
              </span>
              <span className="generation-log-viewer__prompt">{log.prompt || t("settings.logs.noPrompt")}</span>
            </button>
          ))}
        </div>
      ) : null}
      {selected ? (
        <article className="generation-log-viewer__detail">
          <header>
            <strong>{t("settings.logs.operation")}</strong>
            <span>{t("settings.logs.duration", { ms: selected.durationMs ?? 0 })}</span>
          </header>
          <p className="generation-log-viewer__operation-id">{selected.requestId}</p>
          {selected.errorCode ? <p className="generation-log-viewer__error">{selected.errorCode}</p> : null}
          <h5>{t("settings.logs.request")}</h5>
          <pre>{JSON.stringify(selected.request, null, 2)}</pre>
          <h5>{t("settings.logs.response")}</h5>
          <pre>{JSON.stringify(selected.response, null, 2)}</pre>
          <h5>{t("settings.logs.providerCalls", { count: selected.calls.length })}</h5>
          {selected.calls.length === 0 ? <p className="generation-log-viewer__state">{t("settings.logs.noCalls")}</p> : null}
          {selected.calls.map((call, index) => (
            <section key={call.callId} className="generation-log-viewer__call">
              <header>
                <strong>{t("settings.logs.call", { index: index + 1 })}</strong>
                <span className={`generation-log-viewer__status is-${statusKey(call.status)}`}>{t(`settings.logs.status.${statusKey(call.status)}`)}</span>
              </header>
              <p className="generation-log-viewer__call-meta">
                {call.provider || "-"} · {call.model || "-"} · {call.stage} · {t("settings.logs.http", { status: callHttpStatus(call) })} · {t("settings.logs.duration", { ms: call.durationMs ?? 0 })}
              </p>
              {call.errorCode ? <p className="generation-log-viewer__error">{call.errorCode}</p> : null}
              <h6>{t("settings.logs.request")}</h6>
              <pre>{JSON.stringify(call.request, null, 2)}</pre>
              <h6>{t("settings.logs.response")}</h6>
              <pre>{JSON.stringify(call.response, null, 2)}</pre>
            </section>
          ))}
        </article>
      ) : null}
    </div>
  );
}
