import { useEffect, useState } from "react";
import {
  Contact,
  Conversation,
  ConversationPresenceEntry,
} from "../../types/models";
import { apiRequest } from "../../services/api";
import { ChannelBadge } from "./ChannelBadge";

type UpdateConversationResponse =
  | Conversation
  | { conversation: Conversation };

function isConversation(value: unknown): value is Conversation {
  return (
    typeof value === "object" &&
    value !== null &&
    "_id" in value &&
    "workspaceId" in value &&
    "channel" in value &&
    "status" in value &&
    "aiState" in value
  );
}

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
  iconOnly?: boolean;
}) {
  const { children, onClick, disabled, variant = "secondary", title, iconOnly = false } = props;

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
      className={`inline-flex items-center justify-center rounded-lg text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${iconOnly ? "h-8 w-8" : "px-2.5 py-1.5"} ${styles}`}
    >
      {children}
    </button>
  );
}

const humanReadableAIState: Record<string, string> = {
  idle: "Bot Active",
  suggesting: "Suggesting",
  auto_replied: "Auto Replied",
  needs_human: "Needs Staff",
  human_requested: "Staff Requested",
  human_active: "Staff Active",
};

const fieldClassName =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

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

function formatViewerName(
  entry: ConversationPresenceEntry,
  currentUserId?: string | null
) {
  return entry.userId === currentUserId ? "You" : entry.userName;
}

function getConversationOwnerLabel(
  aiState: Conversation["aiState"],
  assigneeName: string | null
) {
  if (aiState === "human_active") {
    return assigneeName ?? "Human";
  }

  return null;
}

function getVisibleConversationTags(
  tags: string[],
  aiState: Conversation["aiState"]
) {
  return tags.filter(
    (tag) =>
      !(
        tag === "needs_human" &&
        (aiState === "needs_human" ||
          aiState === "human_requested" ||
          aiState === "human_active")
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
  const aiState = conversation.aiState ?? "idle";
  const assigneeName = conversation.assignee?.name ?? null;
  const ownerLabel = getConversationOwnerLabel(aiState, assigneeName);
  const visibleConversationTags = getVisibleConversationTags(tags, aiState);
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

  const patchConversation = async (patch: Record<string, unknown>) => {
    setIsSubmitting(true);
    setActionError(null);

    try {
      const data = await apiRequest<UpdateConversationResponse>(
        `/api/conversations/${conversation._id}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        }
      );

      let updatedConversation: Conversation | null = null;

      if (isConversation(data)) {
        updatedConversation = data;
      } else if (
        typeof data === "object" &&
        data !== null &&
        "conversation" in data &&
        isConversation((data as { conversation?: unknown }).conversation)
      ) {
        updatedConversation = (data as { conversation: Conversation }).conversation;
      }

      if (!updatedConversation) {
        throw new Error("Unexpected conversation response");
      }

      onConversationUpdated?.(updatedConversation);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to update conversation"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTakeOver = async () => {
    await patchConversation({
      status: "pending",
      aiState: "human_active",
      assigneeUserId: currentUserId ?? null,
      tags: Array.from(new Set([...(conversation.tags ?? []), "needs_human"])),
    });
  };

  const handleReturnToBot = async () => {
    await patchConversation({
      status: "open",
      aiState: "idle",
      assigneeUserId: null,
      tags: (conversation.tags ?? []).filter((tag) => tag !== "needs_human"),
    });
  };

  const handleRequestHuman = async () => {
    await patchConversation({
      status: "pending",
      aiState: "human_requested",
      tags: Array.from(new Set([...(conversation.tags ?? []), "needs_human"])),
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
    (aiState === "human_active" ||
      aiState === "human_requested" ||
      aiState === "needs_human") &&
    !isSubmitting;

  const nextAction = (() => {
    if (aiState === "human_active") {
      return {
        label: isSubmitting ? "Updating..." : "Resume Bot",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 7H5v4" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 11a7 7 0 1 0 2.05-4.95L5 7"
            />
          </svg>
        ),
        variant: "secondary" as const,
        onClick: handleReturnToBot,
        disabled: !canReturnToBot,
      };
    }

    if (aiState === "needs_human" || aiState === "human_requested") {
      return {
        label: isSubmitting ? "Updating..." : "Take Ownership",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
          </svg>
        ),
        variant: "primary" as const,
        onClick: handleTakeOver,
        disabled: isSubmitting,
      };
    }

    return {
      label: isSubmitting ? "Updating..." : "Request Staff Review",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="h-3.5 w-3.5"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.5 9.5 3.5 3.5 3.5-3.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
        </svg>
      ),
      variant: "danger" as const,
      onClick: handleRequestHuman,
      disabled: isSubmitting,
    };
  })();

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
            <Pill>{humanReadableAIState[aiState] ?? aiState}</Pill>
            <Pill>Status: {formatConversationStatus(conversation.status)}</Pill>
            {ownerLabel ? <Pill>Owner: {ownerLabel}</Pill> : null}
            {visibleConversationTags.map((tag) => (
              <Pill key={tag}>{tag}</Pill>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionButton
              variant={nextAction.variant}
              onClick={nextAction.onClick}
              disabled={nextAction.disabled}
              title={nextAction.label}
              iconOnly={!isSubmitting}
            >
              {isSubmitting ? nextAction.label : nextAction.icon}
            </ActionButton>
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
