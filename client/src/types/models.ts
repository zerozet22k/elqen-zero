import { OutboundContentBlock } from "./outbound-content";

export type Channel =
  | "facebook"
  | "instagram"
  | "telegram"
  | "viber"
  | "tiktok"
  | "line"
  | "website";
export type ConversationStatus = "open" | "pending" | "resolved";
export type ConversationRoutingState = "bot_active" | "human_pending" | "human_active";
export type MessageKind =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "sticker"
  | "location"
  | "contact"
  | "interactive"
  | "unsupported"
  | "system";

export type AttentionItemState =
  | "open"
  | "bot_replied"
  | "awaiting_human"
  | "human_replied"
  | "closed";

export type AttentionNeedsHumanReason =
  | "low_confidence"
  | "manual_request"
  | "customer_requested_human"
  | "policy_block"
  | "bot_failure"
  | "after_hours"
  | "other";

export type AttentionResolutionType =
  | "bot_reply"
  | "human_reply"
  | "auto_ack_only"
  | "ignored"
  | "merged_into_newer_item";

export type BotPauseState = "active" | "expired";
export type ActorKind = "workspace_user" | "platform_user" | "hybrid_user";
export type PlatformRole =
  | "founder"
  | "platform_admin"
  | "support"
  | "ops"
  | "billing"
  | "staff";
export type WorkspaceRole =
  | "owner"
  | "admin"
  | "manager"
  | "agent"
  | "viewer";

export interface MessageMeta extends Record<string, unknown> {
  actorUserId?: string | null;
  actorRunId?: string | null;
  inReplyToMessageId?: string | null;
  attentionItemId?: string | null;
  deliveryError?: string | null;
}

export interface AttentionItem {
  _id: string;
  conversationId: string;
  openedByInboundMessageIds: string[];
  lastInboundMessageId: string;
  state: AttentionItemState;
  needsHuman: boolean;
  needsHumanReason?: AttentionNeedsHumanReason | null;
  assignedUserId?: string | null;
  claimedAt?: string | null;
  botPausedAt?: string | null;
  botPausedUntil?: string | null;
  botPausedByUserId?: string | null;
  botPauseState?: BotPauseState | null;
  acknowledgementMessageId?: string | null;
  botReplyMessageId?: string | null;
  humanReplyMessageId?: string | null;
  resolvedByUserId?: string | null;
  resolutionType?: AttentionResolutionType | null;
  openedAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
}

export interface SessionData {
  token: string;
  user: {
    _id: string;
    email: string;
    name: string;
    avatarUrl?: string;
    actorKind: ActorKind;
    platformRole?: PlatformRole | null;
    authProvider?: "password" | "google" | "hybrid";
  };
  workspaces: Array<{
    _id: string;
    name: string;
    slug: string;
    timeZone: string;
    workspaceRole: WorkspaceRole;
    status?: "active" | "invited" | "disabled" | "inactive_due_to_plan_limit";
  }>;
  activeWorkspaceId: string;
  blockedAccess?: {
    reason: "inactive_due_to_plan_limit";
    message: string;
    workspaces: Array<{
      _id: string;
      name: string;
      slug: string;
    }>;
  } | null;
}

export interface AccountProfile {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  actorKind: ActorKind;
  platformRole?: PlatformRole | null;
  authProvider?: "password" | "google" | "hybrid";
  workspaceCount: number;
}

export interface PortalStaffUser {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  platformRole: PlatformRole;
  authProvider?: "password" | "google" | "hybrid";
  createdAt: string;
  updatedAt: string;
}

export type BillingPlanCode = string;
export type BillingAccountStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "grace_period"
  | "restricted"
  | "free_fallback"
  | "canceled"
  | "paused";
export type BillingInterval = "monthly" | "yearly" | "manual";
export type BillingScheduledChangeKind = "downgrade" | "cancel";
export type BillingOverrideType =
  | "entitlement_override"
  | "trial_extension"
  | "manual_discount"
  | "manual_status";
export type BillingPricingMode = "free" | "fixed" | "manual";
export type BillingPlanGroup = "standard" | "custom";
export type PlatformFamily =
  | "website"
  | "meta"
  | "telegram"
  | "viber"
  | "tiktok"
  | "line";

