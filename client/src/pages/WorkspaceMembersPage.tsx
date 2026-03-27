import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import { useSession } from "../hooks/use-session";
import { BillingState, WorkspaceRole } from "../types/models";
import {
  ASSIGNABLE_WORKSPACE_ROLES,
  type AssignableWorkspaceRole,
  formatWorkspaceRoleLabel,
} from "../utils/workspace-role";
import {
  BillingUpgradePanel,
  getBillingUpgradeContent,
  getBillingUpgradeDetails,
} from "../features/billing/billing-upgrade";

type MemberItem = {
  _id: string;
  workspaceRole: WorkspaceRole;
  status: "active" | "invited" | "disabled";
  isWorkspaceOwnerAccount?: boolean;
  inviteExpiresAt?: string | null;
  inviteEmailSentAt?: string | null;
  inviteAcceptedAt?: string | null;
  user: {
    _id: string;
    email: string;
    name: string;
  } | null;
};

type MembersResponse = {
  items: MemberItem[];
  billing: BillingState;
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export function WorkspaceMembersPage() {
  const { session, activeWorkspace, isAdmin } = useSession();
  const workspaceId = activeWorkspace?._id;

  const [items, setItems] = useState<MemberItem[]>([]);
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [workspaceRole, setWorkspaceRole] =
    useState<AssignableWorkspaceRole>("agent");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [upgradeDetails, setUpgradeDetails] = useState<ReturnType<
    typeof getBillingUpgradeDetails
  >>(null);

  const loadMembers = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<MembersResponse>(
        `/api/workspaces/${workspaceId}/members`
      );
      setItems(response.items);
      setBilling(response.billing);
      setUpgradeDetails(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const copyInviteUrl = async () => {
    if (!latestInviteUrl || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(latestInviteUrl);
      setNotice("Invite link copied.");
    } catch {
      setNotice("Invite link is ready below if you want to copy it manually.");
    }
  };

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspaceId || !email.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    setUpgradeDetails(null);
    try {
      const response = await apiRequest<{
        inviteDelivery?: {
          inviteUrl?: string;
          emailSent?: boolean;
          emailSkipped?: boolean;
          emailReason?: string | null;
        } | null;
      }>(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          workspaceRole,
        }),
      });

      const nextInviteUrl = response.inviteDelivery?.inviteUrl ?? null;
      setLatestInviteUrl(nextInviteUrl);
      setEmail("");
      setName("");
      setWorkspaceRole("agent");

      if (nextInviteUrl) {
        setNotice(
          response.inviteDelivery?.emailSent
            ? "Invite created and email sent."
            : "Invite created. Share the link manually."
        );
      } else {
        setNotice("Workspace access granted.");
      }

      await loadMembers();
    } catch (nextError) {
      const nextUpgradeDetails = getBillingUpgradeDetails(nextError);
      setUpgradeDetails(nextUpgradeDetails);
      setError(
        nextUpgradeDetails
          ? null
          : nextError instanceof Error
            ? nextError.message
            : "Failed to add member"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendInvite = async (memberId: string) => {
    if (!workspaceId) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    setUpgradeDetails(null);
    try {
      const response = await apiRequest<{
        inviteDelivery?: {
          inviteUrl?: string;
          emailSent?: boolean;
          emailSkipped?: boolean;
          emailReason?: string | null;
        } | null;
      }>(`/api/workspaces/${workspaceId}/members/${memberId}/resend-invite`, {
        method: "POST",
      });

      const nextInviteUrl = response.inviteDelivery?.inviteUrl ?? null;
      setLatestInviteUrl(nextInviteUrl);
      setNotice(
        response.inviteDelivery?.emailSent
          ? "Invite refreshed and email sent again."
          : "Invite refreshed. Share the new link manually."
      );
      await loadMembers();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to resend invite");
    } finally {
      setSubmitting(false);
    }
  };

  if (!session || !workspaceId) {
    return <div className="p-6">Workspace not selected.</div>;
  }

  if (!isAdmin) {
    return <div className="p-6">You do not have permission to manage members.</div>;
  }

  const activeCount = items.filter((item) => item.status === "active").length;
  const invitedCount = items.filter((item) => item.status === "invited").length;
  const seatsAtLimit = billing
    ? billing.usageSummary.seatsUsed >= billing.entitlements.maxSeats
    : false;
  const proactiveUpgradeContent = billing
    ? {
        title: "Seat limit reached",
        description:
          "This billing account is already using every seat it includes. Active members and pending invites across every workspace count toward the same seat pool.",
        usageLabel: `${billing.usageSummary.seatsUsed} of ${billing.entitlements.maxSeats} seats are already in use`,
      }
    : null;
  const reactiveUpgradeContent = upgradeDetails
    ? getBillingUpgradeContent(upgradeDetails)
    : null;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Workspace Members
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          People and invites
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          Invite people into {activeWorkspace?.name}, refresh invite links, and keep
          workspace access separated by role.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          The founding workspace owner-of-record account is locked and cannot be
          reassigned or removed.
        </p>
      </div>

      {billing ? (
        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Current plan
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {billing.subscription.planDisplayName}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {billing.subscription.version
                ? `v${billing.subscription.version}`
                : "No version"}
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Seat usage
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {billing.usageSummary.seatsUsed}/{billing.entitlements.maxSeats}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Shared across the billing account
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Active members
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{activeCount}</p>
            <p className="mt-1 text-sm text-slate-500">
              {invitedCount} pending invite{invitedCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Seats remaining
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {billing.usageSummary.seatsRemaining}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Pending invites count too
            </p>
          </div>
        </div>
      ) : null}

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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Access
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                Team members and pending invites
              </h3>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {items.length} record{items.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Invite</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-slate-500">
                      Loading members...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-slate-500">
                      No members found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item._id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-950">
                            {item.user?.name ?? "Unknown"}
                          </span>
                          {item.isWorkspaceOwnerAccount ? (
                            <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[11px] font-medium text-white">
                              Owner of record
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.user?.email ?? "N/A"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatWorkspaceRoleLabel(item.workspaceRole)}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">{item.status}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {item.status === "invited" ? (
                          <div className="space-y-1">
                            <div>Expires {formatDateTime(item.inviteExpiresAt)}</div>
                            <div>Sent {formatDateTime(item.inviteEmailSentAt)}</div>
                          </div>
                        ) : (
                          <span>No pending invite</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.status === "invited" ? (
                          <button
                            type="button"
                            onClick={() => void handleResendInvite(item._id)}
                            disabled={submitting}
                            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Refresh invite
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">No action</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-6">
          {upgradeDetails && reactiveUpgradeContent ? (
            <BillingUpgradePanel
              billing={upgradeDetails.billing}
              workspaceSlug={activeWorkspace?.slug}
              workspaceId={activeWorkspace?._id}
              requestGate={upgradeDetails.gate}
              {...reactiveUpgradeContent}
            />
          ) : null}

          {!upgradeDetails && seatsAtLimit && billing && proactiveUpgradeContent ? (
            <BillingUpgradePanel
              billing={billing}
              workspaceSlug={activeWorkspace?.slug}
              workspaceId={activeWorkspace?._id}
              requestGate="seats"
              {...proactiveUpgradeContent}
            />
          ) : null}

          <form
            onSubmit={handleAdd}
            className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Invite
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              Create workspace access
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Enter the teammate email, choose a role, and create an invite link for
              this workspace.
            </p>
            <p className="mt-2 text-xs leading-6 text-slate-400">
              Active members and pending invites across this billing account both
              count toward seat usage.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-100">
                  Email
                </span>
                <input
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-slate-400"
                  placeholder="email@domain.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-100">
                  Name
                </span>
                <input
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-slate-400"
                  placeholder="Name (optional)"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-100">
                  Role
                </span>
                <select
                  className="h-11 w-full rounded-xl border border-white/10 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-white focus:ring-2 focus:ring-white/20"
                  value={workspaceRole}
                  onChange={(event) =>
                    setWorkspaceRole(event.target.value as AssignableWorkspaceRole)
                  }
                >
                  {ASSIGNABLE_WORKSPACE_ROLES.map((roleOption) => (
                    <option key={roleOption} value={roleOption}>
                      {formatWorkspaceRoleLabel(roleOption)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="submit"
              className="mt-5 h-11 w-full rounded-xl bg-white px-4 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create invite"}
            </button>
          </form>

          {latestInviteUrl ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Share Link
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                People can join from the invite link directly, or paste the full link
                into My Workspaces.
              </p>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {latestInviteUrl}
              </div>
              <button
                type="button"
                onClick={() => void copyInviteUrl()}
                className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
              >
                Copy invite link
              </button>
            </div>
          ) : null}

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Notes
            </p>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
              <li>Each invite is tied to the target email address.</li>
              <li>Seat limits are shared across the billing account, not this workspace alone.</li>
              <li>Invite links can be emailed automatically or shared manually.</li>
              <li>Workspace members and pending invites stay isolated inside this workspace.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
