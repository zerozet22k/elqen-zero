import { useMemo } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useSession } from "../hooks/use-session";
import { isPortalPlatformRole } from "../utils/platform-role";
import {
  formatWorkspaceRoleLabel,
  isWorkspaceAdminRole,
  isWorkspaceOwnerRole,
} from "../utils/workspace-role";
import { buildWorkspacePath } from "../utils/workspace-routes";

export function WorkspacesPage() {
  const { session, setActiveWorkspaceId, loading, logout } = useSession();
  const navigate = useNavigate();

  const sortedWorkspaces = useMemo(() => {
    if (!session) {
      return [];
    }

    return [...session.workspaces].sort((left, right) =>
      left.name.localeCompare(right.name)
    );
  }, [session]);

  if (loading) {
    return <div className="page-loader">Loading workspaces...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (isPortalPlatformRole(session.user.platformRole)) {
    return <Navigate to="/portal" replace />;
  }

  const openWorkspace = (workspaceId: string, workspaceSlug: string) => {
    setActiveWorkspaceId(workspaceId);
    navigate(buildWorkspacePath(workspaceSlug, "inbox"));
  };

  const hasOwnedWorkspace = sortedWorkspaces.some((workspace) =>
    isWorkspaceOwnerRole(workspace.workspaceRole)
  );

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div className="flex min-h-screen w-full flex-col px-4 py-8 sm:px-6 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Elqen Zero
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
              My Workspaces
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Choose a workspace, create another one, or jump into the workspace
              you manage. Billing is account-level and lives separately from
              workspace operations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/account"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
            >
              My account
            </Link>
            {hasOwnedWorkspace ? (
              <Link
                to="/account/billings"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
              >
                Billing accounts
              </Link>
            ) : null}
            <Link
              to="/account/workspaces/new"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Create workspace
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Available
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Workspace access
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {sortedWorkspaces.length} workspace{sortedWorkspaces.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {sortedWorkspaces.map((workspace) => {
              const isCurrent = session.activeWorkspaceId === workspace._id;

              return (
                <div
                  key={workspace._id}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">
                        {workspace.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        `/workspace/{workspace.slug}`
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-600 ring-1 ring-slate-200">
                        {formatWorkspaceRoleLabel(workspace.workspaceRole)}
                      </span>
                      {isCurrent ? (
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">
                          Active
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => openWorkspace(workspace._id, workspace.slug)}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Open inbox
                    </button>
                    {isWorkspaceAdminRole(workspace.workspaceRole) ? (
                      <Link
                        to={buildWorkspacePath(workspace.slug, "workspace-members")}
                        onClick={() => setActiveWorkspaceId(workspace._id)}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                      >
                        Invite people
                      </Link>
                    ) : null}
                    {isWorkspaceOwnerRole(workspace.workspaceRole) ? (
                      <Link
                        to="/account/billings"
                        onClick={() => setActiveWorkspaceId(workspace._id)}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                      >
                        Billing account
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
