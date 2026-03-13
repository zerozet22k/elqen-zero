import axios from "axios";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let app: import("express").Express;
let models: typeof import("../models");
let adapterRegistry: typeof import("../channels/adapter.registry")["adapterRegistry"];
const testDbName = `chatbot_test_${Date.now()}`;

const fixedTelegramDate = Math.floor(
  new Date("2026-03-08T02:00:00.000Z").getTime() / 1000
);

const buildTelegramTextUpdate = (messageId: number, text: string) => ({
  update_id: messageId,
  message: {
    message_id: messageId,
    date: fixedTelegramDate,
    chat: { id: 5001 },
    from: {
      id: 7001,
      first_name: "Mina",
      username: "mina_shop",
    },
    text,
  },
});

const buildTelegramUnsupportedUpdate = (messageId: number) => ({
  update_id: messageId,
  message: {
    message_id: messageId,
    date: fixedTelegramDate,
    chat: { id: 5001 },
    from: {
      id: 7001,
      first_name: "Mina",
      username: "mina_shop",
    },
    sticker: {
      file_id: "sticker-1",
    },
  },
});

const createWorkspace = async () => {
  return models.WorkspaceModel.create({
    name: "Seller Workspace",
    slug: `seller-${Math.random().toString(36).slice(2, 8)}`,
    timeZone: "UTC",
  });
};

const createTelegramConnection = async (workspaceId: string) => {
  return models.ChannelConnectionModel.create({
    workspaceId,
    channel: "telegram",
    displayName: "Telegram Bot",
    externalAccountId: "12345",
    credentials: {
      webhookSecret: "telegram-secret",
      botToken: "telegram-token",
    },
    webhookConfig: {},
    webhookUrl: "https://unit.test/webhooks/telegram",
    webhookVerified: true,
    verificationState: "verified",
    status: "active",
    capabilities: adapterRegistry.get("telegram").getCapabilities(),
  });
};

const createConversationForConnection = async (workspaceId: string) => {
  const inboundResponse = await request(app)
    .post("/webhooks/telegram")
    .set("x-telegram-bot-api-secret-token", "telegram-secret")
    .send(buildTelegramTextUpdate(1001, "Hello"));

  expect(inboundResponse.status).toBe(200);
  const conversation = await models.ConversationModel.findOne();
  expect(conversation).toBeTruthy();
  return conversation!;
};

const configureAfterHoursAutomation = async (workspaceId: string) => {
  await models.AISettingsModel.create({
    workspaceId,
    enabled: true,
    autoReplyEnabled: true,
    afterHoursEnabled: true,
    confidenceThreshold: 0.7,
  });

  await models.BusinessHoursModel.create({
    workspaceId,
    timeZone: "UTC",
    weeklySchedule: [
      {
        dayOfWeek: 1,
        enabled: true,
        windows: [{ start: "09:00", end: "17:00" }],
      },
    ],
  });

  await models.AutomationRuleModel.create({
    workspaceId,
    type: "after_hours_auto_reply",
    name: "After Hours",
    isActive: true,
    action: {
      fallbackText: "We are offline right now. A teammate will review this soon.",
    },
  });
};

beforeAll(async () => {
  process.env.CLIENT_URL = "http://localhost:3000";
  process.env.MONGO_URL = "mongodb://localhost:27017";
  process.env.MONGO_DB = testDbName;
  process.env.JWT_SECRET = "test-secret";
  process.env.SESSION_SECRET = "test-secret";
  process.env.PUBLIC_WEBHOOK_BASE_URL = "https://unit.test";
  process.env.FACEBOOK_VERIFY_TOKEN = "verify-me";

  models = await import("../models");
  ({ adapterRegistry } = await import("../channels/adapter.registry"));

  await mongoose.connect(`${process.env.MONGO_URL}/${process.env.MONGO_DB}`);
  app = (await import("../app")).createApp();
}, 60000);

