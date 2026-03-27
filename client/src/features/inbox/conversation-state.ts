import { Conversation } from "../../types/models";

export const HUMAN_PENDING_TAG = "human_pending" as const;
export const BOT_ACTIVE_ROUTING_STATE = "bot_active" as const;
export const HUMAN_PENDING_ROUTING_STATE = "human_pending" as const;
export const HUMAN_ACTIVE_ROUTING_STATE = "human_active" as const;
export type InboxHandlingState = "bot" | "pending_human" | "paused" | "expired";

export type InboxAssignmentState = "unassigned" | "mine" | "others";

function getConversationRoutingState(
  conversationOrState?:
    | Pick<Conversation, "routingState">
    | Conversation["routingState"]
    | null
) {
  if (!conversationOrState) {
    return null;
  }

  if (typeof conversationOrState === "string") {
    return conversationOrState;
  }

  return conversationOrState.routingState ?? null;
}

export const HUMAN_HANDOFF_ROUTING_STATES: ReadonlySet<Conversation["routingState"]> = new Set([
  HUMAN_PENDING_ROUTING_STATE,
  HUMAN_ACTIVE_ROUTING_STATE,
]);

export function isHumanHandoffRoutingState(
  routingState?: Conversation["routingState"] | null
) {
  if (!routingState) {
    return false;
  }
  return HUMAN_HANDOFF_ROUTING_STATES.has(routingState);
}

export function hasNeedsHumanTag(tags?: string[] | null) {
  return Array.isArray(tags) && tags.includes(HUMAN_PENDING_TAG);
}

export function isHumanPendingRoutingState(
  routingState?: Conversation["routingState"] | null
) {
  return routingState === HUMAN_PENDING_ROUTING_STATE;
}

export function isHumanActiveRoutingState(
  routingState?: Conversation["routingState"] | null
) {
  return routingState === HUMAN_ACTIVE_ROUTING_STATE;
}

export function isNeedsStaffConversation(
  conversation: Pick<Conversation, "routingState" | "tags" | "currentAttentionItem">
) {
  if (conversation.currentAttentionItem) {
    return conversation.currentAttentionItem.needsHuman;
  }

  const routingState = getConversationRoutingState(conversation);
  if (routingState) {
    return isHumanHandoffRoutingState(routingState);
  }

  return hasNeedsHumanTag(conversation.tags);
}

export function getConversationAssigneeId(
  conversation: Pick<Conversation, "assigneeUserId" | "assignee" | "currentAttentionItem">
) {
  return (
    conversation.currentAttentionItem?.assignedUserId ??
    conversation.assignee?._id ??
    conversation.assigneeUserId ??
    null
  );
}

export function isUnassignedConversation(
  conversation: Pick<Conversation, "assigneeUserId" | "assignee" | "currentAttentionItem">
) {
  return !getConversationAssigneeId(conversation);
}

export function isConversationBotPaused(
  conversation: Pick<
    Conversation,
    "botPauseState" | "botPausedAt" | "botPausedUntil" | "currentAttentionItem"
  >
) {
  if (conversation.botPauseState) {
    return conversation.botPauseState === "active";
  }

  if (conversation.currentAttentionItem?.botPauseState) {
    return conversation.currentAttentionItem.botPauseState === "active";
  }

  if (!conversation.botPausedAt) {
    return false;
  }

  if (!conversation.botPausedUntil) {
    return true;
  }

  return new Date(conversation.botPausedUntil).getTime() > Date.now();
}

export function isConversationBotPauseExpired(
  conversation: Pick<
    Conversation,
    "botPauseState" | "botPausedAt" | "botPausedUntil" | "currentAttentionItem"
  >
) {
  if (conversation.botPauseState) {
    return conversation.botPauseState === "expired";
  }

  if (conversation.currentAttentionItem?.botPauseState) {
    return conversation.currentAttentionItem.botPauseState === "expired";
  }

  return (
    !!conversation.botPausedAt &&
    !!conversation.botPausedUntil &&
    new Date(conversation.botPausedUntil).getTime() <= Date.now()
  );
}

export function getConversationHandlingState(
  conversation: Pick<
    Conversation,
    "routingState" | "tags" | "currentAttentionItem" | "botPauseState" | "botPausedAt"
    | "botPausedUntil"
  >
): InboxHandlingState {
  if (isConversationBotPaused(conversation)) {
    return "paused";
  }

  if (isConversationBotPauseExpired(conversation)) {
    return "expired";
  }

  if (isNeedsStaffConversation(conversation)) {
    return "pending_human";
  }

  return "bot";
}

export function isConversationAssignedToCurrentUser(
  conversation: Pick<Conversation, "assigneeUserId" | "assignee" | "currentAttentionItem">,
  currentUserId?: string | null
) {
  const assigneeId = getConversationAssigneeId(conversation);
  return !!assigneeId && !!currentUserId && assigneeId === currentUserId;
}

export function getConversationAssignmentState(
  conversation: Pick<Conversation, "assigneeUserId" | "assignee" | "currentAttentionItem">,
  currentUserId?: string | null
): InboxAssignmentState {
  const assigneeId = getConversationAssigneeId(conversation);

  if (!assigneeId) {
    return "unassigned";
  }

  if (currentUserId && assigneeId === currentUserId) {
    return "mine";
  }

  return "others";
}

export function getConversationHandlingLabel(
  conversation: Pick<
    Conversation,
    "routingState" | "tags" | "currentAttentionItem" | "botPauseState" | "botPausedAt"
    | "botPausedUntil"
  >
) {
  const handlingState = getConversationHandlingState(conversation);

  if (handlingState === "paused") {
    return "AI paused";
  }

  if (handlingState === "expired") {
    return "Pause expired";
  }

  if (handlingState === "pending_human") {
    return "Pending human";
  }

  return "Bot active";
}

export function getConversationAssignmentLabel(
  conversation: Pick<Conversation, "assigneeUserId" | "assignee" | "currentAttentionItem">,
  currentUserId?: string | null
) {
  const assigneeId = getConversationAssigneeId(conversation);
  const assigneeName = conversation.assignee?.name?.trim() || null;

  if (!assigneeId) {
    return null;
  }

  if (currentUserId && assigneeId === currentUserId) {
    return "Assigned to you";
  }

  return assigneeName ? `Assigned to ${assigneeName}` : "Assigned to staff";
}

export function getConversationActivityLabel(
  conversation: Pick<
    Conversation,
    | "routingState"
    | "tags"
    | "currentAttentionItem"
    | "botPauseState"
    | "botPausedAt"
    | "assigneeUserId"
    | "assignee"
  >,
  currentUserId?: string | null
) {
  const assigneeName = conversation.assignee?.name?.trim() || null;
  const isAssignedToCurrentUser = isConversationAssignedToCurrentUser(
    conversation,
    currentUserId
  );

  if (isConversationBotPaused(conversation)) {
    if (isAssignedToCurrentUser) {
      return "AI paused by you";
    }

    return assigneeName ? `AI paused by ${assigneeName}` : "AI paused";
  }

  if (isConversationBotPauseExpired(conversation)) {
    if (isAssignedToCurrentUser) {
      return "Pause expired";
    }

    return assigneeName ? `Pause expired for ${assigneeName}` : "Pause expired";
  }

  if (isNeedsStaffConversation(conversation)) {
    return "Pending human";
  }

  return getConversationAssignmentLabel(conversation, currentUserId) ?? "Bot active";
}
