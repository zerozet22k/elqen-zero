import { randomUUID } from "crypto";
import { adapterRegistry } from "../channels/adapter.registry";
import { CanonicalMessage, OutboundCommand } from "../channels/types";
import { CapabilityError, NotFoundError, ValidationError } from "../lib/errors";
import { auditLogService } from "./audit-log.service";
import { channelConnectionService } from "./channel-connection.service";
import { conversationService } from "./conversation.service";
import { messageService } from "./message.service";
import { emitRealtimeEvent } from "../lib/realtime";

class OutboundMessageService {
  async send(params: {
    conversationId: string;
    command: OutboundCommand;
    source?: string;
  }) {
    const conversation = await conversationService.getById(params.conversationId);
    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    const connection = await channelConnectionService.getConnectionByWorkspaceAndChannel({
      workspaceId: String(conversation.workspaceId),
      channel: conversation.channel,
      externalAccountId: conversation.channelAccountId,
      requireActive: false,
    });

    if (connection.status !== "active") {
      throw new ValidationError(
        `Channel connection is ${connection.status}. Complete provider setup before sending.`
      );
    }

    const adapter = adapterRegistry.get(conversation.channel);
    const capabilities = adapter.getCapabilities();
    if (!capabilities.outbound[params.command.kind]) {
      throw new CapabilityError(
        `Channel ${conversation.channel} does not support outbound kind ${params.command.kind} in the current adapter.`
      );
    }

    const canonicalMessage: CanonicalMessage = {
      channel: conversation.channel,
      channelAccountId: conversation.channelAccountId,
      externalChatId: conversation.externalChatId,
      externalSenderId: undefined,
      direction: "outbound",
      senderType: params.command.senderType,
      kind: params.command.kind,
      text: params.command.text,
      media: params.command.media,
      occurredAt: params.command.occurredAt ?? new Date(),
      raw: {
        queuedAt: new Date().toISOString(),
        correlationId: randomUUID(),
      },
      meta: {
        source: params.source ?? "api",
        ...(params.command.meta ?? {}),
      },
    };

    const queuedMessage = await messageService.createOutboundQueuedMessage({
      workspaceId: String(conversation.workspaceId),
      conversationId: String(conversation._id),
      message: canonicalMessage,
    });

    const sendResult = await adapter.sendOutbound({
      conversation: {
        externalChatId: conversation.externalChatId,
        channel: conversation.channel,
      },
      message: canonicalMessage,
      connection: {
        externalAccountId: connection.externalAccountId,
        credentials: connection.credentials ?? {},
        webhookConfig: connection.webhookConfig ?? {},
      },
    });

    const finalizedMessage = await messageService.finalizeOutboundMessage(
      String(queuedMessage._id),
      sendResult
    );

    const delivery = await messageService.createDeliveryRecord({
      workspaceId: String(conversation.workspaceId),
      conversationId: String(conversation._id),
      messageId: String(queuedMessage._id),
      channelConnectionId: String(connection._id),
      channel: conversation.channel,
      sendResult,
    });

    if (finalizedMessage) {
      const updatedConversation = await conversationService.applyOutboundMessage({
        conversationId: String(conversation._id),
        message: finalizedMessage,
      });

      emitRealtimeEvent(
        sendResult.status === "failed" ? "message.failed" : "message.sent",
        {
          workspaceId: String(conversation.workspaceId),
          conversationId: String(conversation._id),
          messageId: String(finalizedMessage._id),
          deliveryStatus: sendResult.status,
          error: sendResult.error,
        }
      );

      emitRealtimeEvent("conversation.updated", {
        workspaceId: String(conversation.workspaceId),
        conversationId: String(conversation._id),
        status: updatedConversation?.status ?? conversation.status,
      });
    }

    if (sendResult.status === "failed") {
      await channelConnectionService.markConnectionError(
        String(connection._id),
        sendResult.error ?? "Provider send failed"
      );
    } else {
      await channelConnectionService.markOutboundSent(String(connection._id));
    }

    await auditLogService.record({
      workspaceId: String(conversation.workspaceId),
      conversationId: String(conversation._id),
      messageId: String(queuedMessage._id),
      actorType: params.command.senderType,
      eventType:
        sendResult.status === "failed"
          ? "message.outbound.failed"
          : "message.outbound.sent",
      reason: sendResult.error,
      data: {
        request: sendResult.request,
        raw: sendResult.raw,
      },
    });

    return {
      message: finalizedMessage ?? queuedMessage,
      delivery,
    };
  }
}

export const outboundMessageService = new OutboundMessageService();
