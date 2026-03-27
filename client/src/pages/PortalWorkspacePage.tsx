import { usePortalWorkspace } from "../features/portal/portal-workspace-context";
import { formatBillingStatusLabel } from "../features/portal/portal-display";

export function PortalWorkspacePage() {
  const { workspace } = usePortalWorkspace();

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Overview
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Client workspace operations
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">
            Review the client identity, public workspace presence, and account
            health before making support, billing, or moderation decisions.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Workspace
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{workspace.name}</p>
            <p className="mt-1 text-sm text-slate-600">/workspace/{workspace.slug}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Owner
            </p>
            <p className="mt-2 text-sm font-medium text-slate-950">
              {workspace.owner?.name ?? "No owner record"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {workspace.owner?.email ?? "Unknown"}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Plan
            </p>
            <p className="mt-2 text-sm font-medium text-slate-950">
              {workspace.billing.subscription.planDisplayName}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {formatBillingStatusLabel(workspace.billing.subscription.status)}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Seats
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {workspace.billing.usageSummary.seatsUsed}/
              {workspace.billing.entitlements.maxSeats}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Across this billing account
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Public chat
            </p>
            <p className="mt-2 text-sm font-medium text-slate-950">
              {workspace.publicChatEnabled ? "Enabled" : "Disabled"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {workspace.websiteChatAvailable
                ? "Website channel connected"
                : "Website channel not connected"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Customer-facing setup
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-950">Description</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {workspace.description || workspace.bio || "No description set."}
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-950">Welcome message</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {workspace.welcomeMessage || "No welcome message set."}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Website
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {workspace.websiteUrl || "Not set"}
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Support email
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {workspace.supportEmail || "Not set"}
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Support phone
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {workspace.supportPhone || "Not set"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Account footprint
            </p>
            <div className="mt-4 space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-950">
                  {workspace.billing.usageSummary.workspacesUsed}/
                  {workspace.billing.entitlements.maxWorkspaces} workspaces
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  This billing account can span multiple client workspaces.
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-950">
                  {workspace.connectionCounts.active}/{workspace.connectionCounts.total}
                  {" "}connected accounts
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Channel health and caps are managed in the Channels section.
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-950">
                  {workspace.billing.overrides.activeCount} active override
                  {workspace.billing.overrides.activeCount === 1 ? "" : "s"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Manual support adjustments are isolated to the Billing section.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Account status
            </p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>
                Billing account:
                <strong className="ml-2 text-white">{workspace.billing.account.name}</strong>
              </p>
              <p>
                Time zone:
                <strong className="ml-2 text-white">{workspace.timeZone}</strong>
              </p>
              <p>
                External platform families:
                <strong className="ml-2 text-white">
                  {workspace.billing.usageSummary.externalPlatformFamiliesUsed.length}/
                  {workspace.billing.entitlements.maxExternalPlatformFamilies}
                </strong>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
