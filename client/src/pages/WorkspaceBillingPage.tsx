import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BillingPlanButton } from "../features/billing/billing-upgrade";
import { useSession } from "../hooks/use-session";
import { apiRequest } from "../services/api";
import { BillingAccountChoiceSummary, BillingState } from "../types/models";
import { isWorkspaceOwnerRole } from "../utils/workspace-role";

type WorkspaceBillingResponse = {
  billing: BillingState;
  accountProfile: {
    name: string;
    companyLegalName: string;
    billingEmail: string;
  };
  workspaceBillingAccountId: string;
  ownedBillingAccounts: {
    defaultBillingAccountId: string | null;
    items: BillingAccountChoiceSummary[];
  } | null;
};

const formatStatusLabel = (value: string) =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const formatDateLabel = (value?: string | null, fallback = "Not scheduled") => {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(parsed);
};

const formatBillingCycleLabel = (value: BillingState["subscription"]["billingInterval"]) =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

export function WorkspaceBillingPage() {
  const { activeWorkspace } = useSession();
  const location = useLocation();
  const workspaceId = activeWorkspace?._id ?? null;
  const workspaceSlug = activeWorkspace?.slug ?? null;
  const isOwner = isWorkspaceOwnerRole(activeWorkspace?.workspaceRole);

  const [billing, setBilling] = useState<BillingState | null>(null);
  const [profile, setProfile] = useState<WorkspaceBillingResponse["accountProfile"] | null>(
    null
  );
  const [ownedBillingAccounts, setOwnedBillingAccounts] =
    useState<WorkspaceBillingResponse["ownedBillingAccounts"]>(null);
  const [selectedBillingAccountId, setSelectedBillingAccountId] = useState<string | null>(
    null
  );
  const [makeSelectedDefault, setMakeSelectedDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);
  const [undoingScheduledChange, setUndoingScheduledChange] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const openPlansOnLoad = new URLSearchParams(location.search).get("plans") === "1";

  const loadBilling = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<WorkspaceBillingResponse>("/api/billing/account");
      setBilling(response.billing);
      setProfile(response.accountProfile);
      setOwnedBillingAccounts(response.ownedBillingAccounts);
      setSelectedBillingAccountId(response.workspaceBillingAccountId);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to load billing summary."
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  const selectedBillingAccount = useMemo(
    () =>
      ownedBillingAccounts?.items.find((item) => item._id === selectedBillingAccountId) ??
      null,
    [ownedBillingAccounts, selectedBillingAccountId]
  );

  if (!workspaceId) {
    return <div className="p-6 md:p-8">Workspace not selected.</div>;
  }

  const handleApplyBillingAccount = async () => {
    if (!selectedBillingAccountId) {
      return;
    }

    setSavingSelection(true);
    setError(null);
    setNotice(null);

    try {
      const response = await apiRequest<WorkspaceBillingResponse>(
        "/api/billing/workspace-account",
        {
          method: "PATCH",
          body: JSON.stringify({
            billingAccountId: selectedBillingAccountId,
            makeDefaultForAccount: makeSelectedDefault,
          }),
        }
      );

      setBilling(response.billing);
      setProfile(response.accountProfile);
      setOwnedBillingAccounts(response.ownedBillingAccounts);
      setSelectedBillingAccountId(response.workspaceBillingAccountId);
      setMakeSelectedDefault(false);
      setNotice("Workspace billing account updated.");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to update the workspace billing account."
      );
    } finally {
      setSavingSelection(false);
    }
  };

  const currentPeriodStart = billing?.subscription.currentPeriodStart ?? null;
  const currentPeriodEnd = billing?.subscription.currentPeriodEnd ?? null;
  const trialEndsAt = billing?.subscription.trialEndsAt ?? null;
  const currentBillingAccountChoice =
    ownedBillingAccounts?.items.find((item) => item._id === billing?.account._id) ?? null;
  const scheduledPlanLabel = billing?.subscription.scheduledPlanDisplayName
    ? `${billing.subscription.scheduledPlanDisplayName}`
    : billing?.subscription.scheduledPlanCode
      ? formatStatusLabel(billing.subscription.scheduledPlanCode)
      : null;
  const hasScheduledChange =
    !!billing?.subscription.scheduledChangeKind &&
    !!billing?.subscription.scheduledChangeEffectiveAt &&
    !!scheduledPlanLabel;
  const renewalLabel = billing?.subscription.cancelAtPeriodEnd
    ? "Plan ends on"
    : billing?.subscription.status === "trialing" && trialEndsAt
      ? "Trial ends on"
      : "Renews on";
  const renewalDate = billing?.subscription.cancelAtPeriodEnd
    ? currentPeriodEnd
    : billing?.subscription.status === "trialing" && trialEndsAt
      ? trialEndsAt
      : currentPeriodEnd;
  const outstandingStatus =
    billing?.subscription.status === "past_due"
      ? "Payment needs attention"
      : billing?.subscription.status === "canceled"
        ? "Subscription ended"
        : "No unpaid balance reported";
  const billingActivityCopy =
    billing?.subscription.provider === "stripe"
      ? "Stripe-hosted invoice and charge history will show here as that billing activity becomes available."
      : "Manual billing is active for this workspace, so invoices and payment follow-up are handled through the platform billing team.";

  const handleUndoScheduledChange = async () => {
    if (!hasScheduledChange) {
      return;
    }

    setUndoingScheduledChange(true);
    setError(null);
    setNotice(null);

    try {
      const response = await apiRequest<WorkspaceBillingResponse>("/api/billing/plan-change/undo", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setBilling(response.billing);
      setProfile(response.accountProfile);
      setOwnedBillingAccounts(response.ownedBillingAccounts);
      setSelectedBillingAccountId(response.workspaceBillingAccountId);
      setNotice("Scheduled plan change removed.");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to undo the scheduled plan change."
      );
    } finally {
      setUndoingScheduledChange(false);
    }
  };

  return (
    <div className="p-6 md:p-8 xl:p-10">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Billing
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Workspace billing
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">
          This workspace is billed through one of your account billing accounts.
          That billing account supplies the plan limits and handles billing for this workspace.
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

      {loading || !billing || !profile ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading billing summary...
        </div>
      ) : (
        <div className="space-y-6">
          {billing.subscription.status === "past_due" ||
          billing.subscription.status === "grace_period" ||
          billing.subscription.status === "restricted" ||
          billing.subscription.status === "free_fallback" ? (
            <section
              className={[
                "rounded-[28px] border p-6 shadow-sm sm:p-8",
                billing.subscription.status === "restricted"
                  ? "border-rose-200 bg-rose-50"
                  : "border-amber-200 bg-amber-50",
              ].join(" ")}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Billing state
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {formatStatusLabel(billing.subscription.status)}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                {billing.subscription.status === "past_due" ||
                billing.subscription.status === "grace_period"
                  ? `Payment needs attention. ${
                      billing.subscription.gracePeriodEndsAt
                        ? `If it is not resolved by ${formatDateLabel(
                            billing.subscription.gracePeriodEndsAt
                          )}, this workspace can fall back to Free or move into a restricted state.`
                        : "This workspace may fall back to Free or move into a restricted state if billing is not resolved."
                    }`
                  : billing.subscription.status === "free_fallback"
                    ? "This workspace has fallen back to the Free plan because the paid subscription could not continue."
                    : "This workspace is restricted until billing is resolved or usage is reduced to match an allowed plan."}
              </p>
            </section>
          ) : null}

          {hasScheduledChange ? (
            <section className="rounded-[28px] border border-sky-200 bg-sky-50 p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Scheduled next plan
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {scheduledPlanLabel}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    This workspace keeps its current plan until{" "}
                    <strong>{formatDateLabel(billing.subscription.scheduledChangeEffectiveAt)}</strong>.
                    No refund will be issued for unused time on the current billing period.
                  </p>
                </div>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => void handleUndoScheduledChange()}
                    disabled={undoingScheduledChange}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {undoingScheduledChange ? "Undoing..." : "Undo scheduled change"}
                  </button>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[24px] border border-sky-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Change type
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {formatStatusLabel(billing.subscription.scheduledChangeKind ?? "downgrade")}
                  </p>
                </div>
                <div className="rounded-[24px] border border-sky-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Effective on
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {formatDateLabel(billing.subscription.scheduledChangeEffectiveAt)}
                  </p>
                </div>
                <div className="rounded-[24px] border border-sky-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Current plan stays active
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    Until the effective date
                  </p>
                </div>
              </div>

              {billing.actionRequiredBeforeEffectiveDate.length > 0 ? (
                <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                  <p className="text-sm font-semibold text-amber-900">
                    Action required before the scheduled change takes effect
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-amber-900/90">
                    {billing.actionRequiredBeforeEffectiveDate.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Current billing summary
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {billing.subscription.planDisplayName} v{billing.subscription.version ?? "-"}
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  This workspace is currently attached to <strong>{profile.name || "a billing account"}</strong>.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {isOwner && workspaceSlug ? (
                  <>
                    <BillingPlanButton
                      billing={billing}
                      workspaceSlug={workspaceSlug}
                      workspaceId={workspaceId}
                      autoOpen={openPlansOnLoad}
                      label="Change plan"
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
                    />
                    <Link
                      to="/account/billings"
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                    >
                      Manage billing accounts
                    </Link>
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Subscription status
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatStatusLabel(billing.subscription.status)}
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Billing cycle
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatBillingCycleLabel(billing.subscription.billingInterval)}
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {renewalLabel}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatDateLabel(renewalDate)}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  Current period: {formatDateLabel(currentPeriodStart)} to {formatDateLabel(currentPeriodEnd)}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Period start
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatDateLabel(currentPeriodStart)}
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Period end
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatDateLabel(currentPeriodEnd)}
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Trial ends on
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatDateLabel(trialEndsAt)}
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Renewal behavior
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {billing.subscription.cancelAtPeriodEnd
                    ? "Ends at period end"
                    : "Renews normally"}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Usage and limits
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Current workspace limits
              </h3>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Seats
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {billing.usageSummary.seatsUsed}/{billing.entitlements.maxSeats}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Workspaces
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {billing.usageSummary.workspacesUsed}/{billing.entitlements.maxWorkspaces}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    External families
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {billing.usageSummary.externalPlatformFamiliesUsed.length}/
                    {billing.entitlements.maxExternalPlatformFamilies}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Billing activity
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Billing status for this workspace
              </h3>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Outstanding balance
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {outstandingStatus}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    {billing.subscription.status === "past_due"
                      ? "The subscription has a payment issue and may need follow-up."
                      : "No unpaid invoice is currently blocking this workspace."}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Latest billing activity
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {billing.subscription.provider === "stripe"
                      ? "Stripe subscription"
                      : "Manual billing"}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    {billingActivityCopy}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Next billing date
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {formatDateLabel(renewalDate)}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Latest invoice
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {billing.subscription.provider === "stripe"
                      ? "Stripe-hosted"
                      : "Manual billing"}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    {billing.subscription.provider === "stripe"
                      ? "Open the Stripe billing flow from this workspace when invoice history is needed."
                      : "Invoice history is handled manually for this workspace right now."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Billing account for this workspace
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {isOwner ? "Choose the billing account" : "Current billing account"}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {isOwner
                      ? "Switch which of your billing accounts this workspace should use."
                      : "Only the workspace owner can change which billing account this workspace uses."}
                  </p>
                </div>
              </div>

              {isOwner && ownedBillingAccounts?.items.length ? (
                <div className="mt-6 space-y-4">
                  {ownedBillingAccounts.items.map((item) => {
                    const isSelected = item._id === selectedBillingAccountId;

                    return (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => setSelectedBillingAccountId(item._id)}
                        className={[
                          "w-full rounded-[24px] border p-5 text-left transition",
                          isSelected
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-950 hover:border-slate-400",
                        ].join(" ")}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-semibold">{item.name}</span>
                          {item.isDefault ? (
                            <span
                              className={[
                                "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                                isSelected
                                  ? "bg-white/10 text-white"
                                  : "bg-white text-slate-700 ring-1 ring-slate-200",
                              ].join(" ")}
                            >
                              Default
                            </span>
                          ) : null}
                        </div>
                        <p
                          className={[
                            "mt-2 text-sm",
                            isSelected ? "text-slate-300" : "text-slate-500",
                          ].join(" ")}
                        >
                          {item.planDisplayName} v{item.version ?? "-"} · {formatStatusLabel(item.status)}
                        </p>
                        <p
                          className={[
                            "mt-2 text-sm",
                            isSelected ? "text-slate-300" : "text-slate-600",
                          ].join(" ")}
                        >
                          {item.workspaceCount} workspace{item.workspaceCount === 1 ? "" : "s"} attached
                        </p>
                      </button>
                    );
                  })}

                  <div className="flex flex-wrap gap-3">
                    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={makeSelectedDefault}
                        onChange={(event) => setMakeSelectedDefault(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-300"
                      />
                      Make this the default for new workspaces
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleApplyBillingAccount()}
                      disabled={savingSelection || !selectedBillingAccount || selectedBillingAccount._id === billing.account._id}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {savingSelection ? "Updating..." : "Use selected billing account"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                  <p>
                    Billing account: <strong className="text-slate-950">{profile.name || "Not set"}</strong>
                  </p>
                  <p>
                    Business: <strong className="text-slate-950">{profile.companyLegalName || "Not set"}</strong>
                  </p>
                  <p>
                    Billing email: <strong className="text-slate-950">{profile.billingEmail || "Not set"}</strong>
                  </p>
                </div>
              )}
            </section>

            <aside className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Current billing account
                </p>
                <p className="mt-3 text-lg font-semibold text-slate-950">
                  {profile.name || "Billing account"}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  This workspace is billed through that account, and the plan on that account sets the limits used here.
                </p>
                {currentBillingAccountChoice?.isDefault ? (
                  <div className="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                    Default for new workspaces
                  </div>
                ) : null}
                <Link
                  to="/account/billings"
                  className="mt-5 inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                >
                  Open account billing
                </Link>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Billing controls
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {isOwner
                    ? "You can switch this workspace between your billing accounts and open the plan picker from this page."
                    : "Billing changes are restricted to the workspace owner because subscriptions are managed at the billing-account level."}
                </p>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
