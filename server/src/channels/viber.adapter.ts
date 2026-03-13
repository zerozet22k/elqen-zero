import axios from "axios";
import { BaseChannelAdapter } from "./base.adapter";
import { CanonicalMessage, ChannelCapabilities } from "./types";

type ViberPayload = {
  event?: string;
  timestamp?: number;
  message_token?: string | number;
  sender?: {
    id: string;
    name?: string;
    avatar?: string;
  };
  message?: {
    type?: string;
    text?: string;
    media?: string;
    thumbnail?: string;
    duration?: number;
    size?: number;
    file_name?: string;
    location?: {
      lat: number;
      lon: number;
    };
    contact?: {
      name?: string;
      phone_number?: string;
    };
  };
  user?: {
    id: string;
    name?: string;
    avatar?: string;
  };
};

export class ViberAdapter extends BaseChannelAdapter {
  channel = "viber" as const;

  async verifyWebhook(input: {
    rawBody?: string;
    headers: Record<string, string>;
    connection?: {
      credentials: Record<string, unknown>;
    };
  }) {
    return this.matchesSignature({
      algorithm: "sha256",
      secret: String(input.connection?.credentials.authToken ?? ""),
      rawBody: input.rawBody,
      provided: input.headers["x-viber-content-signature"],
    });
  }

  getCapabilities(): ChannelCapabilities {
    return {
      inbound: {
        text: true,
        image: true,
        video: true,
        audio: false,
        file: true,
        location: true,
        contact: true,
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
    const body = reqBody as ViberPayload;
    const sender = body.sender ?? body.user;
    if (!sender?.id) {
      return [];
    }

    const base = {
      channel: this.channel,
      direction: "inbound" as const,
      senderType: body.event === "conversation_started" ? ("system" as const) : ("customer" as const),
      externalMessageId: body.message_token ? String(body.message_token) : undefined,
      externalChatId: sender.id,
      externalSenderId: sender.id,
      senderProfile: {
        displayName: sender.name,
        avatar: sender.avatar,
      },
      raw: body,
      occurredAt: body.timestamp ? new Date(body.timestamp) : new Date(),
    };

    if (body.event === "conversation_started") {
      return [
        {
          ...base,
          kind: "system",
          text: {
            body: `${sender.name ?? "Customer"} started a Viber conversation`,
            plain: `${sender.name ?? "Customer"} started a Viber conversation`,
          },
        },
      ];
    }

    const message = body.message;
    if (!message) {
      return [];
    }

    if (message.type === "text" && message.text) {
      return [
        {
          ...base,
          senderType: "customer",
          kind: "text",
          text: {
            body: message.text,
            plain: message.text,
          },
        },
      ];
    }

    if (message.type === "picture") {
      return [
        {
          ...base,
          senderType: "customer",
          kind: "image",
          media: [
            {
              url: message.media,
              thumbnailUrl: message.thumbnail,
              size: message.size,
            },
          ],
        },
      ];
    }

    if (message.type === "video") {
      return [
        {
          ...base,
          senderType: "customer",
          kind: "video",
          media: [
            {
              url: message.media,
              thumbnailUrl: message.thumbnail,
              size: message.size,
              durationMs: message.duration ? message.duration * 1000 : undefined,
            },
          ],
        },
      ];
    }

    if (message.type === "file") {
      return [
        {
          ...base,
          senderType: "customer",
          kind: "file",
          media: [
            {
              url: message.media,
              filename: message.file_name,
              size: message.size,
            },
          ],
        },
      ];
    }

    if (message.type === "location" && message.location) {
      return [
        {
          ...base,
          senderType: "customer",
          kind: "location",
          location: {
            lat: message.location.lat,
            lng: message.location.lon,
          },
        },
      ];
    }

    if (message.type === "contact" && message.contact) {
      return [
        {
          ...base,
          senderType: "customer",
          kind: "contact",
          contact: {
            name: message.contact.name,
            phone: message.contact.phone_number,
          },
        },
      ];
    }

    return [
      this.buildUnsupportedMessage(
        {
          ...base,
          senderType: "customer",
        },
        "Viber payload type is not mapped in MVP"
      ),
    ];
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
      receiver: input.conversation.externalChatId,
      type: "text",
      text: input.message.text?.body ?? "",
    };

    const authToken = String(input.connection.credentials.authToken ?? "");
    if (!authToken) {
      return {
        status: "failed" as const,
        error: "Missing Viber auth token",
        request,
      };
    }

    try {
      const response = await axios.post(
        "https://chatapi.viber.com/pa/send_message",
        request,
        {
          headers: {
            "X-Viber-Auth-Token": authToken,
          },
        }
      );

      return {
        externalMessageId: String(response.data?.message_token ?? ""),
        status:
          response.data?.status === 0 ? ("sent" as const) : ("failed" as const),
        raw: response.data,
        error:
          response.data?.status === 0 ? undefined : response.data?.status_message,
        request,
      };
    } catch (error) {
      return this.buildFailedSendResult(error, request);
    }
  }
}
