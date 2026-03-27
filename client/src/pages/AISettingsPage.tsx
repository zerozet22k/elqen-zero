import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "../hooks/use-session";
import { apiRequest } from "../services/api";
import { AISettings, AuditLog, BillingState } from "../types/models";
import geminiModelOptionsData from "../utils/gemini-model-options.json";
import { BillingUpgradePanel } from "../features/billing/billing-upgrade";

const geminiModelOptions = geminiModelOptionsData.models;

type ToggleRowProps = {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
};

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "bg-slate-900" : "bg-slate-300",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition",
            checked ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

type AIBillingAccess = {
  allowBYOAI: boolean;
  allowAutomation: boolean;
};

type AISettingsResponse = {
  settings: AISettings | null;
  billingAccess: AIBillingAccess;
  billing: BillingState;
};

export function AISettingsPage() {
  const { activeWorkspace } = useSession();
  const workspaceId = activeWorkspace?._id;

  const [settings, setSettings] = useState<AISettings | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isBooting, setIsBooting] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState("");
  const [clearGeminiApiKey, setClearGeminiApiKey] = useState(false);
  const [billingAccess, setBillingAccess] = useState<AIBillingAccess>({
    allowBYOAI: true,
    allowAutomation: true,
  });
  const [billing, setBilling] = useState<BillingState | null>(null);

  const geminiKeyStatusLabel = clearGeminiApiKey
    ? "Key will be removed"
    : geminiApiKeyInput.trim()
    ? settings?.hasGeminiApiKey
      ? "Replacement key ready"
      : "New key ready"
    : settings?.hasGeminiApiKey
    ? "Workspace key saved"
    : "No workspace key saved";
  const workspaceAIRuntimeLocked =
    !billingAccess.allowBYOAI || !billingAccess.allowAutomation;
  const workspaceAILockMessage = !billingAccess.allowBYOAI
    ? "This plan does not include BYO AI, so workspace AI controls are locked."
    : !billingAccess.allowAutomation
      ? "This plan does not include automation, so workspace AI runtime controls are locked."
      : null;
  const workspaceAIUpgradeTitle = !billingAccess.allowBYOAI
    ? "BYO AI is not included"
    : !billingAccess.allowAutomation
      ? "Automation is not included"
      : null;
  const workspaceAIUpgradeDescription = !billingAccess.allowBYOAI
    ? "Upgrade the plan before enabling workspace AI settings, saving a Gemini key, or turning on AI-assisted replies."
    : !billingAccess.allowAutomation
      ? "Upgrade the plan before enabling automation controls for this workspace."
      : null;
  const visibleLogs = useMemo(() => {
    const filtered = logs.filter(
      (log) =>
        !log.eventType.startsWith("automation.buffer.") &&
        log.eventType !== "webhook.received"
    );

    return filtered.length ? filtered : logs;
  }, [logs]);

  const loadSettings = useCallback(async () => {
    if (!workspaceId) return;

    const response = await apiRequest<AISettingsResponse>(
      "/api/ai-settings",
      {},
      { workspaceId }
    );
    setBillingAccess(response.billingAccess);
    setBilling(response.billing);

    setSettings(
      response.settings ?? {
        workspaceId,
        enabled: true,
        autoReplyEnabled: true,
        autoReplyMode: "all",
        afterHoursEnabled: true,
        confidenceThreshold: 0.7,
        fallbackMessage:
          "Thanks for your message. A teammate will follow up soon.",
        assistantInstructions: "",
        geminiModel: "",
        hasGeminiApiKey: false,
        supportedChannels: {
          facebook: true,
          instagram: true,
          telegram: true,
          viber: true,
          tiktok: true,
          line: true,
          website: true,
        },
      }
    );
    setSaveMessage(null);
    setGeminiApiKeyInput("");
    setClearGeminiApiKey(false);
  }, [workspaceId]);

  const loadLogs = useCallback(async () => {
    if (!workspaceId) return;

    const response = await apiRequest<{ items: AuditLog[] }>(
      "/api/audit-logs",
      {},
      {
        workspaceId,
        limit: 12,
      }
    );

    setLogs(response.items);
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;

    async function boot() {
      try {
        setIsBooting(true);
        setError(null);
        await Promise.all([loadSettings(), loadLogs()]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load AI settings.");
        }
      } finally {
        if (!cancelled) {
          setIsBooting(false);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, loadSettings, loadLogs]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings || workspaceAIRuntimeLocked) return;

    try {
      setIsSaving(true);
      setError(null);
      setSaveMessage(null);

      const payload: Record<string, unknown> = {
        enabled: settings.enabled,
        autoReplyEnabled: settings.autoReplyMode !== "none",
        autoReplyMode: settings.autoReplyMode,
        afterHoursEnabled: settings.afterHoursEnabled,
        confidenceThreshold: settings.confidenceThreshold,
        fallbackMessage: settings.fallbackMessage,
        assistantInstructions: settings.assistantInstructions,
        geminiModel: settings.geminiModel.trim(),
        supportedChannels: settings.supportedChannels,
      };

      if (geminiApiKeyInput.trim()) {
        payload.geminiApiKey = geminiApiKeyInput.trim();
      } else if (clearGeminiApiKey) {
        payload.geminiApiKey = "";
      }

      const [response] = await Promise.all([
        apiRequest<AISettingsResponse>("/api/ai-settings", {
          method: "PATCH",
          body: JSON.stringify(payload),
        }),
        apiRequest("/api/automations", {
          method: "PATCH",
          body: JSON.stringify({
            workspaceId,
            afterHoursRule: {
              name: "After Hours",
              isActive: settings.afterHoursEnabled,
              mode: "after_hours",
            },
          }),
        }),
      ]);

      setSettings(response.settings);
      setBillingAccess(response.billingAccess);
      setBilling(response.billing);
      if (clearGeminiApiKey) {
        setSaveMessage("Workspace Gemini key removed.");
      } else if (geminiApiKeyInput.trim()) {
        setSaveMessage("Workspace Gemini key saved.");
      } else {
        setSaveMessage("AI settings saved.");
      }
      setGeminiApiKeyInput("");
      setClearGeminiApiKey(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshLogs = async () => {
    try {
      setIsRefreshingLogs(true);
      setError(null);
      await loadLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh logs.");
    } finally {
      setIsRefreshingLogs(false);
    }
  };

  if (!workspaceId) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No workspace session found.
        </div>
      </div>
    );
  }

  if (isBooting || !settings) {
    return (
      <div className="space-y-6 p-6">
        <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-6">
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="mt-3 h-8 w-72 rounded bg-slate-200" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
            <div className="h-24 rounded-2xl bg-slate-100" />
            <div className="h-24 rounded-2xl bg-slate-100" />
            <div className="h-32 rounded-2xl bg-slate-100" />
          </div>
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
            <div className="h-20 rounded-2xl bg-slate-100" />
            <div className="h-20 rounded-2xl bg-slate-100" />
            <div className="h-20 rounded-2xl bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 p-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              AI Settings
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Workspace automation and channel controls
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Control which messaging channels are enabled for this workspace,
              when AI is active, and what customers receive when confidence is too low.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={[
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1",
                workspaceAIRuntimeLocked
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : settings.enabled
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-slate-100 text-slate-600 ring-slate-200",
              ].join(" ")}
            >
              {workspaceAIRuntimeLocked
                ? "Plan blocked"
                : settings.enabled
                  ? "AI enabled"
                  : "AI disabled"}
            </span>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {saveMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {saveMessage}
        </div>
      ) : null}

      {workspaceAIRuntimeLocked &&
      billing &&
      workspaceAIUpgradeTitle &&
      workspaceAIUpgradeDescription ? (
        <BillingUpgradePanel
          billing={billing}
          workspaceSlug={activeWorkspace?.slug}
          workspaceId={activeWorkspace?._id}
          requestGate={!billingAccess.allowBYOAI ? "byo_ai" : "automation"}
          title={workspaceAIUpgradeTitle}
          description={workspaceAIUpgradeDescription}
          className="shadow-none"
        />
      ) : null}

      {workspaceAILockMessage && !billing ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {workspaceAILockMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <form
          className={[
            "space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm",
            workspaceAIRuntimeLocked ? "opacity-70" : "",
          ].join(" ")}
          onSubmit={handleSubmit}
        >
          <div>
            <h3 className="text-base font-semibold text-slate-900">Automation controls</h3>
            <p className="mt-1 text-sm text-slate-500">
              Toggle core AI behaviors without leaving the page.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Gemini assistant</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Manage the workspace Gemini runtime from the UI instead of editing env files by hand.
                </p>
              </div>

              <span
                className={[
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1",
                  clearGeminiApiKey
                    ? "bg-amber-50 text-amber-700 ring-amber-200"
                    : settings.hasGeminiApiKey || geminiApiKeyInput.trim()
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-amber-50 text-amber-700 ring-amber-200",
                ].join(" ")}
              >
                {geminiKeyStatusLabel}
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Gemini API key
                </span>
                <input
                  type="password"
                  value={geminiApiKeyInput}
                  disabled={workspaceAIRuntimeLocked}
                  onChange={(event) => {
                    setSaveMessage(null);
                    setGeminiApiKeyInput(event.target.value);
                    if (event.target.value.trim()) {
                      setClearGeminiApiKey(false);
                    }
                  }}
                  placeholder={
                    settings.hasGeminiApiKey
                      ? "Leave blank to keep current key"
                      : "Enter workspace Gemini API key"
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  The current key is never sent back to the browser. Enter a new one only when replacing it.
                </p>
                {geminiApiKeyInput.trim() ? (
                  <p className="mt-1.5 text-xs font-medium text-emerald-700">
                    New workspace key entered. Save AI settings to apply it.
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Gemini model
                </span>
                <select
                  value={settings.geminiModel}
                  disabled={workspaceAIRuntimeLocked}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, geminiModel: event.target.value } : current
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">Use server default model</option>
                  {geminiModelOptions.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500">
                  Leave blank to use the server default model.
                </p>
                {settings.geminiModel ? (
                  <p className="mt-1.5 text-xs text-slate-600">
                    Selected:{" "}
                    {geminiModelOptions.find(
                      (model) => model.value === settings.geminiModel
                    )?.description ?? settings.geminiModel}
                  </p>
                ) : null}
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="text-sm text-slate-600">
                Auto reply now uses your configured Gemini model during normal hours when auto reply is enabled, and outside business hours only when after-hours automation is enabled.
              </p>

              <button
                type="button"
                disabled={workspaceAIRuntimeLocked}
                onClick={() => {
                  setSaveMessage(null);
                  setGeminiApiKeyInput("");
                  setClearGeminiApiKey(true);
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-300 px-4 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear saved key
              </button>
            </div>

            {clearGeminiApiKey ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                The saved workspace Gemini key will be removed when you save these settings.
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <ToggleRow
              label="AI enabled"
              description="Master switch for all AI behavior in this workspace."
              checked={settings.enabled}
              disabled={workspaceAIRuntimeLocked}
              onChange={(value) =>
                setSettings((current) => (current ? { ...current, enabled: value } : current))
              }
            />

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-slate-900">Auto reply mode</h4>
              <p className="mt-1 text-sm text-slate-500">
                Control when the bot can auto-reply.
              </p>

              <select
                value={settings.autoReplyMode}
                disabled={workspaceAIRuntimeLocked}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          autoReplyMode: event.target.value as AISettings["autoReplyMode"],
                          autoReplyEnabled: event.target.value !== "none",
                        }
                      : current
                  )
                }
                className="mt-3 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="all">All</option>
                <option value="after_hours_only">After-hours only</option>
                <option value="business_hours_only">Not after-hours</option>
                <option value="none">None</option>
              </select>
            </div>

            <ToggleRow
              label="Fallback replies enabled"
              description="When AI cannot complete a reply, send fallback text outside business hours only."
              checked={settings.afterHoursEnabled}
              disabled={workspaceAIRuntimeLocked}
              onChange={(value) =>
                setSettings((current) =>
                  current ? { ...current, afterHoursEnabled: value } : current
                )
              }
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label
                  htmlFor="confidence-threshold"
                  className="text-sm font-medium text-slate-900"
                >
                  Confidence threshold
                </label>
                <p className="mt-1 text-sm text-slate-500">
                  Higher values make AI more conservative.
                </p>
              </div>

              <div className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200">
                {(settings.confidenceThreshold * 100).toFixed(0)}%
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_120px] md:items-center">
              <input
                id="confidence-threshold"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.confidenceThreshold}
                disabled={workspaceAIRuntimeLocked}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          confidenceThreshold: Number(event.target.value),
                        }
                      : current
                  )
                }
                className="w-full accent-slate-900 disabled:opacity-50"
              />

              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={settings.confidenceThreshold}
                disabled={workspaceAIRuntimeLocked}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          confidenceThreshold: Number(event.target.value),
                        }
                      : current
                  )
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="fallback-message"
              className="text-sm font-medium text-slate-900"
            >
              Fallback message (single source)
            </label>
            <p className="mt-1 text-sm text-slate-500">
              Used for after-hours mode and when the AI should not answer directly.
            </p>

            <textarea
              id="fallback-message"
              rows={5}
              value={settings.fallbackMessage}
              disabled={workspaceAIRuntimeLocked}
              onChange={(event) =>
                setSettings((current) =>
                  current ? { ...current, fallbackMessage: event.target.value } : current
                )
              }
              className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
              placeholder="Thanks for your message. A teammate will follow up soon."
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-500">
              Changes apply at the workspace level.
            </p>

            <button
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              type="submit"
              disabled={isSaving || workspaceAIRuntimeLocked}
            >
              {isSaving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                AI Audit Log
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                Recent decisions
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Review recent AI actions and supporting signals.
              </p>
            </div>

            <button
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void handleRefreshLogs()}
              type="button"
              disabled={isRefreshingLogs}
            >
              {isRefreshingLogs ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {visibleLogs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                No audit activity yet.
              </div>
            ) : (
              visibleLogs.map((log) => (
                <article
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  key={log._id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <strong className="text-sm font-semibold text-slate-900">
                      {log.eventType}
                    </strong>
                    <span className="text-xs text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-700">
                    {log.reason || "No reason captured"}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                      confidence: {log.confidence ?? "n/a"}
                    </span>
                    <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                      sources: {log.sourceHints.length ? log.sourceHints.join(", ") : "none"}
                    </span>
                    {typeof log.data?.replyType === "string" ? (
                      <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                        reply: {log.data.replyType}
                      </span>
                    ) : null}
                    {log.data?.pendingAckSent === true ? (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                        customer acknowledged
                      </span>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
