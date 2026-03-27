import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../services/api";
import { useSession } from "../hooks/use-session";
import { WorkspaceRole } from "../types/models";
import { formatWorkspaceRoleLabel } from "../utils/workspace-role";

type InvitationInfo = {
  workspace: {
    _id: string;
    name: string;
    slug: string;
  };
  workspaceRole: WorkspaceRole;
  email: string;
  name: string;
  expiresAt: string;
};

export function AcceptInvitePage() {
  const { session, acceptInvite } = useSession();
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("Invitation token is missing.");
      return;
    }

    let cancelled = false;

    async function loadInvitation() {
      try {
        setLoading(true);
        setError(null);
        const response = await apiRequest<{ invitation: InvitationInfo }>(
          `/api/auth/invitations/${encodeURIComponent(token)}`
        );
        if (cancelled) {
          return;
        }
        setInvitation(response.invitation);
        setName(response.invitation.name || "");
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to load invitation."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInvitation();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const expirationLabel = useMemo(() => {
    if (!invitation?.expiresAt) {
      return "";
    }
    return new Date(invitation.expiresAt).toLocaleString();
  }, [invitation?.expiresAt]);

  if (session) {
    return (
      <Navigate
        to={
          token
            ? `/account/workspaces?invite=${encodeURIComponent(token)}`
            : "/account/workspaces"
        }
        replace
      />
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!token) {
      setError("Invitation token is missing.");
      return;
    }

    if (!password.trim()) {
      setError("Password is required.");
      return;
    }

    if (password.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await acceptInvite({
        token,
        password: password.trim(),
        name: name.trim() || undefined,
      });
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to accept invitation."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Workspace invitation
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Accept invitation
        </h1>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Loading invitation...
          </div>
        ) : invitation ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              You were invited to join <strong>{invitation.workspace.name}</strong> as{" "}
              <strong>{formatWorkspaceRoleLabel(invitation.workspaceRole)}</strong>.
            </p>
            <p className="mt-1">Email: {invitation.email}</p>
            {expirationLabel ? <p className="mt-1">Expires: {expirationLabel}</p> : null}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-900">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              placeholder="Your name"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-900">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              placeholder="Create a password"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-900">
              Confirm password
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              placeholder="Repeat password"
            />
          </label>

          <button
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={submitting || loading || !invitation}
            type="submit"
          >
            {submitting ? "Accepting..." : "Accept invitation"}
          </button>
        </form>
      </div>
    </div>
  );
}
