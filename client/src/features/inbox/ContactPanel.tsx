import { useEffect, useState } from "react";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import {
  AttentionItem,
  Contact,
  Conversation,
  ConversationPresenceEntry,
} from "../../types/models";
import { apiRequest } from "../../services/api";
import { ChannelBadge } from "./ChannelBadge";
import {
  BOT_ACTIVE_ROUTING_STATE,
  getConversationAssignmentLabel,
  getConversationHandlingState,
  getConversationHandlingLabel,
  HUMAN_PENDING_TAG,
  isHumanHandoffRoutingState,
} from "./conversation-state";

type AttentionItemsResponse = {
  items: AttentionItem[];
};

type AttentionItemActionResponse = {
  conversation: Conversation;
  currentAttentionItem?: AttentionItem | null;
  attentionItem?: AttentionItem | null;
  items?: AttentionItem[];
};

type InfoBlockProps = {
  label: string;
  children: React.ReactNode;
};

function InfoBlock({ label, children }: InfoBlockProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <div className="mt-2.5 text-xs text-slate-900">{children}</div>
    </article>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
      {children}
    </span>
  );
}

function ActionButton(props: {
  children: React.ReactNode;
  onClick: () => Promise<void> | void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  title?: string;
}) {
  const { children, onClick, disabled, variant = "secondary", title } = props;

  const styles =
    variant === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : variant === "danger"
        ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100";

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles}`}
    >
      {children}
    </button>
  );
}

const fieldClassName =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

const humanReadableAttentionState: Record<AttentionItem["state"], string> = {
  open: "Open",
  bot_replied: "Bot Replied",
  awaiting_human: "Awaiting Human",
  human_replied: "Human Replied",
  closed: "Closed",
};

const humanReadableNeedsHumanReason: Record<NonNullable<AttentionItem["needsHumanReason"]>, string> = {
  low_confidence: "Low confidence",
  manual_request: "Manual request",
  customer_requested_human: "Customer requested human",
  policy_block: "Policy block",
  bot_failure: "Bot failure",
  after_hours: "After hours",
  other: "Other",
};

const humanReadableResolutionType: Record<NonNullable<AttentionItem["resolutionType"]>, string> = {
  bot_reply: "Resolved by bot reply",
  human_reply: "Resolved by human reply",
  auto_ack_only: "Acknowledgement only",
  ignored: "Returned to bot",
  merged_into_newer_item: "Merged into newer item",
};

function serializePhones(phones: string[]) {
  return phones.join("\n");
}

function parsePhoneDraft(value: string) {
  return [
    ...new Set(
      value
        .split(/\r?\n|,/)
        .map((item) => item.replace(/\s+/g, " ").trim())
        .filter(Boolean)
    ),
  ];
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function getAttentionSummary(item: AttentionItem) {
  if (item.needsHuman) {
    return item.needsHumanReason
      ? humanReadableNeedsHumanReason[item.needsHumanReason]
      : "Needs human review";
  }

  if (item.resolutionType) {
    return humanReadableResolutionType[item.resolutionType];
  }

  return humanReadableAttentionState[item.state];
}

function formatViewerName(
  entry: ConversationPresenceEntry,
  currentUserId?: string | null
) {
  return entry.userId === currentUserId ? "You" : entry.userName;
}

function getVisibleConversationTags(
  tags: string[],
  routingState: Conversation["routingState"]
) {
  return tags.filter(
    (tag) =>
      !(
        tag === HUMAN_PENDING_TAG &&
        isHumanHandoffRoutingState(routingState)
      )
  );
}

function formatConversationStatus(status: Conversation["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getIdentityOpenUrl(identity: Contact["channelIdentities"][number]) {
  if (identity.channel === "telegram" && identity.username?.trim()) {
    return `https://t.me/${identity.username.trim()}`;
  }

  return null;
}

function getIdentityActionLabel(identity: Contact["channelIdentities"][number]) {
  if (identity.channel === "telegram") {
    return "Open in Telegram";
  }

  if (identity.channel === "viber") {
    return "Copy Viber ID";
  }

  if (identity.channel === "facebook") {
    return "Copy Facebook ID";
  }

  if (identity.channel === "instagram") {
    return "Copy Instagram ID";
  }

  return "Copy user ID";
}

function ActionLabel(props: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  const { children, icon } = props;
  return (
    <>
      {icon}
      <span>{children}</span>
    </>
  );
}

function fallbackCopyText(value: string) {
  if (typeof document === "undefined") {
    return false;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "true");
  input.style.position = "absolute";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(input);
  }
}