beforeEach(async () => {
  vi.restoreAllMocks();
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}, 60000);

describe("functional messaging core", () => {
  it("telegram connection validation persists an active verified connection", async () => {
    const workspace = await createWorkspace();
    vi.spyOn(axios, "get").mockResolvedValueOnce({
      data: {
        ok: true,
        result: {
          id: 12345,
          first_name: "Shop Bot",
          username: "shop_bot",
        },
      },
    });
    vi.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        ok: true,
        result: true,
      },
    });

    const response = await request(app)
      .post("/api/channels/telegram/connect")
      .send({
        workspaceId: String(workspace._id),
        displayName: "Primary Telegram",
        credentials: {
          botToken: "telegram-token",
          webhookSecret: "telegram-secret",
        },
        webhookConfig: {},
      });

    expect(response.status).toBe(201);
    expect(response.body.connection.status).toBe("active");
    expect(response.body.connection.webhookVerified).toBe(true);
    expect(response.body.connection.externalAccountId).toBe("12345");

    const connection = await models.ChannelConnectionModel.findOne({
      workspaceId: workspace._id,
      channel: "telegram",
    });
    expect(connection?.credentials).toMatchObject({
      botToken: "telegram-token",
      webhookSecret: "telegram-secret",
    });
    expect(connection?.webhookUrl).toBe("https://unit.test/webhooks/telegram");
  });

  it("viber connection validation persists an active verified connection", async () => {
    const workspace = await createWorkspace();
    vi.spyOn(axios, "post")
      .mockResolvedValueOnce({
        data: {
          status: 0,
          id: "viber-bot-1",
          name: "Seller Viber",
        },
      })
      .mockResolvedValueOnce({
        data: {
          status: 0,
          status_message: "ok",
        },
      });

    const response = await request(app)
      .post("/api/channels/viber/connect")
      .send({
        workspaceId: String(workspace._id),
        displayName: "Primary Viber",
        credentials: {
          authToken: "viber-token",
        },
        webhookConfig: {
          connectionKey: "viber-main",
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.connection.status).toBe("active");
    expect(response.body.connection.webhookVerified).toBe(true);
    expect(response.body.connection.externalAccountId).toBe("viber-bot-1");
  });

  it("facebook config starts pending and verify endpoint promotes it to active", async () => {
    const workspace = await createWorkspace();
    vi.spyOn(axios, "get").mockResolvedValueOnce({
      data: {
        id: "fb-page-1",
        name: "Seller Page",
      },
    });

    const connectResponse = await request(app)
      .post("/api/channels/facebook/connect")
      .send({
        workspaceId: String(workspace._id),
        displayName: "Messenger",
        credentials: {
          pageAccessToken: "facebook-token",
          verifyToken: "verify-me",
        },
        webhookConfig: {},
      });

    expect(connectResponse.status).toBe(201);
    expect(connectResponse.body.connection.status).toBe("pending");
    expect(connectResponse.body.connection.webhookVerified).toBe(false);

    const verifyResponse = await request(app)
      .get("/webhooks/facebook/verify")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "verify-me",
        "hub.challenge": "123456",
      });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.text).toBe("123456");

    const connection = await models.ChannelConnectionModel.findOne({
      workspaceId: workspace._id,
      channel: "facebook",
    });
    expect(connection?.status).toBe("active");
    expect(connection?.webhookVerified).toBe(true);
  });

  it("inbound webhook persists canonical message, updates conversation, and records lastInboundAt", async () => {
    const workspace = await createWorkspace();
    const connection = await createTelegramConnection(String(workspace._id));

    const response = await request(app)
      .post("/webhooks/telegram")
      .set("x-telegram-bot-api-secret-token", "telegram-secret")
      .send(buildTelegramTextUpdate(1002, "Do you have blue?"));

    expect(response.status).toBe(200);
    expect(response.body.processed).toBe(1);

    const conversation = await models.ConversationModel.findOne();
    const message = await models.MessageModel.findOne();
    const refreshedConnection = await models.ChannelConnectionModel.findById(
      connection._id
    );

    expect(message?.kind).toBe("text");
    expect(message?.text?.body).toBe("Do you have blue?");
    expect(message?.raw).toBeDefined();
    expect(conversation?.unreadCount).toBe(1);
    expect(conversation?.lastMessageText).toBe("Do you have blue?");
    expect(refreshedConnection?.lastInboundAt).toBeTruthy();
  });

  it("unsupported inbound payload maps to unsupported and does not crash", async () => {
    const workspace = await createWorkspace();
    await createTelegramConnection(String(workspace._id));

    const response = await request(app)
      .post("/webhooks/telegram")
      .set("x-telegram-bot-api-secret-token", "telegram-secret")
      .send(buildTelegramUnsupportedUpdate(2001));

    expect(response.status).toBe(200);

    const message = await models.MessageModel.findOne();
    expect(message?.kind).toBe("unsupported");
    expect(message?.unsupportedReason).toContain("not mapped");
  });

  it("outbound send success updates delivery status and connection.lastOutboundAt", async () => {
    const workspace = await createWorkspace();
    const connection = await createTelegramConnection(String(workspace._id));
    const conversation = await createConversationForConnection(String(workspace._id));

    vi.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        ok: true,
        result: {
          message_id: 9001,
        },
      },
    });

    const response = await request(app)
      .post(`/api/conversations/${conversation._id}/messages`)
      .send({
        senderType: "agent",
        kind: "text",
        text: {
          body: "We have it in stock.",
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.delivery.status).toBe("sent");

    const refreshedConnection = await models.ChannelConnectionModel.findById(
      connection._id
    );
    const delivery = await models.MessageDeliveryModel.findOne();

    expect(refreshedConnection?.lastOutboundAt).toBeTruthy();
    expect(delivery?.status).toBe("sent");
    expect(delivery?.providerResponse).toMatchObject({
      ok: true,
    });
  });

  it("outbound send failure records message delivery error and marks connection error", async () => {
    const workspace = await createWorkspace();
    const connection = await createTelegramConnection(String(workspace._id));
    const conversation = await createConversationForConnection(String(workspace._id));

    vi.spyOn(axios, "post").mockRejectedValueOnce(
      new Error("Telegram send_message failed")
    );

    const response = await request(app)
      .post(`/api/conversations/${conversation._id}/messages`)
      .send({
        senderType: "agent",
        kind: "text",
        text: {
          body: "This send will fail.",
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.delivery.status).toBe("failed");

    const refreshedConnection = await models.ChannelConnectionModel.findById(
      connection._id
    );
    const failedMessage = await models.MessageModel.findOne({ direction: "outbound" });

    expect(refreshedConnection?.status).toBe("error");
    expect(refreshedConnection?.lastError).toContain("Telegram send_message failed");
    expect(failedMessage?.status).toBe("failed");
  });

  it("send is blocked when no active channel connection exists", async () => {
    const workspace = await createWorkspace();
    const conversation = await models.ConversationModel.create({
      workspaceId: workspace._id,
      channel: "telegram",
      channelAccountId: "12345",
      externalChatId: "5001",
      externalUserId: "7001",
      status: "open",
      unreadCount: 0,
      aiEnabled: true,
      aiState: "idle",
      tags: [],
    });

    await models.ChannelConnectionModel.create({
      workspaceId: workspace._id,
      channel: "telegram",
      displayName: "Telegram Bot",
      externalAccountId: "12345",
      credentials: {
        botToken: "telegram-token",
        webhookSecret: "telegram-secret",
      },
      webhookConfig: {},
      webhookUrl: "https://unit.test/webhooks/telegram",
      webhookVerified: false,
      verificationState: "pending",
      status: "pending",
      capabilities: adapterRegistry.get("telegram").getCapabilities(),
    });

    const response = await request(app)
      .post(`/api/conversations/${conversation._id}/messages`)
      .send({
        senderType: "agent",
        kind: "text",
        text: {
          body: "Can I send now?",
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("Channel connection is pending");
  });

  it("after-hours automation sends an automation reply instead of ai", async () => {
    const workspace = await createWorkspace();
    await createTelegramConnection(String(workspace._id));
    await configureAfterHoursAutomation(String(workspace._id));
    await models.CannedReplyModel.create({
      workspaceId: String(workspace._id),
      title: "Availability reply",
      body: "Yes, this item is available.",
      triggers: ["available"],
      category: "sales",
    });
    vi.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        ok: true,
        result: {
          message_id: 9101,
        },
      },
    });

    const response = await request(app)
      .post("/webhooks/telegram")
      .set("x-telegram-bot-api-secret-token", "telegram-secret")
      .send(buildTelegramTextUpdate(3001, "Is this available?"));

    expect(response.status).toBe(200);

    const messages = await models.MessageModel.find().sort({ createdAt: 1 });
    const automationAudit = await models.AuditLogModel.findOne({
      eventType: "automation.reply.sent",
    });
    const aiAudit = await models.AuditLogModel.findOne({
      eventType: /^ai\./,
    });

    expect(messages).toHaveLength(2);
    expect(messages[1].senderType).toBe("automation");
    expect(messages[1].text?.body).toBe("Yes, this item is available.");
    expect(automationAudit).toBeTruthy();
    expect(aiAudit).toBeNull();
  });

  it("canned reply override beats retrieval during after-hours automation", async () => {
    const workspace = await createWorkspace();
    await createTelegramConnection(String(workspace._id));
    await configureAfterHoursAutomation(String(workspace._id));
    await models.KnowledgeItemModel.create({
      workspaceId: String(workspace._id),
      title: "Availability article",
      content: "Knowledge says the item is available and ships tomorrow.",
      tags: ["available", "shipping"],
    });
    await models.CannedReplyModel.create({
      workspaceId: String(workspace._id),
      title: "Priority canned availability",
      body: "Canned reply wins for availability questions.",
      triggers: ["available"],
      category: "sales",
    });
    vi.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        ok: true,
        result: {
          message_id: 9102,
        },
      },
    });

    const response = await request(app)
      .post("/webhooks/telegram")
      .set("x-telegram-bot-api-secret-token", "telegram-secret")
      .send(buildTelegramTextUpdate(3501, "Is this available today?"));

    expect(response.status).toBe(200);

    const messages = await models.MessageModel.find().sort({ createdAt: 1 });
    const decisionAudit = await models.AuditLogModel.findOne({
      eventType: "automation.decision.evaluated",
    });

    expect(messages[1].text?.body).toBe("Canned reply wins for availability questions.");
    expect(decisionAudit?.reason).toContain("Matched canned reply trigger");
  });

  it("low-confidence automation escalates to human review and keeps senderType non-ai", async () => {
    const workspace = await createWorkspace();
    await createTelegramConnection(String(workspace._id));
    await configureAfterHoursAutomation(String(workspace._id));

    const response = await request(app)
      .post("/webhooks/telegram")
      .set("x-telegram-bot-api-secret-token", "telegram-secret")
      .send(buildTelegramTextUpdate(4001, "Can you compare three fabrics and suggest one?"));

    expect(response.status).toBe(200);

    const conversation = await models.ConversationModel.findOne();
    const messages = await models.MessageModel.find().sort({ createdAt: 1 });
    const handoffAudit = await models.AuditLogModel.findOne({
      eventType: "automation.handoff.requested",
    });

    expect(conversation?.status).toBe("pending");
    expect(conversation?.tags).toContain("needs_human");
    expect(messages).toHaveLength(1);
    expect(messages[0].senderType).toBe("customer");
    expect(handoffAudit?.reason).toContain("No canned reply matched");
  });
});
