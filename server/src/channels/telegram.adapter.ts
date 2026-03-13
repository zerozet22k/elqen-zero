import axios from "axios";
import { BaseChannelAdapter } from "./base.adapter";
import { CanonicalMessage, ChannelCapabilities } from "./types";

type TelegramPhoto = {
  file_id: string;
  width?: number;
  height?: number;
  file_size?: number;
};

type TelegramMessagePayload = {
  message_id: number;
  date?: number;
  chat: { id: number | string };
  from?: {
    id: number | string;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  text?: string;
  caption?: string;
  photo?: TelegramPhoto[];
  video?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
    duration?: number;
    width?: number;
    height?: number;
    thumbnail?: { file_id: string };
  };
  voice?: {
    file_id: string;
    mime_type?: string;
    file_size?: number;
    duration?: number;
  };
  audio?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
    duration?: number;
  };
  document?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
    thumbnail?: { file_id: string };
  };
  location?: {
    latitude: number;
    longitude: number;
  };
  contact?: {
    first_name?: string;
    last_name?: string;
    phone_number?: string;
  };
  sticker?: unknown;
  animation?: unknown;
};

type TelegramUpdate = {
  message?: TelegramMessagePayload;
  edited_message?: TelegramMessagePayload;
  callback_query?: {
    id: string;
    data?: string;
    from: {
      id: number | string;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    message?: TelegramMessagePayload;
  };
};

export class TelegramAdapter extends BaseChannelAdapter {
  channel = "telegram" as const;

  async verifyWebhook(input: {
    headers: Record<string, string>;
    connection?: {
      credentials: Record<string, unknown>;
    };
  }) {
    const provided = input.headers["x-telegram-bot-api-secret-token"];
    const expected = String(input.connection?.credentials.webhookSecret ?? "");
    return !!provided && !!expected && provided === expected;
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
    const body = reqBody as TelegramUpdate;
    if (body.callback_query) {
      const callback = body.callback_query;
      const sourceMessage = callback.message;
      if (!sourceMessage) {
        return [];
      }

      return [
        {
          channel: this.channel,
          direction: "inbound",
          senderType: "customer",
          kind: "interactive",
          externalMessageId: callback.id,
          externalChatId: String(sourceMessage.chat.id),
          externalSenderId: String(callback.from.id),
          interactive: {
            subtype: "callback_query",
            label: callback.data,
            value: callback.data,
            payload: callback.data,
          },
          text: callback.data
            ? {
                body: callback.data,
                plain: callback.data,
              }
            : undefined,
          senderProfile: {
            displayName: [callback.from.first_name, callback.from.last_name]
              .filter(Boolean)
              .join(" ")
              .trim(),
            username: callback.from.username,
          },
          raw: callback,
          occurredAt: sourceMessage.date
            ? new Date(sourceMessage.date * 1000)
            : new Date(),
        },
      ];
    }

    const message = body.message ?? body.edited_message;
    if (!message) {
      return [];
    }

    const base = {
      channel: this.channel,
      direction: "inbound" as const,
      senderType: "customer" as const,
      externalMessageId: String(message.message_id),
      externalChatId: String(message.chat.id),
      externalSenderId: message.from ? String(message.from.id) : undefined,
      senderProfile: message.from
        ? {
            displayName: [message.from.first_name, message.from.last_name]
              .filter(Boolean)
              .join(" ")
              .trim(),
            username: message.from.username,
          }
        : undefined,
      raw: message,
      occurredAt: message.date ? new Date(message.date * 1000) : new Date(),
      text: undefined,
    };

    if (message.text) {
      return [
        {
          ...base,
          kind: "text",
          text: {
            body: message.text,
            plain: message.text,
          },
        },
      ];
    }

    if (message.photo?.length) {
      const largest = message.photo[message.photo.length - 1];
      return [
        {
          ...base,
          kind: "image",
          text: message.caption
            ? { body: message.caption, plain: message.caption }
            : undefined,
          media: [
            {
              providerFileId: largest.file_id,
              width: largest.width,
              height: largest.height,
              size: largest.file_size,
            },
          ],
        },
      ];
    }

    if (message.video) {
      return [
        {
          ...base,
          kind: "video",
          text: message.caption
            ? { body: message.caption, plain: message.caption }
            : undefined,
          media: [
            {
              providerFileId: message.video.file_id,
              filename: message.video.file_name,
              mimeType: message.video.mime_type,
              size: message.video.file_size,
              durationMs: message.video.duration
                ? message.video.duration * 1000
                : undefined,
              width: message.video.width,
              height: message.video.height,
            },
          ],
        },
      ];
    }

    if (message.voice) {
      return [
        {
          ...base,
          kind: "audio",
          text: message.caption
            ? { body: message.caption, plain: message.caption }
            : undefined,
          media: [
            {
              providerFileId: message.voice.file_id,
              mimeType: message.voice.mime_type,
              size: message.voice.file_size,
              durationMs: message.voice.duration
                ? message.voice.duration * 1000
                : undefined,
            },
          ],
        },
      ];
    }

    if (message.audio) {
      return [
        {
          ...base,
          kind: "audio",
          text: message.caption
            ? { body: message.caption, plain: message.caption }
            : undefined,
          media: [
            {
              providerFileId: message.audio.file_id,
              filename: message.audio.file_name,
              mimeType: message.audio.mime_type,
              size: message.audio.file_size,
              durationMs: message.audio.duration
                ? message.audio.duration * 1000
                : undefined,
            },
          ],
        },
      ];
    }

    if (message.document) {
      return [
        {
          ...base,
          kind: "file",
          text: message.caption
            ? { body: message.caption, plain: message.caption }
            : undefined,
          media: [
            {
              providerFileId: message.document.file_id,
              filename: message.document.file_name,
              mimeType: message.document.mime_type,
              size: message.document.file_size,
            },
          ],
        },
      ];
    }

    if (message.location) {
      return [
        {
          ...base,
          kind: "location",
          location: {
            lat: message.location.latitude,
            lng: message.location.longitude,
          },
        },
      ];
    }

    if (message.contact) {
      return [
        {
          ...base,
          kind: "contact",
          contact: {
            name: [message.contact.first_name, message.contact.last_name]
              .filter(Boolean)
              .join(" ")
              .trim(),
            phone: message.contact.phone_number,
          },
        },
      ];
    }

    return [
      this.buildUnsupportedMessage(base, "Telegram payload type is not mapped in MVP"),
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
      chat_id: input.conversation.externalChatId,
      text: input.message.text?.body ?? "",
    };

    const botToken = String(input.connection.credentials.botToken ?? "");
    if (!botToken) {
      return {
        status: "failed" as const,
        error: "Missing Telegram bot token",
        request,
      };
    }

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        request
      );

      return {
        externalMessageId: String(response.data?.result?.message_id ?? ""),
        status: "sent" as const,
        raw: response.data,
        request,
      };
    } catch (error) {
      return this.buildFailedSendResult(error, request);
    }
  }
}
