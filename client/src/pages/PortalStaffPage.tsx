import { FormEvent, useEffect, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import {
  MANAGEABLE_PLATFORM_ROLES,
  type ManageablePlatformRole,
  formatPlatformRoleLabel,
} from "../utils/platform-role";
import { apiRequest } from "../services/api";
import { PlatformRole, PortalStaffUser } from "../types/models";

type PortalStaffResponse = {
  currentUserRole: PlatformRole | null;
  canManageRoles: boolean;
  items: PortalStaffUser[];
};

export function PortalStaffPage() {
  const [data, setData] = useState<PortalStaffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ManageablePlatformRole | "none">("staff");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiRequest<PortalStaffResponse>("/api/portal/staff-users");
        setData(response);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to load portal staff."
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const response = await apiRequest<PortalStaffResponse>("/api/portal/staff-users/assign", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          platformRole: role === "none" ? null : role,
          note: note.trim() || undefined,
        }),
      });
      setData(response);
      setEmail("");
      setRole("staff");
      setNote("");
      setNotice("Portal role updated.");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to update portal role."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalShell
      title="Internal staff"
      description="Manage who can access the platform portal. People should sign in with Google first, then a higher internal role can grant portal access."
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Team
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Portal access list
              </h2>
            </div>
            {data ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {data.items.length} staff account{data.items.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Sign-in</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-slate-500">
                      Loading internal staff...
                    </td>
                  </tr>
                ) : !data || data.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-slate-500">
                      No internal staff accounts found yet.
                    </td>
                  </tr>
                ) : (
                  data.items.map((item) => (
                    <tr key={item._id}>
                      <td className="px-4 py-3 text-slate-600">
                        <div>
                          <p className="font-medium text-slate-950">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatPlatformRoleLabel(item.platformRole)}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">
                        {item.authProvider ?? "password"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Intl.DateTimeFormat(undefined, {
                          dateStyle: "medium",
                        }).format(new Date(item.createdAt))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-6">
          <form
            onSubmit={handleSubmit}
            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Role assignment
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Grant portal access
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              The person should sign in first. After that, assign their email a
              portal role from here.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Account email
                </span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="person@example.com"
                  disabled={!data?.canManageRoles}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Role
                </span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as ManageablePlatformRole | "none")}
                  disabled={!data?.canManageRoles}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                >
                  {MANAGEABLE_PLATFORM_ROLES.map((roleOption) => (
                    <option key={roleOption} value={roleOption}>
                      {formatPlatformRoleLabel(roleOption)}
                    </option>
                  ))}
                  <option value="none">Remove portal access</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Reason
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  disabled={!data?.canManageRoles}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving || !data?.canManageRoles}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:bg-slate-400"
            >
              {saving ? "Saving..." : "Update role"}
            </button>
          </form>

          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Current access
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Your current internal role is{" "}
              <strong className="text-white">
                {formatPlatformRoleLabel(data?.currentUserRole)}
              </strong>
              .
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {data?.canManageRoles
                ? "You can grant or remove support, ops, billing, and staff access."
                : "Only Founder and Platform Admin accounts can change internal portal roles."}
            </p>
          </div>
        </aside>
      </div>
    </PortalShell>
  );
}
