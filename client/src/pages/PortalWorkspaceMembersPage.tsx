import { usePortalWorkspace } from "../features/portal/portal-workspace-context";
import { formatDateTime } from "../features/portal/portal-workspace-helpers";
import { formatWorkspaceRoleLabel } from "../utils/workspace-role";

export function PortalWorkspaceMembersPage() {
  const { workspace } = usePortalWorkspace();

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Members
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Seat and access review
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Review who belongs to this client workspace, which invites are still
              pending, and whether the billing account is approaching seat limits.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Seats used
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {workspace.billing.usageSummary.seatsUsed}/
              {workspace.billing.entitlements.maxSeats}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Active members
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {workspace.memberCounts.active}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pending invites
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {workspace.memberCounts.invited}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Disabled access
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {workspace.memberCounts.disabled}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Access roster
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                Workspace members
              </h3>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Invite accepted</th>
                  <th className="px-4 py-3 font-medium">Invite expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workspace.members.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-slate-500">
                      No members found for this workspace.
                    </td>
                  </tr>
                ) : (
                  workspace.members.map((member) => (
                    <tr key={member._id}>
                      <td className="px-4 py-3 text-slate-600">
                        {member.user ? (
                          <div>
                            <p className="font-medium text-slate-950">{member.user.name}</p>
                            <p className="mt-1 text-xs text-slate-500">{member.user.email}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400">User record missing</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatWorkspaceRoleLabel(member.workspaceRole)}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">{member.status}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateTime(member.inviteAcceptedAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateTime(member.inviteExpiresAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Access guardrails
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
              <li>Seat limits are derived from the billing account, not from this workspace alone.</li>
              <li>The founding owner remains the anchor account for workspace ownership.</li>
              <li>Invite cleanup and support decisions should stay auditable in the portal.</li>
            </ul>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Ownership
            </p>
            <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-950">
                {workspace.owner?.name ?? "No owner record"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {workspace.owner?.email ?? "Unknown"}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Treat this account as the client owner of record for billing,
                communication, and support escalation unless a future transfer flow is
                explicitly added.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