export function ContactPanel(props: {
  contact: Contact | null;
  conversation: Conversation | null;
  currentUserId?: string | null;
  presence?: ConversationPresenceEntry[];
  onConversationUpdated?: (conversation: Conversation) => void;
  onContactUpdated?: (contact: Contact) => void;
}) {
  const {
    contact,
    conversation,
    currentUserId,
    presence = [],
    onConversationUpdated,
    onContactUpdated,
  } = props;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [identityNotice, setIdentityNotice] = useState<string | null>(null);
  const [draftPhones, setDraftPhones] = useState("");
  const [draftDeliveryAddress, setDraftDeliveryAddress] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftAiNotes, setDraftAiNotes] = useState("");
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [isLoadingAttentionItems, setIsLoadingAttentionItems] = useState(false);

  useEffect(() => {
    setDraftPhones(serializePhones(contact?.phones ?? []));
    setDraftDeliveryAddress(contact?.deliveryAddress ?? "");
    setDraftNotes(contact?.notes ?? "");
    setDraftAiNotes(contact?.aiNotes ?? "");
    setProfileError(null);
    setProfileNotice(null);
    setIdentityNotice(null);
  }, [contact]);

  useEffect(() => {
    if (!identityNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIdentityNotice(null);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [identityNotice]);

  useEffect(() => {
    if (!conversation?._id) {
      setAttentionItems([]);
      return;
    }

    let cancelled = false;
    setIsLoadingAttentionItems(true);

    void apiRequest<AttentionItemsResponse>(
      `/api/conversations/${conversation._id}/attention-items`
    )
      .then((response) => {
        if (!cancelled) {
          setAttentionItems(response.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAttentionItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingAttentionItems(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [conversation?._id]);

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <div>
          <p className="text-sm font-medium text-slate-900">No contact selected</p>
          <p className="mt-1 text-sm text-slate-500">
            Select a conversation to inspect the customer profile.
          </p>
        </div>
      </div>
    );
  }

  const identities = contact?.channelIdentities ?? [];
  const tags = conversation.tags ?? [];
  const routingState = conversation.routingState ?? BOT_ACTIVE_ROUTING_STATE;
  const handlingState = getConversationHandlingState(conversation);
  const handlingLabel = getConversationHandlingLabel(conversation);
  const assignmentLabel = getConversationAssignmentLabel(conversation, currentUserId);
  const visibleConversationTags = getVisibleConversationTags(tags, routingState);
  const primaryIdentity =
    identities.find((identity) => identity.channel === conversation.channel) ??
    identities[0] ??
    null;
  const activeViewers = presence;
  const activeComposers = activeViewers.filter((entry) => entry.isComposing);

  const handleCopyIdentity = async (value: string, label: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      } else if (!fallbackCopyText(value)) {
        throw new Error("copy-unavailable");
      }
      setIdentityNotice(`${label} copied.`);
    } catch {
      setIdentityNotice("Copy failed.");
    }
  };

  const currentAttentionItemId =
    conversation.currentAttentionItem?._id ?? conversation.currentAttentionItemId ?? null;

  const applyAttentionActionResponse = (response: AttentionItemActionResponse) => {
    const nextCurrentAttentionItem = response.currentAttentionItem ?? null;
    const updatedConversation: Conversation = {
      ...response.conversation,
      currentAttentionItem: nextCurrentAttentionItem,
      currentAttentionItemId: nextCurrentAttentionItem?._id ?? null,
    };

    onConversationUpdated?.(updatedConversation);
    setAttentionItems(response.items ?? []);
  };

  const runAttentionAction = async (params: {
    actionPath: string;
    fallbackMessage: string;
  }) => {
    setIsSubmitting(true);
    setActionError(null);

    try {
      const response = await apiRequest<AttentionItemActionResponse>(params.actionPath, {
        method: "POST",
      });
      applyAttentionActionResponse(response);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : params.fallbackMessage
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTakeOver = async () => {
    await runAttentionAction({
      actionPath: `/api/conversations/${conversation._id}/pause-bot`,
      fallbackMessage: "Failed to pause AI",
    });
  };

  const handleReturnToBot = async () => {
    await runAttentionAction({
      actionPath: `/api/conversations/${conversation._id}/resume-bot`,
      fallbackMessage: "Failed to return conversation to bot",
    });
  };

  const handleRequestHuman = async () => {
    await runAttentionAction({
      actionPath: `/api/conversations/${conversation._id}/request-human`,
      fallbackMessage: "Failed to hand off to staff",
    });
  };

  const handleSaveProfile = async () => {
    if (!contact?._id) {
      return;
    }

    setIsSavingProfile(true);
    setProfileError(null);
    setProfileNotice(null);

    try {
      const response = await apiRequest<{ contact: Contact }>(`/api/contacts/${contact._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          phones: parsePhoneDraft(draftPhones),
          deliveryAddress: draftDeliveryAddress,
          notes: draftNotes,
          aiNotes: draftAiNotes,
        }),
      });

      onContactUpdated?.(response.contact);
      setProfileNotice("Customer profile saved.");
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Failed to save customer profile"
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const canReturnToBot =
    (handlingState === "paused" || handlingState === "expired") && !isSubmitting;
  const primaryAction = (() => {
    if (handlingState === "paused" || handlingState === "expired") {
      return {
        label: isSubmitting ? "Updating..." : "Extend 1h",
        icon: <ScheduleRoundedIcon className="h-3.5 w-3.5" aria-hidden="true" />,
        variant: "primary" as const,
        onClick: handleTakeOver,
        disabled: isSubmitting,
      };
    }

    if (handlingState === "bot") {
      return {
        label: isSubmitting ? "Updating..." : "Pause 1h",
        icon: <ScheduleRoundedIcon className="h-3.5 w-3.5" aria-hidden="true" />,
        variant: "primary" as const,
        onClick: handleTakeOver,
        disabled: isSubmitting,
      };
    }

    if (handlingState === "pending_human") {
      return {
        label: isSubmitting ? "Updating..." : "Pause 1h",
        icon: <ScheduleRoundedIcon className="h-3.5 w-3.5" aria-hidden="true" />,
        variant: "primary" as const,
        onClick: handleTakeOver,
        disabled: isSubmitting,
      };
    }

    return {
      label: isSubmitting ? "Updating..." : "Hand Off",
      icon: <SupportAgentRoundedIcon className="h-3.5 w-3.5" aria-hidden="true" />,
      variant: "danger" as const,
      onClick: handleRequestHuman,
      disabled: isSubmitting,
    };
  })();
  const secondaryAction =
    handlingState === "paused" || handlingState === "expired"
      ? {
          label: isSubmitting ? "Updating..." : "Resume",
          icon: <AutorenewRoundedIcon className="h-3.5 w-3.5" aria-hidden="true" />,
          variant: "secondary" as const,
          onClick: handleReturnToBot,
          disabled: !canReturnToBot,
        }
      : handlingState === "bot"
        ? {
          label: isSubmitting ? "Updating..." : "Hand Off",
          icon: <SupportAgentRoundedIcon className="h-3.5 w-3.5" aria-hidden="true" />,
            variant: "danger" as const,
            onClick: handleRequestHuman,
            disabled: isSubmitting,
          }
      : null;

  const canSaveProfile = !!contact?._id && !isSavingProfile;

  return (
    <div className="space-y-3">
      <InfoBlock label="User">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="min-w-0 truncate text-sm font-semibold text-slate-900">
              {contact?.primaryName ?? conversation.contactName ?? "Unknown contact"}
            </h4>

            <div className="flex items-center gap-1.5">
              <ChannelBadge channel={conversation.channel} />
              {primaryIdentity ? (
                getIdentityOpenUrl(primaryIdentity) ? (
                  <a
                    href={getIdentityOpenUrl(primaryIdentity) ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
                  >
                    {getIdentityActionLabel(primaryIdentity)}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyIdentity(
                        primaryIdentity.externalUserId,
                        getIdentityActionLabel(primaryIdentity)
                      )
                    }
                    className="inline-flex items-center justify-center rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
                  >
                    {getIdentityActionLabel(primaryIdentity)}
                  </button>
                )
              ) : null}
            </div>
          </div>

          {primaryIdentity ? (
            <>
              {primaryIdentity.displayName &&
              primaryIdentity.displayName !==
                (contact?.primaryName ?? conversation.contactName ?? "") ? (
                <p className="truncate text-[11px] text-slate-500">
                  {primaryIdentity.displayName}
                </p>
              ) : null}
              {identityNotice ? (
                <p className="text-[11px] text-slate-500">{identityNotice}</p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-slate-500">No identity details yet</p>
          )}
        </div>
      </InfoBlock>

      <InfoBlock label="Chat Control">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill>Bot: {handlingLabel}</Pill>
            <Pill>Status: {formatConversationStatus(conversation.status)}</Pill>
            {assignmentLabel ? <Pill>{assignmentLabel}</Pill> : null}
            {visibleConversationTags.map((tag) => (
              <Pill key={tag}>{tag}</Pill>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ActionButton
              variant={primaryAction.variant}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              title={primaryAction.label}
            >
              <ActionLabel icon={primaryAction.icon}>{primaryAction.label}</ActionLabel>
            </ActionButton>
            {secondaryAction ? (
              <ActionButton
                variant={secondaryAction.variant}
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
                title={secondaryAction.label}
              >
                <ActionLabel icon={secondaryAction.icon}>{secondaryAction.label}</ActionLabel>
              </ActionButton>
            ) : null}
          </div>

          {actionError ? (
            <p className="text-sm text-red-600">{actionError}</p>
          ) : null}

          <div className="space-y-2 border-t border-slate-200 pt-2.5">
            {activeViewers.length ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Viewers
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeViewers.map((entry) => (
                    <Pill key={`${entry.userId}-${entry.userName}`}>
                      {formatViewerName(entry, currentUserId)}
                      {entry.isComposing ? " (typing)" : ""}
                    </Pill>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No teammates are viewing this chat right now.
              </p>
            )}

            {activeComposers.length ? (
              <p className="text-[11px] text-slate-600">
                Typing now: {activeComposers.map((entry) => formatViewerName(entry, currentUserId)).join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      </InfoBlock>

      <InfoBlock label="Attention">
        <div className="space-y-2.5">
          {isLoadingAttentionItems ? (
            <p className="text-xs text-slate-500">Loading attention history...</p>
          ) : attentionItems.length === 0 ? (
            <p className="text-xs text-slate-500">
              No explicit attention items recorded for this conversation yet.
            </p>
          ) : (
            <div className="space-y-2">
              {attentionItems.map((item) => {
                const openedAt = formatDateTime(item.openedAt);
                const resolvedAt = formatDateTime(item.resolvedAt);
                const isCurrent = item._id === currentAttentionItemId;

                return (
                  <article
                    key={item._id}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill>{humanReadableAttentionState[item.state]}</Pill>
                      {item.needsHuman ? <Pill>Needs human</Pill> : null}
                      {isCurrent ? <Pill>Current</Pill> : null}
                    </div>

                    <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                      <p>{getAttentionSummary(item)}</p>
                      <p>Inbound messages: {item.openedByInboundMessageIds.length}</p>
                      {openedAt ? <p>Opened: {openedAt}</p> : null}
                      {resolvedAt ? <p>Resolved: {resolvedAt}</p> : null}
                      {item.botPausedUntil ? (
                        <p>Bot pause until: {formatDateTime(item.botPausedUntil)}</p>
                      ) : null}
                      {item.assignedUserId ? <p>Assigned user: {item.assignedUserId}</p> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </InfoBlock>

      <InfoBlock label="Customer Profile">
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Keep profile details and reusable notes here for human follow-up and AI context.
          </p>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Phone numbers
            </label>
            <textarea
              value={draftPhones}
              onChange={(event) => setDraftPhones(event.target.value)}
              rows={2}
              placeholder="One phone number per line"
              className={fieldClassName}
              disabled={!contact?._id || isSavingProfile}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Delivery address
            </label>
            <textarea
              value={draftDeliveryAddress}
              onChange={(event) => setDraftDeliveryAddress(event.target.value)}
              rows={2}
              placeholder="Customer delivery address or drop-off details"
              className={fieldClassName}
              disabled={!contact?._id || isSavingProfile}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Team notes
            </label>
            <textarea
              value={draftNotes}
              onChange={(event) => setDraftNotes(event.target.value)}
              rows={3}
              placeholder="Internal notes for staff"
              className={fieldClassName}
              disabled={!contact?._id || isSavingProfile}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              AI memory
            </label>
            <textarea
              value={draftAiNotes}
              onChange={(event) => setDraftAiNotes(event.target.value)}
              rows={3}
              placeholder="Short reusable customer memory for AI"
              className={fieldClassName}
              disabled={!contact?._id || isSavingProfile}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <ActionButton
              variant="primary"
              onClick={handleSaveProfile}
              disabled={!canSaveProfile}
            >
              {isSavingProfile ? "Saving..." : "Save profile"}
            </ActionButton>
            {profileNotice ? (
              <p className="text-xs text-emerald-700">{profileNotice}</p>
            ) : null}
          </div>

          {profileError ? (
            <p className="text-xs text-red-600">{profileError}</p>
          ) : null}
        </div>
      </InfoBlock>

    </div>
  );
}
