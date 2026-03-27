import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useSession } from "../../hooks/use-session";
import { apiRequest, isApiRequestError } from "../../services/api";
import {
  AccountTrialState,
  BillingPaymentProviders,
  BillingPricingMode,
  BillingState,
  Channel,
  PlanCatalogSummary,
  PlatformFamily,
  PlanVersionSummary,
} from "../../types/models";
import { buildWorkspacePath } from "../../utils/workspace-routes";

type BillingLimitGate =
  | "workspaces"
  | "seats"
  | "website_chat"
  | "byo_ai"
  | "automation"
  | "platform_family"
  | "external_platform_families"
  | "channel_connections";

export type BillingUpgradeDetails = {
  upgradeRequired: true;
  gate: BillingLimitGate;
  billing: BillingState;
  limitValue?: number;
  usedValue?: number;
  platformFamily?: PlatformFamily;
  channel?: Channel;
};

type BillingUpgradeContent = {
  title: string;
  description: string;
  usageLabel?: string;
};

type BillingPlanActionProps = {
  billing: BillingState;
  workspaceSlug?: string | null;
  workspaceId?: string | null;
  requestGate?: BillingLimitGate | "general";
  title?: string;
  description?: string;
  autoOpen?: boolean;
  label: string;
  className?: string;
};

type BillingUpgradePanelProps = BillingUpgradeContent & {
  billing: BillingState;
  workspaceSlug?: string | null;
  workspaceId?: string | null;
  requestGate?: BillingLimitGate | "general";
  className?: string;
};

type BillingCatalogResponse = {
  items: PlanCatalogSummary[];
  trial: AccountTrialState;
  stripeConfigured: boolean;
  paymentProviders: BillingPaymentProviders;
};

const titleCaseLabel = (value: string) =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const formatBillingStatusLabel = (value: BillingState["subscription"]["status"]) =>
  value === "past_due" ? "Past Due" : titleCaseLabel(value);

const formatBillingIntervalLabel = (
  value: BillingState["subscription"]["billingInterval"]
) => titleCaseLabel(value);

const formatBooleanLabel = (value: boolean) => (value ? "Included" : "Blocked");

const formatMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
};

const pluralize = (value: number, singular: string, plural?: string) =>
  value === 1 ? singular : plural ?? `${singular}s`;

export const formatPlatformFamilyLabel = (value?: PlatformFamily | null) => {
  if (!value) {
    return "This feature";
  }

  if (value === "website") {
    return "Website Chat";
  }

  if (value === "meta") {
    return "Meta";
  }

  if (value === "line") {
    return "LINE";
  }

  if (value === "tiktok") {
    return "TikTok";
  }

  return titleCaseLabel(value);
};

const formatPlanVersionLabel = (billing: BillingState) => {
  const planName = billing.subscription.planDisplayName || billing.subscription.planCode;
  const versionLabel = billing.subscription.version
    ? `v${billing.subscription.version}`
    : "No version";

  return `${planName} ${versionLabel}`;
};

const formatUsageLabel = (label: string, used?: number, limit?: number) => {
  if (typeof used !== "number" || typeof limit !== "number") {
    return undefined;
  }

  return `${label}: ${used} / ${limit}`;
};

const buildPlanHeadline = (version: PlanVersionSummary) => {
  if (
    version.entitlements.maxWorkspaces >= 3 ||
    version.entitlements.maxSeats >= 10
  ) {
    return "Generous scale across multiple workspaces and a larger support team.";
  }

  if (
    version.entitlements.maxSeats >= 3 ||
    version.entitlements.maxExternalPlatformFamilies >= 1
  ) {
    return "Add teammates and expand beyond website chat when you are ready.";
  }

  return "Start with a lightweight workspace and first-party website chat.";
};

const buildPlanHighlights = (version: PlanVersionSummary) => {
  const highlights = [
    `${version.entitlements.maxSeats} ${pluralize(
      version.entitlements.maxSeats,
      "seat"
    )} included`,
    `${version.entitlements.maxWorkspaces} ${pluralize(
      version.entitlements.maxWorkspaces,
      "workspace"
    )} included`,
  ];

  if (version.entitlements.maxExternalPlatformFamilies > 0) {
    highlights.push(
      `${version.entitlements.maxExternalPlatformFamilies} external platform ${pluralize(
        version.entitlements.maxExternalPlatformFamilies,
        "family",
        "families"
      )}`
    );
  } else {
    highlights.push("Website Chat only");
  }

  highlights.push(
    `BYO AI ${version.entitlements.allowBYOAI ? "included" : "blocked"}`
  );
  highlights.push(
    `Automation ${version.entitlements.allowAutomation ? "included" : "blocked"}`
  );

  if (version.entitlements.allowCustomDomain) {
    highlights.push("Custom domains included");
  }

  if (version.entitlements.allowAuditExports) {
    highlights.push("Audit exports included");
  }

  return highlights;
};

const getPriceDisplay = (
  version: PlanVersionSummary,
  pricingMode?: BillingPricingMode
) => {
  if (pricingMode === "free") {
    return {
      price: "$0",
      suffix: "/ month",
    };
  }

  if (version.billingInterval === "manual") {
    return {
      price: "Manual",
      suffix: "Pricing handled by the platform team",
    };
  }

  const interval =
    version.billingInterval === "yearly" ? "/ year" : "/ month";

  return {
    price: formatMoney(version.priceAmount, version.currency),
    suffix: interval,
  };
};

