/**
 * Tests for workspace-owned Codex assistant config override.
 */

import axios from "axios";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../config/env";
import { decryptField, encryptField } from "../lib/crypto";
import { aiReplyService } from "../services/ai-reply.service";

const testDbName = `chatbot_ai_override_test_${Date.now()}`;

let app: import("express").Express;
let models: typeof import("../models");

beforeAll(async () => {
  process.env.CLIENT_URL = "http://localhost:3000";
  process.env.MONGO_URL = "mongodb://localhost:27017";
  process.env.MONGO_DB = testDbName;
  process.env.JWT_SECRET = "test-secret";
  process.env.SESSION_SECRET = "test-secret";
  process.env.PUBLIC_WEBHOOK_BASE_URL = "https://unit.test";
  process.env.FIELD_ENCRYPTION_KEY = "test-encryption-key-32-bytes!!!";
  process.env.APP_TENANT_MODE = "multi";

  models = await import("../models");
  await mongoose.connect(`${process.env.MONGO_URL}/${process.env.MONGO_DB}`);
  app = (await import("../app")).createApp();
}, 60000);

beforeEach(async () => {
  vi.restoreAllMocks();
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((col) => col.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}, 60000);

const registerAndLogin = async () => {
  const reg = await request(app).post("/api/auth/register").send({
    name: "Owner",
    email: "owner@ai-test.local",
    password: "SecretPass123",
    workspaceName: "AI Test Workspace",
    workspaceSlug: "ai-test-ws",
    timeZone: "UTC",
  });
  expect(reg.status).toBe(200);
  return reg.body as {
    token: string;
    activeWorkspaceId: string;
  };
};

describe("encryptField / decryptField", () => {
  it("round-trips plaintext correctly", () => {
    const secret = "test-encryption-key-32-bytes!!!";
    const plaintext = "super-secret-codex-api-key";
    const ciphertext = encryptField(plaintext, secret);

    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.length).toBeGreaterThan(0);
    expect(decryptField(ciphertext, secret)).toBe(plaintext);
  });

  it("returns empty string for empty inputs", () => {
    expect(encryptField("", "secret")).toBe("");
    expect(encryptField("plaintext", "")).toBe("");
    expect(decryptField("", "secret")).toBe("");
    expect(decryptField("ciphertext", "")).toBe("");
  });
});

