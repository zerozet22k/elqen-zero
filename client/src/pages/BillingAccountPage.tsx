import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useSession } from "../hooks/use-session";
import { apiRequest } from "../services/api";
import {
  BillingAccountProfile,
  BillingPaymentProviders,
  OwnedBillingAccountSummary,
} from "../types/models";
import { isWorkspaceOwnerRole } from "../utils/workspace-role";

type BillingAccountsResponse = {
  defaultBillingAccountId: string | null;
  items: OwnedBillingAccountSummary[];
  paymentProviders: BillingPaymentProviders;
};

const cloneProfile = (profile: BillingAccountProfile): BillingAccountProfile => ({
  ...profile,
  billingAddress: {
    ...profile.billingAddress,
  },
  paymentMethod: {
    ...profile.paymentMethod,
  },
});

const formatStatusLabel = (value: string) =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const formatFieldValue = (value?: string | null, fallback = "Not set") => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || fallback;
};

const formatAddressBlock = (profile: BillingAccountProfile) => {
  const address = profile.billingAddress;
  const lines = [
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(", "),
    [address.postalCode, address.country].filter(Boolean).join(" "),
  ]
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length ? lines.join("\n") : "Add a billing address";
};

const buildBillingEmailHref = (email: string, billingAccountName: string) => {
  const subject = encodeURIComponent(`Billing help for ${billingAccountName}`);
  const body = encodeURIComponent(
    [
      `Billing account: ${billingAccountName}`,
      "",
      "Please help us with billing or payment setup.",
    ]
      .filter(Boolean)
      .join("\n")
  );

  return `mailto:${email}?subject=${subject}&body=${body}`;
};

