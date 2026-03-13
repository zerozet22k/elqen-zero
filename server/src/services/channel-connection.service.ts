import { randomUUID } from "crypto";
import axios from "axios";
import { adapterRegistry } from "../channels/adapter.registry";
import {
  CanonicalChannel,
  ChannelConnectionStatus,
  ChannelConnectionVerificationState,
} from "../channels/types";
import {
  ChannelConnectionDocument,
  ChannelConnectionModel,
} from "../models/channel-connection.model";
import {
  ConflictError,
  IntegrationNotReadyError,
  NotFoundError,
  ValidationError,
} from "../lib/errors";
import { env } from "../config/env";
import { emitRealtimeEvent } from "../lib/realtime";

type ConnectionPayload = {
  workspaceId: string;
  displayName?: string;
  externalAccountId?: string;
  credentials: Record<string, unknown>;
  webhookConfig: Record<string, unknown>;
};

type ConnectionValidationResult = {
  displayName: string;
  externalAccountId: string;
  credentials: Record<string, unknown>;
  webhookConfig: Record<string, unknown>;
  webhookUrl: string | null;
  webhookVerified: boolean;
  verificationState: ChannelConnectionVerificationState;
  status: ChannelConnectionStatus;
  lastError: string | null;
  diagnostics: Record<string, unknown>;
};

const trimString = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