export interface BillingEntitlements {
  maxWorkspaces: number;
  maxSeats: number;
  allowedPlatformFamilies: PlatformFamily[];
  maxExternalPlatformFamilies: number;
  maxConnectedAccountsPerPlatform: Record<PlatformFamily, number>;
  allowWebsiteChat: boolean;
  allowCustomDomain: boolean;
  allowBYOAI: boolean;
  allowAutomation: boolean;
  allowAuditExports: boolean;
  allowExtraSeats: boolean;
  allowExtraWorkspaces: boolean;
  allowExtraConnections: boolean;
}

export interface BillingState {
  account: {
    _id: string;
    ownerUserId: string | null;
    name: string;
    status: BillingAccountStatus;
    createdAt: string;
  };
  subscription: {
    _id: string;
    provider: "manual" | "stripe";
    providerSubscriptionId?: string | null;
    status: BillingAccountStatus;
    planCatalogId: string | null;
    planVersionId: string | null;
    planCode: BillingPlanCode;
    planDisplayName: string;
    version: number | null;
    billingInterval: BillingInterval;
    priceAmount: number;
    currency: string;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd: boolean;
    trialEndsAt?: string | null;
    trialPlanCode?: string | null;
    scheduledPlanCatalogId?: string | null;
    scheduledPlanVersionId?: string | null;
    scheduledPlanCode?: string | null;
    scheduledPlanDisplayName?: string | null;
    scheduledChangeKind?: BillingScheduledChangeKind | null;
    scheduledChangeEffectiveAt?: string | null;
    renewsAt?: string | null;
    gracePeriodEndsAt?: string | null;
  };
  entitlements: BillingEntitlements;
  usageSummary: {
    billingAccountId: string;
    periodStart: string;
    periodEnd: string;
    seatsUsed: number;
    workspacesUsed: number;
    connectedAccountsUsedByPlatform: Record<PlatformFamily, number>;
    platformFamiliesUsed: PlatformFamily[];
    externalPlatformFamiliesUsed: Array<Exclude<PlatformFamily, "website">>;
    seatsRemaining: number;
    workspacesRemaining: number;
    externalPlatformFamiliesRemaining: number;
  };
  overrides: {
    activeCount: number;
  };
  actionRequiredBeforeEffectiveDate: string[];
  billingActivity: {
    outstandingAmount: number | null;
    currency: string | null;
    latestChargeStatus: string | null;
    nextBillingAt: string | null;
    latestInvoiceLabel: string | null;
  };
}

export interface BillingAccountProfile {
  accountId: string;
  name: string;
  companyLegalName: string;
  billingEmail: string;
  billingPhone: string;
  billingAddress: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  paymentMethod: {
    provider: "stripe" | "manual" | null;
    customerId: string | null;
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
  };
}

export interface BillingAccountChoiceSummary {
  _id: string;
  name: string;
  planDisplayName: string;
  version: number | null;
  status: BillingAccountStatus;
  workspaceCount: number;
  isDefault: boolean;
}

export interface OwnedBillingAccountSummary {
  billing: BillingState;
  accountProfile: BillingAccountProfile;
  stripe: BillingStripeState;
  workspaceCount: number;
  attachedWorkspaces: Array<{
    _id: string;
    name: string;
    slug: string;
  }>;
  isDefault: boolean;
}

export interface BillingStripeState {
  configured: boolean;
  customerId: string | null;
  subscriptionId: string | null;
  canOpenPortal: boolean;
  portalConfigurationId: string | null;
}

export interface BillingPaymentProviders {
  stripe: {
    enabled: boolean;
    configured: boolean;
    available: boolean;
  };
  manualEmail: {
    enabled: boolean;
    available: boolean;
    contactEmail: string | null;
  };
  kbzpay: {
    enabled: boolean;
    available: boolean;
    contactEmail: string | null;
  };
}

export interface BillingOverrideSummary {
  _id: string;
  type: BillingOverrideType;
  payload: Record<string, unknown>;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  reason?: string | null;
  createdBy?: string | null;
  createdAt: string;
  active: boolean;
}

export interface PlanVersionSummary {
  _id: string;
  planCatalogId: string;
  version: number;
  active: boolean;
  billingInterval: BillingInterval;
  priceAmount: number;
  currency: string;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
  entitlements: BillingEntitlements;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
}

export interface PlanCatalogSummary {
  _id: string;
  code: string;
  displayName: string;
  sortOrder: number;
  showPublicly: boolean;
  selfServe: boolean;
  pricingMode: BillingPricingMode;
  planGroup: BillingPlanGroup;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  currentSubscriptions: number;
  versions: PlanVersionSummary[];
}