describe("GET /api/ai-settings — key masking", () => {
  it("returns hasAssistantApiKey=false when no key is set", async () => {
    const { token, activeWorkspaceId } = await registerAndLogin();

    const res = await request(app)
      .get("/api/ai-settings")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Workspace-Id", activeWorkspaceId);

    expect(res.status).toBe(200);
    expect(res.body.settings.hasAssistantApiKey).toBe(false);
    expect(res.body.settings).not.toHaveProperty("assistantApiKey");
  });

  it("returns hasAssistantApiKey=true after setting a key, without exposing the raw key", async () => {
    const { token, activeWorkspaceId } = await registerAndLogin();

    await request(app)
      .patch("/api/ai-settings")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Workspace-Id", activeWorkspaceId)
      .send({ assistantApiKey: "workspace-secret-key" });

    const res = await request(app)
      .get("/api/ai-settings")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Workspace-Id", activeWorkspaceId);

    expect(res.status).toBe(200);
    expect(res.body.settings.hasAssistantApiKey).toBe(true);
    expect(res.body.settings).not.toHaveProperty("assistantApiKey");
    expect(JSON.stringify(res.body)).not.toContain("workspace-secret-key");
  });

  it("stores the key encrypted (ciphertext !== plaintext)", async () => {
    const { token, activeWorkspaceId } = await registerAndLogin();

    await request(app)
      .patch("/api/ai-settings")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Workspace-Id", activeWorkspaceId)
      .send({ assistantApiKey: "my-raw-codex-key" });

    const dbRecord = await models.AISettingsModel.findOne({ workspaceId: activeWorkspaceId });
    expect(dbRecord?.assistantApiKey).toBeTruthy();
    expect(dbRecord?.assistantApiKey).not.toBe("my-raw-codex-key");
  });

  it("clears the key when an empty string is patched", async () => {
    const { token, activeWorkspaceId } = await registerAndLogin();

    await request(app)
      .patch("/api/ai-settings")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Workspace-Id", activeWorkspaceId)
      .send({ assistantApiKey: "temporary-key" });

    await request(app)
      .patch("/api/ai-settings")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Workspace-Id", activeWorkspaceId)
      .send({ assistantApiKey: "" });

    const res = await request(app)
      .get("/api/ai-settings")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Workspace-Id", activeWorkspaceId);

    expect(res.body.settings.hasAssistantApiKey).toBe(false);
  });

  it("surfaces legacy saved provider credentials during migration", async () => {
    const { token, activeWorkspaceId } = await registerAndLogin();
    const secret = env.FIELD_ENCRYPTION_KEY || env.SESSION_SECRET;

    await models.AISettingsModel.findOneAndUpdate(
      { workspaceId: activeWorkspaceId },
      {
        $set: {
          workspaceId: activeWorkspaceId,
          geminiApiKey: encryptField("legacy-key", secret),
          geminiModel: "gemini-2.5-flash",
          assistantApiKey: "",
          assistantModel: "",
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    const res = await request(app)
      .get("/api/ai-settings")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Workspace-Id", activeWorkspaceId);

    expect(res.status).toBe(200);
    expect(res.body.settings.hasAssistantApiKey).toBe(true);
    expect(res.body.settings.assistantModel).toBe("gemini-2.5-flash");
  });
});

describe("PATCH /api/ai-settings — model override", () => {
  it("stores and returns assistantModel", async () => {
    const { token, activeWorkspaceId } = await registerAndLogin();

    await request(app)
      .patch("/api/ai-settings")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Workspace-Id", activeWorkspaceId)
      .send({ assistantModel: "gpt-5.3-codex" });

    const res = await request(app)
      .get("/api/ai-settings")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Workspace-Id", activeWorkspaceId);

    expect(res.body.settings.assistantProvider).toBe("codex");
    expect(res.body.settings.assistantModel).toBe("gpt-5.3-codex");
  });
});

describe("PATCH /api/ai-settings — assistant instructions", () => {
  it("stores and returns assistantInstructions", async () => {
    const { token, activeWorkspaceId } = await registerAndLogin();

    await request(app)
      .patch("/api/ai-settings")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Workspace-Id", activeWorkspaceId)
      .send({
        assistantInstructions:
          "You are helping a dental clinic.\nDraft price replies for staff review.",
      });

    const res = await request(app)
      .get("/api/ai-settings")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Workspace-Id", activeWorkspaceId);

    expect(res.status).toBe(200);
    expect(res.body.settings.assistantInstructions).toBe(
      "You are helping a dental clinic.\nDraft price replies for staff review."
    );
  });
});

describe("aiReplyService — workspace override priority", () => {
  it("uses the default Codex model when a workspace key is provided without a model override", async () => {
    const encryptionSecret = env.FIELD_ENCRYPTION_KEY || env.SESSION_SECRET;
    const encryptedKey = encryptField("workspace-only-key", encryptionSecret);

    const axiosSpy = vi.spyOn(axios, "post").mockResolvedValueOnce({
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
      workspaceId: new mongoose.Types.ObjectId().toString(),
      message: {
        channel: "telegram",
        externalChatId: "test-chat",
        direction: "inbound",
        senderType: "customer",
        kind: "text",
        text: { body: "Hello" },
        raw: {},
        occurredAt: new Date(),
      },
      channel: "telegram",
      workspaceAiOverride: {
        encryptedApiKey: encryptedKey,
      },
    });

    expect(result.kind).toBe("knowledge");
    if (result.kind !== "knowledge") {
      throw new Error(`Expected knowledge reply, got ${result.kind}`);
    }
    expect(result.text).toBe("Hello there.");
    expect(String(axiosSpy.mock.calls[0]?.[0])).toContain("/responses");
    expect((axiosSpy.mock.calls[0]?.[1] as { model?: string }).model).toBe(env.OPENAI_MODEL);
  });

  it("uses workspace override key and model when provided", async () => {
    const encryptionSecret = env.FIELD_ENCRYPTION_KEY || env.SESSION_SECRET;
    const encryptedKey = encryptField("workspace-override-key", encryptionSecret);

    const axiosSpy = vi.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        output_text: JSON.stringify({
          replyText: "Thanks, can you share a bit more detail?",
          confidence: 0.76,
          sourceHints: [],
          reason: "Generated from workspace override",
        }),
      },
    });

    const result = await aiReplyService.generateReply({
      workspaceId: new mongoose.Types.ObjectId().toString(),
      message: {
        channel: "telegram",
        externalChatId: "test-chat",
        direction: "inbound",
        senderType: "customer",
        kind: "text",
        text: { body: "Hello" },
        raw: {},
        occurredAt: new Date(),
      },
      channel: "telegram",
      workspaceAiOverride: {
        assistantProvider: "codex",
        encryptedApiKey: encryptedKey,
        modelOverride: "gpt-5.2-codex",
      },
    });

    expect(result.kind).toBe("knowledge");
    if (result.kind !== "knowledge") {
      throw new Error(`Expected knowledge reply, got ${result.kind}`);
    }
    expect(result.text).toContain("share a bit more detail");
    expect((axiosSpy.mock.calls[0]?.[1] as { model?: string }).model).toBe(
      "gpt-5.2-codex"
    );
  });

  it("returns key-missing reason when no workspace or env key is present", async () => {
    const axiosSpy = vi.spyOn(axios, "post");
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "";

    const result = await aiReplyService.generateReply({
      workspaceId: new mongoose.Types.ObjectId().toString(),
      message: {
        channel: "telegram",
        externalChatId: "test-chat",
        direction: "inbound",
        senderType: "customer",
        kind: "text",
        text: { body: "Hello" },
        raw: {},
        occurredAt: new Date(),
      },
      channel: "telegram",
      workspaceAiOverride: undefined,
    });

    process.env.OPENAI_API_KEY = originalOpenAiKey;

    expect(result.kind).toBe("low_confidence");
    expect(result.reason).toMatch(/Workspace Codex API key is not configured/i);
    expect(axiosSpy).not.toHaveBeenCalled();
  });
});
