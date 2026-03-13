import {
  MessageDeliveryModel,
  MessageDocument,
  MessageModel,
} from "../models";
import { CanonicalMessage, SendOutboundResult } from "../channels/types";

class MessageService {
  async createInboundMessage(params: {
    workspaceId: string;
    conversationId: string;
    message: CanonicalMessage;
  }): Promise<{ message: MessageDocument; created: boolean }> {
    if (params.message.externalMessageId) {
      const existing = await MessageModel.findOne({
        workspaceId: params.workspaceId,
        channel: params.message.channel,
        channelAccountId: params.message.channelAccountId,
        externalMessageId: params.message.externalMessageId,
      });

      if (existing) {
        return { message: existing, created: false };
      }
    }

    const created = await MessageModel.create({
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      channel: params.message.channel,
      channelAccountId: params.message.channelAccountId,
      externalMessageId: params.message.externalMessageId ?? null,
      externalChatId: params.message.externalChatId,
      externalSenderId: params.message.externalSenderId ?? null,
      direction: params.message.direction,
      senderType: params.message.senderType,
      kind: params.message.kind,
      text: params.message.text,
      media: params.message.media ?? [],
      location: params.message.location,
      contact: params.message.contact,
      interactive: params.message.interactive,
      unsupportedReason: params.message.unsupportedReason ?? null,
      status: "received",
      raw: params.message.raw,
      meta: params.message.meta ?? {},
      createdAt: params.message.occurredAt,
      updatedAt: params.message.occurredAt,
    });

    return { message: created, created: true };
  }

  async createOutboundQueuedMessage(params: {
    workspaceId: string;
    conversationId: string;
    message: CanonicalMessage;
  }) {
    return MessageModel.create({
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      channel: params.message.channel,
      channelAccountId: params.message.channelAccountId,
      externalMessageId: null,
      externalChatId: params.message.externalChatId,
      externalSenderId: params.message.externalSenderId ?? null,
      direction: params.message.direction,
      senderType: params.message.senderType,
      kind: params.message.kind,
      text: params.message.text,
      media: params.message.media ?? [],
      location: params.message.location,
      contact: params.message.contact,
      interactive: params.message.interactive,
      unsupportedReason: params.message.unsupportedReason ?? null,
      status: "queued",
      raw: params.message.raw,
      meta: params.message.meta ?? {},
      createdAt: params.message.occurredAt ?? new Date(),
      updatedAt: params.message.occurredAt ?? new Date(),
    });
  }

  async finalizeOutboundMessage(
    messageId: string,
    sendResult: SendOutboundResult
  ) {
    return MessageModel.findByIdAndUpdate(
      messageId,
      {
        $set: {
          externalMessageId: sendResult.externalMessageId ?? null,
          status:
            sendResult.status === "sent"
              ? "sent"
              : sendResult.status === "queued"
                ? "queued"
                : "failed",
          raw: {
            request: sendResult.request,
            response: sendResult.raw,
          },
          meta: {
            deliveryError: sendResult.error ?? null,
          },
        },
      },
      { new: true }
    );
  }

  async createDeliveryRecord(params: {
    workspaceId: string;
    conversationId: string;
    messageId: string;
    channelConnectionId: string;
    channel: string;
    sendResult: SendOutboundResult;
  }) {
    return MessageDeliveryModel.create({
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      channelConnectionId: params.channelConnectionId,
      channel: params.channel,
      externalMessageId: params.sendResult.externalMessageId ?? null,
      status:
        params.sendResult.status === "sent"
          ? "sent"
          : params.sendResult.status === "queued"
            ? "queued"
            : "failed",
      error: params.sendResult.error ?? null,
      providerResponse: params.sendResult.raw ?? {},
      request: params.sendResult.request ?? {},
    });
  }

  async listByConversation(conversationId: string) {
    const messages = await MessageModel.find({ conversationId }).sort({ createdAt: 1 });
    const messageIds = messages.map((message) => message._id);
    const deliveries = messageIds.length
      ? await MessageDeliveryModel.find({ messageId: { $in: messageIds } }).sort({
        createdAt: -1,
      })
      : [];

    const latestDeliveryByMessageId = new Map<string, (typeof deliveries)[number]>();
    for (const delivery of deliveries) {
      const messageId = String(delivery.messageId);
      if (!latestDeliveryByMessageId.has(messageId)) {
        latestDeliveryByMessageId.set(messageId, delivery);
      }
    }

    return messages.map((message) => ({
      ...message.toObject(),
      delivery: latestDeliveryByMessageId.get(String(message._id))?.toObject() ?? null,
    }));
  }
}

export const messageService = new MessageService();
