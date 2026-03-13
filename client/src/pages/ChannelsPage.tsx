import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "../hooks/use-session";
import { apiRequest } from "../services/api";
import { connectWorkspaceSocket } from "../services/realtime";
import { Channel, ChannelConnection } from "../types/models";
import { ChannelConnectionCard } from "../features/channels/ChannelConnectionCard";
import { StatusBadge } from "../features/ui/StatusBadge";

const channelOptions: Channel[] = ["facebook", "telegram", "viber", "tiktok"];
const apiBase =
  import.meta.env.VITE_API_URL ??
  import.meta.env.REACT_APP_API_URL ??
  "http://localhost:4000";

type ConnectionDiagnostics = {
  status: string;
  verificationState: string;
  webhookUrl?: string | null;
  lastError?: string | null;
  diagnostics?: Record<string, unknown>;
};

type ChannelFormState = {
  displayName: string;
  token: string;
  webhookSecret: string;
  verifyToken: string;
  appSecret: string;
  connectionKey: string;
};

const initialFormState: ChannelFormState = {
  displayName: "",
  token: "",
  webhookSecret: "",
  verifyToken: "",
  appSecret: "",
  connectionKey: "",
};

const channelMeta: Record<
  Channel,
  {
    label: string;
    description: string;
    credentialHint: string;
    webhookPath?: string;
  }
> = {
  facebook: {
    label: "Facebook",
    description: "Connect a Facebook Page with webhook verification.",
    credentialHint: "Requires page access token and verify token.",
    webhookPath: "/webhooks/facebook",
  },
  telegram: {
    label: "Telegram",
    description: "Connect a Telegram bot and register its webhook.",
    credentialHint: "Requires bot token. Webhook secret is optional.",
    webhookPath: "/webhooks/telegram",
  },
  viber: {
    label: "Viber",
    description: "Connect a Viber bot and map inbound traffic with a connection key.",
    credentialHint: "Requires auth token. Connection key is optional.",
    webhookPath: "/webhooks/viber?connectionKey=your-key",
  },
  tiktok: {
    label: "TikTok",
    description: "Scaffold-only until business messaging support is confirmed.",
    credentialHint: "Provider integration is not yet active.",
  },
};



function getStatusTone(status?: string) {
  switch (status) {
    case "connected":
    case "verified":
    case "active":
      return "emerald";
    case "pending":
      return "amber";
    case "failed":
    case "error":
      return "rose";
    default:
      return "default";
  }
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-900">
        {label}
      </span>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </label>
  );
}

function ProviderFields({
  channel,
  form,
  setForm,
}: {
  channel: Channel;
  form: ChannelFormState;
  setForm: React.Dispatch<React.SetStateAction<ChannelFormState>>;
}) {
  const inputClass =
    "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

  if (channel === "telegram") {
    return (
      <>
        <Field label="Bot token">
          <input
            type="password"
            value={form.token}
            onChange={(event) =>
              setForm((current) => ({ ...current, token: event.target.value }))
            }
            className={inputClass}
            placeholder="Telegram bot token"
          />
        </Field>

        <Field
          label="Webhook secret"
          hint="Optional. The backend can generate this if you leave it blank."
        >
          <input
            type="password"
            value={form.webhookSecret}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                webhookSecret: event.target.value,
              }))
            }
            className={inputClass}
            placeholder="Optional webhook secret"
          />
        </Field>
      </>
    );
  }

  if (channel === "viber") {
    return (
      <>
        <Field label="Auth token">
          <input
            type="password"
            value={form.token}
            onChange={(event) =>
              setForm((current) => ({ ...current, token: event.target.value }))
            }
            className={inputClass}
            placeholder="Viber auth token"
          />
        </Field>

        <Field
          label="Connection key"
          hint="Optional. Used in the webhook query string to identify the connection."
        >
          <input
            value={form.connectionKey}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                connectionKey: event.target.value,
              }))
            }
            className={inputClass}
            placeholder="Optional connection key"
          />
        </Field>
      </>
    );
  }

  if (channel === "facebook") {
    return (
      <>
        <Field label="Page access token">
          <input
            type="password"
            value={form.token}
            onChange={(event) =>
              setForm((current) => ({ ...current, token: event.target.value }))
            }
            className={inputClass}
            placeholder="Facebook page access token"
          />
        </Field>

        <Field label="Verify token">
          <input
            value={form.verifyToken}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                verifyToken: event.target.value,
              }))
            }
            className={inputClass}
            placeholder="Webhook verify token"
          />
        </Field>

        <Field label="App secret" hint="Optional but useful for signature verification.">
          <input
            type="password"
            value={form.appSecret}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                appSecret: event.target.value,
              }))
            }
            className={inputClass}
            placeholder="Optional app secret"
          />
        </Field>
      </>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-900">Pending provider verification</p>
      <p className="mt-1 text-sm text-slate-500">
        TikTok messaging remains scaffold-only until public business messaging support is verified.
      </p>
    </div>
  );
}