type PlanChangeKind =
  | "current"
  | "scheduled"
  | "upgrade"
  | "downgrade"
  | "switch"
  | "unavailable";

type PlanChoice = {
  catalog: PlanCatalogSummary;
  version: PlanVersionSummary;
  changeKind: PlanChangeKind;
  badgeLabel: string;
  ctaLabel: string;
  badgeTone: "current" | "upgrade" | "downgrade" | "switch" | "muted";
  improvements: string[];
  reductions: string[];
  blockedReasons: string[];
  actionRequiredBeforeEffectiveDate: string[];
  scheduledEffectiveAt: string | null;
};

const formatPlanDateLabel = (value?: string | null, fallback = "Not scheduled") => {
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

const countEnabledFeatureFlags = (entitlements: BillingState["entitlements"]) =>
  [
    entitlements.allowWebsiteChat,
    entitlements.allowBYOAI,
    entitlements.allowAutomation,
    entitlements.allowCustomDomain,
    entitlements.allowAuditExports,
    entitlements.allowExtraSeats,
    entitlements.allowExtraWorkspaces,
    entitlements.allowExtraConnections,
  ].filter(Boolean).length;

const describePlanDifference = (
  label: string,
  targetValue: number,
  currentValue: number
) => {
  if (targetValue === currentValue) {
    return null;
  }

  if (targetValue > currentValue) {
    return `${label} increases from ${currentValue} to ${targetValue}`;
  }

  return `${label} drops from ${currentValue} to ${targetValue}`;
};

const buildPlanChoice = (
  billing: BillingState,
  catalog: PlanCatalogSummary,
  version: PlanVersionSummary,
  currentSortOrder: number,
  trial: AccountTrialState | null
): PlanChoice => {
  const isCurrentPlan =
    billing.subscription.planCatalogId === catalog._id &&
    billing.subscription.planVersionId === version._id;
  const isScheduledTarget =
    billing.subscription.scheduledPlanVersionId === version._id ||
    (!billing.subscription.scheduledPlanVersionId &&
      billing.subscription.scheduledPlanCatalogId === catalog._id);

  if (isCurrentPlan) {
    return {
      catalog,
      version,
      changeKind: "current",
      badgeLabel: "Current plan",
      ctaLabel: "Current plan",
      badgeTone: "current",
      improvements: [],
      reductions: [],
      blockedReasons: [],
      actionRequiredBeforeEffectiveDate: [],
      scheduledEffectiveAt: null,
    };
  }

  const current = billing.entitlements;
  const target = version.entitlements;
  const improvements: string[] = [];
  const reductions: string[] = [];
  const blockedReasons: string[] = [];
  const actionRequiredBeforeEffectiveDate: string[] = [];

  const numericDiffs = [
    describePlanDifference("Seats", target.maxSeats, current.maxSeats),
    describePlanDifference("Workspaces", target.maxWorkspaces, current.maxWorkspaces),
    describePlanDifference(
      "External platform families",
      target.maxExternalPlatformFamilies,
      current.maxExternalPlatformFamilies
    ),
  ].filter((item): item is string => !!item);

  for (const diff of numericDiffs) {
    if (diff.includes("increases")) {
      improvements.push(diff);
    } else {
      reductions.push(diff);
    }
  }

  const currentFamilyCount = current.allowedPlatformFamilies.length;
  const targetFamilyCount = target.allowedPlatformFamilies.length;
  if (targetFamilyCount > currentFamilyCount) {
    improvements.push(
      `Allowed platform families increase from ${currentFamilyCount} to ${targetFamilyCount}`
    );
  } else if (targetFamilyCount < currentFamilyCount) {
    reductions.push(
      `Allowed platform families drop from ${currentFamilyCount} to ${targetFamilyCount}`
    );
  }

  const currentFeatureCount = countEnabledFeatureFlags(current);
  const targetFeatureCount = countEnabledFeatureFlags(target);
  if (targetFeatureCount > currentFeatureCount) {
    improvements.push("More plan features are included");
  } else if (targetFeatureCount < currentFeatureCount) {
    reductions.push("Some currently enabled features will no longer be included");
  }

  if (target.allowAutomation && !current.allowAutomation) {
    improvements.push("Automation becomes available");
  } else if (!target.allowAutomation && current.allowAutomation) {
    reductions.push("Automation is no longer included");
  }

  if (target.allowCustomDomain && !current.allowCustomDomain) {
    improvements.push("Custom domains become available");
  } else if (!target.allowCustomDomain && current.allowCustomDomain) {
    reductions.push("Custom domains are no longer included");
  }

  if (target.allowBYOAI && !current.allowBYOAI) {
    improvements.push("BYO AI becomes available");
  } else if (!target.allowBYOAI && current.allowBYOAI) {
    reductions.push("BYO AI is no longer included");
  }

  const usageWarnings: string[] = [];
  if (billing.usageSummary.seatsUsed > target.maxSeats) {
    usageWarnings.push(
      `Reduce seats from ${billing.usageSummary.seatsUsed} to ${target.maxSeats} before the scheduled change takes effect.`
    );
  }

  if (billing.usageSummary.workspacesUsed > target.maxWorkspaces) {
    usageWarnings.push(
      `Reduce attached workspaces from ${billing.usageSummary.workspacesUsed} to ${target.maxWorkspaces} before the scheduled change takes effect.`
    );
  }

  if (
    billing.usageSummary.externalPlatformFamiliesUsed.length >
    target.maxExternalPlatformFamilies
  ) {
    usageWarnings.push(
      `Reduce external platform families from ${billing.usageSummary.externalPlatformFamiliesUsed.length} to ${target.maxExternalPlatformFamilies} before the scheduled change takes effect.`
    );
  }

  const blockedFamilies = billing.usageSummary.externalPlatformFamiliesUsed.filter(
    (family) => !target.allowedPlatformFamilies.includes(family)
  );
  if (blockedFamilies.length > 0) {
    usageWarnings.push(
      `${blockedFamilies.map((family) => formatPlatformFamilyLabel(family)).join(", ")} would become restricted on the selected plan unless those connections are removed first.`
    );
  }

  let changeKind: PlanChangeKind = "unavailable";
  const targetIsDowngrade =
    catalog.pricingMode === "free" ||
    catalog.sortOrder < currentSortOrder ||
    reductions.length > 0;

  if (isScheduledTarget) {
    changeKind = "scheduled";
  } else if (catalog.sortOrder > currentSortOrder) {
    changeKind = "upgrade";
  } else if (targetIsDowngrade) {
    changeKind = "downgrade";
  } else {
    changeKind = "switch";
  }

  const labelMap: Record<
    Exclude<PlanChangeKind, "unavailable">,
    { badgeLabel: string; ctaLabel: string; badgeTone: PlanChoice["badgeTone"] }
  > = {
    current: {
      badgeLabel: "Current plan",
      ctaLabel: "Current plan",
      badgeTone: "current",
    },
    scheduled: {
      badgeLabel:
        billing.subscription.scheduledChangeKind === "downgrade"
          ? "Scheduled downgrade"
          : "Scheduled change",
      ctaLabel:
        billing.subscription.scheduledChangeKind === "downgrade"
          ? "Scheduled downgrade"
          : "Scheduled change",
      badgeTone: "downgrade",
    },
    upgrade: {
      badgeLabel: "Upgrade",
      ctaLabel:
        trial?.available && catalog.pricingMode === "fixed"
          ? `Start trial on ${catalog.displayName}`
          : `Upgrade to ${catalog.displayName}`,
      badgeTone: "upgrade",
    },
    downgrade: {
      badgeLabel: "Downgrade",
      ctaLabel: `Downgrade to ${catalog.displayName}`,
      badgeTone: "downgrade",
    },
    switch: {
      badgeLabel: "Switch",
      ctaLabel: `Switch to ${catalog.displayName}`,
      badgeTone: "switch",
    },
  };

  if (changeKind === "downgrade" || changeKind === "scheduled") {
    actionRequiredBeforeEffectiveDate.push(...usageWarnings);
  } else {
    blockedReasons.push(...usageWarnings);
  }

  return {
    catalog,
    version,
    changeKind,
    badgeLabel: labelMap[changeKind].badgeLabel,
    ctaLabel: labelMap[changeKind].ctaLabel,
    badgeTone: labelMap[changeKind].badgeTone,
    improvements,
    reductions,
    blockedReasons,
    actionRequiredBeforeEffectiveDate:
      changeKind === "scheduled"
        ? billing.actionRequiredBeforeEffectiveDate
        : actionRequiredBeforeEffectiveDate,
    scheduledEffectiveAt:
      changeKind === "scheduled"
        ? billing.subscription.scheduledChangeEffectiveAt ?? null
        : changeKind === "downgrade"
          ? billing.subscription.trialEndsAt ?? billing.subscription.currentPeriodEnd ?? null
          : null,
  };
};

export const getBillingUpgradeDetails = (
  error: unknown
): BillingUpgradeDetails | null => {
  if (!isApiRequestError(error)) {
    return null;
  }

  const details = error.details;
  if (!details || typeof details !== "object") {
    return null;
  }

  if (
    !("upgradeRequired" in details) ||
    (details as { upgradeRequired?: unknown }).upgradeRequired !== true
  ) {
    return null;
  }

  if (!("billing" in details)) {
    return null;
  }

  return details as BillingUpgradeDetails;
};

export const getBillingUpgradeContent = (
  details: BillingUpgradeDetails
): BillingUpgradeContent => {
  const familyLabel = formatPlatformFamilyLabel(details.platformFamily);

  switch (details.gate) {
    case "workspaces":
      return {
        title: "Workspace limit reached",
        description:
          "This billing account is already using all of its workspace slots. Upgrade the plan or free a workspace slot before creating another workspace.",
        usageLabel: formatUsageLabel(
          "Workspaces in use",
          details.usedValue,
          details.limitValue
        ),
      };
    case "seats":
      return {
        title: "Seat limit reached",
        description:
          "Active members and pending invites across this billing account already consume every available seat. Upgrade the plan or free a seat before inviting another person.",
        usageLabel: formatUsageLabel(
          "Seats in use",
          details.usedValue,
          details.limitValue
        ),
      };
    case "website_chat":
      return {
        title: "Website Chat is not included",
        description:
          "This billing plan does not include Website Chat. Upgrade the plan before turning on website chat or adding a website connection.",
      };
    case "byo_ai":
      return {
        title: "BYO AI is not included",
        description:
          "This billing plan does not include bring-your-own AI. Upgrade the plan before enabling workspace AI settings.",
      };
    case "automation":
      return {
        title: "Automation is not included",
        description:
          "This billing plan does not include automation controls. Upgrade the plan before enabling automation for this workspace.",
      };
    case "platform_family":
      return {
        title: `${familyLabel} is not included`,
        description: `This billing plan does not allow ${familyLabel} connections for this billing account. Upgrade before connecting that platform family.`,
      };
    case "external_platform_families":
      return {
        title: "Platform family limit reached",
        description:
          "This billing account is already using the maximum number of external platform families allowed on the current plan. Upgrade the plan before adding another provider family.",
        usageLabel: formatUsageLabel(
          "External platform families in use",
          details.usedValue,
          details.limitValue
        ),
      };
    case "channel_connections":
      return {
        title: `${familyLabel} connection limit reached`,
        description: `This billing account already uses all ${familyLabel} connection slots allowed on the current plan. Upgrade the plan before adding another connection.`,
        usageLabel: formatUsageLabel(
          `${familyLabel} connections`,
          details.usedValue,
          details.limitValue
        ),
      };
    default:
      return {
        title: "Upgrade required",
        description:
          "This action is blocked by the current billing plan. Upgrade the plan or ask the platform team to review entitlements for this billing account.",
      };
  }
};

function BillingPlanModal(props: {
  billing: BillingState;
  workspaceSlug?: string | null;
  workspaceId?: string | null;
  requestGate?: BillingLimitGate | "general";
  title?: string;
  description?: string;
  onClose: () => void;
}) {
  const { activeWorkspace } = useSession();
  const [planCatalogs, setPlanCatalogs] = useState<PlanCatalogSummary[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [paymentProviders, setPaymentProviders] =
    useState<BillingPaymentProviders | null>(null);
  const [trial, setTrial] = useState<AccountTrialState | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPlanVersionId, setSelectedPlanVersionId] = useState<string | null>(null);
  const [redirectingPlanVersionId, setRedirectingPlanVersionId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canManageBilling = activeWorkspace?.workspaceRole === "owner";
  const workspaceBillingPath = props.workspaceSlug
    ? buildWorkspacePath(props.workspaceSlug, "billing")
    : null;

  const sortedPlanCatalogs = useMemo(
    () => [...planCatalogs].sort((left, right) => left.sortOrder - right.sortOrder),
    [planCatalogs]
  );

  const planChoices = useMemo(
    () => {
      const currentSortOrder =
        sortedPlanCatalogs.find(
          (catalog) => catalog._id === props.billing.subscription.planCatalogId
        )?.sortOrder ?? 100;

      return sortedPlanCatalogs
        .map((catalog) => {
          const version = catalog.versions[0];
          if (!version) {
            return null;
          }

          return buildPlanChoice(
            props.billing,
            catalog,
            version,
            currentSortOrder,
            trial
          );
        })
        .filter((item): item is PlanChoice => !!item);
    },
    [props.billing, sortedPlanCatalogs, trial]
  );

  const selectedPlanChoice = useMemo(
    () =>
      planChoices.find((choice) => choice.version._id === selectedPlanVersionId) ?? null,
    [planChoices, selectedPlanVersionId]
  );

  const stripeAvailable =
    stripeConfigured && !!paymentProviders?.stripe.available && canManageBilling;
  const manualBillingEmail =
    paymentProviders?.manualEmail.available && paymentProviders.manualEmail.contactEmail
      ? paymentProviders.manualEmail.contactEmail
      : null;
  const selectedCanUseStripeCheckout =
    !!selectedPlanChoice?.version.stripePriceId &&
    stripeAvailable &&
    selectedPlanChoice?.changeKind === "upgrade";
  const selectedCanStartTrial =
    !!selectedPlanChoice &&
    selectedPlanChoice.catalog.pricingMode === "fixed" &&
    !!trial?.available &&
    (selectedPlanChoice.changeKind === "upgrade" ||
      selectedPlanChoice.changeKind === "switch");
  const selectedPriceDisplay = selectedPlanChoice
    ? getPriceDisplay(selectedPlanChoice.version, selectedPlanChoice.catalog.pricingMode)
    : null;
  const currentPlanLabel = formatPlanVersionLabel(props.billing);
  const stepLabels: Array<{ value: 1 | 2 | 3; label: string }> = [
    { value: 1, label: "Choose plan" },
    { value: 2, label: "Review change" },
    { value: 3, label: "Confirm update" },
  ];
  const deploymentBillingNote = !canManageBilling
    ? "Plan changes are managed by the workspace owner."
    : trial?.available
      ? "Your account still has one paid-plan trial available. Selecting a paid self-serve plan can start that trial once."
      : stripeAvailable
        ? "Choose a plan, review the impact, then continue with the payment flow when you confirm."
        : manualBillingEmail
          ? "Choose a plan, review the impact, then confirm it so billing can follow up manually."
          : "Choose a plan, review the impact, then confirm the change from this workspace.";

  const effectiveDateLabel = !selectedPlanChoice
    ? "Not selected"
    : selectedPlanChoice.changeKind === "scheduled"
      ? `Already scheduled for ${formatPlanDateLabel(
          selectedPlanChoice.scheduledEffectiveAt
        )}.`
      : selectedPlanChoice.changeKind === "downgrade"
        ? `Takes effect on ${formatPlanDateLabel(
            selectedPlanChoice.scheduledEffectiveAt
          )}.`
        : selectedCanStartTrial
          ? "The paid-plan trial starts immediately after confirmation."
          : selectedCanUseStripeCheckout
            ? "The upgrade applies as soon as checkout completes."
            : selectedPlanChoice.catalog.pricingMode === "free"
              ? "The workspace moves onto the Free plan at the scheduled change date."
              : "The change applies as soon as billing confirms the update.";
  const renewalBehaviorLabel = !selectedPlanChoice
    ? "Not selected"
    : selectedPlanChoice.changeKind === "scheduled" ||
        selectedPlanChoice.changeKind === "downgrade"
      ? `Your current plan stays active until ${formatPlanDateLabel(
          selectedPlanChoice.scheduledEffectiveAt
        )}. No refund will be issued for unused time.`
      : selectedCanStartTrial
        ? "The selected paid plan starts in trial mode once, then continues on that plan unless you change it again."
        : selectedPlanChoice.version.billingInterval === "manual"
          ? "Billing stays on a manual cycle until the platform team confirms renewal details."
          : "The new plan renews on its billing cycle unless it is canceled later.";
  const selectedChangeLabel = selectedPlanChoice
    ? selectedPlanChoice.changeKind === "scheduled"
      ? "Scheduled downgrade"
      : titleCaseLabel(selectedPlanChoice.changeKind)
    : "Not selected";

  useEffect(() => {
    let cancelled = false;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };

    const loadCatalog = async () => {
      try {
        setCatalogLoading(true);
        const response = await apiRequest<BillingCatalogResponse>(
          "/api/billing/catalog"
        );
        if (!cancelled) {
          setPlanCatalogs(response.items);
          setTrial(response.trial);
          setStripeConfigured(response.stripeConfigured);
          setPaymentProviders(response.paymentProviders);
        }
      } catch {
        if (!cancelled) {
          setPlanCatalogs([]);
          setTrial(null);
          setStripeConfigured(false);
          setPaymentProviders(null);
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    void loadCatalog();

    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [props.onClose]);

  const handleStartPlanSession = async (planVersionId: string) => {
    if (!props.workspaceId || !planVersionId) {
      return;
    }

    try {
      setRedirectingPlanVersionId(planVersionId);
      setError(null);
      setNotice(null);
      const response = await apiRequest<{
        url: string;
        mode: "checkout" | "portal_subscription_update";
      }>("/api/billing/plan-session", {
        method: "POST",
        body: JSON.stringify({
          planVersionId,
        }),
      });

      setNotice(
        response.mode === "checkout"
          ? "Redirecting to the checkout flow..."
          : "Redirecting to the subscription confirmation flow..."
      );
      window.location.assign(response.url);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to start the billing flow."
      );
    } finally {
      setRedirectingPlanVersionId(null);
    }
  };

  const handleChoosePlan = (choice: PlanChoice) => {
    if (
      !canManageBilling ||
      choice.changeKind === "current" ||
      choice.changeKind === "scheduled" ||
      choice.changeKind === "unavailable"
    ) {
      return;
    }

    setSelectedPlanVersionId(choice.version._id);
    setStep(2);
    setError(null);
    setNotice(null);
  };

  const buildManualBillingHref = (choice: PlanChoice) => {
    if (!manualBillingEmail) {
      return null;
    }

    const subject = encodeURIComponent(
      `${titleCaseLabel(choice.changeKind)} request for ${activeWorkspace?.name ?? "workspace"}`
    );
    const body = encodeURIComponent(
      [
        `Workspace: ${activeWorkspace?.name ?? props.workspaceSlug ?? "Workspace"}`,
        props.workspaceSlug ? `Workspace slug: ${props.workspaceSlug}` : null,
        `Billing account: ${props.billing.account.name}`,
        `Current plan: ${currentPlanLabel}`,
        `Requested plan: ${choice.catalog.displayName} v${choice.version.version}`,
        `Change type: ${titleCaseLabel(choice.changeKind)}`,
        `Billing cycle: ${formatBillingIntervalLabel(choice.version.billingInterval)}`,
      ]
        .filter(Boolean)
        .join("\n")
    );

    return `mailto:${manualBillingEmail}?subject=${subject}&body=${body}`;
  };

  const handleConfirmSelectedPlan = async () => {
    if (!selectedPlanChoice || !canManageBilling) {
      return;
    }

    if (
      selectedPlanChoice.catalog.pricingMode === "free" ||
      selectedCanStartTrial
    ) {
      try {
        setRedirectingPlanVersionId(selectedPlanChoice.version._id);
        setError(null);
        setNotice(null);
        const response = await apiRequest<{
          mode:
            | "plan_updated"
            | "trial_started"
            | "change_scheduled"
            | "manual_billing_required";
        }>("/api/billing/plan-change", {
          method: "POST",
          body: JSON.stringify({
            planVersionId: selectedPlanChoice.version._id,
          }),
        });

        if (response.mode === "plan_updated") {
          setNotice("Workspace plan updated. Reloading billing...");
        } else if (response.mode === "trial_started") {
          setNotice("Paid-plan trial started. Reloading billing...");
        } else if (response.mode === "change_scheduled") {
          setNotice("Plan change scheduled. Reloading workspace billing...");
        } else {
          setNotice("This plan still needs billing follow-up before it can be applied.");
        }

        if (workspaceBillingPath) {
          window.location.assign(workspaceBillingPath);
        } else {
          window.location.reload();
        }
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to update the workspace plan."
        );
      } finally {
        setRedirectingPlanVersionId(null);
      }
      return;
    }

    if (selectedCanUseStripeCheckout) {
      await handleStartPlanSession(selectedPlanChoice.version._id);
      return;
    }

    const manualHref = buildManualBillingHref(selectedPlanChoice);
    if (manualHref) {
      setNotice("Opening the billing request email...");
      window.location.href = manualHref;
      return;
    }

    if (workspaceBillingPath) {
      setNotice("Review the billing account details on the workspace billing page before trying again.");
      window.location.assign(workspaceBillingPath);
    }
  };

  const renderPlanCard = (choice: PlanChoice) => {
    const priceDisplay = getPriceDisplay(choice.version, choice.catalog.pricingMode);
    const allowedFamilyLabels =
      choice.version.entitlements.allowedPlatformFamilies.length > 0
        ? choice.version.entitlements.allowedPlatformFamilies
            .map((family) => formatPlatformFamilyLabel(family))
            .join(", ")
        : "Website Chat only";
    const isSelected = choice.version._id === selectedPlanVersionId;
    const isCurrentPlan = choice.changeKind === "current";
    const isScheduled = choice.changeKind === "scheduled";
    const isUnavailable = choice.changeKind === "unavailable";
    const canSelect = canManageBilling && !isCurrentPlan && !isScheduled && !isUnavailable;

    return (
      <section
        key={choice.catalog._id}
        className={[
          "flex min-h-[680px] w-[min(410px,calc(100vw-3rem))] shrink-0 flex-col rounded-[36px] border p-8 shadow-2xl xl:w-[390px]",
          isCurrentPlan
            ? "border-indigo-400/40 bg-[linear-gradient(180deg,rgba(84,74,160,0.72),rgba(38,38,38,0.95))]"
            : isSelected
              ? "border-white/40 bg-[linear-gradient(180deg,rgba(50,50,50,0.96),rgba(22,22,22,0.98))]"
              : "border-white/10 bg-[#202020]",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-4xl font-semibold tracking-tight text-white">
              {choice.catalog.displayName}
            </p>
            <p className="mt-3 text-sm font-medium uppercase tracking-[0.16em] text-slate-400">
              {formatBillingIntervalLabel(choice.version.billingInterval)}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {buildPlanHeadline(choice.version)}
            </p>
          </div>
          <span
            className={[
              "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]",
              choice.badgeTone === "current"
                ? "bg-white/10 text-white"
                : choice.badgeTone === "upgrade"
                  ? "bg-emerald-500/20 text-emerald-100"
                  : choice.badgeTone === "downgrade"
                    ? "bg-amber-400/20 text-amber-100"
                    : choice.badgeTone === "switch"
                      ? "bg-sky-400/20 text-sky-100"
                      : "bg-white/10 text-slate-300",
            ].join(" ")}
          >
            {choice.badgeLabel}
          </span>
        </div>

        <div className="mt-10 flex items-end gap-3">
          <p className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            {priceDisplay.price}
          </p>
          <div className="pb-1 text-base text-slate-300">{priceDisplay.suffix}</div>
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={() => handleChoosePlan(choice)}
            disabled={!canSelect}
            className={[
              "inline-flex h-14 w-full items-center justify-center rounded-full px-6 text-base font-semibold transition",
              !canSelect
                ? "cursor-not-allowed border border-white/10 bg-black/20 text-slate-400"
                : choice.changeKind === "upgrade"
                  ? "bg-white text-slate-950 hover:bg-slate-200"
                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10",
            ].join(" ")}
          >
            {!canManageBilling ? "Managed by workspace owner" : choice.ctaLabel}
          </button>
          {choice.blockedReasons.length > 0 ? (
            <div className="mt-4 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
              {choice.blockedReasons[0]}
            </div>
          ) : null}
          {choice.actionRequiredBeforeEffectiveDate.length > 0 ? (
            <div className="mt-4 rounded-3xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm leading-6 text-sky-100">
              {isScheduled
                ? `Scheduled for ${formatPlanDateLabel(choice.scheduledEffectiveAt)}.`
                : `If you schedule this change, fix the listed usage before ${formatPlanDateLabel(
                    choice.scheduledEffectiveAt
                  )}.`}
            </div>
          ) : null}
        </div>

        <div className="mt-8 space-y-5">
          <ul className="space-y-3 text-sm leading-7 text-slate-200">
            {buildPlanHighlights(choice.version).map((item) => (
              <li key={item} className="flex gap-3">
                <span className="pt-1 text-slate-400">*</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-3xl border border-white/10 bg-black/10 p-5">
            <p className="text-sm font-semibold text-white">Included limits</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-300">
              <p>Seats: {choice.version.entitlements.maxSeats}</p>
              <p>Workspaces: {choice.version.entitlements.maxWorkspaces}</p>
              <p>
                External families: {choice.version.entitlements.maxExternalPlatformFamilies}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/10 p-5">
            <p className="text-sm font-semibold text-white">Platform coverage</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">{allowedFamilyLabels}</p>
          </div>
        </div>
      </section>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[250] overflow-y-auto bg-[#171717] text-white">
      <div className="min-h-screen w-full overflow-x-hidden px-4 py-6 sm:px-6 lg:px-10">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-3xl leading-none text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            aria-label="Close pricing"
          >
            x
          </button>
        </div>

        <div className="mx-auto mt-2 max-w-5xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Workspace billing
          </p>
          <h3 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {props.title || "Change workspace plan"}
          </h3>
          <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base">
            {props.description ||
              "Choose a new plan for this workspace, review the impact, then confirm the change."}
          </p>
          <p className="mt-4 text-sm text-slate-500">{deploymentBillingNote}</p>
        </div>

        <div className="mx-auto mt-8 flex w-full max-w-5xl flex-wrap items-center justify-center gap-3">
          {stepLabels.map((stepItem) => (
            <div
              key={stepItem.value}
              className={[
                "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]",
                step === stepItem.value
                  ? "bg-white text-slate-950"
                  : step > stepItem.value
                    ? "bg-emerald-500/20 text-emerald-100"
                    : "bg-white/5 text-slate-400",
              ].join(" ")}
            >
              {stepItem.value}. {stepItem.label}
            </div>
          ))}
        </div>

        {error ? (
          <div className="mx-auto mt-8 max-w-4xl rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mx-auto mt-8 max-w-4xl rounded-3xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
            {notice}
          </div>
        ) : null}

        {step === 1 ? (
          <>
            <div className="mx-auto mt-12 flex w-full max-w-450 flex-wrap items-center justify-center gap-4 text-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Step 1
                </p>
                <h4 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  Choose a new plan
                </h4>
                <p className="mt-2 text-sm text-slate-400">
                  The current workspace plan is compared against every active option so you can see which ones are upgrades, downgrades, or unavailable.
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto pb-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="mx-auto flex w-max min-w-full justify-center gap-6 px-1 pb-4">
                {catalogLoading ? (
                  <div className="rounded-[32px] border border-white/10 bg-white/5 px-6 py-8 text-sm text-slate-400">
                    Loading active plans...
                  </div>
                ) : null}

                {!catalogLoading && planChoices.length === 0 ? (
                  <div className="rounded-[32px] border border-white/10 bg-white/5 px-6 py-8 text-sm text-slate-400">
                    No active plan versions are published yet.
                  </div>
                ) : null}

                {planChoices.map((choice) => renderPlanCard(choice))}
              </div>
            </div>
          </>
        ) : null}

        {step === 2 && selectedPlanChoice ? (
          <div className="mx-auto mt-12 max-w-6xl">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
              <section className="rounded-[36px] border border-white/10 bg-white/5 p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Step 2
                </p>
                <h4 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                  Review plan change
                </h4>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Review what changes for this workspace before you confirm the plan update.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Current plan
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">{currentPlanLabel}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      {formatBillingIntervalLabel(props.billing.subscription.billingInterval)}
                    </p>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Selected plan
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {selectedPlanChoice.catalog.displayName} v{selectedPlanChoice.version.version}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      {formatBillingIntervalLabel(selectedPlanChoice.version.billingInterval)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Change type
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">{selectedChangeLabel}</p>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Billing account
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">{props.billing.account.name}</p>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Effective date
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-200">{effectiveDateLabel}</p>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Billing cycle
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {formatBillingIntervalLabel(selectedPlanChoice.version.billingInterval)}
                    </p>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Renewal behavior
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-200">{renewalBehaviorLabel}</p>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Current cycle ends
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {formatPlanDateLabel(props.billing.subscription.currentPeriodEnd)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 p-5">
                    <p className="text-sm font-semibold text-emerald-100">What improves</p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-emerald-50">
                      {selectedPlanChoice.improvements.length > 0 ? (
                        selectedPlanChoice.improvements.map((item) => (
                          <li key={item}>* {item}</li>
                        ))
                      ) : (
                        <li>No immediate increases compared with the current plan.</li>
                      )}
                    </ul>
                  </div>
                  <div
                    className={[
                      "rounded-[28px] border p-5",
                      selectedPlanChoice.reductions.length > 0 ||
                      selectedPlanChoice.blockedReasons.length > 0 ||
                      selectedPlanChoice.actionRequiredBeforeEffectiveDate.length > 0
                        ? "border-amber-400/20 bg-amber-400/10"
                        : "border-white/10 bg-black/15",
                    ].join(" ")}
                  >
                    <p
                      className={[
                        "text-sm font-semibold",
                        selectedPlanChoice.reductions.length > 0 ||
                        selectedPlanChoice.blockedReasons.length > 0 ||
                        selectedPlanChoice.actionRequiredBeforeEffectiveDate.length > 0
                          ? "text-amber-100"
                          : "text-white",
                      ].join(" ")}
                    >
                      What changes or reduces
                    </p>
                    <ul
                      className={[
                        "mt-3 space-y-2 text-sm leading-7",
                        selectedPlanChoice.reductions.length > 0 ||
                        selectedPlanChoice.blockedReasons.length > 0 ||
                        selectedPlanChoice.actionRequiredBeforeEffectiveDate.length > 0
                          ? "text-amber-50"
                          : "text-slate-300",
                      ].join(" ")}
                    >
                      {selectedPlanChoice.reductions.length > 0 ? (
                        selectedPlanChoice.reductions.map((item) => <li key={item}>* {item}</li>)
                      ) : (
                        <li>No limit reductions were detected for this change.</li>
                      )}
                      {selectedPlanChoice.blockedReasons.map((reason) => (
                        <li key={reason}>* {reason}</li>
                      ))}
                      {selectedPlanChoice.actionRequiredBeforeEffectiveDate.map((reason) => (
                        <li key={reason}>* {reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-5 text-sm font-medium text-white transition hover:bg-white/5"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={selectedPlanChoice.changeKind === "unavailable"}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400"
                  >
                    Continue
                  </button>
                </div>
              </section>

              <aside className="space-y-6">
                <div className="rounded-[32px] border border-white/10 bg-black/15 p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Selected plan
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {selectedPlanChoice.catalog.displayName}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {selectedPriceDisplay?.price} {selectedPriceDisplay?.suffix}
                  </p>
                  <p className="mt-4 text-sm leading-7 text-slate-400">
                    {buildPlanHeadline(selectedPlanChoice.version)}
                  </p>
                </div>
                <div className="rounded-[32px] border border-white/10 bg-black/15 p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Included limits
                  </p>
                  <div className="mt-4 space-y-2 text-sm text-slate-200">
                    <p>Seats: {selectedPlanChoice.version.entitlements.maxSeats}</p>
                    <p>Workspaces: {selectedPlanChoice.version.entitlements.maxWorkspaces}</p>
                    <p>
                      External families: {selectedPlanChoice.version.entitlements.maxExternalPlatformFamilies}
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        ) : null}

        {step === 3 && selectedPlanChoice ? (
          <div className="mx-auto mt-12 max-w-4xl">
            <div className="rounded-[40px] border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Step 3
              </p>
              <h4 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Confirm plan update
              </h4>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                You are about to {selectedPlanChoice.changeKind} this workspace from <strong className="text-white">{currentPlanLabel}</strong> to <strong className="text-white">{selectedPlanChoice.catalog.displayName} v{selectedPlanChoice.version.version}</strong>.
              </p>

              {selectedCanStartTrial ? (
                <div className="mt-5 rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 px-5 py-4 text-left text-sm leading-7 text-emerald-50">
                  This account still has its one-time paid-plan trial available, so confirming this change will start that trial on the selected billing account.
                </div>
              ) : null}

              <div className="mt-6 grid gap-4 text-left md:grid-cols-2">
                <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Workspace
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {activeWorkspace?.name ?? props.workspaceSlug ?? "Workspace"}
                  </p>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Billing account
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">{props.billing.account.name}</p>
                </div>
              </div>

              <div className="mt-6 rounded-[28px] border border-white/10 bg-black/15 p-5 text-left">
                <p className="text-sm font-semibold text-white">What happens next</p>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-300">
                  <li>* Change type: {selectedChangeLabel}</li>
                  <li>* Billing cycle: {formatBillingIntervalLabel(selectedPlanChoice.version.billingInterval)}</li>
                  <li>* Effective date: {effectiveDateLabel}</li>
                  <li>* Renewal behavior: {renewalBehaviorLabel}</li>
                  {(selectedPlanChoice.changeKind === "downgrade" ||
                    selectedPlanChoice.changeKind === "scheduled") && (
                    <li>* No refund will be issued for unused time on the current plan.</li>
                  )}
                  {selectedPlanChoice.actionRequiredBeforeEffectiveDate.map((item) => (
                    <li key={item}>* Action required: {item}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-5 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmSelectedPlan()}
                  disabled={
                    redirectingPlanVersionId === selectedPlanChoice.version._id ||
                    selectedPlanChoice.changeKind === "current" ||
                    selectedPlanChoice.changeKind === "unavailable"
                  }
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400"
                >
                  {redirectingPlanVersionId === selectedPlanChoice.version._id
                    ? "Redirecting..."
                    : selectedCanStartTrial
                      ? `Start trial on ${selectedPlanChoice.catalog.displayName}`
                    : selectedCanUseStripeCheckout
                      ? "Continue to checkout"
                      : selectedPlanChoice.changeKind === "scheduled"
                        ? "Already scheduled"
                      : selectedPlanChoice.changeKind === "upgrade"
                        ? `Confirm upgrade to ${selectedPlanChoice.catalog.displayName}`
                        : selectedPlanChoice.changeKind === "downgrade"
                          ? `Schedule downgrade to ${selectedPlanChoice.catalog.displayName}`
                          : `Confirm switch to ${selectedPlanChoice.catalog.displayName}`}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export function BillingPlanButton({
  billing,
  workspaceSlug,
  workspaceId,
  requestGate = "general",
  title,
  description,
  autoOpen = false,
  label,
  className,
}: BillingPlanActionProps) {
  const [open, setOpen] = useState(autoOpen);

  useEffect(() => {
    if (autoOpen) {
      setOpen(true);
    }
  }, [autoOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
      >
        {label}
      </button>

      {open ? (
        <BillingPlanModal
          billing={billing}
          workspaceSlug={workspaceSlug}
          workspaceId={workspaceId}
          requestGate={requestGate}
          title={title}
          description={description}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function BillingUpgradePanel({
  billing,
  title,
  description,
  usageLabel,
  workspaceSlug,
  workspaceId,
  requestGate = "general",
  className,
}: BillingUpgradePanelProps) {
  return (
    <section
      className={[
        "rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm",
        className ?? "",
      ].join(" ")}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
        Upgrade Plan
      </p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-slate-700">{description}</p>
      {usageLabel ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-white/70 px-4 py-3 text-sm font-medium text-slate-900">
          {usageLabel}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Current Plan
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {formatPlanVersionLabel(billing)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {formatBillingIntervalLabel(billing.subscription.billingInterval)}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Subscription
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {formatBillingStatusLabel(billing.subscription.status)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{billing.account.name}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Usage Snapshot
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {billing.usageSummary.seatsUsed}/{billing.entitlements.maxSeats} seats
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {billing.usageSummary.workspacesUsed}/{billing.entitlements.maxWorkspaces} workspaces
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <BillingPlanButton
          billing={billing}
          workspaceSlug={workspaceSlug}
          workspaceId={workspaceId}
          requestGate={requestGate}
          title={title}
          description={description}
          label="Change plan"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
        />

        {workspaceSlug ? (
          <Link
            to={buildWorkspacePath(workspaceSlug, "billing")}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
          >
            Open billing page
          </Link>
        ) : null}
      </div>
    </section>
  );
}
