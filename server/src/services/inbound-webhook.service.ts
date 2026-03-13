import { adapterRegistry } from "../channels/adapter.registry";
import { CanonicalChannel } from "../channels/types";
import { auditLogService } from "./audit-log.service";
import { channelConnectionService } from "./channel-connection.service";
import { contactService } from "./contact.service";
import { conversationService } from "./conversation.service";
import { messageService } from "./message.service";
import { automationService } from "./automation.service";
import { ForbiddenError, IntegrationNotReadyError } from "../lib/errors";
import { emitRealtimeEvent } from "../lib/realtime";

type HeaderMap = Record<string, string>;

const normalizeHeaders = (headers: Record<string, unknown>): HeaderMap => {
  return Object.entries(headers).reduce<HeaderMap>((acc, [key, value]) => {
    if (typeof value === "string") {
      acc[key.toLowerCase()] = value;
    }
    return acc;
  }, {});
};

class InboundWebhookService {
  async handle(params: {
    channel: CanonicalChannel;
    body: unknown;
    rawBody?: string;
    headers: Record<string, unknown>;
    query: Record<string, string | string[] | undefined>;
  }) {
    const headers = normalizeHeaders(params.headers);
    const connection = await this.resolveConnection(
      params.channel,
      params.body,
      headers,
      params.query
    );

    const adapter = adapterRegistry.get(params.channel);
    if (adapter.verifyWebhook) {
      const isValid = await adapter.verifyWebhook({
        body: params.body,
        rawBody: params.rawBody,
        headers,
        query: params.query,
        connection: {
          externalAccountId: connection.externalAccountId,
          credentials: connection.credentials ?? {},
          webhookConfig: connection.webhookConfig ?? {},
          webhookUrl: connection.webhookUrl,
          webhookVerified: connection.webhookVerified,
          verificationState: connection.verificationState,
        },
      });

      if (!isValid) {
        throw new ForbiddenError("Webhook verification failed");
      }
    }

    await auditLogService.record({
      workspaceId: String(connection.workspaceId),
      actorType: "system",
      eventType: "webhook.received",
      data: {
        channel: params.channel,
        raw: params.body as Record<string, unknown>,
      },
    });

    const normalized = await adapter.parseInbound(params.body, headers);
    const processed = [];

    for (const item of normalized) {
      const message = {
        ...item,
        channel: params.channel,
        channelAccountId: item.channelAccountId ?? connection.externalAccountId,
      };

      const contact = await contactService.upsertFromMessage(
        String(connection.workspaceId),
        message
      );

      const conversation = await conversationService.findOrCreateInbound({
        workspaceId: String(connection.workspaceId),
        connection: {
          channel: connection.channel,
          externalAccountId: connection.externalAccountId,
        },
        message,
        contactId: contact ? String(contact._id) : null,
      });

      const stored = await messageService.createInboundMessage({
        workspaceId: String(connection.workspaceId),
        conversationId: String(conversation._id),
        message,
      });

      if (stored.created) {
        const updatedConversation = await conversationService.applyInboundMessage({
          conversationId: String(conversation._id),
          message: stored.message,
        });

        emitRealtimeEvent("message.received", {
          workspaceId: String(connection.workspaceId),
          conversationId: String(conversation._id),
          messageId: String(stored.message._id),
        });

        emitRealtimeEvent("conversation.updated", {
          workspaceId: String(connection.workspaceId),
          conversationId: String(conversation._id),
          status: updatedConversation?.status ?? conversation.status,
        });

        await automationService.handleInbound({
          workspaceId: String(connection.workspaceId),
          conversationId: String(conversation._id),
          message,
        });
      }

      processed.push({
        conversation,
        message: stored.message,
        created: stored.created,
      });
    }

    await channelConnectionService.markInboundReceived(String(connection._id));

    return {
      connection,
      processed,
    };
  }

  private async resolveConnection(
    channel: CanonicalChannel,
    body: unknown,
    headers: HeaderMap,
    query: Record<string, string | string[] | undefined>
  ) {
    if (channel === "facebook") {
      const payload = body as { entry?: Array<{ id?: string }> };
      const pageId = payload.entry?.[0]?.id;
      if (!pageId) {
        throw new Error("Missing Facebook page id in webhook payload");
      }
      return channelConnectionService.resolveFacebookConnection(pageId);
    }

    if (channel === "telegram") {
      const secret = headers["x-telegram-bot-api-secret-token"];
      if (!secret) {
        throw new Error("Missing Telegram webhook secret");
      }
      return channelConnectionService.resolveTelegramConnection(secret);
    }

    if (channel === "viber") {
      const key = Array.isArray(query.connectionKey)
        ? query.connectionKey[0]
        : query.connectionKey;
      return channelConnectionService.resolveViberConnection(key);
    }

    throw new IntegrationNotReadyError(
      "TikTok webhook resolution is scaffold-only until public business messaging support is verified."
    );
  }
}

export const inboundWebhookService = new InboundWebhookService();
