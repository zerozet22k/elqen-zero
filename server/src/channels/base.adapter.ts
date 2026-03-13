import { createHmac, timingSafeEqual } from "crypto";
import axios from "axios";
import {
  CanonicalChannel,
  CanonicalMessage,
  ChannelAdapter,
  ChannelCapabilities,
  SendOutboundResult,
} from "./types";

export abstract class BaseChannelAdapter implements ChannelAdapter {
  abstract channel: CanonicalChannel;

  async verifyWebhook(_req: {
    body: unknown;
    rawBody?: string;
    headers: Record<string, string>;
    query: Record<string, string | string[] | undefined>;
    connection?: {
      externalAccountId: string;
      credentials: Record<string, unknown>;
      webhookConfig: Record<string, unknown>;
      webhookUrl?: string | null;
      webhookVerified?: boolean;
      verificationState?: string;
    };
  }): Promise<boolean> {
    return true;
  }

  abstract getCapabilities(): ChannelCapabilities;

  abstract parseInbound(
    reqBody: unknown,
    headers?: Record<string, string>
  ): Promise<CanonicalMessage[]>;

  abstract sendOutbound(input: {
    conversation: { externalChatId: string; channel: CanonicalChannel };
    message: CanonicalMessage;
    connection: {
      externalAccountId: string;
      credentials: Record<string, unknown>;
      webhookConfig: Record<string, unknown>;
    };
  }): Promise<SendOutboundResult>;

  protected buildUnsupportedMessage(
    partial: Omit<CanonicalMessage, "kind" | "unsupportedReason">,
    reason: string
  ): CanonicalMessage {
    return {
      ...partial,
      kind: "unsupported",
      unsupportedReason: reason,
    };
  }

  protected buildFailedSendResult(
    error: unknown,
    request: unknown
  ): SendOutboundResult {
    if (axios.isAxiosError(error)) {
      return {
        status: "failed",
        error:
          (typeof error.response?.data === "object" &&
          error.response?.data &&
          "description" in error.response.data
            ? String(error.response.data.description)
            : undefined) ??
          (typeof error.response?.data === "object" &&
          error.response?.data &&
          "error" in error.response.data
            ? String(error.response.data.error)
            : undefined) ??
          error.message,
        raw: error.response?.data ?? null,
        request,
      };
    }

    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Provider request failed",
      request,
    };
  }

  protected matchesSignature(params: {
    algorithm: "sha1" | "sha256";
    secret: string;
    rawBody?: string;
    provided?: string;
    prefix?: string;
  }) {
    if (!params.rawBody || !params.provided || !params.secret) {
      return false;
    }

    const digest = createHmac(params.algorithm, params.secret)
      .update(params.rawBody)
      .digest("hex");
    const expected = params.prefix ? `${params.prefix}${digest}` : digest;

    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(params.provided);
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  }
}
