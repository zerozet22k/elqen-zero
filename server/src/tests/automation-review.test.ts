import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { aiReplyService } from "../services/ai-reply.service";
import { automationService } from "../services/automation.service";
import { outboundContentExecutorService } from "../services/outbound-content-executor.service";

const testDbName = `chatbot_automation_review_test_${Date.now()}`;

let models: typeof import("../models");

describe("automation review workflow", () => {
  beforeAll(async () => {
    process.env.MONGO_URL = "mongodb://localhost:27017";
    process.env.MONGO_DB = testDbName;

    models = await import("../models");
    await mongoose.connect(`${process.env.MONGO_URL}/${process.env.MONGO_DB}`);
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

  it("creates an internal review note, sends a holding reply, and marks the conversation for human follow-up", async () => {
    const workspace = await models.WorkspaceModel.create({
      name: "Review Workspace",
      slug: `review-${Math.random().toString(36).slice(2, 8)}`,
      timeZone: "UTC",
    });

    await models.AISettingsModel.create({
      workspaceId: workspace._id,
      enabled: true,
      autoReplyEnabled: true,
      afterHoursEnabled: false,
      confidenceThreshold: 0.7,
    });

    const conversation = await models.ConversationModel.create({
      workspaceId: workspace._id,
      channel: "telegram",
      channelAccountId: "telegram-account",
      externalChatId: "chat-1",
      externalUserId: "customer-1",
      status: "open",
      unreadCount: 0,
      aiEnabled: true,
      aiState: "idle",
      tags: [],
    });

    vi.spyOn(aiReplyService, "generateReply").mockResolvedValue({
      kind: "review",
      confidence: 0.82,
      sourceHints: ["Whitening pricing"],
      reason: "Pricing should be verified before sending.",
      internalNote: "Confirm the current promotion before sending this draft.",
      blocks: [
        {
          kind: "text",
          text: {
            body: "The whitening package is 120,000 MMK. Would you like to book this week?",
            plain: "The whitening package is 120,000 MMK. Would you like to book this week?",
          },
        },
      ],
    });
    const sendBlocksSpy = vi
      .spyOn(outboundContentExecutorService, "sendBlocks")
      .mockResolvedValue({
        messages: [{ _id: new mongoose.Types.ObjectId() }] as never[],
        deliveries: [],
      });

    await automationService.handleInbound({
      workspaceId: String(workspace._id),
      conversationId: String(conversation._id),
      message: {
        channel: "telegram",
        channelAccountId: "telegram-account",
        externalChatId: "chat-1",
        direction: "inbound",
        senderType: "customer",
        kind: "text",
        text: { body: "How much is teeth whitening?" },
        raw: {},
        occurredAt: new Date("2026-03-23T04:00:00.000Z"),
      },
    });

    const updatedConversation = await models.ConversationModel.findById(conversation._id);
    const systemMessage = await models.MessageModel.findOne({
      conversationId: conversation._id,
      kind: "system",
    });
    const reviewAudit = await models.AuditLogModel.findOne({
      conversationId: conversation._id,
      eventType: "automation.review.requested",
    });

    expect(updatedConversation?.status).toBe("pending");
    expect(updatedConversation?.aiState).toBe("needs_human");
    expect(updatedConversation?.tags).toContain("needs_human");
    expect(systemMessage?.senderType).toBe("system");
    expect(systemMessage?.text?.body).toContain("Human follow-up requested");
    expect(systemMessage?.text?.body).toContain(
      "Customer has already been acknowledged and is waiting for staff follow-up."
    );
    expect(systemMessage?.text?.body).toContain(
      "Confirm the current promotion before sending this draft."
    );
    expect(sendBlocksSpy).toHaveBeenCalledTimes(1);
    expect(sendBlocksSpy.mock.calls[0]?.[0].blocks[0]?.kind).toBe("text");
    expect(sendBlocksSpy.mock.calls[0]?.[0].blocks[0]?.text?.body).toBeTruthy();
    expect(reviewAudit).toBeTruthy();
  });

  it("sends a payment-verification acknowledgement while waiting for human follow-up", async () => {
    const workspace = await models.WorkspaceModel.create({
      name: "Payment Review Workspace",
      slug: `review-${Math.random().toString(36).slice(2, 8)}`,
      timeZone: "UTC",
    });

    await models.AISettingsModel.create({
      workspaceId: workspace._id,
      enabled: true,
      autoReplyEnabled: true,
      afterHoursEnabled: false,
      confidenceThreshold: 0.7,
    });

    const conversation = await models.ConversationModel.create({
      workspaceId: workspace._id,
      channel: "telegram",
      channelAccountId: "telegram-account",
      externalChatId: "chat-2",
      externalUserId: "customer-2",
      status: "pending",
      unreadCount: 0,
      aiEnabled: true,
      aiState: "needs_human",
      tags: ["needs_human"],
    });

    const sendBlocksSpy = vi
      .spyOn(outboundContentExecutorService, "sendBlocks")
      .mockResolvedValue({
        messages: [{ _id: new mongoose.Types.ObjectId() }] as never[],
        deliveries: [],
      });

    const generateReplySpy = vi.spyOn(aiReplyService, "generateReply");

    await automationService.handleInbound({
      workspaceId: String(workspace._id),
      conversationId: String(conversation._id),
      message: {
        channel: "telegram",
        channelAccountId: "telegram-account",
        externalChatId: "chat-2",
        direction: "inbound",
        senderType: "customer",
        kind: "text",
        text: { body: "I have sent the payment in Wave Money." },
        raw: {},
        occurredAt: new Date("2026-03-23T04:05:00.000Z"),
      },
    });

    expect(generateReplySpy).not.toHaveBeenCalled();
    expect(sendBlocksSpy).toHaveBeenCalledTimes(1);
    expect(sendBlocksSpy.mock.calls[0]?.[0].blocks[0]?.text?.body).toBeTruthy();
  });

  it("applies AI contact updates while sending an automated reply", async () => {
    const workspace = await models.WorkspaceModel.create({
      name: "Profile Update Workspace",
      slug: `profile-${Math.random().toString(36).slice(2, 8)}`,
      timeZone: "UTC",
    });

    await models.AISettingsModel.create({
      workspaceId: workspace._id,
      enabled: true,
      autoReplyEnabled: true,
      afterHoursEnabled: false,
      confidenceThreshold: 0.7,
    });

    const contact = await models.ContactModel.create({
      workspaceId: workspace._id,
      primaryName: "Thi Ha Zaw",
      phones: [],
      deliveryAddress: "",
      notes: "",
      aiNotes: "",
      channelIdentities: [
        {
          channel: "telegram",
          externalUserId: "customer-3",
        },
      ],
    });

    const conversation = await models.ConversationModel.create({
      workspaceId: workspace._id,
      contactId: contact._id,
      channel: "telegram",
      channelAccountId: "telegram-account",
      externalChatId: "chat-3",
      externalUserId: "customer-3",
      status: "open",
      unreadCount: 0,
      aiEnabled: true,
      aiState: "idle",
      tags: [],
    });

    vi.spyOn(aiReplyService, "generateReply").mockResolvedValue({
      kind: "knowledge",
      confidence: 0.88,
      sourceHints: ["Delivery info"],
      reason: "Saved customer delivery details and asked one follow-up.",
      blocks: [
        {
          kind: "text",
          text: {
            body: "Thanks. Please confirm the township for delivery.",
            plain: "Thanks. Please confirm the township for delivery.",
          },
        },
      ],
      contactUpdates: {
        phones: ["09 123 456 789"],
        deliveryAddress: "Yangon, Thingangyun",
        aiNotes: "Customer prefers delivery coordination in chat.",
      },
    });

    vi.spyOn(outboundContentExecutorService, "sendBlocks").mockResolvedValue({
      messages: [{ _id: new mongoose.Types.ObjectId() }] as never[],
      deliveries: [],
    });

    await automationService.handleInbound({
      workspaceId: String(workspace._id),
      conversationId: String(conversation._id),
      message: {
        channel: "telegram",
        channelAccountId: "telegram-account",
        externalChatId: "chat-3",
        direction: "inbound",
        senderType: "customer",
        kind: "text",
        text: { body: "My phone is 09 123 456 789 and deliver to Thingangyun." },
        raw: {},
        occurredAt: new Date("2026-03-23T04:10:00.000Z"),
      },
    });

    const updatedContact = await models.ContactModel.findById(contact._id);

    expect(updatedContact?.phones).toContain("09 123 456 789");
    expect(updatedContact?.deliveryAddress).toBe("Yangon, Thingangyun");
    expect(updatedContact?.aiNotes).toBe("Customer prefers delivery coordination in chat.");
  });
});
