import axios from "axios";
import { BaseChannelAdapter } from "./base.adapter";
import { CanonicalMessage, ChannelCapabilities } from "./types";

type FacebookWebhook = {
  entry?: Array<{
    id?: string;
    messaging?: Array<{
      sender?: { id: string };
      recipient?: { id: string };
      timestamp?: number;
      message?: {
        mid?: string;
        text?: string;
        quick_reply?: { payload?: string };
        attachments?: Array<{
          type?: string;
          payload?: Record<string, unknown> & {
            url?: string;
            coordinates?: {
              lat?: number;
              long?: number;
            };
          };
        }>;
      };
      postback?: {
        title?: string;
        payload?: string;
      };
    }>;
  }>;
};

export class FacebookAdapter extends BaseChannelAdapter {
  channel = "facebook" as const;

  async verifyWebhook(input: {
    rawBody?: string;
    headers: Record<string, string>;
    connection?: {
      credentials: Record<string, unknown>;
    };
  }) {
    const appSecret = String(input.connection?.credentials.appSecret ?? "");
    if (!appSecret) {
      return true;
    }

    return this.matchesSignature({
      algorithm: "sha256",
      secret: appSecret,
      rawBody: input.rawBody,
      provided: input.headers["x-hub-signature-256"],
      prefix: "sha256=",
    });
  }

  getCapabilities(): ChannelCapabilities {
    return {
      inbound: {
        text: true,
        image: true,
        video: true,
        audio: true,
        file: true,
        location: true,
        contact: false,
        interactive: true,
      },
      outbound: {
        text: true,
        image: false,
        video: false,
        audio: false,
        file: false,
        location: false,
        contact: false,
        interactive: false,
      },
    };
  }

  async parseInbound(reqBody: unknown): Promise<CanonicalMessage[]> {
    const body = reqBody as FacebookWebhook;
    const messages: CanonicalMessage[] = [];

    for (const entry of body.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        if (!event.sender?.id || !event.recipient?.id) {
          continue;
        }

        const base = {
          channel: this.channel,
          channelAccountId: entry.id ?? event.recipient.id,
          direction: "inbound" as const,
          senderType: "customer" as const,
          externalMessageId: event.message?.mid,
          externalChatId: event.sender.id,
          externalSenderId: event.sender.id,
          raw: event,
          occurredAt: event.timestamp ? new Date(event.timestamp) : new Date(),
        };

        if (event.message?.quick_reply?.payload) {
          messages.push({
            ...base,
            kind: "interactive",
            text: {
              body: event.message.text ?? event.message.quick_reply.payload,
              plain: event.message.text ?? event.message.quick_reply.payload,
            },
            interactive: {
              subtype: "quick_reply",
              label: event.message.text,
              value: event.message.quick_reply.payload,
              payload: event.message.quick_reply.payload,
            },
          });
          continue;
        }

        if (event.postback?.payload) {
          messages.push({
            ...base,
            kind: "interactive",
            text: {
              body: event.postback.title ?? event.postback.payload,
              plain: event.postback.title ?? event.postback.payload,
            },
            interactive: {
              subtype: "postback",
              label: event.postback.title,
              value: event.postback.payload,
              payload: event.postback.payload,
            },
          });
          continue;
        }

        if (event.message?.text) {
          messages.push({
            ...base,
            kind: "text",
            text: {
              body: event.message.text,
              plain: event.message.text,
            },
          });
          continue;
        }

        const attachment = event.message?.attachments?.[0];
        if (!attachment) {
          continue;
        }

        if (attachment.type === "image") {
          messages.push({
            ...base,
            kind: "image",
            media: [
              {
                url: attachment.payload?.url,
              },
            ],
          });
          continue;
        }

        if (attachment.type === "video") {
          messages.push({
            ...base,
            kind: "video",
            media: [
              {
                url: attachment.payload?.url,
              },
            ],
          });
          continue;
        }

        if (attachment.type === "audio") {
          messages.push({
            ...base,
            kind: "audio",
            media: [
              {
                url: attachment.payload?.url,
              },
            ],
          });
          continue;
        }

        if (attachment.type === "file") {
          messages.push({
            ...base,
            kind: "file",
            media: [
              {
                url: attachment.payload?.url,
              },
            ],
          });
          continue;
        }

        if (
          attachment.type === "location" &&
          attachment.payload?.coordinates?.lat !== undefined &&
          attachment.payload?.coordinates?.long !== undefined
        ) {
          messages.push({
            ...base,
            kind: "location",
            location: {
              lat: attachment.payload.coordinates.lat,
              lng: attachment.payload.coordinates.long,
            },
          });
          continue;
        }

        messages.push(
          this.buildUnsupportedMessage(base, "Messenger attachment type is not mapped in MVP")
        );
      }
    }

    return messages;
  }

  async sendOutbound(input: {
    conversation: { externalChatId: string };
    message: CanonicalMessage;
    connection: {
      credentials: Record<string, unknown>;
      externalAccountId: string;
      webhookConfig: Record<string, unknown>;
    };
  }) {
    const request = {
      messaging_type: "RESPONSE",
      recipient: { id: input.conversation.externalChatId },
      message: {
        text: input.message.text?.body ?? "",
      },
    };

    const pageAccessToken = String(input.connection.credentials.pageAccessToken ?? "");
    if (!pageAccessToken) {
      return {
        status: "failed" as const,
        error: "Missing Facebook page access token",
        request,
      };
    }

    try {
      const response = await axios.post(
        "https://graph.facebook.com/v19.0/me/messages",
        request,
        {
          params: {
            access_token: pageAccessToken,
          },
        }
      );

      return {
        externalMessageId: String(response.data?.message_id ?? ""),
        status: "sent" as const,
        raw: response.data,
        request,
      };
    } catch (error) {
      return this.buildFailedSendResult(error, request);
    }
  }
}
