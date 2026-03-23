import { ChannelConnection, Conversation } from "../../types/models";

export function isConnectionUsableForSending(connection?: ChannelConnection | null) {
  if (!connection) {
    return false;
  }

  return (
    connection.status === "active" ||
    (connection.status === "error" && connection.verificationState === "verified")
  );
}

export function getComposerDisabledReason(params: {
  selectedConversation?: Conversation | null;
  selectedConnection?: ChannelConnection | null;
  supportedChannels: Record<Conversation["channel"], boolean>;
}) {
  if (!params.selectedConversation) {
    return "Select a conversation to send a reply.";
  }

  if (params.supportedChannels[params.selectedConversation.channel] === false) {
    return `${params.selectedConversation.channel} is disabled in AI Settings.`;
  }

  if (!params.selectedConnection) {
    return "No stored channel connection matches this conversation.";
  }

  if (!isConnectionUsableForSending(params.selectedConnection)) {
    return (
      params.selectedConnection.lastError ||
      `Connection is ${params.selectedConnection.status}. Sending is blocked until the provider setup is active.`
    );
  }

  return undefined;
}

export function shouldPersistSendError(params: {
  message: string;
  selectedConnection?: ChannelConnection | null;
}) {
  if (!params.message.trim()) {
    return false;
  }

  if (!isConnectionUsableForSending(params.selectedConnection)) {
    return true;
  }

  return /disabled|blocked|no stored channel connection|provider setup|unsupported/i.test(
    params.message
  );
}
