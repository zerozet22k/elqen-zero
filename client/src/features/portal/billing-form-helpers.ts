import { BillingEntitlements, PlatformFamily } from "../../types/models";

export const PLATFORM_FAMILY_OPTIONS: PlatformFamily[] = [
  "website",
  "meta",
  "telegram",
  "viber",
  "tiktok",
  "line",
];

export type BillingEntitlementDraft = {
  maxWorkspaces: string;
  maxSeats: string;
  allowedPlatformFamilies: PlatformFamily[];
  maxExternalPlatformFamilies: string;
  maxConnectedAccountsPerPlatform: Record<PlatformFamily, string>;
  allowWebsiteChat: boolean;
  allowCustomDomain: boolean;
  allowBYOAI: boolean;
  allowAutomation: boolean;
  allowAuditExports: boolean;
  allowExtraSeats: boolean;
  allowExtraWorkspaces: boolean;
  allowExtraConnections: boolean;
};

export const createEntitlementDraft = (
  entitlements?: Partial<BillingEntitlements>
): BillingEntitlementDraft => ({
  maxWorkspaces: String(entitlements?.maxWorkspaces ?? 1),
  maxSeats: String(entitlements?.maxSeats ?? 1),
  allowedPlatformFamilies: entitlements?.allowedPlatformFamilies ?? ["website"],
  maxExternalPlatformFamilies: String(entitlements?.maxExternalPlatformFamilies ?? 0),
  maxConnectedAccountsPerPlatform: {
    website: String(entitlements?.maxConnectedAccountsPerPlatform?.website ?? 1),
    meta: String(entitlements?.maxConnectedAccountsPerPlatform?.meta ?? 0),
    telegram: String(entitlements?.maxConnectedAccountsPerPlatform?.telegram ?? 0),
    viber: String(entitlements?.maxConnectedAccountsPerPlatform?.viber ?? 0),
    tiktok: String(entitlements?.maxConnectedAccountsPerPlatform?.tiktok ?? 0),
    line: String(entitlements?.maxConnectedAccountsPerPlatform?.line ?? 0),
  },
  allowWebsiteChat: entitlements?.allowWebsiteChat ?? true,
  allowCustomDomain: entitlements?.allowCustomDomain ?? false,
  allowBYOAI: entitlements?.allowBYOAI ?? false,
  allowAutomation: entitlements?.allowAutomation ?? false,
  allowAuditExports: entitlements?.allowAuditExports ?? false,
  allowExtraSeats: entitlements?.allowExtraSeats ?? false,
  allowExtraWorkspaces: entitlements?.allowExtraWorkspaces ?? false,
  allowExtraConnections: entitlements?.allowExtraConnections ?? false,
});

export const entitlementDraftToPayload = (
  draft: BillingEntitlementDraft
): BillingEntitlements => ({
  maxWorkspaces: Number(draft.maxWorkspaces || 0),
  maxSeats: Number(draft.maxSeats || 0),
  allowedPlatformFamilies: draft.allowedPlatformFamilies,
  maxExternalPlatformFamilies: Number(draft.maxExternalPlatformFamilies || 0),
  maxConnectedAccountsPerPlatform: {
    website: Number(draft.maxConnectedAccountsPerPlatform.website || 0),
    meta: Number(draft.maxConnectedAccountsPerPlatform.meta || 0),
    telegram: Number(draft.maxConnectedAccountsPerPlatform.telegram || 0),
    viber: Number(draft.maxConnectedAccountsPerPlatform.viber || 0),
    tiktok: Number(draft.maxConnectedAccountsPerPlatform.tiktok || 0),
    line: Number(draft.maxConnectedAccountsPerPlatform.line || 0),
  },
  allowWebsiteChat: draft.allowWebsiteChat,
  allowCustomDomain: draft.allowCustomDomain,
  allowBYOAI: draft.allowBYOAI,
  allowAutomation: draft.allowAutomation,
  allowAuditExports: draft.allowAuditExports,
  allowExtraSeats: draft.allowExtraSeats,
  allowExtraWorkspaces: draft.allowExtraWorkspaces,
  allowExtraConnections: draft.allowExtraConnections,
});
