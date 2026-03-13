import axios from "axios";
import { CannedReplyModel, KnowledgeItemModel } from "../models";
import { CanonicalMessage } from "../channels/types";
import { env } from "../config/env";

type AIReplyResult =
  | {
    kind: "canned" | "knowledge";
    text: string;
    confidence: number;
    sourceHints: string[];
    reason: string;
  }
  | {
    kind: "unsupported" | "low_confidence";
    confidence: number;
    sourceHints: string[];
    reason: string;
  };

type KnowledgePromptItem = {
  title: string;
  content: string;
  tags: string[];
};

class AIReplyService {
  async generateReply(params: {
    workspaceId: string;
    message: CanonicalMessage;
  }): Promise<AIReplyResult> {
    if (params.message.kind === "unsupported") {
      return {
        kind: "unsupported",
        confidence: 0,
        sourceHints: [],
        reason: "Unsupported inbound content requires human review",
      };
    }

    const incomingText = this.normalizeText(params.message.text?.body);
    if (!incomingText) {
      return {
        kind: "low_confidence",
        confidence: 0,
        sourceHints: [],
        reason: "Message does not contain text that can be matched safely",
      };
    }

    const [cannedReplies, knowledgeItems] = await Promise.all([
      CannedReplyModel.find({
        workspaceId: params.workspaceId,
        isActive: true,
      }),
      KnowledgeItemModel.find({
        workspaceId: params.workspaceId,
        isActive: true,
      })
        .sort({ updatedAt: -1 })
        .limit(8),
    ]);

    const geminiResult = await this.tryKnowledgeReply({
      incomingText,
      knowledgeItems: knowledgeItems.map((item) => ({
        title: item.title,
        content: item.content,
        tags: item.tags,
      })),
    });

    if (
      geminiResult.kind === "knowledge" &&
      geminiResult.text.trim() &&
      geminiResult.confidence >= 0.7
    ) {
      return geminiResult;
    }

    const cannedResult = this.tryCannedReply({
      incomingText,
      cannedReplies,
    });

    if (cannedResult) {
      return cannedResult;
    }

    return geminiResult;
  }

  private tryCannedReply(params: {
    incomingText: string;
    cannedReplies: Array<{
      title: string;
      body: string;
      triggers: string[];
    }>;
  }): AIReplyResult | null {
    for (const reply of params.cannedReplies) {
      const cleanedTriggers = this.normalizeTriggers(reply.triggers);

      const matchedTrigger = cleanedTriggers.find((trigger) =>
        this.matchesTrigger(params.incomingText, trigger)
      );

      if (matchedTrigger) {
        return {
          kind: "canned",
          text: reply.body,
          confidence: 0.95,
          sourceHints: [reply.title],
          reason: `Matched canned reply trigger "${matchedTrigger}"`,
        };
      }
    }

    return null;
  }

  private async tryKnowledgeReply(params: {
    incomingText: string;
    knowledgeItems: KnowledgePromptItem[];
  }): Promise<AIReplyResult> {
    const geminiApiKey = env.GEMINI_API_KEY?.trim();
    const geminiModel = env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite-preview";
    console.log("[AI] calling Gemini with model:", geminiModel);
    if (!geminiApiKey) {
      return {
        kind: "low_confidence",
        confidence: 0.2,
        sourceHints: [],
        reason: "Gemini API key is not configured",
      };
    }

    if (!params.knowledgeItems.length) {
      return {
        kind: "low_confidence",
        confidence: 0.2,
        sourceHints: [],
        reason: "No active context items are available",
      };
    }

    try {
      console.log("[AI] calling Gemini with model:", geminiModel);

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
        {
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: this.buildGeminiPrompt({
                    incomingText: params.incomingText,
                    knowledgeItems: params.knowledgeItems,
                  }),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        },
        {
          headers: {
            "x-goog-api-key": geminiApiKey,
            "Content-Type": "application/json",
          },
        }
      );

      const result = this.parseGeminiResult(response.data);

      if (!result.replyText) {
        return {
          kind: "low_confidence",
          confidence: 0.2,
          sourceHints: [],
          reason: result.reason || "Gemini did not return a usable reply",
        };
      }

      return {
        kind: "knowledge",
        text: result.replyText,
        confidence: result.confidence,
        sourceHints: result.sourceHints,
        reason: result.reason || "Gemini generated a reply from provided context",
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("[AI] Gemini error response:", error.response?.data);
      } else {
        console.error("[AI] Gemini error:", error);
      }

      return {
        kind: "low_confidence",
        confidence: 0.2,
        sourceHints: [],
        reason:
          error instanceof Error
            ? `Gemini request failed: ${error.message}`
            : "Gemini request failed",
      };
    }
  }

  private buildGeminiPrompt(params: {
    incomingText: string;
    knowledgeItems: KnowledgePromptItem[];
  }) {
    return [
      "You are assisting an ecommerce seller inbox.",
      "Use only the provided context items below.",
      "Do not invent policies, products, prices, shipping timelines, or return rules.",
      "If the context is insufficient, return empty replyText and low confidence.",
      "Keep the reply concise, customer-friendly, and directly useful.",
      'Return strict JSON with keys: replyText, confidence, sourceHints, reason.',
      "",
      `Customer message: ${params.incomingText}`,
      "",
      "Context items:",
      ...params.knowledgeItems.map(
        (item, index) =>
          `${index + 1}. ${item.title}\nTags: ${item.tags.join(", ")}\n${item.content}`
      ),
    ].join("\n");
  }

  private parseGeminiResult(data: unknown) {
    const rawText =
      (data as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      }).candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";

    if (!rawText) {
      return {
        replyText: "",
        confidence: 0.2,
        sourceHints: [] as string[],
        reason: "Gemini returned an empty response",
      };
    }

    const normalized = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    try {
      const parsed = JSON.parse(normalized) as {
        replyText?: string;
        confidence?: number;
        sourceHints?: string[];
        reason?: string;
      };

      return {
        replyText: parsed.replyText?.trim() ?? "",
        confidence:
          typeof parsed.confidence === "number"
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0.75,
        sourceHints: Array.isArray(parsed.sourceHints)
          ? parsed.sourceHints.map((item) => String(item))
          : [],
        reason: parsed.reason ?? "Gemini generated a reply from provided context",
      };
    } catch {
      return {
        replyText: "",
        confidence: 0.2,
        sourceHints: [] as string[],
        reason: "Gemini response was not valid JSON",
      };
    }
  }

  private normalizeText(value?: string | null) {
    return (value ?? "").trim().toLowerCase();
  }

  private normalizeTriggers(triggers: string[]) {
    return [
      ...new Set(
        triggers
          .map((trigger) => this.normalizeText(trigger))
          .filter((trigger) => trigger.length > 0)
      ),
    ];
  }

  private matchesTrigger(incomingText: string, trigger: string) {
    if (!trigger) {
      return false;
    }

    if (incomingText === trigger) {
      return true;
    }

    const escapedTrigger = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escapedTrigger}\\b`, "i");
    return regex.test(incomingText);
  }
}

export const aiReplyService = new AIReplyService();