import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import { useSession } from "../hooks/use-session";

type MemberItem = {
  _id: string;
  role: "owner" | "admin" | "staff";
  status: "active" | "invited" | "disabled";
  inviteExpiresAt?: string | null;
  inviteEmailSentAt?: string | null;
  inviteAcceptedAt?: string | null;
  user: {
    _id: string;
    email: string;
    name: string;
  } | null;
};

export function WorkspaceMembersPage() {
  const { session, activeWorkspace, isAdmin } = useSession();
  const workspaceId = activeWorkspace?._id;

  const [items, setItems] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<{ items: MemberItem[] }>(
        `/api/workspaces/${workspaceId}/members`
      );
      setItems(response.items);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspaceId || !email.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
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
          role,
        }),
      });
      setEmail("");
      setName("");
      setRole("staff");
      if (response.inviteDelivery?.inviteUrl) {
        setNotice(
          response.inviteDelivery.emailSent
            ? `Invitation email sent. Invite link: ${response.inviteDelivery.inviteUrl}`
            : `Invitation created. Copy this link to share manually: ${response.inviteDelivery.inviteUrl}`
        );
      } else {
        setNotice("Member added.");
      }
      await loadMembers();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to add member");
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

      if (response.inviteDelivery?.inviteUrl) {
        setNotice(
          response.inviteDelivery.emailSent
            ? `Invitation email sent again. Invite link: ${response.inviteDelivery.inviteUrl}`
            : `New invite link created: ${response.inviteDelivery.inviteUrl}`
        );
      } else {
        setNotice("Invite refreshed.");
      }
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

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">Workspace Members</h2>
        <p className="mt-1 text-sm text-slate-600">
          Manage staff access for {activeWorkspace?.name}.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <form onSubmit={handleAdd} className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <input
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          placeholder="email@domain.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          placeholder="Name (optional)"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <select
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          value={role}
          onChange={(event) => setRole(event.target.value as "admin" | "staff")}
        >
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:bg-slate-400"
          disabled={submitting}
        >
          {submitting ? "Adding..." : "Add member"}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-slate-500">
                  Loading members...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-slate-500">
                  No members found.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id}>
                  <td className="px-4 py-3">{item.user?.name ?? "Unknown"}</td>
                  <td className="px-4 py-3">{item.user?.email ?? "N/A"}</td>
                  <td className="px-4 py-3 capitalize">{item.role}</td>
                  <td className="px-4 py-3 capitalize">{item.status}</td>
                  <td className="px-4 py-3">
                    {item.status === "invited" ? (
                      <button
                        type="button"
                        onClick={() => void handleResendInvite(item._id)}
                        disabled={submitting}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Resend invite
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
    </div>
  );
}
