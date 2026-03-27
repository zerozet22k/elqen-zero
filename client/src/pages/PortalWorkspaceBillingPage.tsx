import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  formatBillingIntervalLabel,
  formatBillingStatusLabel,
  formatBooleanLabel,
  formatOverrideTypeLabel,
  formatPortalLabel,
  formatShortDate,
} from "../features/portal/portal-display";
import { usePortalWorkspace } from "../features/portal/portal-workspace-context";
import { flattenPlanVersions, formatDateTime, toDateInputValue } from "../features/portal/portal-workspace-helpers";
import { apiRequest } from "../services/api";
import {
  BillingAccountStatus,
  BillingOverrideSummary,
  BillingOverrideType,
  PortalWorkspaceDetail,
} from "../types/models";

const BILLING_STATUS_OPTIONS: BillingAccountStatus[] = [
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
];

const OVERRIDE_TYPE_OPTIONS: BillingOverrideType[] = [
  "manual_status",
  "trial_extension",
  "entitlement_override",
  "manual_discount",
];

type BillingPanel = "subscription" | "override";

export function PortalWorkspaceBillingPage() {
  const {
    workspace,
    workspaceId,
    planCatalogs,
    overrides,
    setWorkspace,
    setOverrides,
  } = usePortalWorkspace();
  const [billingAccountName, setBillingAccountName] = useState("");
  const [activePanel, setActivePanel] = useState<BillingPanel>("subscription");
  const [status, setStatus] = useState<BillingAccountStatus>("active");
  const [planVersionId, setPlanVersionId] = useState("");
  const [currentPeriodStart, setCurrentPeriodStart] = useState("");
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState("");
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [overrideType, setOverrideType] =
    useState<BillingOverrideType>("manual_status");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideStatus, setOverrideStatus] = useState<BillingAccountStatus>("active");
  const [overrideTrialEndsAt, setOverrideTrialEndsAt] = useState("");
  const [overridePayloadText, setOverridePayloadText] = useState("{}");
  const [discountLabel, setDiscountLabel] = useState("");
  const [discountAmountOff, setDiscountAmountOff] = useState("");
  const [discountPercentOff, setDiscountPercentOff] = useState("");
  const [discountNote, setDiscountNote] = useState("");
  const [overrideEffectiveFrom, setOverrideEffectiveFrom] = useState("");
  const [overrideEffectiveTo, setOverrideEffectiveTo] = useState("");
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setBillingAccountName(workspace.billing.account.name);
    setStatus(workspace.billing.subscription.status);
    setPlanVersionId(workspace.billing.subscription.planVersionId ?? "");
    setCurrentPeriodStart(
      toDateInputValue(workspace.billing.subscription.currentPeriodStart)
    );
    setCurrentPeriodEnd(toDateInputValue(workspace.billing.subscription.currentPeriodEnd));
    setTrialEndsAt(toDateInputValue(workspace.billing.subscription.trialEndsAt));
    setCancelAtPeriodEnd(workspace.billing.subscription.cancelAtPeriodEnd);
  }, [workspace]);

  const planOptions = useMemo(() => flattenPlanVersions(planCatalogs), [planCatalogs]);
  const selectedPlanOption =
    planOptions.find((item) => item.version._id === planVersionId) ?? null;

  const buildOverridePayload = () => {
    if (overrideType === "manual_status") {
      return { status: overrideStatus };
    }

    if (overrideType === "trial_extension") {
      return { trialEndsAt: overrideTrialEndsAt || null };
    }

    if (overrideType === "manual_discount") {
      return {
        label: discountLabel || undefined,
        amountOff: discountAmountOff ? Number(discountAmountOff) : undefined,
        percentOff: discountPercentOff ? Number(discountPercentOff) : undefined,
        note: discountNote || undefined,
      };
    }

    return JSON.parse(overridePayloadText || "{}") as Record<string, unknown>;
  };

  const handleSubscriptionSave = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setSavingSubscription(true);
      setError(null);
      setNotice(null);
      const response = await apiRequest<{
        billing: PortalWorkspaceDetail["billing"];
        overrides: BillingOverrideSummary[];
      }>(`/api/portal/workspaces/${encodeURIComponent(workspaceId)}/subscription`, {
        method: "POST",
        body: JSON.stringify({
          billingAccountName,
          status,
          planVersionId,
          currentPeriodStart: currentPeriodStart || null,
          currentPeriodEnd: currentPeriodEnd || null,
          trialEndsAt: trialEndsAt || null,
          cancelAtPeriodEnd,
        }),
      });

      setWorkspace((current) =>
        current ? { ...current, billing: response.billing } : current
      );
      setOverrides(response.overrides);
      setNotice("Subscription updated.");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to update subscription."
      );
    } finally {
      setSavingSubscription(false);
    }
  };

  const handleOverrideCreate = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setSavingOverride(true);
      setError(null);
      setNotice(null);
      const response = await apiRequest<{
        billing: PortalWorkspaceDetail["billing"];
        overrides: BillingOverrideSummary[];
      }>(`/api/portal/workspaces/${encodeURIComponent(workspaceId)}/overrides`, {
        method: "POST",
        body: JSON.stringify({
          type: overrideType,
          payload: buildOverridePayload(),
          effectiveFrom: overrideEffectiveFrom || null,
          effectiveTo: overrideEffectiveTo || null,
          reason: overrideReason,
        }),
      });

      setWorkspace((current) =>
        current ? { ...current, billing: response.billing } : current
      );
      setOverrides(response.overrides);
      setOverrideReason("");
      setNotice("Billing override created.");
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to create override."
      );
    } finally {
      setSavingOverride(false);
    }
  };

  return (
    <div className="space-y-6">
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

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Billing
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Subscription and overrides
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">
              Internal billing controls for this client account. Update the billing
              account name, current subscription version, billing timeline, and manual
              support overrides from here.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Billing Account
            </p>
            <p className="mt-2 text-sm font-medium text-slate-950">
              {workspace.billing.account.name}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {formatBillingStatusLabel(workspace.billing.account.status)}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Current Plan
            </p>
            <p className="mt-2 text-sm font-medium text-slate-950">
              {workspace.billing.subscription.planDisplayName} v
              {workspace.billing.subscription.version ?? "-"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {formatBillingIntervalLabel(workspace.billing.subscription.billingInterval)}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Billing Status
            </p>
            <p className="mt-2 text-sm font-medium text-slate-950">
              {formatBillingStatusLabel(workspace.billing.subscription.status)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Provider: {formatPortalLabel(workspace.billing.subscription.provider)}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Billing Period
            </p>
            <p className="mt-2 text-sm font-medium text-slate-950">
              {formatShortDate(workspace.billing.subscription.currentPeriodStart)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              to {formatShortDate(workspace.billing.subscription.currentPeriodEnd)}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Active Overrides
            </p>
            <p className="mt-2 text-sm font-medium text-slate-950">
              {workspace.billing.overrides.activeCount}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Support-only adjustments
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_430px]">
        <section className="space-y-6">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
            {[
              { key: "subscription", label: "Subscription controls" },
              { key: "override", label: "Support overrides" },
            ].map((option) => {
              const active = activePanel === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setActivePanel(option.key as BillingPanel)}
                  className={[
                    "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition",
                    active
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-600 hover:text-slate-950",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {activePanel === "subscription" ? (
            <form
              onSubmit={handleSubscriptionSave}
              className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
            >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Subscription Controls
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-950">
              Billing account settings
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Adjust the billing account name, account status, plan version, and the
              active billing dates for this client.
            </p>

            <div className="mt-5 space-y-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Billing account name
                </span>
                <input
                  value={billingAccountName}
                  onChange={(event) => setBillingAccountName(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Status
                  </span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as BillingAccountStatus)}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  >
                    {BILLING_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatBillingStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Plan version
                  </span>
                  <select
                    value={planVersionId}
                    onChange={(event) => setPlanVersionId(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  >
                    {planOptions.map((item) => (
                      <option key={item.version._id} value={item.version._id}>
                        {item.catalogDisplayName} v{item.version.version} |{" "}
                        {formatBillingIntervalLabel(item.version.billingInterval)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-950">Billing dates</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Use the calendar inputs below so staff can adjust the active
                      period and trial window without typing raw dates.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-900">
                      Period start
                    </span>
                    <input
                      type="date"
                      value={currentPeriodStart}
                      onChange={(event) => setCurrentPeriodStart(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-900">
                      Period end
                    </span>
                    <input
                      type="date"
                      value={currentPeriodEnd}
                      onChange={(event) => setCurrentPeriodEnd(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-900">
                      Trial ends on
                    </span>
                    <input
                      type="date"
                      value={trialEndsAt}
                      onChange={(event) => setTrialEndsAt(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-900">
                      Renewal behavior
                    </span>
                    <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={cancelAtPeriodEnd}
                        onChange={(event) => setCancelAtPeriodEnd(event.target.checked)}
                      />
                      <span>Cancel at the end of the current period</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSubscription}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:bg-slate-400"
            >
              {savingSubscription ? "Saving..." : "Save subscription"}
            </button>
            </form>
          ) : null}

          {activePanel === "override" ? (
            <form
              onSubmit={handleOverrideCreate}
              className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
            >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Support Overrides
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-950">
              Create manual override
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Apply temporary support controls without rewriting the subscribed plan
              version for this billing account.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">Type</span>
                <select
                  value={overrideType}
                  onChange={(event) =>
                    setOverrideType(event.target.value as BillingOverrideType)
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                >
                  {OVERRIDE_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {formatOverrideTypeLabel(option)}
                    </option>
                  ))}
                </select>
              </label>

              {overrideType === "manual_status" ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">Status</span>
                  <select
                    value={overrideStatus}
                    onChange={(event) =>
                      setOverrideStatus(event.target.value as BillingAccountStatus)
                    }
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  >
                    {BILLING_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatBillingStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {overrideType === "trial_extension" ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Trial ends on
                  </span>
                  <input
                    type="date"
                    value={overrideTrialEndsAt}
                    onChange={(event) => setOverrideTrialEndsAt(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  />
                </label>
              ) : null}

              {overrideType === "entitlement_override" ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Entitlement payload JSON
                  </span>
                  <textarea
                    value={overridePayloadText}
                    onChange={(event) => setOverridePayloadText(event.target.value)}
                    rows={7}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900"
                  />
                </label>
              ) : null}

              {overrideType === "manual_discount" ? (
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-900">Label</span>
                    <input
                      value={discountLabel}
                      onChange={(event) => setDiscountLabel(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-900">
                        Amount off
                      </span>
                      <input
                        value={discountAmountOff}
                        onChange={(event) => setDiscountAmountOff(event.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-900">
                        Percent off
                      </span>
                      <input
                        value={discountPercentOff}
                        onChange={(event) => setDiscountPercentOff(event.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-900">Note</span>
                    <textarea
                      value={discountNote}
                      onChange={(event) => setDiscountNote(event.target.value)}
                      rows={3}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900"
                    />
                  </label>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Effective from
                  </span>
                  <input
                    type="date"
                    value={overrideEffectiveFrom}
                    onChange={(event) => setOverrideEffectiveFrom(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Effective to
                  </span>
                  <input
                    type="date"
                    value={overrideEffectiveTo}
                    onChange={(event) => setOverrideEffectiveTo(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">Reason</span>
                <textarea
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={savingOverride}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:bg-slate-400"
            >
              {savingOverride ? "Creating..." : "Create override"}
            </button>
            </form>
          ) : null}
        </section>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Subscription Snapshot
            </p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Current plan assignment
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {workspace.billing.subscription.planDisplayName} v
                  {workspace.billing.subscription.version ?? "-"}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {formatBillingIntervalLabel(workspace.billing.subscription.billingInterval)}{" "}
                  | {formatPortalLabel(workspace.billing.subscription.provider)}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Current billing cycle
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {formatShortDate(workspace.billing.subscription.currentPeriodStart)} to{" "}
                  {formatShortDate(workspace.billing.subscription.currentPeriodEnd)}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Trial access
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {workspace.billing.subscription.trialEndsAt
                    ? `Ends on ${formatShortDate(workspace.billing.subscription.trialEndsAt)}`
                    : "No trial end date set"}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Renewal behavior
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {formatBooleanLabel(
                    workspace.billing.subscription.cancelAtPeriodEnd,
                    "Ends at the current period boundary",
                    "Renews automatically"
                  )}
                </p>
              </div>
            </div>

            {selectedPlanOption ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                <p className="font-medium text-white">Selected plan version</p>
                <p className="mt-2">
                  {selectedPlanOption.catalogDisplayName} v
                  {selectedPlanOption.version.version} |{" "}
                  {selectedPlanOption.version.priceAmount}{" "}
                  {selectedPlanOption.version.currency} |{" "}
                  {formatBillingIntervalLabel(selectedPlanOption.version.billingInterval)}
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Override history
            </p>
            <div className="mt-4 space-y-3">
              {overrides.length === 0 ? (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No overrides recorded for this billing account yet.
                </div>
              ) : (
                overrides.map((item) => (
                  <div
                    key={item._id}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-950">
                        {formatOverrideTypeLabel(item.type)}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          item.active
                            ? "bg-slate-950 text-white"
                            : "bg-white text-slate-600 ring-1 ring-slate-200"
                        }`}
                      >
                        {item.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {item.reason ? (
                      <p className="mt-2 text-sm leading-7 text-slate-600">{item.reason}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">
                      {formatDateTime(item.effectiveFrom)} to{" "}
                      {formatDateTime(item.effectiveTo)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
