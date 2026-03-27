import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "../components/portal-shell";
import { formatBillingStatusLabel } from "../features/portal/portal-display";
import { apiRequest } from "../services/api";
import { PortalWorkspaceSummary } from "../types/models";

type PortalDashboardResponse = {
  summary: {
    totalWorkspaces: number;
    totalBillingAccounts: number;
    totalSeatsUsed: number;
    plansByCode: Record<string, number>;
    statuses: Record<
      "trialing" | "active" | "past_due" | "canceled" | "paused",
      number
    >;
  };
  items: PortalWorkspaceSummary[];
};

export function PortalDashboardPage() {
  const [data, setData] = useState<PortalDashboardResponse | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiRequest<PortalDashboardResponse>("/api/portal/workspaces");
        setData(response);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to load portal workspaces."
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!data || !normalizedQuery) {
      return data?.items ?? [];
    }

    return data.items.filter((item) => {
      const haystack = [
        item.name,
        item.slug,
        item.owner?.name ?? "",
        item.owner?.email ?? "",
        item.billing.subscription.planCode,
        item.billing.subscription.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [data, query]);

  return (
    <PortalShell
      title="Client workspace operations"
      description="Manage paying client workspaces, review billing health, investigate support issues, and open a dedicated admin area for each workspace."
    >
      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Client workspaces
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {data?.summary.totalWorkspaces ?? 0}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Total client workspaces currently managed by the platform portal.
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Paid accounts
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {data
              ? `${
                  Object.entries(data.summary.plansByCode)
                    .filter(([code]) => code !== "free")
                    .reduce((sum, [, count]) => sum + count, 0)
                }/${data.summary.totalBillingAccounts}`
              : "0/0"}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Non-free billing accounts out of the current platform total.
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Billing Risk
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {data ? data.summary.statuses.past_due + data.summary.statuses.paused : 0}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Billing accounts that need platform staff follow-up.
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Seats In Use
          </p>
          <p className="mt-3 text-3xl font-semibold">
            {data?.summary.totalSeatsUsed ?? 0}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Total seats currently occupied across account-level subscriptions.
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Search
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Client workspace list
          </h2>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by workspace, slug, owner, plan, or status"
            className="h-11 w-full max-w-md rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Workspace</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Members</th>
                <th className="px-4 py-3 font-medium">Channels</th>
                <th className="px-4 py-3 font-medium">Billing</th>
                <th className="px-4 py-3 font-medium">Usage</th>
                <th className="px-4 py-3 font-medium">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-slate-500">
                    Loading portal workspaces...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-slate-500">
                    No workspaces matched the current filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item._id}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-950">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-500">/workspace/{item.slug}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.owner ? (
                        <div>
                          <p>{item.owner.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.owner.email}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">No owner record</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.memberCounts.active} active / {item.memberCounts.total} total
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.connectionCounts.active} active / {item.connectionCounts.total} total
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                          {item.billing.subscription.planDisplayName}
                        </span>
                        <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-medium capitalize text-white">
                          {formatBillingStatusLabel(item.billing.subscription.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.billing.usageSummary.seatsUsed}/{item.billing.entitlements.maxSeats} seats
                      <div className="mt-1 text-xs text-slate-500">
                        {item.billing.usageSummary.workspacesUsed}/
                        {item.billing.entitlements.maxWorkspaces} workspaces
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/portal/workspaces/${item._id}/overview`}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PortalShell>
  );
}