export interface AccountTrialState {
  available: boolean;
  hasUsedTrial: boolean;
  trialStartedAt: string | null;
  trialConsumedAt: string | null;
  trialUsedByBillingAccountId: string | null;
  trialUsedOnPlanCode: string | null;
}

export interface PortalWorkspaceSummary {
  _id: string;
  name: string;
  slug: string;
  timeZone: string;
  owner: {
    _id: string;
    name: string;
    email: string;
  } | null;
  memberCounts: {
    total: number;
    active: number;
    invited: number;
    disabled: number;
  };
  billing: BillingState;
  connectionCounts: {
    total: number;
    active: number;
  };
  channels: string[];
  publicChatEnabled: boolean;
  websiteChatAvailable: boolean;
  publicPagePath: string;
  publicChatPagePath: string;
  publicPageUrl: string;
  publicChatPageUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface PortalWorkspaceDetail extends PortalWorkspaceSummary {
  bio: string;
  description: string;
  websiteUrl: string;
  supportEmail: string;
  supportPhone: string;
  welcomeMessage: string;
  members: Array<{
    _id: string;
    workspaceRole: WorkspaceRole;
    status: "active" | "invited" | "disabled" | "inactive_due_to_plan_limit";
    inviteExpiresAt?: string | null;
    inviteAcceptedAt?: string | null;
    user: {
      _id: string;
      name: string;
      email: string;
    } | null;
  }>;
  connections: Array<{
    _id: string;
    channel: string;
    status: string;
    displayName: string;
    verificationState: string;
    lastInboundAt?: string | null;
    lastOutboundAt?: string | null;
    lastError?: string | null;
  }>;
  auditTrail: Array<{
    _id: string;
    actorType: string;
    actorId?: string | null;
    eventType: string;
    reason?: string | null;
    data?: Record<string, unknown>;
    createdAt: string;
  }>;
  planCatalogs?: PlanCatalogSummary[];
  overrides?: BillingOverrideSummary[];
}

export interface Conversation {
  _id: string;
  workspaceId: string;
  channel: Channel;
  channelAccountId: string;
  externalChatId: string;
  externalUserId?: string;
  contactId?: string;
  assigneeUserId?: string | null;
  status: ConversationStatus;
  unreadCount: number;
  lastMessageAt?: string;
  lastMessageText?: string;
  aiEnabled: boolean;
  routingState: ConversationRoutingState;
  botPausedAt?: string | null;
  botPausedUntil?: string | null;
  botPausedByUserId?: string | null;
  botPauseState?: BotPauseState | null;
  tags: string[];
  currentAttentionItemId?: string | null;
  currentAttentionItem?: AttentionItem | null;
  contactName?: string;
  contact?: {
    _id: string;
    primaryName: string;
    channelIdentities?: Array<{
      channel: Channel;
      externalUserId: string;
      displayName?: string;
      username?: string;
      avatar?: string;
    }>;
  } | null;
  assignee?: {
    _id: string;
    name: string;
    avatarUrl?: string;
  } | null;
}

export interface Message {
  _id: string;
  conversationId: string;
  channel: Channel;
  direction: "inbound" | "outbound";
  senderType: "customer" | "agent" | "automation" | "ai" | "system";
  kind: MessageKind;
  text?: {
    body?: string;
    plain?: string;
  };
  media?: Array<{
    url?: string;
    mimeType?: string;
    filename?: string;
    size?: number;
    width?: number;
    height?: number;
    durationMs?: number;
    thumbnailUrl?: string;
    isTemporary?: boolean;
    expiresAt?: string | null;
    expirySource?: "provider_ttl" | "signed_url" | "unknown" | null;
    lastValidatedAt?: string | null;
    storedAssetId?: string | null;
    storedAssetUrl?: string | null;
  }>;
  location?: {
    lat?: number;
    lng?: number;
    label?: string;
  };
  contact?: {
    name?: string;
    phone?: string;
  };
  unsupportedReason?: string | null;
  status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
  meta?: MessageMeta;
  delivery?: {
    status: "queued" | "sent" | "delivered" | "read" | "failed";
    externalMessageId?: string | null;
    error?: string | null;
    request?: Record<string, unknown>;
  } | null;
  createdAt: string;
}

export interface Contact {
  _id: string;
  primaryName: string;
  phones: string[];
  deliveryAddress?: string;
  notes?: string;
  aiNotes?: string;
  channelIdentities: Array<{
    channel: Channel;
    externalUserId: string;
    displayName?: string;
    username?: string;
    avatar?: string;
  }>;
}

export interface ChannelConnection {
  _id: string;
  workspaceId: string;
  channel: Channel;
  displayName: string;
  externalAccountId: string;
  status:
    | "active"
    | "attention_required"
    | "restricted_due_to_plan"
    | "credentials_invalid"
    | "disconnected"
    | "inactive"
    | "pending"
    | "error";
  webhookUrl?: string | null;
  webhookVerified: boolean;
  verificationState:
  | "unverified"
  | "pending"
  | "verified"
  | "failed"
  | "pending_provider_verification";
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
  lastError?: string | null;
  preflightChecklist?: Array<{
    code: string;
    label: string;
    description: string;
    fixPath: string;
  }>;
  credentials: Record<string, unknown>;
  webhookConfig: Record<string, unknown>;
  capabilities: Record<string, unknown>;
}

export interface KnowledgeItem {
  _id: string;
  workspaceId: string;
  title: string;
  content: string;
  tags: string[];
  isActive?: boolean;
}

export interface CannedReply {
  _id: string;
  workspaceId: string;
  title: string;
  body: string;
  blocks: OutboundContentBlock[];
  triggers: string[];
  category: string;
  isActive?: boolean;
}

export interface AISettings {
  workspaceId: string;
  enabled: boolean;
  autoReplyEnabled: boolean;
  autoReplyMode: "none" | "all" | "after_hours_only" | "business_hours_only";
  afterHoursEnabled: boolean;
  confidenceThreshold: number;
  fallbackMessage: string;
  assistantInstructions: string;
  geminiModel: string;
  hasGeminiApiKey: boolean;
  supportedChannels: Record<Channel, boolean>;
}

export interface ConversationPresenceEntry {
  userId: string;
  userName: string;
  isComposing: boolean;
  connectionCount?: number;
}

export interface BusinessHoursDay {
  dayOfWeek: number;
  enabled: boolean;
  windows: Array<{
    start: string;
    end: string;
  }>;
}

export interface BusinessHours {
  workspaceId: string;
  timeZone: string;
  weeklySchedule: BusinessHoursDay[];
}

export interface AutomationState {
  businessHours?: BusinessHours | null;
  afterHoursRule?: {
    _id: string;
    name: string;
    isActive: boolean;
    trigger?: {
      applyWindow?: "after_hours" | "all";
    };
    action?: {
      fallbackText?: string;
    };
  } | null;
}

export interface AuditLog {
  _id: string;
  workspaceId?: string;
  conversationId?: string;
  messageId?: string;
  actorType: string;
  actorId?: string | null;
  eventType: string;
  reason?: string | null;
  confidence?: number | null;
  sourceHints: string[];
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface WorkspaceStickerLibraryItem {
  _id: string;
  workspaceId: string;
  channel: "telegram" | "viber" | "line";
  providerRef: string;
  platformStickerId: string;
  label: string;
  description?: string;
  emoji?: string;
  providerMeta?: {
    telegram?: {
      fileId: string;
      thumbnailFileId?: string;
      isAnimated?: boolean;
      isVideo?: boolean;
    };
    viber?: {
      previewUrl?: string;
    };
    line?: {
      packageId: string;
      stickerResourceType?: string;
      storeUrl?: string;
      packTitle?: string;
    };
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspaceProfile {
  _id: string;
  name: string;
  slug: string;
  timeZone: string;
  bio: string;
  publicDescription: string;
  publicWebsiteUrl: string;
  publicSupportEmail: string;
  publicSupportPhone: string;
  publicLogoUrl: string;
  publicWelcomeMessage: string;
  publicChatEnabled: boolean;
  websiteChatAvailable: boolean;
  publicChatPagePath: string;
  publicChatPageUrl: string;
  publicPagePath: string;
  publicPageUrl: string;
  websiteChatEntitled: boolean;
  billing: BillingState;
}

export interface PublicWorkspaceProfile {
  _id: string;
  name: string;
  slug: string;
  bio: string;
  publicDescription: string;
  publicWebsiteUrl: string;
  publicSupportEmail: string;
  publicSupportPhone: string;
  publicLogoUrl: string;
  publicWelcomeMessage: string;
  publicChatEnabled: boolean;
  websiteChatAvailable: boolean;
}

export interface PublicWorkspaceChatMessage {
  _id: string;
  direction: "inbound" | "outbound";
  senderType: "customer" | "agent" | "automation" | "ai" | "system";
  kind: MessageKind;
  body: string;
  createdAt: string;
}
