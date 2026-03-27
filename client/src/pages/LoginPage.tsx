import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { PublicSiteShell } from "../components/PublicSiteShell";
import { apiRequest } from "../services/api";
import { useSession } from "../hooks/use-session";
import { SessionData } from "../types/models";
import { SITE_BRAND } from "../content/site";
import { getPostLoginHomePath } from "../utils/platform-role";
import { formatWorkspaceRoleLabel } from "../utils/workspace-role";

const POST_LOGIN_WORKSPACE_PICK_KEY = "omni-chat-post-login-workspace-pick";

type GoogleOAuthPopupPayload = {
  source?: string;
  status?: string;
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
};

type LoginPageProps = {
  audience?: "client" | "staff";
};

export function LoginPage({ audience = "client" }: LoginPageProps) {
  const { session, deployment, setActiveWorkspaceId, establishSession } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showLegacyLogin, setShowLegacyLogin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedEmail = email.trim();
  const trimmedPassword = password.trim();

  useEffect(() => {
    document.title =
      audience === "staff"
        ? `${SITE_BRAND} | Portal Login`
        : `${SITE_BRAND} | Login`;
  }, [audience]);

  const postLoginWorkspacePickPending =
    typeof window !== "undefined" &&
    window.localStorage.getItem(POST_LOGIN_WORKSPACE_PICK_KEY) === "true";

  const showWorkspacePicker =
    !!session &&
    postLoginWorkspacePickPending &&
    (session.workspaces?.length ?? 0) > 1;

  if (session && !showWorkspacePicker) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(POST_LOGIN_WORKSPACE_PICK_KEY);
    }
    return (
      <Navigate
        to={getPostLoginHomePath(session.user.platformRole)}
        replace
      />
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Email and password are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(POST_LOGIN_WORKSPACE_PICK_KEY, "true");
      }

      const nextSession = await apiRequest<SessionData>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: trimmedEmail,
          password: trimmedPassword,
          audience,
        }),
      });

      establishSession(nextSession);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setSubmitting(true);
      setError(null);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(POST_LOGIN_WORKSPACE_PICK_KEY, "true");
      }

      const start = await apiRequest<{
        state: string;
        authUrl: string;
        callbackOrigin: string;
      }>("/api/auth/google/start", {
        method: "POST",
        body: JSON.stringify({
          uiOrigin: window.location.origin,
        }),
      });

      const popup = window.open(
        start.authUrl,
        "google_oauth",
        "width=520,height=720,menubar=no,toolbar=no"
      );

      if (!popup) {
        throw new Error("Popup blocked. Allow popups and try again.");
      }

      const oauthPayload = await new Promise<{ code: string; state: string }>(
        (resolve, reject) => {
          const timeoutId = window.setTimeout(() => {
            cleanup();
            reject(new Error("Google login timed out. Please try again."));
          }, 120000);

          const closeWatcher = window.setInterval(() => {
            if (popup.closed) {
              cleanup();
              reject(new Error("Google login window was closed."));
            }
          }, 400);

          const cleanup = () => {
            window.clearTimeout(timeoutId);
            window.clearInterval(closeWatcher);
            window.removeEventListener("message", onMessage);
            try {
              if (!popup.closed) {
                popup.close();
              }
            } catch {}
          };

          const onMessage = (event: MessageEvent) => {
            if (event.origin !== start.callbackOrigin) {
              return;
            }

            const data = event.data as GoogleOAuthPopupPayload;
            if (data?.source !== "google-oauth") {
              return;
            }

            if (data.status === "error" || data.error) {
              cleanup();
              reject(new Error(data.errorDescription || "Google login failed."));
              return;
            }

            const code = typeof data.code === "string" ? data.code.trim() : "";
            const state = typeof data.state === "string" ? data.state.trim() : "";

            if (!code || !state) {
              cleanup();
              reject(new Error("Google login did not return a valid code."));
              return;
            }

            cleanup();
            resolve({ code, state });
          };

          window.addEventListener("message", onMessage);
        }
      );

      const nextSession = await apiRequest<SessionData>("/api/auth/google/exchange", {
        method: "POST",
        body: JSON.stringify({
          ...oauthPayload,
          audience,
        }),
      });

      establishSession(nextSession);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Google login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const heroTitle =
    audience === "staff"
      ? "Portal access for Elqen staff."
      : "Sign in once, then move across your workspaces.";

  const heroDescription =
    audience === "staff"
      ? "Portal access is for approved internal staff accounts."
      : "Google is the main sign-in path. After login, users land in Workspaces and can open, create, or join a workspace.";

  return (
  <PublicSiteShell mainClassName="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    {error ? (
      <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    ) : null}

    <section className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.05)] sm:px-8 sm:py-10">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {audience === "staff" ? "Portal Login" : "Login"}
        </p>

        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
          {audience === "staff" ? "Sign in to Elqen Portal" : "Sign in to Elqen"}
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          {audience === "staff"
            ? "For approved internal staff accounts."
            : "Access your business inbox and workspace."}
        </p>
      </div>

      {showWorkspacePicker && session ? (
        <div className="mt-8 rounded-[24px] border border-slate-200 bg-slate-950 p-6 text-white">
          <p className="text-sm font-medium text-slate-300">Choose a workspace</p>

          <div className="mt-4 space-y-3">
            {session.workspaces.map((workspace) => (
              <button
                key={workspace._id}
                type="button"
                onClick={() => {
                  setActiveWorkspaceId(workspace._id);
                  if (typeof window !== "undefined") {
                    window.localStorage.removeItem(POST_LOGIN_WORKSPACE_PICK_KEY);
                  }
                }}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white transition hover:bg-white/10"
              >
                <span className="font-medium">{workspace.name}</span>
                <span className="text-xs uppercase tracking-[0.14em] text-slate-300">
                  {formatWorkspaceRoleLabel(workspace.workspaceRole)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-6 text-white">
            <h2 className="text-xl font-semibold tracking-tight">Continue with Google</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              {audience === "staff"
                ? "Use your approved internal account."
                : "The fastest way to access your Elqen account."}
            </p>

            {deployment.googleAuthEnabled ? (
              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                disabled={submitting}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-3 rounded-xl bg-white px-5 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-semibold"
                >
                  G
                </span>
                Continue with Google
              </button>
            ) : (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                Google login is not configured yet.
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Email and password
              </h2>

              {deployment.googleAuthEnabled ? (
                <button
                  type="button"
                  onClick={() => setShowLegacyLogin((current) => !current)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                >
                  {showLegacyLogin ? "Hide" : "Use email"}
                </button>
              ) : null}
            </div>

            {!deployment.googleAuthEnabled || showLegacyLogin ? (
              <form onSubmit={handleSubmit} className="mt-5 space-y-5">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Email
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Password
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Your password"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <button
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? "Signing in..." : "Sign in"}
                </button>
              </form>
            ) : (
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Use email login only if needed.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  </PublicSiteShell>
);
}
