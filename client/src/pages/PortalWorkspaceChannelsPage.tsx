import { useMemo } from "react";
import { usePortalWorkspace } from "../features/portal/portal-workspace-context";
import { formatDateTime } from "../features/portal/portal-workspace-helpers";

export function PortalWorkspaceChannelsPage() {
  const { workspace } = usePortalWorkspace();

  const platformCoverage = useMemo(() => {
    const allowedFamilies = new Set(workspace.billing.entitlements.allowedPlatformFamilies);
    const usageByPlatform = workspace.billing.usageSummary.connectedAccountsUsedByPlatform;
    const limitsByPlatform = workspace.billing.entitlements.maxConnectedAccountsPerPlatform;

    const rows = Object.entries(limitsByPlatform)
      .filter(([family, limit]) => {
        const used =
          usageByPlatform[
            family as keyof typeof workspace.billing.usageSummary.connectedAccountsUsedByPlatform
          ] ?? 0;

        if (family === "website") {
          return workspace.billing.entitlements.allowWebsiteChat || used > 0;
        }

        return allowedFamilies.has(
          family as (typeof workspace.billing.entitlements.allowedPlatformFamilies)[number]
        ) || limit > 0 || used > 0;
      })
      .map(([family, limit]) => {
        const used =
          usageByPlatform[
            family as keyof typeof workspace.billing.usageSummary.connectedAccountsUsedByPlatform
          ] ?? 0;

        const access =
          family === "website"
            ? workspace.billing.entitlements.allowWebsiteChat
              ? "included"
              : "blocked"
            : allowedFamilies.has(
                  family as (typeof workspace.billing.entitlements.allowedPlatformFamilies)[number]
                )
              ? "allowed"
              : "blocked";

        return {
          family,
          limit,
          used,
          access,
        };
      });

    return rows;
  }, [workspace]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Channels
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Connected account operations
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">
              Review live channel connections, platform coverage, and which account
              caps could block the client from connecting more channels.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Active connections
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {workspace.connectionCounts.active}/{workspace.connectionCounts.total}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              External families
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {workspace.billing.usageSummary.externalPlatformFamiliesUsed.length}/
              {workspace.billing.entitlements.maxExternalPlatformFamilies}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Website chat
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {workspace.billing.entitlements.allowWebsiteChat ? "Included" : "Blocked"}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Public chat
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {workspace.publicChatEnabled ? "Enabled" : "Disabled"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Platform coverage
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-950">
              Allowed families and connection caps
            </h3>
          </div>
        </div>

        {platformCoverage.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            This plan currently exposes no channel families to the workspace.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Family</th>
                  <th className="px-4 py-3 font-medium">Access</th>
                  <th className="px-4 py-3 font-medium">Cap</th>
                  <th className="px-4 py-3 font-medium">Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {platformCoverage.map((row) => (
                  <tr key={row.family}>
                    <td className="px-4 py-3 capitalize text-slate-950">{row.family}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{row.access}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.family === "website" && row.limit === 0 ? "-" : row.limit}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.used}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Connections
        </p>
        <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Channel</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last inbound</th>
                <th className="px-4 py-3 font-medium">Last outbound</th>
                <th className="px-4 py-3 font-medium">Last error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workspace.connections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-slate-500">
                    No channel connections found for this workspace.
                  </td>
                </tr>
              ) : (
                workspace.connections.map((connection) => (
                  <tr key={connection._id}>
                    <td className="px-4 py-3 capitalize text-slate-950">
                      {connection.channel}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{connection.displayName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {connection.status} / {connection.verificationState}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDateTime(connection.lastInboundAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDateTime(connection.lastOutboundAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {connection.lastError || "No recent error"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