function ConnectionCard({
  connection,
  isSelected,
}: {
  connection: ChannelConnection;
  isSelected: boolean;
}) {
  return (
    <article
      className={[
        "rounded-2xl border p-4 transition",
        isSelected
          ? "border-slate-900 bg-slate-50 shadow-sm"
          : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              {connection.displayName || channelMeta[connection.channel].label}
            </h3>
            <StatusBadge
              label={connection.status}
              tone={getStatusTone(connection.status)}
            />
            <StatusBadge label={connection.channel} />
          </div>

          <p className="mt-2 text-sm text-slate-500">
            {connection.externalAccountId || "No external account id"}
          </p>
        </div>

        {isSelected ? <StatusBadge label="Selected" tone="blue" /> : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
            Verification
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {connection.verificationState}
          </p>
        </div>

        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
            Webhook verified
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {connection.webhookVerified ? "Yes" : "No"}
          </p>
        </div>

        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
            Last inbound
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {connection.lastInboundAt
              ? new Date(connection.lastInboundAt).toLocaleString()
              : "None"}
          </p>
        </div>

        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
            Last outbound
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {connection.lastOutboundAt
              ? new Date(connection.lastOutboundAt).toLocaleString()
              : "None"}
          </p>
        </div>
      </div>

      {connection.webhookUrl ? (
        <div className="mt-4 rounded-xl bg-slate-950 px-3 py-2 text-xs text-slate-100">
          {connection.webhookUrl}
        </div>
      ) : null}

      {connection.lastError ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {connection.lastError}
        </div>
      ) : null}
    </article>
  );
}

export function ChannelsPage() {
  const { session } = useSession();
  const workspaceId = session?.workspace?._id;

  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [channel, setChannel] = useState<Channel>("telegram");
  const [form, setForm] = useState<ChannelFormState>(initialFormState);
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics | null>(null);

  const [isBooting, setIsBooting] = useState(true);
  const [action, setAction] = useState<"connect" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    if (!workspaceId) return;

    const response = await apiRequest<{ items: ChannelConnection[] }>(
      "/api/channels",
      {},
      { workspaceId }
    );

    setConnections(response.items);
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;

    async function boot() {
      try {
        setIsBooting(true);
        setError(null);

        const response = await apiRequest<{ items: ChannelConnection[] }>(
          "/api/channels",
          {},
          { workspaceId }
        );

        if (!cancelled) {
          setConnections(response.items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load channel connections.");
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
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    const socket = connectWorkspaceSocket(workspaceId);
    const refreshConnections = () => {
      void loadConnections();
    };

    socket.on("connection.updated", refreshConnections);

    return () => {
      socket.off("connection.updated", refreshConnections);
      socket.disconnect();
    };
  }, [loadConnections, workspaceId]);

  useEffect(() => {
    setDiagnostics(null);
    setError(null);
    setForm((current) => ({
      ...current,
      token: "",
      webhookSecret: "",
      verifyToken: "",
      appSecret: "",
      connectionKey: "",
    }));
  }, [channel]);

  const formPayload = useMemo(() => {
    const credentials: Record<string, unknown> = {};
    const webhookConfig: Record<string, unknown> = {};

    if (channel === "telegram") {
      if (form.token.trim()) {
        credentials.botToken = form.token.trim();
      }
      if (form.webhookSecret.trim()) {
        credentials.webhookSecret = form.webhookSecret.trim();
      }
    }

    if (channel === "viber") {
      if (form.token.trim()) {
        credentials.authToken = form.token.trim();
      }
      if (form.connectionKey.trim()) {
        webhookConfig.connectionKey = form.connectionKey.trim();
      }
    }

    if (channel === "facebook") {
      if (form.token.trim()) {
        credentials.pageAccessToken = form.token.trim();
      }
      if (form.verifyToken.trim()) {
        credentials.verifyToken = form.verifyToken.trim();
      }
      if (form.appSecret.trim()) {
        credentials.appSecret = form.appSecret.trim();
      }
    }

    return {
      workspaceId,
      displayName: form.displayName.trim() || undefined,
      credentials,
      webhookConfig,
    };
  }, [channel, form, workspaceId]);

  const handleConnect = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspaceId) return;

    try {
      setAction("connect");
      setError(null);

      const response = await apiRequest<{ connection: ChannelConnection }>(
        `/api/channels/${channel}/connect`,
        {
          method: "POST",
          body: JSON.stringify(formPayload),
        }
      );

      setDiagnostics({
        status: response.connection.status,
        verificationState: response.connection.verificationState,
        webhookUrl: response.connection.webhookUrl,
        lastError: response.connection.lastError,
      });

      await loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setAction(null);
    }
  };

  const handleTest = async () => {
    if (!workspaceId) return;

    try {
      setAction("test");
      setError(null);

      const response = await apiRequest<{ diagnostics: ConnectionDiagnostics }>(
        `/api/channels/${channel}/test`,
        {
          method: "POST",
          body: JSON.stringify(formPayload),
        }
      );

      setDiagnostics(response.diagnostics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed.");
    } finally {
      setAction(null);
    }
  };

  const selectedConnection =
    connections.find((item) => item.channel === channel) ?? null;

  const webhookEndpoints = [
    `${apiBase}/webhooks/facebook`,
    `${apiBase}/webhooks/telegram`,
    `${apiBase}/webhooks/viber?connectionKey=your-key`,
  ];

  if (!workspaceId) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No workspace session found.
        </div>
      </div>
    );
  }

  if (isBooting) {
    return (
      <div className="space-y-6 p-6">
        <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-6">
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="mt-3 h-8 w-64 rounded bg-slate-200" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
            <div className="h-24 rounded-2xl bg-slate-100" />
            <div className="h-12 rounded-2xl bg-slate-100" />
            <div className="h-12 rounded-2xl bg-slate-100" />
            <div className="h-40 rounded-2xl bg-slate-100" />
          </div>

          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-40 rounded-2xl bg-slate-100" />
            ))}
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
              Channels
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Real provider connections
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Connect external messaging providers, validate credentials, and inspect current channel health.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge label={`${connections.length} connections`} />
            {selectedConnection ? (
              <StatusBadge
                label={`${channelMeta[channel].label}: ${selectedConnection.status}`}
                tone={getStatusTone(selectedConnection.status)}
              />
            ) : (
              <StatusBadge label={`${channelMeta[channel].label}: not connected`} />
            )}
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.05fr)]">
        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Connector
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">
              Configure provider access
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Save credentials for a specific provider and optionally test them before use.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Webhook endpoints</p>
              <p className="mt-1 text-sm text-slate-500">
                Use the matching endpoint for each provider when configuring callbacks.
              </p>
            </div>

            {webhookEndpoints.map((endpoint) => (
              <div
                key={endpoint}
                className="rounded-xl bg-slate-950 px-3 py-2 text-xs text-slate-100"
              >
                {endpoint}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">Runtime rule</p>
            <p className="mt-1 text-sm text-slate-500">
              No provider credentials means no active connection. The backend should not claim connected,
              verified, or sent unless provider calls or verified webhook logic actually succeeded.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleConnect}>
            <Field label="Channel">
              <select
                value={channel}
                onChange={(event) => setChannel(event.target.value as Channel)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              >
                {channelOptions.map((option) => (
                  <option key={option} value={option}>
                    {channelMeta[option].label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-slate-900">
                  {channelMeta[channel].label}
                </p>
                <StatusBadge label={channel} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {channelMeta[channel].description}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {channelMeta[channel].credentialHint}
              </p>
              {channelMeta[channel].webhookPath ? (
                <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200">
                  {`${apiBase}${channelMeta[channel].webhookPath}`}
                </div>
              ) : null}
            </div>

            <Field label="Display name" hint="Optional internal label for this connection.">
              <input
                value={form.displayName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                placeholder="Optional label"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </Field>

            <ProviderFields channel={channel} form={form} setForm={setForm} />

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
              <button
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={action !== null}
                type="submit"
              >
                {action === "connect" ? "Saving..." : "Save connection"}
              </button>

              <button
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={action !== null}
                onClick={() => void handleTest()}
                type="button"
              >
                {action === "test" ? "Testing..." : "Test credentials"}
              </button>
            </div>
          </form>

          {diagnostics ? (
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-900">Latest validation</h4>
                <StatusBadge
                  label={diagnostics.status}
                  tone={getStatusTone(diagnostics.status)}
                />
                <StatusBadge label={diagnostics.verificationState} />
              </div>

              {diagnostics.webhookUrl ? (
                <div className="mt-3 rounded-xl bg-slate-950 px-3 py-2 text-xs text-slate-100">
                  {diagnostics.webhookUrl}
                </div>
              ) : null}

              {diagnostics.lastError ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {diagnostics.lastError}
                </div>
              ) : null}

              {diagnostics.diagnostics ? (
                <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
                  {JSON.stringify(diagnostics.diagnostics, null, 2)}
                </pre>
              ) : null}
            </article>
          ) : null}

          {selectedConnection ? (
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold text-slate-900">Selected channel state</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Status</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {selectedConnection.status}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                    Verification
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {selectedConnection.verificationState}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                    Webhook verified
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {selectedConnection.webhookVerified ? "Yes" : "No"}
                  </p>
                </div>
              </div>
            </article>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Workspace connections
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">
              Current provider states
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Review existing channel connections, verification state, and recent delivery activity.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {connections.length ? (
              connections.map((connection) => (
                <ConnectionCard
                  key={connection._id}
                  connection={connection}
                  isSelected={connection.channel === channel}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                No channel connections yet. This workspace stays empty until real provider credentials are saved and validated.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
