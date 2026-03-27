import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "../components/portal-shell";
import { apiRequest } from "../services/api";
import {
  BillingPlanGroup,
  BillingPricingMode,
  PlanCatalogSummary,
} from "../types/models";

export function PortalPlansPage() {
  const [plans, setPlans] = useState<PlanCatalogSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sortOrder, setSortOrder] = useState("100");
  const [showPublicly, setShowPublicly] = useState(true);
  const [selfServe, setSelfServe] = useState(true);
  const [pricingMode, setPricingMode] = useState<BillingPricingMode>("fixed");
  const [planGroup, setPlanGroup] = useState<BillingPlanGroup>("standard");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiRequest<{ items: PlanCatalogSummary[] }>("/api/portal/plans");
        setPlans(response.items);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Failed to load plans.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const sortedPlans = useMemo(
    () => [...plans].sort((left, right) => left.sortOrder - right.sortOrder),
    [plans]
  );

  const totalVersions = useMemo(
    () => plans.reduce((sum, plan) => sum + plan.versions.length, 0),
    [plans]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const response = await apiRequest<{ plan: PlanCatalogSummary }>("/api/portal/plans", {
        method: "POST",
        body: JSON.stringify({
          code,
          displayName,
          sortOrder: Number(sortOrder || 100),
          showPublicly,
          selfServe,
          pricingMode,
          planGroup,
        }),
      });

      setPlans((current) =>
        [...current, response.plan].sort((left, right) => left.sortOrder - right.sortOrder)
      );
      setCode("");
      setDisplayName("");
      setSortOrder("100");
      setShowPublicly(true);
      setSelfServe(true);
      setPricingMode("fixed");
      setPlanGroup("standard");
      setNotice("Plan catalog created. Publish a version next.");
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to create the plan catalog."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalShell
      title="Plan catalog"
      description="Create platform billing catalogs first, then publish immutable plan versions with pricing and entitlements."
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

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Plans</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{plans.length}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Versions
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{totalVersions}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Public plans
          </p>
          <p className="mt-3 text-3xl font-semibold">
            {plans.filter((plan) => plan.showPublicly).length}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Catalog
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Defined plans</h2>
          </div>

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                Loading plans...
              </div>
            ) : sortedPlans.length === 0 ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                No plan catalogs created yet.
              </div>
            ) : (
              sortedPlans.map((plan) => (
                <Link
                  key={plan._id}
                  to={`/portal/plans/${plan._id}`}
                  className="block rounded-[24px] border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-950"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">{plan.displayName}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {plan.code} · order {plan.sortOrder}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                        {plan.pricingMode}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                        {plan.planGroup}
                      </span>
                      <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">
                        {plan.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                    <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                      {plan.showPublicly ? "Public" : "Private"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                      {plan.selfServe ? "Self-serve" : "Manual only"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                      {plan.currentSubscriptions} subscriptions
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                      {plan.versions.length} version{plan.versions.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Create
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">New plan catalog</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Create the long-lived catalog metadata here. Pricing and entitlements get
            published later as explicit plan versions.
          </p>

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">Code</span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="basic-plus"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Display name
                </span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Basic Plus"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
              <div className="grid gap-3">
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
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:bg-slate-400"
          >
            {saving ? "Creating..." : "Create plan catalog"}
          </button>
        </form>
      </div>
    </PortalShell>
  );
}