class ChannelConnectionService {
  async createConnection(
    channel: CanonicalChannel,
    payload: ConnectionPayload
  ): Promise<ChannelConnectionDocument> {
    const validation = await this.validateConnection(channel, payload);

    const connection = await ChannelConnectionModel.findOneAndUpdate(
      {
        workspaceId: payload.workspaceId,
        channel,
        externalAccountId: validation.externalAccountId,
      },
      {
        $set: {
          workspaceId: payload.workspaceId,
          channel,
          displayName: validation.displayName,
          externalAccountId: validation.externalAccountId,
          credentials: validation.credentials,
          webhookConfig: validation.webhookConfig,
          webhookUrl: validation.webhookUrl,
          webhookVerified: validation.webhookVerified,
          verificationState: validation.verificationState,
          status: validation.status,
          lastError: validation.lastError,
          capabilities: adapterRegistry.get(channel).getCapabilities(),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    emitRealtimeEvent("connection.updated", {
      workspaceId: payload.workspaceId,
      connectionId: String(connection._id),
      channel: connection.channel,
      status: connection.status,
      verificationState: connection.verificationState,
    });

    return connection;
  }

  async updateConnection(
    id: string,
    patch: Partial<{
      displayName: string;
      credentials: Record<string, unknown>;
      webhookConfig: Record<string, unknown>;
      webhookUrl: string | null;
      webhookVerified: boolean;
      verificationState: ChannelConnectionVerificationState;
      status: ChannelConnectionStatus;
      lastError: string | null;
      lastInboundAt: Date | null;
      lastOutboundAt: Date | null;
    }>
  ) {
    const connection = await ChannelConnectionModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true }
    );

    if (!connection) {
      throw new NotFoundError("Channel connection not found");
    }

    emitRealtimeEvent("connection.updated", {
      workspaceId: String(connection.workspaceId),
      connectionId: String(connection._id),
      channel: connection.channel,
      status: connection.status,
      verificationState: connection.verificationState,
    });

    return connection;
  }

  async validateConnection(
    channel: CanonicalChannel,
    payload: ConnectionPayload
  ): Promise<ConnectionValidationResult> {
    if (channel === "telegram") {
      return this.validateTelegramConnection(payload);
    }

    if (channel === "viber") {
      return this.validateViberConnection(payload);
    }

    if (channel === "facebook") {
      return this.validateFacebookConnection(payload);
    }

    return this.validateTikTokConnection(payload);
  }

  async getConnectionByWorkspaceAndChannel(params: {
    workspaceId: string;
    channel: CanonicalChannel;
    externalAccountId?: string;
    requireActive?: boolean;
  }) {
    const query: Record<string, unknown> = {
      workspaceId: params.workspaceId,
      channel: params.channel,
    };

    if (params.externalAccountId) {
      query.externalAccountId = params.externalAccountId;
    }

    if (params.requireActive !== false) {
      query.status = "active";
    }

    const connection = await ChannelConnectionModel.findOne(query).sort({
      updatedAt: -1,
    });

    if (!connection) {
      throw new NotFoundError("Channel connection not found");
    }

    emitRealtimeEvent("connection.updated", {
      workspaceId: String(connection.workspaceId),
      connectionId: String(connection._id),
      channel: connection.channel,
      status: connection.status,
      verificationState: connection.verificationState,
      lastInboundAt: connection.lastInboundAt,
    });

    return connection;
  }

  async listConnectionsByWorkspace(workspaceId: string) {
    return ChannelConnectionModel.find({ workspaceId }).sort({ createdAt: -1 });
  }

  async markInboundReceived(connectionId: string, receivedAt = new Date()) {
    const connection = await ChannelConnectionModel.findByIdAndUpdate(
      connectionId,
      {
        $set: {
          lastInboundAt: receivedAt,
          lastError: null,
          status: "active",
        },
      },
      { new: true }
    );

    if (!connection) {
      throw new NotFoundError("Channel connection not found");
    }

    emitRealtimeEvent("connection.updated", {
      workspaceId: String(connection.workspaceId),
      connectionId: String(connection._id),
      channel: connection.channel,
      status: connection.status,
      verificationState: connection.verificationState,
      lastOutboundAt: connection.lastOutboundAt,
    });

    return connection;
  }

  async markOutboundSent(connectionId: string, sentAt = new Date()) {
    const connection = await ChannelConnectionModel.findByIdAndUpdate(
      connectionId,
      {
        $set: {
          lastOutboundAt: sentAt,
          lastError: null,
          status: "active",
        },
      },
      { new: true }
    );

    if (!connection) {
      throw new NotFoundError("Channel connection not found");
    }

    emitRealtimeEvent("connection.updated", {
      workspaceId: String(connection.workspaceId),
      connectionId: String(connection._id),
      channel: connection.channel,
      status: connection.status,
      verificationState: connection.verificationState,
      lastError: connection.lastError,
    });

    return connection;
  }

  async markConnectionError(connectionId: string, message: string) {
    const connection = await ChannelConnectionModel.findByIdAndUpdate(
      connectionId,
      {
        $set: {
          status: "error",
          lastError: message,
        },
      },
      { new: true }
    );

    if (!connection) {
      throw new NotFoundError("Channel connection not found");
    }

    return connection;
  }

  async resolveFacebookConnection(pageId: string) {
    const connection = await ChannelConnectionModel.findOne({
      channel: "facebook",
      externalAccountId: pageId,
      status: "active",
    });

    if (!connection) {
      throw new NotFoundError(
        `No active Facebook connection found for page ${pageId}`
      );
    }

    return connection;
  }

  async resolveFacebookVerificationToken(verifyToken: string) {
    const connection = await ChannelConnectionModel.findOne({
      channel: "facebook",
      "credentials.verifyToken": verifyToken,
    });

    if (!connection) {
      throw new NotFoundError("No Facebook connection matched the verify token");
    }

    emitRealtimeEvent("connection.updated", {
      workspaceId: String(connection.workspaceId),
      connectionId: String(connection._id),
      channel: connection.channel,
      status: connection.status,
      verificationState: connection.verificationState,
    });

    return connection;
  }

  async markFacebookWebhookVerified(verifyToken: string) {
    const connection = await ChannelConnectionModel.findOneAndUpdate(
      {
        channel: "facebook",
        "credentials.verifyToken": verifyToken,
      },
      {
        $set: {
          webhookVerified: true,
          verificationState: "verified",
          status: "active",
          lastError: null,
        },
      },
      { new: true }
    );

    if (!connection) {
      throw new NotFoundError("No Facebook connection matched the verify token");
    }

    return connection;
  }

  async resolveTelegramConnection(webhookSecret: string) {
    const connection = await ChannelConnectionModel.findOne({
      channel: "telegram",
      "credentials.webhookSecret": webhookSecret,
      status: "active",
    });

    if (!connection) {
      throw new NotFoundError(
        "No active Telegram connection matched the webhook secret"
      );
    }

    return connection;
  }

  async resolveViberConnection(
    connectionKey?: string
  ): Promise<ChannelConnectionDocument> {
    if (connectionKey) {
      const keyedConnection = await ChannelConnectionModel.findOne({
        channel: "viber",
        "webhookConfig.connectionKey": connectionKey,
        status: "active",
      });

      if (keyedConnection) {
        return keyedConnection;
      }
    }

    const activeConnections = await ChannelConnectionModel.find({
      channel: "viber",
      status: "active",
    });

    if (activeConnections.length === 1) {
      return activeConnections[0];
    }

    if (activeConnections.length > 1) {
      throw new ConflictError(
        "Multiple active Viber connections exist. Configure a connectionKey to disambiguate inbound requests."
      );
    }

    throw new NotFoundError("No active Viber connection found");
  }

  serialize(connection: ChannelConnectionDocument) {
    return {
      ...connection.toObject(),
      credentials: this.summarizeCredentials(
        connection.channel,
        connection.credentials ?? {}
      ),
      webhookConfig: this.summarizeWebhookConfig(
        connection.channel,
        connection.webhookConfig ?? {}
      ),
    };
  }

  serializeMany(connections: ChannelConnectionDocument[]) {
    return connections.map((connection) => this.serialize(connection));
  }

  private getPublicWebhookBaseUrl() {
    const baseUrl = trimTrailingSlash(env.PUBLIC_WEBHOOK_BASE_URL.trim());
    return baseUrl || "";
  }

  private buildWebhookUrl(
    channel: "facebook" | "telegram" | "viber",
    query?: Record<string, string>
  ) {
    const baseUrl = this.getPublicWebhookBaseUrl();
    if (!baseUrl) {
      return "";
    }

    const url = new URL(`/webhooks/${channel}`, `${baseUrl}/`);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(key, value);
        }
      });
    }

    return url.toString();
  }

  private async validateTelegramConnection(
    payload: ConnectionPayload
  ): Promise<ConnectionValidationResult> {
    const botToken = trimString(payload.credentials.botToken);
    if (!botToken) {
      throw new ValidationError("Telegram bot token is required");
    }

    const meResponse = await axios
      .get(`https://api.telegram.org/bot${botToken}/getMe`)
      .catch((error) => {
        throw new ValidationError(
          "Telegram bot token validation failed",
          error instanceof Error ? error.message : error
        );
      });

    if (!meResponse.data?.ok || !meResponse.data?.result?.id) {
      throw new ValidationError("Telegram bot token validation failed");
    }

    const webhookSecret =
      trimString(payload.credentials.webhookSecret) || randomUUID();
    const webhookUrl = this.buildWebhookUrl("telegram");
    const bot = meResponse.data.result as {
      id: number;
      first_name?: string;
      username?: string;
      can_join_groups?: boolean;
      supports_inline_queries?: boolean;
    };

    if (!webhookUrl) {
      return {
        displayName:
          payload.displayName?.trim() ||
          bot.first_name ||
          (bot.username ? `@${bot.username}` : "Telegram bot"),
        externalAccountId: String(bot.id),
        credentials: {
          botToken,
          webhookSecret,
        },
        webhookConfig: payload.webhookConfig,
        webhookUrl: null,
        webhookVerified: false,
        verificationState: "pending",
        status: "pending",
        lastError:
          "PUBLIC_WEBHOOK_BASE_URL is required before Telegram webhook registration can complete.",
        diagnostics: {
          provider: {
            id: bot.id,
            username: bot.username,
            firstName: bot.first_name,
            canJoinGroups: bot.can_join_groups,
            supportsInlineQueries: bot.supports_inline_queries,
          },
        },
      };
    }

    try {
      const setWebhookResponse = await axios.post(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
          url: webhookUrl,
          secret_token: webhookSecret,
          allowed_updates: ["message", "edited_message", "callback_query"],
        }
      );

      return {
        displayName:
          payload.displayName?.trim() ||
          bot.first_name ||
          (bot.username ? `@${bot.username}` : "Telegram bot"),
        externalAccountId: String(bot.id),
        credentials: {
          botToken,
          webhookSecret,
        },
        webhookConfig: payload.webhookConfig,
        webhookUrl,
        webhookVerified: !!setWebhookResponse.data?.ok,
        verificationState: setWebhookResponse.data?.ok ? "verified" : "failed",
        status: setWebhookResponse.data?.ok ? "active" : "error",
        lastError: setWebhookResponse.data?.ok
          ? null
          : "Telegram rejected webhook registration",
        diagnostics: {
          provider: {
            id: bot.id,
            username: bot.username,
            firstName: bot.first_name,
          },
          webhook: setWebhookResponse.data,
        },
      };
    } catch (error) {
      return {
        displayName:
          payload.displayName?.trim() ||
          bot.first_name ||
          (bot.username ? `@${bot.username}` : "Telegram bot"),
        externalAccountId: String(bot.id),
        credentials: {
          botToken,
          webhookSecret,
        },
        webhookConfig: payload.webhookConfig,
        webhookUrl,
        webhookVerified: false,
        verificationState: "failed",
        status: "error",
        lastError:
          error instanceof Error
            ? error.message
            : "Telegram webhook registration failed",
        diagnostics: {
          provider: {
            id: bot.id,
            username: bot.username,
            firstName: bot.first_name,
          },
        },
      };
    }
  }

  private async validateViberConnection(
    payload: ConnectionPayload
  ): Promise<ConnectionValidationResult> {
    const authToken = trimString(payload.credentials.authToken);
    if (!authToken) {
      throw new ValidationError("Viber auth token is required");
    }

    const accountInfoResponse = await axios
      .post(
        "https://chatapi.viber.com/pa/get_account_info",
        {},
        {
          headers: {
            "X-Viber-Auth-Token": authToken,
          },
        }
      )
      .catch((error) => {
        throw new ValidationError(
          "Viber auth token validation failed",
          error instanceof Error ? error.message : error
        );
      });

    if (accountInfoResponse.data?.status !== 0) {
      throw new ValidationError(
        accountInfoResponse.data?.status_message ||
        "Viber auth token validation failed"
      );
    }

    const account = accountInfoResponse.data as {
      id?: string;
      uri?: string;
      name?: string;
      avatar?: string;
    };
    const connectionKey =
      trimString(payload.webhookConfig.connectionKey) || randomUUID();
    const externalAccountId =
      trimString(account.id) || trimString(account.uri) || payload.externalAccountId;

    if (!externalAccountId) {
      throw new ValidationError(
        "Viber account validation succeeded but did not return an account identifier"
      );
    }

    const webhookUrl = this.buildWebhookUrl("viber", { connectionKey });
    if (!webhookUrl) {
      return {
        displayName:
          payload.displayName?.trim() || account.name || "Viber public account",
        externalAccountId,
        credentials: {
          authToken,
        },
        webhookConfig: {
          ...payload.webhookConfig,
          connectionKey,
        },
        webhookUrl: null,
        webhookVerified: false,
        verificationState: "pending",
        status: "pending",
        lastError:
          "PUBLIC_WEBHOOK_BASE_URL is required before Viber webhook registration can complete.",
        diagnostics: {
          provider: {
            id: account.id,
            uri: account.uri,
            name: account.name,
            avatar: account.avatar,
          },
        },
      };
    }

    try {
      const setWebhookResponse = await axios.post(
        "https://chatapi.viber.com/pa/set_webhook",
        {
          url: webhookUrl,
          event_types: [
            "message",
            "conversation_started",
            "delivered",
            "seen",
            "failed",
          ],
          send_name: true,
          send_photo: true,
        },
        {
          headers: {
            "X-Viber-Auth-Token": authToken,
          },
        }
      );

      const success = setWebhookResponse.data?.status === 0;

      return {
        displayName:
          payload.displayName?.trim() || account.name || "Viber public account",
        externalAccountId,
        credentials: {
          authToken,
        },
        webhookConfig: {
          ...payload.webhookConfig,
          connectionKey,
        },
        webhookUrl,
        webhookVerified: success,
        verificationState: success ? "verified" : "failed",
        status: success ? "active" : "error",
        lastError: success
          ? null
          : setWebhookResponse.data?.status_message ||
          "Viber webhook registration failed",
        diagnostics: {
          provider: {
            id: account.id,
            uri: account.uri,
            name: account.name,
          },
          webhook: setWebhookResponse.data,
        },
      };
    } catch (error) {
      return {
        displayName:
          payload.displayName?.trim() || account.name || "Viber public account",
        externalAccountId,
        credentials: {
          authToken,
        },
        webhookConfig: {
          ...payload.webhookConfig,
          connectionKey,
        },
        webhookUrl,
        webhookVerified: false,
        verificationState: "failed",
        status: "error",
        lastError:
          error instanceof Error
            ? error.message
            : "Viber webhook registration failed",
        diagnostics: {
          provider: {
            id: account.id,
            uri: account.uri,
            name: account.name,
          },
        },
      };
    }
  }

  private async validateFacebookConnection(
    payload: ConnectionPayload
  ): Promise<ConnectionValidationResult> {
    const pageAccessToken = trimString(payload.credentials.pageAccessToken);
    const verifyToken =
      trimString(payload.credentials.verifyToken) ||
      trimString(payload.webhookConfig.verifyToken);
    const appSecret = trimString(payload.credentials.appSecret);

    if (!pageAccessToken) {
      throw new ValidationError("Facebook page access token is required");
    }

    if (!verifyToken) {
      throw new ValidationError("Facebook verify token is required");
    }

    const pageResponse = await axios
      .get("https://graph.facebook.com/v19.0/me", {
        params: {
          fields: "id,name",
          access_token: pageAccessToken,
        },
      })
      .catch((error) => {
        throw new ValidationError(
          "Facebook page token validation failed",
          error instanceof Error ? error.message : error
        );
      });

    if (!pageResponse.data?.id) {
      throw new ValidationError("Facebook page token validation failed");
    }

    const webhookUrl = this.buildWebhookUrl("facebook");
    const pendingReason = webhookUrl
      ? null
      : "PUBLIC_WEBHOOK_BASE_URL is required before Facebook webhook verification can complete.";

    return {
      displayName:
        payload.displayName?.trim() ||
        pageResponse.data?.name ||
        "Facebook page",
      externalAccountId: String(pageResponse.data.id),
      credentials: {
        pageAccessToken,
        verifyToken,
        ...(appSecret ? { appSecret } : {}),
      },
      webhookConfig: payload.webhookConfig,
      webhookUrl: webhookUrl || null,
      webhookVerified: false,
      verificationState: "pending",
      status: "pending",
      lastError: pendingReason,
      diagnostics: {
        provider: {
          id: pageResponse.data.id,
          name: pageResponse.data.name,
        },
        webhook: {
          url: webhookUrl || null,
          verified: false,
        },
      },
    };
  }

  private async validateTikTokConnection(
    payload: ConnectionPayload
  ): Promise<ConnectionValidationResult> {
    const externalAccountId =
      payload.externalAccountId || `tiktok-experimental-${randomUUID()}`;

    return {
      displayName: payload.displayName?.trim() || "TikTok experimental",
      externalAccountId,
      credentials: payload.credentials,
      webhookConfig: payload.webhookConfig,
      webhookUrl: null,
      webhookVerified: false,
      verificationState: "pending_provider_verification",
      status: "pending",
      lastError:
        "TikTok messaging integration is pending provider verification and is not active in production.",
      diagnostics: {
        status: "pending_provider_verification",
      },
    };
  }

  private summarizeCredentials(
    channel: CanonicalChannel,
    credentials: Record<string, unknown>
  ) {
    if (channel === "telegram") {
      return {
        botTokenConfigured: !!trimString(credentials.botToken),
        webhookSecretConfigured: !!trimString(credentials.webhookSecret),
      };
    }

    if (channel === "viber") {
      return {
        authTokenConfigured: !!trimString(credentials.authToken),
      };
    }

    if (channel === "facebook") {
      return {
        pageAccessTokenConfigured: !!trimString(credentials.pageAccessToken),
        verifyTokenConfigured: !!trimString(credentials.verifyToken),
        appSecretConfigured: !!trimString(credentials.appSecret),
      };
    }

    return {
      configured: Object.keys(credentials).length > 0,
    };
  }

  private summarizeWebhookConfig(
    channel: CanonicalChannel,
    webhookConfig: Record<string, unknown>
  ) {
    if (channel === "viber") {
      return {
        connectionKeyConfigured: !!trimString(webhookConfig.connectionKey),
        connectionKey: trimString(webhookConfig.connectionKey) || undefined,
      };
    }

    return {};
  }
}

export const channelConnectionService = new ChannelConnectionService();
