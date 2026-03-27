import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  BillingUpgradePanel,
  getBillingUpgradeContent,
  getBillingUpgradeDetails,
} from "../features/billing/billing-upgrade";
import { useSession } from "../hooks/use-session";
import { apiRequest } from "../services/api";
import { OwnedBillingAccountSummary } from "../types/models";
import { isPortalPlatformRole } from "../utils/platform-role";

type BillingAccountsResponse = {
  defaultBillingAccountId: string | null;
  items: OwnedBillingAccountSummary[];
};

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

const formatStatusLabel = (value: string) =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const canAttachWorkspace = (item: OwnedBillingAccountSummary) =>
  item.billing.usageSummary.workspacesUsed < item.billing.entitlements.maxWorkspaces;

export function CreateWorkspacePage() {
  const { session, activeWorkspace, deployment, createWorkspace } = useSession();
  const navigate = useNavigate();

  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [timeZone, setTimeZone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Bangkok"
  );
  const [billingSourceType, setBillingSourceType] = useState<"existing" | "new">(
    "existing"
  );
  const [existingBillingAccountId, setExistingBillingAccountId] = useState<string>("");
  const [newBillingAccountName, setNewBillingAccountName] = useState("");
  const [billingAccounts, setBillingAccounts] = useState<OwnedBillingAccountSummary[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeDetails, setUpgradeDetails] = useState<ReturnType<
    typeof getBillingUpgradeDetails
  >>(null);

  const creationDisabled =
    deployment.tenantMode === "single" || !deployment.allowWorkspaceCreation;

  const suggestedSlug = useMemo(
    () => normalizeSlug(workspaceSlug || workspaceName),
    [workspaceName, workspaceSlug]
  );

  const selectedBillingAccount = useMemo(
    () =>
      billingAccounts.find((item) => item.billing.account._id === existingBillingAccountId) ??
      null,
    [billingAccounts, existingBillingAccountId]
  );

  const selectedAccountHasCapacity = selectedBillingAccount
    ? canAttachWorkspace(selectedBillingAccount)
    : false;
  const selectedBillingWorkspace = selectedBillingAccount?.attachedWorkspaces[0] ?? null;

  useEffect(() => {
    if (!session || isPortalPlatformRole(session.user.platformRole)) {
      return;
    }

    let cancelled = false;

    const loadBillingAccounts = async () => {
      try {
        setBillingLoading(true);
        const response = await apiRequest<BillingAccountsResponse>("/api/billing/accounts");
        if (cancelled) {
          return;
        }

        setBillingAccounts(response.items);
        setExistingBillingAccountId(
          response.defaultBillingAccountId ??
            response.items[0]?.billing.account._id ??
            ""
        );
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to load billing accounts."
          );
        }
      } finally {
        if (!cancelled) {
          setBillingLoading(false);
        }
      }
    };

    void loadBillingAccounts();

    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (isPortalPlatformRole(session.user.platformRole)) {
    return <Navigate to="/portal" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (creationDisabled) {
      setError("Workspace creation is disabled on this deployment.");
      return;
    }

    if (!workspaceName.trim()) {
      setError("Workspace name is required.");
      return;
    }

    if (!suggestedSlug) {
      setError("Workspace slug is required.");
      return;
    }

    if (billingSourceType === "existing" && !existingBillingAccountId) {
      setError("Choose which billing account should be used.");
      return;
    }

    if (billingSourceType === "existing" && !selectedAccountHasCapacity) {
      setError(
        "That billing account is already at its workspace limit. Upgrade it or choose another billing account."
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    setUpgradeDetails(null);

    try {
      await createWorkspace({
        workspaceName: workspaceName.trim(),
        workspaceSlug: suggestedSlug,
        timeZone: timeZone.trim() || "Asia/Bangkok",
        billingSelection:
          billingSourceType === "existing"
            ? {
                type: "existing",
                billingAccountId: existingBillingAccountId,
              }
            : {
                type: "new",
                billingAccountName: newBillingAccountName.trim() || workspaceName.trim(),
              },
      });
      navigate("/account/workspaces", { replace: true });
    } catch (nextError) {
      const nextUpgradeDetails = getBillingUpgradeDetails(nextError);
      setUpgradeDetails(nextUpgradeDetails);
      setError(
        nextUpgradeDetails
          ? null
          : nextError instanceof Error
            ? nextError.message
            : "Failed to create workspace."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Workspaces
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
            Create another workspace
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
            Create the workspace first, then decide which saved billing account it
            should use. If one of your existing billing accounts already has room,
            the workspace can attach immediately without a payment step.
          </p>
        </header>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {upgradeDetails ? (
          <div className="mt-6">
            <BillingUpgradePanel
              billing={upgradeDetails.billing}
              workspaceSlug={activeWorkspace?.slug}
              workspaceId={activeWorkspace?._id}
              requestGate={upgradeDetails.gate}
              {...getBillingUpgradeContent(upgradeDetails)}
            />
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Step 1
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Workspace identity
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Workspace name
                  </span>
                  <input
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    placeholder="My New Workspace"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Workspace slug
                  </span>
                  <input
                    value={workspaceSlug}
                    onChange={(event) =>
                      setWorkspaceSlug(normalizeSlug(event.target.value))
                    }
                    placeholder="my-new-workspace"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Public URL slug: {suggestedSlug || "workspace-slug"}
                  </p>
                </label>
              </div>

              <label className="mt-5 block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Time zone
                </span>
                <input
                  value={timeZone}
                  onChange={(event) => setTimeZone(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                />
              </label>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Step 2
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Choose billing source
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                A workspace does not own its subscription. It attaches to one of your
                saved billing accounts, and that billing account supplies the plan
                limits used by the workspace.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setBillingSourceType("existing")}
                  className={[
                    "rounded-[24px] border p-5 text-left transition",
                    billingSourceType === "existing"
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-950 hover:border-slate-400",
                  ].join(" ")}
                >
                  <p className="text-lg font-semibold">Use existing billing account</p>
                  <p
                    className={[
                      "mt-2 text-sm leading-7",
                      billingSourceType === "existing" ? "text-slate-300" : "text-slate-600",
                    ].join(" ")}
                  >
                    Attach this workspace to one of your saved billing profiles first.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setBillingSourceType("new")}
                  className={[
                    "rounded-[24px] border p-5 text-left transition",
                    billingSourceType === "new"
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-950 hover:border-slate-400",
                  ].join(" ")}
                >
                  <p className="text-lg font-semibold">Create new billing account</p>
                  <p
                    className={[
                      "mt-2 text-sm leading-7",
                      billingSourceType === "new" ? "text-slate-300" : "text-slate-600",
                    ].join(" ")}
                  >
                    Start this workspace on a new saved billing profile and keep it separate.
                  </p>
                </button>
              </div>

              {billingSourceType === "existing" ? (
                <div className="mt-6 space-y-4">
                  {billingLoading ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      Loading billing accounts...
                    </div>
                  ) : billingAccounts.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      No saved billing accounts yet. Switch to creating a new billing
                      account for this workspace.
                    </div>
                  ) : (
                    billingAccounts.map((item) => {
                      const isSelected =
                        item.billing.account._id === existingBillingAccountId;
                      const hasCapacity = canAttachWorkspace(item);

                      return (
                        <button
                          key={item.billing.account._id}
                          type="button"
                          onClick={() =>
                            setExistingBillingAccountId(item.billing.account._id)
                          }
                          className={[
                            "w-full rounded-[24px] border p-5 text-left transition",
                            isSelected
                              ? "border-slate-950 bg-slate-950 text-white"
                              : "border-slate-200 bg-slate-50 text-slate-950 hover:border-slate-400",
                          ].join(" ")}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-semibold">
                              {item.accountProfile.name}
                            </span>
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
                            <span
                              className={[
                                "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                                isSelected
                                  ? hasCapacity
                                    ? "bg-emerald-500/20 text-emerald-100"
                                    : "bg-amber-400/20 text-amber-100"
                                  : hasCapacity
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700",
                              ].join(" ")}
                            >
                              {hasCapacity ? "Has room" : "Needs upgrade"}
                            </span>
                          </div>
                          <div
                            className={[
                              "mt-3 grid gap-3 text-sm md:grid-cols-3",
                              isSelected ? "text-slate-300" : "text-slate-600",
                            ].join(" ")}
                          >
                            <p>
                              Plan:{" "}
                              <strong className={isSelected ? "text-white" : "text-slate-950"}>
                                {item.billing.subscription.planDisplayName} v
                                {item.billing.subscription.version ?? "-"}
                              </strong>
                            </p>
                            <p>
                              Workspaces:{" "}
                              <strong className={isSelected ? "text-white" : "text-slate-950"}>
                                {item.billing.usageSummary.workspacesUsed}/
                                {item.billing.entitlements.maxWorkspaces}
                              </strong>
                            </p>
                            <p>
                              Status:{" "}
                              <strong className={isSelected ? "text-white" : "text-slate-950"}>
                                {formatStatusLabel(item.billing.subscription.status)}
                              </strong>
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-900">
                      New billing account name
                    </span>
                    <input
                      value={newBillingAccountName}
                      onChange={(event) => setNewBillingAccountName(event.target.value)}
                      placeholder={workspaceName || "Billing account"}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                    />
                  </label>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    A new billing account starts on the permanent Free plan. That does
                    not consume the one-time paid-plan trial on your account.
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Step 3
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Review before creation
              </h2>

              {billingSourceType === "existing" && selectedBillingAccount ? (
                <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
                  <p>
                    This workspace will attach to{" "}
                    <strong className="text-white">
                      {selectedBillingAccount.accountProfile.name}
                    </strong>
                    .
                  </p>
                  <p>
                    Current plan:{" "}
                    <strong className="text-white">
                      {selectedBillingAccount.billing.subscription.planDisplayName} v
                      {selectedBillingAccount.billing.subscription.version ?? "-"}
                    </strong>
                  </p>
                  <p>
                    Remaining workspace capacity:{" "}
                    <strong className="text-white">
                      {Math.max(
                        selectedBillingAccount.billing.entitlements.maxWorkspaces -
                          selectedBillingAccount.billing.usageSummary.workspacesUsed,
                        0
                      )}
                    </strong>
                  </p>
                </div>
              ) : (
                <div className="mt-5 text-sm leading-7 text-slate-300">
                  <p>
                    This workspace will start on a new saved billing account using
                    the permanent Free plan, then you can upgrade later only if you
                    actually need more capacity.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  submitting ||
                  creationDisabled ||
                  billingLoading ||
                  (billingSourceType === "existing" &&
                    (!selectedBillingAccount || !selectedAccountHasCapacity))
                }
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitting ? "Creating workspace..." : "Create workspace"}
              </button>
            </div>

            {billingSourceType === "existing" &&
            selectedBillingAccount &&
            !selectedAccountHasCapacity ? (
              <BillingUpgradePanel
                billing={selectedBillingAccount.billing}
                workspaceSlug={selectedBillingWorkspace?.slug ?? activeWorkspace?.slug}
                workspaceId={selectedBillingWorkspace?._id ?? activeWorkspace?._id}
                requestGate="workspaces"
                {...getBillingUpgradeContent({
                  upgradeRequired: true,
                  gate: "workspaces",
                  billing: selectedBillingAccount.billing,
                  limitValue: selectedBillingAccount.billing.entitlements.maxWorkspaces,
                  usedValue: selectedBillingAccount.billing.usageSummary.workspacesUsed,
                })}
              />
            ) : null}

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Notes
              </p>
              <ul className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
                <li>A billing account can be shared across more than one workspace.</li>
                <li>The account-level trial does not reset when you create a new workspace.</li>
                <li>The workspace creator becomes the owner of record for that workspace.</li>
              </ul>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
