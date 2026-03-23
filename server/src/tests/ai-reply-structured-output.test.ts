import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../config/env";
import { encryptField } from "../lib/crypto";
import { aiReplyService } from "../services/ai-reply.service";
import { cannedReplyService } from "../services/canned-reply.service";
import { knowledgeService } from "../services/knowledge.service";

const encryptedKey = encryptField(
  "workspace-secret-key",
  env.FIELD_ENCRYPTION_KEY || env.SESSION_SECRET
);

describe("aiReplyService structured output", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(cannedReplyService, "listActive").mockResolvedValue([]);
    vi.spyOn(knowledgeService, "selectRelevantBundles").mockResolvedValue([]);
  });

  it("supports review actions with a staff note and draft reply", async () => {
    const axiosSpy = vi.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        output_text: JSON.stringify({
          action: "review",
          messages: [
            "The whitening package is 120,000 MMK. Would you like to book this week?",
          ],
          confidence: 0.81,
          sourceHints: ["Whitening pricing"],
          reason: "Pricing should be verified before sending.",
          internalNote: "Confirm the current promotion before sending this draft.",
        }),
      },
    });

    const result = await aiReplyService.generateReply({
      workspaceId: "workspace-1",
      channel: "telegram",
      message: {
        channel: "telegram",
        channelAccountId: "telegram-account",
        externalChatId: "chat-1",
        direction: "inbound",
        senderType: "customer",
        kind: "text",
        text: { body: "How much is teeth whitening?" },
        raw: {},
        occurredAt: new Date(),
      },
      workspaceAiOverride: {
        encryptedApiKey: encryptedKey,
        assistantInstructions:
          "You support a dental clinic. Draft price replies for human verification.",
      },
    });

    expect(result.kind).toBe("review");
    if (result.kind !== "review") {
      throw new Error(`Expected review result, got ${result.kind}`);
    }

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.text?.body).toContain("120,000 MMK");
    expect(result.internalNote).toContain("Confirm the current promotion");

    const prompt = String((axiosSpy.mock.calls[0]?.[1] as { input?: string }).input ?? "");
    expect(prompt).toContain("Workspace operating instructions:");
    expect(prompt).toContain(
      "You support a dental clinic. Draft price replies for human verification."
    );
    expect(prompt).toContain("You are Codex, the inbox assistant.");
  });

  it("combines multiple AI text parts into one outbound message and parses contact updates", async () => {
    const axiosSpy = vi.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        output_text: JSON.stringify({
          action: "send",
          messages: [
            "Thanks for your order.",
            "Please share the township for delivery confirmation.",
          ],
          confidence: 0.86,
          sourceHints: ["Delivery policy"],
          reason: "Asked one follow-up question and saved profile details.",
          internalNote: "",
          contactUpdates: {
            phones: ["09 123 456 789"],
            deliveryAddress: "Yangon, Thingangyun",
            aiNotes: "Customer prefers delivery updates in chat.",
          },
        }),
      },
    });

    const result = await aiReplyService.generateReply({
      workspaceId: "workspace-1",
      channel: "telegram",
      message: {
        channel: "telegram",
        channelAccountId: "telegram-account",
        externalChatId: "chat-1",
        direction: "inbound",
        senderType: "customer",
        kind: "text",
        text: { body: "My phone is 09 123 456 789 and I am in Thingangyun." },
        raw: {},
        occurredAt: new Date(),
      },
      contactProfile: {
        primaryName: "Thi Ha Zaw",
        notes: "Existing team note",
        aiNotes: "Existing AI memory",
      },
      workspaceAiOverride: {
        encryptedApiKey: encryptedKey,
        assistantInstructions: "Use customer profile context when available.",
      },
    });

    expect(result.kind).toBe("knowledge");
    if (result.kind !== "knowledge") {
      throw new Error(`Expected knowledge result, got ${result.kind}`);
    }

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.text?.body).toBe(
      "Thanks for your order.\n\nPlease share the township for delivery confirmation."
    );
    expect(result.contactUpdates).toEqual({
      phones: ["09 123 456 789"],
      deliveryAddress: "Yangon, Thingangyun",
      aiNotes: "Customer prefers delivery updates in chat.",
    });

    const prompt = String((axiosSpy.mock.calls[0]?.[1] as { input?: string }).input ?? "");
    expect(prompt).toContain("Context type: customer profile");
    expect(prompt).toContain("- Name: Thi Ha Zaw");
    expect(prompt).toContain("- Team notes: Existing team note");
    expect(prompt).toContain("- AI memory: Existing AI memory");
    expect(prompt).toContain("contactUpdates");
  });

  it("can safely reply to image-only messages with a clarifying question", async () => {
    vi.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        output_text: JSON.stringify({
          action: "send",
          messages: [
            "Thanks for the image. Please tell me which item or service you want help with, and I will guide you from there.",
          ],
          confidence: 0.83,
          sourceHints: [],
          reason: "Safe clarifying question for attachment-only message.",
          internalNote: "",
        }),
      },
    });

    const result = await aiReplyService.generateReply({
      workspaceId: "workspace-1",
      channel: "telegram",
      message: {
        channel: "telegram",
        channelAccountId: "telegram-account",
        externalChatId: "chat-2",
        direction: "inbound",
        senderType: "customer",
        kind: "image",
        media: [
          {
            filename: "product.jpg",
            mimeType: "image/jpeg",
          },
        ],
        raw: {},
        occurredAt: new Date(),
      },
      workspaceAiOverride: {
        encryptedApiKey: encryptedKey,
      },
    });

    expect(result.kind).toBe("knowledge");
    if (result.kind !== "knowledge") {
      throw new Error(`Expected knowledge result, got ${result.kind}`);
    }

    expect(result.blocks[0]?.text?.body).toContain("Thanks for the image");
  });

  it("stays backward compatible with legacy replyText payloads", async () => {
    vi.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        output_text: JSON.stringify({
          replyText: "Hello there.",
          confidence: 0.82,
          sourceHints: [],
          reason: "Generated from conversation context",
        }),
      },
    });

    const result = await aiReplyService.generateReply({
      workspaceId: "workspace-1",
      channel: "telegram",
      message: {
        channel: "telegram",
        channelAccountId: "telegram-account",
        externalChatId: "chat-3",
        direction: "inbound",
        senderType: "customer",
        kind: "text",
        text: { body: "Hello" },
        raw: {},
        occurredAt: new Date(),
      },
      workspaceAiOverride: {
        encryptedApiKey: encryptedKey,
      },
    });

    expect(result.kind).toBe("knowledge");
    if (result.kind !== "knowledge") {
      throw new Error(`Expected knowledge result, got ${result.kind}`);
    }

    expect(result.blocks[0]?.text?.body).toBe("Hello there.");
  });
});
