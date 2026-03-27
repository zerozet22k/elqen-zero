import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useParams } from "react-router-dom";
import { PortalShell } from "../components/portal-shell";
import { formatBillingStatusLabel } from "../features/portal/portal-display";
import { PortalWorkspaceOutletContext } from "../features/portal/portal-workspace-context";
import { apiRequest } from "../services/api";
import {
  BillingOverrideSummary,
  PlanCatalogSummary,
  PortalWorkspaceDetail,
} from "../types/models";

type PortalWorkspaceResponse = {
  workspace: PortalWorkspaceDetail;
  planCatalogs: PlanCatalogSummary[];
  overrides: BillingOverrideSummary[];
};

const sectionLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition",
    isActive
      ? "border-slate-950 bg-slate-950 text-white"
      : "border-slate-200 bg-white text-slate-700 hover:border-slate-950 hover:text-slate-950",
  ].join(" ");

export function PortalWorkspaceLayout() {
  const { workspaceId = "" } = useParams();
  const [workspace, setWorkspace] = useState<PortalWorkspaceDetail | null>(null);
  const [planCatalogs, setPlanCatalogs] = useState<PlanCatalogSummary[]>([]);
  const [overrides, setOverrides] = useState<BillingOverrideSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshWorkspace = async () => {
    const response = await apiRequest<PortalWorkspaceResponse>(
      `/api/portal/workspaces/${encodeURIComponent(workspaceId)}`
    );
    setWorkspace(response.workspace);
    setPlanCatalogs(response.planCatalogs);
    setOverrides(response.overrides);
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        await refreshWorkspace();
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to load workspace operations."
        );
      } finally {
        setLoading(false);
      }
    };

    if (workspaceId) {
      void load();
    }
  }, [workspaceId]);

  if (!workspaceId) {
    return <Navigate to="/portal" replace />;
  }

  const outletContext: PortalWorkspaceOutletContext | null = workspace
    ? {
        workspaceId,
        workspace,
        setWorkspace,
        planCatalogs,
        overrides,
        setOverrides,
        refreshWorkspace,
      }
    : null;

  return (
    <PortalShell
      title={workspace?.name ?? "Client workspace"}
      description={
        workspace
          ? "Platform staff manages billing, workspace access, connected channels, audit review, and support escalations from this client account."
          : "Load a client workspace to inspect billing, access, operations, and support history."
      }
      badge="Platform Portal"
    >
      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading workspace operations...
        </div>
      ) : !workspace || !outletContext ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Workspace detail is not available right now.
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Admin sections
              </p>
              <nav className="mt-4 space-y-3">
                <NavLink
                  to={`/portal/workspaces/${workspaceId}/overview`}
                  className={sectionLinkClass}
                >
                  <span>
                    <span className="block text-sm font-medium">Overview</span>
                    <span className="mt-1 block text-xs opacity-80">
                      Client summary, public setup, and usage snapshot
                    </span>
                  </span>
                </NavLink>
                <NavLink
                  to={`/portal/workspaces/${workspaceId}/billing`}
                  className={sectionLinkClass}
                >
                  <span>
                    <span className="block text-sm font-medium">Billing</span>
                    <span className="mt-1 block text-xs opacity-80">
                      Subscription, plan version, and internal overrides
                    </span>
                  </span>
                </NavLink>
                <NavLink
                  to={`/portal/workspaces/${workspaceId}/members`}
                  className={sectionLinkClass}
                >
                  <span>
                    <span className="block text-sm font-medium">Members</span>
                    <span className="mt-1 block text-xs opacity-80">
                      Seat usage, owner access, and invite state
                    </span>
                  </span>
                </NavLink>
                <NavLink
                  to={`/portal/workspaces/${workspaceId}/channels`}
                  className={sectionLinkClass}
                >
                  <span>
                    <span className="block text-sm font-medium">Channels</span>
                    <span className="mt-1 block text-xs opacity-80">
                      Connected accounts, caps, and delivery health
                    </span>
                  </span>
                </NavLink>
                <NavLink
                  to={`/portal/workspaces/${workspaceId}/audit`}
                  className={sectionLinkClass}
                >
                  <span>
                    <span className="block text-sm font-medium">Audit</span>
                    <span className="mt-1 block text-xs opacity-80">
                      Internal actions and support history
                    </span>
                  </span>
                </NavLink>
              </nav>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Client account
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {workspace.billing.account.name}
              </h2>
              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <p>
                  Owner:
                  <span className="ml-2 font-medium text-white">
                    {workspace.owner?.email ?? "No owner record"}
                  </span>
                </p>
                <p>
                  Plan:
                  <span className="ml-2 font-medium text-white">
                    {workspace.billing.subscription.planDisplayName}
                  </span>
                </p>
                <p>
                  Status:
                  <span className="ml-2 font-medium text-white capitalize">
                    {formatBillingStatusLabel(workspace.billing.subscription.status)}
                  </span>
                </p>
                <p>
                  Workspace slug:
                  <span className="ml-2 font-medium text-white">{workspace.slug}</span>
                </p>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Public entrypoints
              </p>
              <div className="mt-4 space-y-3">
                <Link
                  to="/portal"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                >
                  Back to client list
                </Link>
                <a
                  href={workspace.publicPageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                >
                  Open public page
                </a>
                <a
                  href={workspace.publicChatPageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Open public chat
                </a>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <Outlet context={outletContext} />
          </div>
        </div>
      )}
    </PortalShell>
  );
}
