import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../hooks/use-session";
import { apiRequest } from "../services/api";
import { WorkspaceProfile } from "../types/models";
import {
  BillingPlanButton,
  BillingUpgradePanel,
} from "../features/billing/billing-upgrade";
import { buildWorkspacePath } from "../utils/workspace-routes";

export function WorkspaceProfilePage() {
  const { activeWorkspace, isAdmin, refreshSession } = useSession();
  const workspaceId = activeWorkspace?._id;

  const [workspace, setWorkspace] = useState<WorkspaceProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<{ workspace: WorkspaceProfile }>(
        "/api/workspace-profile"
      );
      setWorkspace(response.workspace);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to load workspace profile."
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspace || !isAdmin) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await apiRequest<{ workspace: WorkspaceProfile }>(
        "/api/workspace-profile",
        {
          method: "PATCH",
          body: JSON.stringify({
            name: workspace.name,
            bio: workspace.bio,
            publicDescription: workspace.publicDescription,
            publicWebsiteUrl: workspace.publicWebsiteUrl,
            publicSupportEmail: workspace.publicSupportEmail,
            publicSupportPhone: workspace.publicSupportPhone,
            publicWelcomeMessage: workspace.publicWelcomeMessage,
            publicChatEnabled: workspace.publicChatEnabled,
          }),
        }
      );

      setWorkspace(response.workspace);
      setNotice("Workspace profile updated.");
      await refreshSession();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to save workspace profile."
      );
    } finally {
      setSaving(false);
    }
  };

  const seatUsagePercent = useMemo(() => {
    if (!workspace || workspace.billing.entitlements.maxSeats <= 0) {
      return 0;
    }
    return Math.min(
      Math.round(
        (workspace.billing.usageSummary.seatsUsed /
          workspace.billing.entitlements.maxSeats) *
          100
      ),
      100
    );
  }, [workspace]);

  const workspaceUsagePercent = useMemo(() => {
    if (!workspace || workspace.billing.entitlements.maxWorkspaces <= 0) {
      return 0;
    }
    return Math.min(
      Math.round(
        (workspace.billing.usageSummary.workspacesUsed /
          workspace.billing.entitlements.maxWorkspaces) *
          100
      ),
      100
    );
  }, [workspace]);

  if (!workspaceId) {
    return <div className="p-6 md:p-8">Workspace not selected.</div>;
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Workspace Profile
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Workspace Details
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          Edit the workspace name, customer-facing details, website chat access, and
          public page links tied to this workspace slug.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      {loading || !workspace ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading workspace profile...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Workspace name
                </span>
                <input
                  value={workspace.name}
                  onChange={(event) =>
                    setWorkspace((current) =>
                      current ? { ...current, name: event.target.value } : current
                    )
                  }
                  disabled={!isAdmin}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Workspace slug
                </span>
                <input
                  value={workspace.slug}
                  disabled
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
                />
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Time zone
                </span>
                <input
                  value={workspace.timeZone}
                  disabled
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
                />
              </label>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-950">Website chat</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Allow customers to message this workspace from the website chat
                      page.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      isAdmin &&
                      workspace.websiteChatEntitled &&
                      setWorkspace((current) =>
                        current
                          ? { ...current, publicChatEnabled: !current.publicChatEnabled }
                          : current
                      )
                    }
                    disabled={!isAdmin || !workspace.websiteChatEntitled}
                    className={`inline-flex h-8 min-w-[70px] items-center justify-center rounded-full px-3 text-xs font-semibold transition ${
                      workspace.publicChatEnabled
                        ? "bg-slate-950 text-white"
                        : "bg-slate-200 text-slate-600"
                    } ${!isAdmin ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    {!workspace.websiteChatEntitled
                      ? "Plan blocked"
                      : workspace.publicChatEnabled
                        ? "Enabled"
                        : "Disabled"}
                  </button>
                </div>
                {!workspace.websiteChatEntitled ? (
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Website chat is not included in the current billing plan.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-950">Workspace copy</p>
              <div className="mt-4 space-y-5">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Bio
                  </span>
                  <textarea
                    value={workspace.bio}
                    onChange={(event) =>
                      setWorkspace((current) =>
                        current ? { ...current, bio: event.target.value } : current
                      )
                    }
                    disabled={!isAdmin}
                    rows={4}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Description
                  </span>
                  <textarea
                    value={workspace.publicDescription}
                    onChange={(event) =>
                      setWorkspace((current) =>
                        current
                          ? { ...current, publicDescription: event.target.value }
                          : current
                      )
                    }
                    disabled={!isAdmin}
                    rows={4}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Welcome message
                  </span>
                  <textarea
                    value={workspace.publicWelcomeMessage}
                    onChange={(event) =>
                      setWorkspace((current) =>
                        current
                          ? { ...current, publicWelcomeMessage: event.target.value }
                          : current
                      )
                    }
                    disabled={!isAdmin}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-950">Customer contact details</p>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Website
                  </span>
                  <input
                    value={workspace.publicWebsiteUrl}
                    onChange={(event) =>
                      setWorkspace((current) =>
                        current
                          ? { ...current, publicWebsiteUrl: event.target.value }
                          : current
                      )
                    }
                    disabled={!isAdmin}
                    placeholder="https://example.com"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Support email
                  </span>
                  <input
                    value={workspace.publicSupportEmail}
                    onChange={(event) =>
                      setWorkspace((current) =>
                        current
                          ? { ...current, publicSupportEmail: event.target.value }
                          : current
                      )
                    }
                    disabled={!isAdmin}
                    placeholder="support@example.com"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Support phone
                  </span>
                  <input
                    value={workspace.publicSupportPhone}
                    onChange={(event) =>
                      setWorkspace((current) =>
                        current
                          ? { ...current, publicSupportPhone: event.target.value }
                          : current
                      )
                    }
                    disabled={!isAdmin}
                    placeholder="+1 555 000 0000"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                  />
                </label>
              </div>
            </div>

            {isAdmin ? (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {saving ? "Saving..." : "Save workspace profile"}
              </button>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                You can view the workspace profile, but only workspace admins can edit it.
              </div>
            )}
          </form>

          <aside className="space-y-6">
            {!workspace.websiteChatEntitled ? (
              <BillingUpgradePanel
                billing={workspace.billing}
                workspaceSlug={workspace.slug}
                workspaceId={workspace._id}
                requestGate="website_chat"
                title="Website Chat is not included"
                description="This plan does not include Website Chat for this billing account. Upgrade the plan before turning on the public website chat entry point."
                className="shadow-none"
              />
            ) : null}

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Website Pages
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">
                Share the workspace slug
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Custom domains can layer in later. Right now the public website entry
                point uses the workspace slug.
              </p>
              <div className="mt-4 space-y-3">
                <a
                  href={workspace.publicPageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition hover:border-slate-950"
                >
                  {workspace.publicPageUrl}
                </a>
                <a
                  href={workspace.publicChatPageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition hover:border-slate-950"
                >
                  {workspace.publicChatPageUrl}
                </a>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Chat Status
              </p>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                <p>
                  Website chat toggle:
                  <strong className="ml-2 text-white">
                    {workspace.publicChatEnabled ? "Enabled" : "Disabled"}
                  </strong>
                </p>
                <p>
                  Website channel:
                  <strong className="ml-2 text-white">
                    {workspace.websiteChatAvailable ? "Connected" : "Not connected"}
                  </strong>
                </p>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Plan and Usage
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">
                {workspace.billing.subscription.planDisplayName}
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Billing is account-level now. This workspace shares seats, workspaces,
                and platform entitlements with the rest of its billing account.
              </p>
              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Seats</span>
                    <strong className="text-slate-950">
                      {workspace.billing.usageSummary.seatsUsed} /{" "}
                      {workspace.billing.entitlements.maxSeats}
                    </strong>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-950"
                      style={{ width: `${seatUsagePercent}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Workspaces</span>
                    <strong className="text-slate-950">
                      {workspace.billing.usageSummary.workspacesUsed} /{" "}
                      {workspace.billing.entitlements.maxWorkspaces}
                    </strong>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-950"
                      style={{ width: `${workspaceUsagePercent}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>
                  Billing status:
                  <strong className="ml-2 capitalize text-slate-950">
                    {workspace.billing.subscription.status}
                  </strong>
                </p>
                <p>
                  Subscription interval:
                  <strong className="ml-2 text-slate-950">
                    {workspace.billing.subscription.billingInterval}
                  </strong>
                </p>
                <p>
                  External platform families:
                  <strong className="ml-2 text-slate-950">
                    {workspace.billing.usageSummary.externalPlatformFamiliesUsed.length} /{" "}
                    {workspace.billing.entitlements.maxExternalPlatformFamilies}
                  </strong>
                </p>
                <p>
                  Allowed families:
                  <strong className="ml-2 text-slate-950">
                    {workspace.billing.entitlements.allowedPlatformFamilies.join(", ")}
                  </strong>
                </p>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-950">Feature access</p>
                <div className="mt-2 space-y-1">
                  <p>Website chat: {workspace.billing.entitlements.allowWebsiteChat ? "Enabled" : "Disabled"}</p>
                  <p>BYO AI: {workspace.billing.entitlements.allowBYOAI ? "Enabled" : "Disabled"}</p>
                  <p>Automation: {workspace.billing.entitlements.allowAutomation ? "Enabled" : "Disabled"}</p>
                  <p>Custom domain: {workspace.billing.entitlements.allowCustomDomain ? "Enabled" : "Disabled"}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap">
                <div className="px-2 py-1">
                  <BillingPlanButton
                    billing={workspace.billing}
                    workspaceSlug={workspace.slug}
                    workspaceId={workspace._id}
                    label="Change plan"
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
                  />
                </div>
                <div className="px-2 py-1">
                  <Link
                    to={buildWorkspacePath(workspace.slug, "billing")}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                  >
                    Open billing page
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
