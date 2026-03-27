import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { PortalShell } from "../components/portal-shell";
import { useSession } from "../hooks/use-session";
import { apiRequest } from "../services/api";
import { AccountProfile } from "../types/models";
import {
  formatPlatformRoleLabel,
  getPostLoginHomePath,
  isPortalPlatformRole,
} from "../utils/platform-role";

type AccountPageProps = {
  audience?: "client" | "portal";
};

export function AccountPage({ audience = "client" }: AccountPageProps) {
  const { session, loading, refreshSession } = useSession();
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    try {
      setError(null);
      const response = await apiRequest<{ account: AccountProfile }>("/api/account");
      setAccount(response.account);
      setName(response.account.name);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to load account."
      );
    }
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    void loadAccount();
  }, [loadAccount, session]);

  if (loading) {
    return <div className="page-loader">Loading account...</div>;
  }

  if (!session) {
    return <Navigate to={audience === "portal" ? "/portal/login" : "/login"} replace />;
  }

  const isPortalUser = isPortalPlatformRole(session.user.platformRole);

  if (audience === "portal" && !isPortalUser) {
    return <Navigate to="/account" replace />;
  }

  if (audience === "client" && isPortalUser) {
    return <Navigate to="/portal/account" replace />;
  }

  const homePath =
    audience === "portal" ? "/portal" : getPostLoginHomePath(session.user.platformRole);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const response = await apiRequest<{ account: AccountProfile }>("/api/account", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      setAccount(response.account);
      setName(response.account.name);
      setNotice("Account updated.");
      await refreshSession();
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to save account."
      );
    } finally {
      setSaving(false);
    }
  };

  const title = audience === "portal" ? "My portal account" : "My details";
  const intro =
    audience === "portal"
      ? "Manage the internal account you use for platform operations, support handling, and billing administration."
      : "Manage your account name, see how this account signs in, and review how many workspaces it can access.";
  const notes =
    audience === "portal"
      ? [
          "Portal access is granted after the person signs in and is promoted by a higher internal role.",
          "Google remains the primary sign-in path for internal accounts.",
          "Portal permissions are separate from client workspace membership.",
        ]
      : [
          "Email is fixed to the account identity used for login.",
          "Google remains the primary sign-in path when it is configured.",
          "Workspace access is managed from invites and the workspaces screen.",
        ];

  const content = (
    <>
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-900">
                Name
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-900">
                Email
              </span>
              <input
                value={account?.email ?? session.user.email}
                disabled
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
              />
            </label>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-900">
                Sign-in method
              </span>
              <input
                value={account?.authProvider ?? session.user.authProvider ?? "password"}
                disabled
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm capitalize text-slate-500"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-900">
                Platform role
              </span>
              <input
                value={formatPlatformRoleLabel(account?.platformRole)}
                disabled
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? "Saving..." : "Save account"}
          </button>
        </form>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Access
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {audience === "portal" ? "Internal access" : "Workspace membership"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {audience === "portal" ? (
                <>
                  This account currently uses the{" "}
                  <strong className="text-white">
                    {formatPlatformRoleLabel(account?.platformRole)}
                  </strong>{" "}
                  internal role.
                </>
              ) : (
                <>
                  This account currently has access to{" "}
                  <strong className="text-white">
                    {account?.workspaceCount ?? session.workspaces.length}
                  </strong>{" "}
                  workspace
                  {(account?.workspaceCount ?? session.workspaces.length) === 1
                    ? ""
                    : "s"}
                  .
                </>
              )}
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Notes
            </p>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
              {notes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );

  if (audience === "portal") {
    return (
      <PortalShell
        title="My Portal Account"
        description="Manage the internal account you use for platform operations, support handling, and billing administration."
      >
        <div className="space-y-6">{content}</div>
      </PortalShell>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Account
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              {intro}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={homePath}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
            >
              Back to account
            </Link>
          </div>
        </header>

        <div className="mt-8 space-y-6">{content}</div>
      </div>
    </div>
  );
}
