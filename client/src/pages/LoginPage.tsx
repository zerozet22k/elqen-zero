import { FormEvent, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSession } from "../hooks/use-session";

export function LoginPage() {
  const { session, login } = useSession();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedWorkspaceSlug = workspaceSlug.trim();
  const trimmedWorkspaceName = workspaceName.trim();

  const mode = useMemo(() => {
    if (trimmedWorkspaceSlug) return "existing";
    if (trimmedWorkspaceName) return "new";
    return "unset";
  }, [trimmedWorkspaceSlug, trimmedWorkspaceName]);

  if (session) {
    return <Navigate to="/inbox" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!trimmedName || !trimmedEmail) {
      setError("Name and email are required.");
      return;
    }

    if (!trimmedWorkspaceSlug && !trimmedWorkspaceName) {
      setError("Enter a workspace slug or provide a new workspace name.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await login({
        name: trimmedName,
        email: trimmedEmail,
        workspaceSlug: trimmedWorkspaceSlug,
        workspaceName: trimmedWorkspaceName || undefined,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-slate-950 p-10 text-slate-100 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_30%)]" />

          <div className="relative flex h-full flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Unified Chat
              </p>

              <h1 className="mt-6 max-w-md text-4xl font-semibold tracking-tight text-white">
                Run your seller inbox from one dashboard.
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
                Connect channels, manage conversations, reuse replies, and keep
                policy knowledge in one workspace.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-sm font-medium text-white">One inbox</p>
                <p className="mt-1 text-sm text-slate-300">
                  View Facebook, Telegram, Viber, and other provider traffic in one place.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-sm font-medium text-white">Operational controls</p>
                <p className="mt-1 text-sm text-slate-300">
                  Manage canned replies, AI rules, automations, and channel health from the same console.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-sm font-medium text-white">Workspace-based access</p>
                <p className="mt-1 text-sm text-slate-300">
                  Join an existing workspace by slug or create a new empty workspace to start fresh.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-lg">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Unified Chat
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Open workspace
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Enter an existing workspace slug, or leave slug empty and provide a
                workspace name to create a new workspace.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                {mode === "existing"
                  ? "Joining existing workspace"
                  : mode === "new"
                    ? "Creating new workspace"
                    : "Choose workspace mode"}
              </span>
            </div>

            {error ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Name
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Workspace slug
                  </span>
                  <input
                    value={workspaceSlug}
                    onChange={(event) => setWorkspaceSlug(event.target.value)}
                    placeholder="existing-workspace"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Use this to open an existing workspace.
                  </p>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Workspace name
                  </span>
                  <input
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    placeholder="New workspace"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Used only when creating a new workspace.
                  </p>
                </label>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">How it works</p>
                <ul className="mt-2 space-y-1.5 text-sm text-slate-500">
                  <li>Provide a workspace slug to join an existing workspace.</li>
                  <li>Or leave slug empty and enter a workspace name to create a new one.</li>
                </ul>
              </div>

              <button
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "Opening workspace..." : "Open workspace"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}