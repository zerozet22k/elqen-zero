import { useEffect, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import { apiRequest } from "../services/api";
import { BillingPaymentProviders } from "../types/models";

type PortalPaymentSettingsResponse = {
  canEdit: boolean;
  paymentProviders: BillingPaymentProviders;
};

export function PortalPaymentsPage() {
  const [paymentSettings, setPaymentSettings] =
    useState<PortalPaymentSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPayments, setSavingPayments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiRequest<PortalPaymentSettingsResponse>(
          "/api/portal/payment-settings"
        );
        setPaymentSettings(response);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to load payment settings."
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handlePaymentToggle = async (
    provider: "stripe" | "manualEmail" | "kbzpay",
    enabled: boolean
  ) => {
    if (!paymentSettings?.canEdit) {
      return;
    }

    try {
      setSavingPayments(true);
      setError(null);
      setNotice(null);
      const response = await apiRequest<PortalPaymentSettingsResponse>(
        "/api/portal/payment-settings",
        {
          method: "PATCH",
          body: JSON.stringify({
            [provider]: {
              ...paymentSettings.paymentProviders[provider],
              enabled,
            },
          }),
        }
      );
      setPaymentSettings(response);
      setNotice("Payment settings updated.");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to update payment settings."
      );
    } finally {
      setSavingPayments(false);
    }
  };

  const handlePaymentEmailChange = (
    provider: "manualEmail" | "kbzpay",
    contactEmail: string
  ) => {
    if (!paymentSettings?.canEdit) {
      return;
    }

    setPaymentSettings((current) =>
      current
        ? {
            ...current,
            paymentProviders: {
              ...current.paymentProviders,
              [provider]: {
                ...current.paymentProviders[provider],
                contactEmail,
              },
            },
          }
        : current
    );
  };

  const handlePaymentEmailSave = async () => {
    if (!paymentSettings?.canEdit) {
      return;
    }

    try {
      setSavingPayments(true);
      setError(null);
      setNotice(null);
      const response = await apiRequest<PortalPaymentSettingsResponse>(
        "/api/portal/payment-settings",
        {
          method: "PATCH",
          body: JSON.stringify({
            manualEmail: {
              enabled: paymentSettings.paymentProviders.manualEmail.enabled,
              contactEmail:
                paymentSettings.paymentProviders.manualEmail.contactEmail ?? "",
            },
            kbzpay: {
              enabled: paymentSettings.paymentProviders.kbzpay.enabled,
              contactEmail:
                paymentSettings.paymentProviders.kbzpay.contactEmail ?? "",
            },
          }),
        }
      );
      setPaymentSettings(response);
      setNotice("Billing contact email updated.");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to save billing contact email."
      );
    } finally {
      setSavingPayments(false);
    }
  };

  return (
    <PortalShell
      title="Platform payments"
      description="Control which payment methods are visible to client workspaces and where manual billing requests should go."
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

      {loading || !paymentSettings ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading payment settings...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="grid gap-4 md:grid-cols-3">
            {[
              {
                key: "stripe" as const,
                title: "Stripe",
                description: paymentSettings.paymentProviders.stripe.enabled
                  ? paymentSettings.paymentProviders.stripe.configured
                    ? "Hosted card checkout and subscription updates are available."
                    : "Enabled in portal, but server Stripe config is still incomplete."
                  : "Customer-facing Stripe billing is hidden.",
                badge: paymentSettings.paymentProviders.stripe.available
                  ? "Live"
                  : paymentSettings.paymentProviders.stripe.enabled
                    ? "Needs config"
                    : "Off",
              },
              {
                key: "manualEmail" as const,
                title: "Manual email billing",
                description: paymentSettings.paymentProviders.manualEmail.enabled
                  ? `Customers can email ${paymentSettings.paymentProviders.manualEmail.contactEmail}.`
                  : "Manual email billing is hidden from customer billing pages.",
                badge: paymentSettings.paymentProviders.manualEmail.enabled
                  ? "On"
                  : "Off",
              },
              {
                key: "kbzpay" as const,
                title: "KBZPay",
                description: paymentSettings.paymentProviders.kbzpay.enabled
                  ? "Shown as a manual platform-assisted option."
                  : "Kept off until KBZPay rollout is ready.",
                badge: paymentSettings.paymentProviders.kbzpay.enabled ? "On" : "Off",
              },
            ].map((item) => {
              const enabled = paymentSettings.paymentProviders[item.key].enabled;
              return (
                <div
                  key={item.key}
                  className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {item.description}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {item.badge}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handlePaymentToggle(item.key, !enabled)}
                    disabled={!paymentSettings.canEdit || savingPayments}
                    className={[
                      "mt-4 inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition",
                      enabled
                        ? "border border-slate-300 bg-white text-slate-700 hover:border-slate-950 hover:text-slate-950"
                        : "bg-slate-950 text-white hover:bg-slate-800",
                    ].join(" ")}
                  >
                    {enabled ? "Disable" : "Enable"}
                  </button>
                </div>
              );
            })}
          </section>

          <aside className="rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Billing Inbox
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              Customer contact email
            </h3>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              This address is used anywhere the product falls back to manual billing
              help, including email-based payment coordination.
            </p>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-100">
                  Manual billing email
                </span>
                <input
                  value={paymentSettings.paymentProviders.manualEmail.contactEmail ?? ""}
                  onChange={(event) =>
                    handlePaymentEmailChange("manualEmail", event.target.value)
                  }
                  disabled={!paymentSettings.canEdit || savingPayments}
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-slate-400"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-100">
                  KBZPay contact email
                </span>
                <input
                  value={paymentSettings.paymentProviders.kbzpay.contactEmail ?? ""}
                  onChange={(event) =>
                    handlePaymentEmailChange("kbzpay", event.target.value)
                  }
                  disabled={!paymentSettings.canEdit || savingPayments}
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-slate-400"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => void handlePaymentEmailSave()}
              disabled={!paymentSettings.canEdit || savingPayments}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {savingPayments ? "Saving..." : "Save payment contacts"}
            </button>
          </aside>
        </div>
      )}
    </PortalShell>
  );
}
