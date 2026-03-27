import {
  ChangeEvent,
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { PortalShell } from "../components/portal-shell";
import {
  BillingEntitlementDraft,
  PLATFORM_FAMILY_OPTIONS,
  createEntitlementDraft,
  entitlementDraftToPayload,
} from "../features/portal/billing-form-helpers";
import { apiRequest } from "../services/api";
import {
  BillingPlanGroup,
  BillingPricingMode,
  PlanCatalogSummary,
  PlatformFamily,
} from "../types/models";

const renderEntitlementInputs = (params: {
  draft: BillingEntitlementDraft;
  setDraft: Dispatch<SetStateAction<BillingEntitlementDraft>>;
}) => {
  const { draft, setDraft } = params;

  const toggleFamily = (family: PlatformFamily) => {
    setDraft((current) => ({
      ...current,
      allowedPlatformFamilies: current.allowedPlatformFamilies.includes(family)
        ? current.allowedPlatformFamilies.filter((item) => item !== family)
        : [...current.allowedPlatformFamilies, family],
    }));
  };

  const updateLimit =
    (family: PlatformFamily) => (event: ChangeEvent<HTMLInputElement>) => {
      setDraft((current) => ({
        ...current,
        maxConnectedAccountsPerPlatform: {
          ...current.maxConnectedAccountsPerPlatform,
          [family]: event.target.value,
        },
      }));
    };

  const booleanFields: Array<{
    key:
      | "allowWebsiteChat"
      | "allowCustomDomain"
      | "allowBYOAI"
      | "allowAutomation"
      | "allowAuditExports"
      | "allowExtraSeats"
      | "allowExtraWorkspaces"
      | "allowExtraConnections";
    label: string;
  }> = [
    { key: "allowWebsiteChat", label: "Website chat" },
    { key: "allowCustomDomain", label: "Custom domain" },
    { key: "allowBYOAI", label: "BYO AI" },
    { key: "allowAutomation", label: "Automation" },
    { key: "allowAuditExports", label: "Audit exports" },
    { key: "allowExtraSeats", label: "Extra seats" },
    { key: "allowExtraWorkspaces", label: "Extra workspaces" },
    { key: "allowExtraConnections", label: "Extra connections" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-900">Max workspaces</span>
          <input
            value={draft.maxWorkspaces}
            onChange={(event) =>
              setDraft((current) => ({ ...current, maxWorkspaces: event.target.value }))
            }
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-900">Max seats</span>
          <input
            value={draft.maxSeats}
            onChange={(event) =>
              setDraft((current) => ({ ...current, maxSeats: event.target.value }))
            }
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-900">
            Max families
          </span>
          <input
            value={draft.maxExternalPlatformFamilies}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                maxExternalPlatformFamilies: event.target.value,
              }))
            }
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
          />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {PLATFORM_FAMILY_OPTIONS.map((family) => (
          <label
            key={family}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            <input
              type="checkbox"
              checked={draft.allowedPlatformFamilies.includes(family)}
              onChange={() => toggleFamily(family)}
            />
            <span className="capitalize">{family}</span>
          </label>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {PLATFORM_FAMILY_OPTIONS.map((family) => (
          <label key={family} className="block">
            <span className="mb-1.5 block text-sm text-slate-600 capitalize">{family}</span>
            <input
              value={draft.maxConnectedAccountsPerPlatform[family]}
              onChange={updateLimit(family)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            />
          </label>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {booleanFields.map((field) => (
          <label
            key={field.key}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            <input
              type="checkbox"
              checked={draft[field.key]}
              onChange={(event) =>
                setDraft((current) => ({ ...current, [field.key]: event.target.checked }))
              }
            />
            <span>{field.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export function PortalPlanCatalogPage() {
  const { planCatalogId = "" } = useParams();
  const [plan, setPlan] = useState<PlanCatalogSummary | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [sortOrder, setSortOrder] = useState("100");
  const [showPublicly, setShowPublicly] = useState(true);
  const [selfServe, setSelfServe] = useState(true);
  const [pricingMode, setPricingMode] = useState<BillingPricingMode>("fixed");
  const [planGroup, setPlanGroup] = useState<BillingPlanGroup>("standard");
  const [active, setActive] = useState(true);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly" | "manual">(
    "monthly"
  );
  const [priceAmount, setPriceAmount] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [draft, setDraft] = useState(createEntitlementDraft());
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiRequest<{ plan: PlanCatalogSummary }>(
          `/api/portal/plans/${encodeURIComponent(planCatalogId)}`
        );
        setPlan(response.plan);
        setDisplayName(response.plan.displayName);
        setSortOrder(String(response.plan.sortOrder));
        setShowPublicly(response.plan.showPublicly);
        setSelfServe(response.plan.selfServe);
        setPricingMode(response.plan.pricingMode);
        setPlanGroup(response.plan.planGroup);
        setActive(response.plan.active);
        const latestVersion = response.plan.versions[0];
        if (latestVersion) {
          setBillingInterval(latestVersion.billingInterval);
          setPriceAmount(String(latestVersion.priceAmount));
          setCurrency(latestVersion.currency);
          setDraft(createEntitlementDraft(latestVersion.entitlements));
        }
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Failed to load plan.");
      } finally {
        setLoading(false);
      }
    };

    if (planCatalogId) {
      void load();
    }
  }, [planCatalogId]);

  const latestVersion = useMemo(() => plan?.versions[0] ?? null, [plan]);

  if (!planCatalogId) {
    return <Navigate to="/portal/plans" replace />;
  }

  const handleCatalogSave = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setSavingMeta(true);
      setError(null);
      setNotice(null);
      const response = await apiRequest<{ plan: PlanCatalogSummary }>(
        `/api/portal/plans/${encodeURIComponent(planCatalogId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            displayName,
            sortOrder: Number(sortOrder || 100),
            showPublicly,
            selfServe,
            pricingMode,
            planGroup,
            active,
          }),
        }
      );
      setPlan(response.plan);
      setNotice("Plan catalog updated.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update plan.");
    } finally {
      setSavingMeta(false);
    }
  };

  const handleVersionCreate = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setSavingVersion(true);
      setError(null);
      setNotice(null);
      const response = await apiRequest<{ plan: PlanCatalogSummary }>(
        `/api/portal/plans/${encodeURIComponent(planCatalogId)}/versions`,
        {
          method: "POST",
          body: JSON.stringify({
            billingInterval,
            priceAmount: Number(priceAmount || 0),
            currency,
            entitlements: entitlementDraftToPayload(draft),
          }),
        }
      );
      setPlan(response.plan);
      setNotice("New plan version published.");
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to create plan version."
      );
    } finally {
      setSavingVersion(false);
    }
  };

  return (
    <PortalShell
      title={plan?.displayName ?? "Plan detail"}
      description="Manage long-lived catalog metadata here, then publish immutable pricing and entitlement versions below."
      badge="Plan Detail"
    >
      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      {loading || !plan ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading plan detail...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
          <section className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Catalog
                  </p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-2">
                    <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                      {plan.displayName}
                    </h2>
                    <span className="text-sm font-mono text-slate-500">{plan.code}</span>
                  </div>
                </div>
                <Link
                  to="/portal/plans"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                >
                  Back to plans
                </Link>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Order
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-950">{plan.sortOrder}</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Public
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-950">
                    {plan.showPublicly ? "Yes" : "No"}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Self-serve
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-950">
                    {plan.selfServe ? "Yes" : "No"}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Versions
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-950">{plan.versions.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Version history
              </p>
              <div className="mt-4 space-y-4">
                {plan.versions.map((version) => (
                  <div
                    key={version._id}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">
                          v{version.version} · {version.billingInterval}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {version.priceAmount} {version.currency}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">
                        {version.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                      <p>
                        Seats: <strong className="text-slate-950">{version.entitlements.maxSeats}</strong>
                      </p>
                      <p>
                        Workspaces:{" "}
                        <strong className="text-slate-950">
                          {version.entitlements.maxWorkspaces}
                        </strong>
                      </p>
                      <p>
                        External families:{" "}
                        <strong className="text-slate-950">
                          {version.entitlements.maxExternalPlatformFamilies}
                        </strong>
                      </p>
                      <p>
                        BYO AI:{" "}
                        <strong className="text-slate-950">
                          {version.entitlements.allowBYOAI ? "Enabled" : "Disabled"}
                        </strong>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <form
              onSubmit={handleCatalogSave}
              className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Catalog settings
              </p>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Display name
                  </span>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Sort order
                  </span>
                  <input
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-900">
                      Pricing mode
                    </span>
                    <select
                      value={pricingMode}
                      onChange={(event) =>
                        setPricingMode(event.target.value as BillingPricingMode)
                      }
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                    >
                      <option value="free">Free</option>
                      <option value="fixed">Fixed</option>
                      <option value="manual">Manual</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-900">
                      Plan group
                    </span>
                    <select
                      value={planGroup}
                      onChange={(event) =>
                        setPlanGroup(event.target.value as BillingPlanGroup)
                      }
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                    >
                      <option value="standard">Standard</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={showPublicly}
                    onChange={(event) => setShowPublicly(event.target.checked)}
                  />
                  <span>Show publicly</span>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selfServe}
                    onChange={(event) => setSelfServe(event.target.checked)}
                  />
                  <span>Self-serve</span>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(event) => setActive(event.target.checked)}
                  />
                  <span>Catalog active for future use</span>
                </label>
              </div>
              <button
                type="submit"
                disabled={savingMeta}
                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:bg-slate-400"
              >
                {savingMeta ? "Saving..." : "Save catalog"}
              </button>
            </form>

            <form
              onSubmit={handleVersionCreate}
              className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Publish version
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Pricing and entitlements are versioned snapshots. Existing subscriptions stay on
                their current version until someone explicitly migrates them.
              </p>

              <div className="mt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-900">
                      Interval
                    </span>
                    <select
                      value={billingInterval}
                      onChange={(event) =>
                        setBillingInterval(event.target.value as typeof billingInterval)
                      }
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="manual">Manual</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-900">
                      Price
                    </span>
                    <input
                      value={priceAmount}
                      onChange={(event) => setPriceAmount(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Currency
                  </span>
                  <input
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  />
                </label>

                {renderEntitlementInputs({ draft, setDraft })}
              </div>

              <button
                type="submit"
                disabled={savingVersion}
                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:bg-slate-400"
              >
                {savingVersion ? "Publishing..." : `Publish v${(latestVersion?.version ?? 0) + 1}`}
              </button>
            </form>
          </aside>
        </div>
      )}
    </PortalShell>
  );
}