function BillingProfileModal(props: {
  profile: BillingAccountProfile;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onChange: (nextProfile: BillingAccountProfile) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const { profile, saving, error, onClose, onChange, onSubmit } = props;

  const updateField = (key: keyof BillingAccountProfile, value: string) => {
    onChange({
      ...profile,
      [key]: value,
    });
  };

  const updateAddressField = (
    key: keyof BillingAccountProfile["billingAddress"],
    value: string
  ) => {
    onChange({
      ...profile,
      billingAddress: {
        ...profile.billingAddress,
        [key]: value,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <div className="max-h-[96vh] w-full max-w-7xl overflow-y-auto rounded-[36px] border border-slate-200 bg-white shadow-2xl">
        <form onSubmit={onSubmit} className="p-6 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Billing Account
              </p>
              <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Edit billing details
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
            >
              Close
            </button>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="space-y-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Billing account name
                </span>
                <input
                  value={profile.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Legal business name
                </span>
                <input
                  value={profile.companyLegalName}
                  onChange={(event) =>
                    updateField("companyLegalName", event.target.value)
                  }
                  placeholder="Optional"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Billing email
                </span>
                <input
                  value={profile.billingEmail}
                  onChange={(event) =>
                    updateField("billingEmail", event.target.value)
                  }
                  placeholder="your-team@gmail.com"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Billing phone
                </span>
                <input
                  value={profile.billingPhone}
                  onChange={(event) =>
                    updateField("billingPhone", event.target.value)
                  }
                  placeholder="+95 ..."
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                />
              </label>
            </div>

            <div className="space-y-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Address line 1
                </span>
                <input
                  value={profile.billingAddress.line1}
                  onChange={(event) =>
                    updateAddressField("line1", event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Address line 2
                </span>
                <input
                  value={profile.billingAddress.line2}
                  onChange={(event) =>
                    updateAddressField("line2", event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    City
                  </span>
                  <input
                    value={profile.billingAddress.city}
                    onChange={(event) =>
                      updateAddressField("city", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    State / region
                  </span>
                  <input
                    value={profile.billingAddress.state}
                    onChange={(event) =>
                      updateAddressField("state", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Postal code
                  </span>
                  <input
                    value={profile.billingAddress.postalCode}
                    onChange={(event) =>
                      updateAddressField("postalCode", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Country
                  </span>
                  <input
                    value={profile.billingAddress.country}
                    onChange={(event) =>
                      updateAddressField("country", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "Saving..." : "Save billing details"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function BillingAccountPage() {
  const { session } = useSession();
  const ownsAnyWorkspace =
    (session?.workspaces ?? []).some((workspace) =>
      isWorkspaceOwnerRole(workspace.workspaceRole)
    ) ?? false;

  const [items, setItems] = useState<OwnedBillingAccountSummary[]>([]);
  const [defaultBillingAccountId, setDefaultBillingAccountId] = useState<string | null>(
    null
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [paymentProviders, setPaymentProviders] =
    useState<BillingPaymentProviders | null>(null);
  const [draftProfile, setDraftProfile] = useState<BillingAccountProfile | null>(null);
  const [editingOpen, setEditingOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.billing.account._id === selectedAccountId) ?? items[0] ?? null,
    [items, selectedAccountId]
  );

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<BillingAccountsResponse>("/api/billing/accounts");
      setItems(response.items);
      setDefaultBillingAccountId(response.defaultBillingAccountId);
      setPaymentProviders(response.paymentProviders);
      setSelectedAccountId((current) => {
        if (current && response.items.some((item) => item.billing.account._id === current)) {
          return current;
        }

        return response.defaultBillingAccountId ?? response.items[0]?.billing.account._id ?? null;
      });
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to load billing accounts."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!ownsAnyWorkspace) {
    return <Navigate to="/account/workspaces" replace />;
  }

  const selectedProfile = selectedItem?.accountProfile ?? null;
  const selectedBilling = selectedItem?.billing ?? null;
  const selectedIsDefault =
    !!selectedBilling && selectedBilling.account._id === defaultBillingAccountId;

  const showStripeBilling = !!paymentProviders?.stripe.available;
  const showManualBilling = !!paymentProviders?.manualEmail.available;
  const showKbzpay = !!paymentProviders?.kbzpay.available;
  const canDeleteSelected =
    !!selectedBilling &&
    !selectedIsDefault &&
    items.length > 1 &&
    (selectedItem?.workspaceCount ?? 0) === 0;

  const handleCreateBillingAccount = async () => {
    setCreating(true);
    setError(null);
    setNotice(null);

    try {
      const response = await apiRequest<BillingAccountsResponse>("/api/billing/accounts", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setItems(response.items);
      setDefaultBillingAccountId(response.defaultBillingAccountId);
      setPaymentProviders(response.paymentProviders);
      const newest = response.items[response.items.length - 1];
      setSelectedAccountId(newest?.billing.account._id ?? null);
      setNotice("New billing account created.");
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to create a billing account."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!draftProfile || !selectedProfile) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await apiRequest<BillingAccountsResponse>(
        `/api/billing/accounts/${encodeURIComponent(selectedProfile.accountId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: draftProfile.name,
            companyLegalName: draftProfile.companyLegalName,
            billingEmail: draftProfile.billingEmail,
            billingPhone: draftProfile.billingPhone,
            billingAddress: draftProfile.billingAddress,
          }),
        }
      );

      setItems(response.items);
      setDefaultBillingAccountId(response.defaultBillingAccountId);
      setPaymentProviders(response.paymentProviders);
      setEditingOpen(false);
      setDraftProfile(null);
      setNotice("Billing details updated.");
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to save billing details."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async () => {
    if (!selectedBilling || selectedIsDefault) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await apiRequest<BillingAccountsResponse>(
        "/api/billing/accounts/default",
        {
          method: "PATCH",
          body: JSON.stringify({
            billingAccountId: selectedBilling.account._id,
          }),
        }
      );

      setItems(response.items);
      setDefaultBillingAccountId(response.defaultBillingAccountId);
      setPaymentProviders(response.paymentProviders);
      setNotice("Default billing account updated for future workspaces.");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to update the default billing account."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBillingAccount = async () => {
    if (!selectedBilling || !selectedProfile || !canDeleteSelected) {
      return;
    }

    const confirmed = window.confirm(
      `Delete billing account "${selectedProfile.name}"?`
    );
    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);
      setNotice(null);
      const response = await apiRequest<BillingAccountsResponse>(
        `/api/billing/accounts/${encodeURIComponent(selectedBilling.account._id)}`,
        {
          method: "DELETE",
        }
      );
      setItems(response.items);
      setDefaultBillingAccountId(response.defaultBillingAccountId);
      setPaymentProviders(response.paymentProviders);
      setSelectedAccountId(
        response.defaultBillingAccountId ?? response.items[0]?.billing.account._id ?? null
      );
      setNotice("Billing account removed.");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to remove the billing account."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div className="flex min-h-screen w-full flex-col px-4 py-8 sm:px-6 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Account Billing
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
              Billing accounts
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Manage reusable billing profiles for your workspaces. Choose which
              billing account new workspaces should use by default.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/account/workspaces"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
            >
              Back to workspaces
            </Link>
            <button
              type="button"
              onClick={() => void handleCreateBillingAccount()}
              disabled={creating}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {creating ? "Creating..." : "Create billing account"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}

        {loading || !selectedItem || !selectedProfile || !selectedBilling ? (
          <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Loading billing accounts...
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Your billing accounts
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    Saved billing profiles for your workspaces
                  </h2>
                </div>
                <p className="text-sm text-slate-500">
                  {items.length} billing account{items.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-3">
                {items.map((item) => {
                  const isSelected = item.billing.account._id === selectedItem.billing.account._id;
                  const isDefault = item.isDefault;

                  return (
                    <button
                      key={item.billing.account._id}
                      type="button"
                      onClick={() => setSelectedAccountId(item.billing.account._id)}
                      className={[
                        "rounded-[24px] border p-5 text-left transition",
                        isSelected
                          ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-950 hover:border-slate-400",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-semibold">{item.accountProfile.name}</span>
                        {isDefault ? (
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
                        {item.accountProfile.billingEmail ||
                          item.accountProfile.companyLegalName ||
                          "Saved billing profile"}
                      </p>
                      <p
                        className={[
                          "mt-3 text-sm",
                          isSelected ? "text-slate-300" : "text-slate-600",
                        ].join(" ")}
                      >
                        Used by {item.workspaceCount} workspace
                        {item.workspaceCount === 1 ? "" : "s"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Billing Account
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      {selectedProfile.name}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      Keep this compact and invoice-ready. These details follow the
                      billing account across every workspace attached to it.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {!selectedIsDefault ? (
                      <button
                        type="button"
                        onClick={() => void handleSetDefault()}
                        disabled={saving}
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                      >
                        Make default
                      </button>
                    ) : null}
                    {canDeleteSelected ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteBillingAccount()}
                        disabled={deleting}
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 px-5 text-sm font-medium text-rose-700 transition hover:border-rose-400 hover:text-rose-800 disabled:cursor-not-allowed disabled:border-rose-100 disabled:text-rose-300"
                      >
                        {deleting ? "Removing..." : "Remove billing account"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setDraftProfile(cloneProfile(selectedProfile));
                        setEditingOpen(true);
                      }}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Edit billing details
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Client billing details
                    </p>
                    <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                      <p>
                        Billing account name:
                        <strong className="ml-2 text-slate-950">
                          {formatFieldValue(selectedProfile.name)}
                        </strong>
                      </p>
                      <p>
                        Business name:
                        <strong className="ml-2 text-slate-950">
                          {formatFieldValue(selectedProfile.companyLegalName)}
                        </strong>
                      </p>
                      <p>
                        Billing email:
                        <strong className="ml-2 text-slate-950">
                          {formatFieldValue(selectedProfile.billingEmail)}
                        </strong>
                      </p>
                      <p>
                        Billing phone:
                        <strong className="ml-2 text-slate-950">
                          {formatFieldValue(selectedProfile.billingPhone)}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Billing address
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-900">
                      {formatAddressBlock(selectedProfile)}
                    </p>
                  </div>
                </div>
              </section>

              <aside className="space-y-6">
                <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Default behavior
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {selectedIsDefault
                      ? "This is your default billing account, so new workspaces start here first."
                      : "Set this as default if you want future workspaces to start on this billing account."}
                  </p>
                  {!canDeleteSelected && !selectedIsDefault ? (
                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      Remove attached workspaces first if you ever want to delete this billing account.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Attached workspaces
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Used by {selectedItem.workspaceCount} workspace
                    {selectedItem.workspaceCount === 1 ? "" : "s"}.
                  </p>
                  {selectedItem.attachedWorkspaces.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {selectedItem.attachedWorkspaces.map((workspace) => (
                        <div
                          key={workspace._id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <p className="text-sm font-semibold text-slate-950">
                            {workspace.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            /workspace/{workspace.slug}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      No workspaces are attached to this billing account yet.
                    </div>
                  )}
                </div>
              </aside>
            </div>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Payment methods
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Platform-enabled methods
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                This page only shows what the platform currently supports for this deployment.
                Billing accounts stay reusable here, while each workspace decides which saved billing account it uses.
              </p>

              <div className="mt-6 grid gap-4 xl:grid-cols-3">
                {showStripeBilling ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-lg font-semibold text-slate-950">Stripe</p>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Available
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Stripe can be used for eligible billing flows on workspaces attached to this billing account.
                    </p>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      Stripe is available on this deployment for supported billing changes.
                    </div>
                  </div>
                ) : null}

                {showManualBilling ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-lg font-semibold text-slate-950">Manual billing by email</p>
                      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                        Available
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Use the platform billing inbox for invoices, manual payment help, or KBZPay coordination.
                    </p>
                    <a
                      href={buildBillingEmailHref(
                        paymentProviders.manualEmail.contactEmail ?? "elqenzero@gmail.com",
                        selectedProfile.name
                      )}
                      className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                    >
                      Email {paymentProviders.manualEmail.contactEmail ?? "elqenzero@gmail.com"}
                    </a>
                  </div>
                ) : null}

                {showKbzpay ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-lg font-semibold text-slate-950">KBZPay</p>
                      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                        Manual rollout
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      KBZPay is handled manually for now through the platform billing inbox.
                    </p>
                    {paymentProviders.kbzpay.contactEmail ? (
                      <a
                        href={buildBillingEmailHref(
                          paymentProviders.kbzpay.contactEmail,
                          selectedProfile.name
                        )}
                        className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                      >
                        Request KBZPay setup
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        )}

        {editingOpen && draftProfile ? (
          <BillingProfileModal
            profile={draftProfile}
            saving={saving}
            error={error}
            onClose={() => {
              if (!saving) {
                setEditingOpen(false);
                setDraftProfile(null);
              }
            }}
            onChange={setDraftProfile}
            onSubmit={handleSaveProfile}
          />
        ) : null}
      </div>
    </div>
  );
}



