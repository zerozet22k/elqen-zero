import {
  AISettingsModel,
  AutomationRuleModel,
  BusinessHoursModel,
} from "../models";
import { CanonicalMessage } from "../channels/types";
import { emitRealtimeEvent } from "../lib/realtime";
import { aiReplyService } from "./ai-reply.service";
import { auditLogService } from "./audit-log.service";
import { conversationService } from "./conversation.service";
import { contactService } from "./contact.service";
import { messageService } from "./message.service";
import { outboundContentExecutorService } from "./outbound-content-executor.service";

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const getLocalDayAndTime = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return {
    dayOfWeek: weekdayMap[weekday] ?? 0,
    minutes: Number(hour) * 60 + Number(minute),
  };
};

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const HUMAN_PENDING_ACK_COOLDOWN_MS = 15 * 60 * 1000;
const DEFAULT_FALLBACK_MESSAGE =
  "Thanks for your message. A teammate will follow up soon.";

class AutomationService {
  private async recordSkip(params: {
    workspaceId: string;
    conversationId: string;
    reason: string;
    data?: Record<string, unknown>;
  }) {
    await auditLogService.record({
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      actorType: "automation",
      eventType: "automation.decision.skipped",
      reason: params.reason,
      data: params.data,
    });
  }

  private extractDraftMessages(
    blocks: Array<{
      kind: string;
      text?: { body?: string; plain?: string };
    }>
  ) {
    return blocks
      .filter((block) => block.kind === "text")
      .map((block) => block.text?.body?.trim() || block.text?.plain?.trim() || "")
      .filter((message) => message.length > 0);
  }

  private buildReviewSystemText(params: {
    reason: string;
    confidence: number;
    sourceHints: string[];
    internalNote: string;
    draftMessages: string[];
    customerAcknowledged: boolean;
  }) {
    return [
      params.customerAcknowledged
        ? "Human follow-up requested"
        : "Draft reply ready for human review",
      `Reason: ${params.reason}`,
      `Confidence: ${Math.round(params.confidence * 100)}%`,
      params.sourceHints.length
        ? `Knowledge library: ${params.sourceHints.join(", ")}`
        : "Knowledge library: none",
      "",
      ...(params.customerAcknowledged
        ? [
            "Customer status:",
            "1. Customer has already been acknowledged and is waiting for staff follow-up.",
            "",
          ]
        : [
            "Draft reply:",
            ...(params.draftMessages.length
              ? params.draftMessages.map((message, index) => `${index + 1}. ${message}`)
              : ["1. [No customer-facing draft provided]"]),
            "",
          ]),
      "Staff note:",
      params.internalNote,
    ].join("\n");
  }

  private hasRecentAgentOrAutomationReply(
    recentMessages: Array<{
      senderType: string;
      direction?: string;
      meta?: Record<string, unknown>;
      createdAt: Date;
    }>,
    inboundOccurredAt: Date
  ) {
    return recentMessages.some((message) => {
      const sentRecently =
        inboundOccurredAt.getTime() - new Date(message.createdAt).getTime() <=
        HUMAN_PENDING_ACK_COOLDOWN_MS;

      if (!sentRecently || message.direction !== "outbound") {
        return false;
      }

      if (message.senderType === "agent") {
        return true;
      }

      if (message.senderType !== "automation" && message.senderType !== "ai") {
        return false;
      }

      const replyType = String(message.meta?.replyType ?? "").trim();
      return replyType === "human_pending_ack" || replyType === "after_hours_fallback";
    });
  }

  private buildHumanPendingText(params: {
    message: CanonicalMessage;
    fallbackText?: string | null;
    isOutsideBusinessHours: boolean;
  }) {
    const configuredText = params.fallbackText?.trim();
    if (configuredText && configuredText !== DEFAULT_FALLBACK_MESSAGE) {
      return configuredText;
    }

    const incomingText = String(params.message.text?.body ?? "").toLowerCase();
    const hasMedia = !!params.message.media?.length || ["image", "file"].includes(params.message.kind);
    const mentionsPayment = /(payment|paid|pay|wave|kpay|kbz|transfer|receipt|invoice|ငွေ|လွှဲ|ပေးချေ)/i.test(
      incomingText
    );
    const indicatesPaymentProof =
      hasMedia ||
      /(i have sent|i sent|paid|payment sent|transfer done|receipt|screenshot|already paid|လွှဲပြီး|ပေးပြီး|ပို့ပြီး|ငွေလွှဲပြီး)/i.test(
        incomingText
      );

    if (mentionsPayment && indicatesPaymentProof) {
      return params.isOutsideBusinessHours
        ? "ကျေးဇူးတင်ပါတယ်ခင်ဗျာ။ ငွေပေးချေမှုအချက်အလက်ကို လက်ခံရရှိထားပါတယ်။ လုပ်ငန်းချိန်အတွင်း team က စစ်ဆေးပြီး ပြန်လည်အကြောင်းကြားပေးပါမယ်ခင်ဗျာ။"
        : "ကျေးဇူးတင်ပါတယ်ခင်ဗျာ။ ငွေပေးချေမှုအချက်အလက်ကို လက်ခံရရှိထားပါတယ်။ Team က စစ်ဆေးပြီး မကြာခင် ပြန်လည်အကြောင်းကြားပေးပါမယ်ခင်ဗျာ။";
    }

    if (mentionsPayment) {
      return params.isOutsideBusinessHours
        ? "ကျေးဇူးတင်ပါတယ်ခင်ဗျာ။ ငွေပေးချေမှုဆိုင်ရာအသေးစိတ်ကို staff team က လုပ်ငန်းချိန်အတွင်း စစ်ဆေးပြီး ပြန်လည်အကြောင်းကြားပေးပါမယ်ခင်ဗျာ။"
        : "ကျေးဇူးတင်ပါတယ်ခင်ဗျာ။ ငွေပေးချေမှုဆိုင်ရာအသေးစိတ်ကို staff team က စစ်ဆေးပြီး မကြာခင် ပြန်လည်အကြောင်းကြားပေးပါမယ်ခင်ဗျာ။";
    }

    return params.isOutsideBusinessHours
      ? "ကျေးဇူးတင်ပါတယ်ခင်ဗျာ။ သက်ဆိုင်ရာ team က လုပ်ငန်းချိန်အတွင်း စစ်ဆေးပြီး ပြန်လည်အကြောင်းကြားပေးပါမယ်ခင်ဗျာ။"
      : "ကျေးဇူးတင်ပါတယ်ခင်ဗျာ။ သက်ဆိုင်ရာ team က စစ်ဆေးပြီး မကြာခင် ပြန်လည်အကြောင်းကြားပေးပါမယ်ခင်ဗျာ။";
  }

  private async sendHumanPendingAcknowledgement(params: {
    workspaceId: string;
    conversationId: string;
    ruleId?: string;
    fallbackText?: string | null;
    inboundOccurredAt: Date;
    confidence: number;
    sourceHints: string[];
    message: CanonicalMessage;
    isOutsideBusinessHours: boolean;
    recentMessages?: Array<{
      senderType: string;
      direction?: string;
      meta?: Record<string, unknown>;
      createdAt: Date;
    }>;
  }) {
    if (
      params.recentMessages &&
      this.hasRecentAgentOrAutomationReply(params.recentMessages, params.inboundOccurredAt)
    ) {
      return false;
    }

    const acknowledgementText = this.buildHumanPendingText({
      message: params.message,
      fallbackText: params.fallbackText,
      isOutsideBusinessHours: params.isOutsideBusinessHours,
    });

    if (!acknowledgementText) {
      return false;
    }

    const replyOccurredAt = new Date(params.inboundOccurredAt.getTime() + 1000);
    const result = await outboundContentExecutorService.sendBlocks({
      conversationId: params.conversationId,
      senderType: "automation",
      blocks: [
        {
          kind: "text",
          text: { body: acknowledgementText, plain: acknowledgementText },
        },
      ],
      meta: {
        automationRuleId: params.ruleId,
        sourceHints: params.sourceHints,
        replyType: "human_pending_ack",
      },
      source: "automation",
      occurredAt: replyOccurredAt,
    });
    const finalMessage = result.messages[result.messages.length - 1];

    await auditLogService.record({
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      messageId: finalMessage ? String(finalMessage._id) : undefined,
      actorType: "automation",
      eventType: "automation.reply.sent",
      reason: "Sent customer acknowledgement while waiting for human follow-up",
      confidence: params.confidence,
      sourceHints: params.sourceHints,
      data: {
        messageIds: result.messages.map((message) => String(message._id)),
        ruleId: params.ruleId,
        replyType: "human_pending_ack",
        outsideBusinessHours: params.isOutsideBusinessHours,
      },
    });

    return true;
  }

  private async sendAfterHoursFallback(params: {
    workspaceId: string;
    conversationId: string;
    ruleId?: string;
    fallbackText?: string | null;
    inboundOccurredAt: Date;
    confidence: number;
    sourceHints: string[];
  }) {
    const fallbackText = params.fallbackText?.trim();
    if (!fallbackText) {
      return false;
    }

    const replyOccurredAt = new Date(params.inboundOccurredAt.getTime() + 1000);
    const result = await outboundContentExecutorService.sendBlocks({
      conversationId: params.conversationId,
      senderType: "automation",
      blocks: [
        {
          kind: "text",
          text: { body: fallbackText, plain: fallbackText },
        },
      ],
      meta: {
        automationRuleId: params.ruleId,
        sourceHints: [],
      },
      source: "automation",
      occurredAt: replyOccurredAt,
    });
    const finalMessage = result.messages[result.messages.length - 1];

    await auditLogService.record({
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      messageId: finalMessage ? String(finalMessage._id) : undefined,
      actorType: "automation",
      eventType: "automation.reply.sent",
      reason: "Sent after-hours fallback text",
      confidence: params.confidence,
      sourceHints: params.sourceHints,
      data: {
        messageIds: result.messages.map((message) => String(message._id)),
        ruleId: params.ruleId,
        replyType: "after_hours_fallback",
        outsideBusinessHours: true,
      },
    });

    return true;
  }

  private async createReviewNote(params: {
    workspaceId: string;
    conversationId: string;
    channel: CanonicalMessage["channel"];
    channelAccountId: string;
    externalChatId: string;
    reason: string;
    confidence: number;
    sourceHints: string[];
    internalNote: string;
    draftMessages: string[];
    customerAcknowledged: boolean;
    occurredAt: Date;
  }) {
    const note = await messageService.createInternalSystemMessage({
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      channel: params.channel,
      channelAccountId: params.channelAccountId,
      externalChatId: params.externalChatId,
      text: this.buildReviewSystemText({
        reason: params.reason,
        confidence: params.confidence,
        sourceHints: params.sourceHints,
        internalNote: params.internalNote,
        draftMessages: params.draftMessages,
        customerAcknowledged: params.customerAcknowledged,
      }),
      meta: {
        internalNoteType: "ai_review",
        draftMessages: params.draftMessages,
        sourceHints: params.sourceHints,
      },
      occurredAt: params.occurredAt,
    });

    emitRealtimeEvent("message.sent", {
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      messageId: String(note._id),
      deliveryStatus: "sent",
      internal: true,
    });

    return note;
  }

  async handleInbound(params: {
    workspaceId: string;
    conversationId: string;
    message: CanonicalMessage;
  }) {
    if (
      params.message.direction !== "inbound" ||
      params.message.senderType !== "customer"
    ) {
      await this.recordSkip({
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        reason: "Inbound message is not customer-originated",
        data: {
          direction: params.message.direction,
          senderType: params.message.senderType,
        },
      });
      return;
    }

    const [aiSettings, businessHours, afterHoursRule, conversation] =
      await Promise.all([
        AISettingsModel.findOne({ workspaceId: params.workspaceId }),
        BusinessHoursModel.findOne({ workspaceId: params.workspaceId }),
        AutomationRuleModel.findOne({
          workspaceId: params.workspaceId,
          type: "after_hours_auto_reply",
          isActive: true,
        }),
        conversationService.getById(params.conversationId),
      ]);

    if (!conversation || !conversation.aiEnabled) {
      await this.recordSkip({
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        reason: !conversation
          ? "Conversation not found for automation"
          : "Conversation AI disabled",
      });
      return;
    }

    const contact = conversation.contactId
      ? await contactService.getById(String(conversation.contactId))
      : null;

    const effectiveEnabled = aiSettings?.enabled ?? true;
    const effectiveAutoReplyEnabled = aiSettings?.autoReplyEnabled ?? true;
    const effectiveAutoReplyMode =
      aiSettings?.autoReplyMode || (effectiveAutoReplyEnabled ? "all" : "none");
    const effectiveFallbackRepliesEnabled = aiSettings?.afterHoursEnabled ?? true;
    const effectiveConfidenceThreshold = aiSettings?.confidenceThreshold ?? 0.7;

    if (!effectiveEnabled || !effectiveAutoReplyEnabled) {
      await this.recordSkip({
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        reason: "Workspace AI auto-reply is disabled",
        data: {
          enabled: effectiveEnabled,
          autoReplyEnabled: effectiveAutoReplyEnabled,
        },
      });
      return;
    }

    const inboundOccurredAt = params.message.occurredAt ?? new Date();
    let isOutsideBusinessHours = false;

    if (businessHours) {
      const local = getLocalDayAndTime(inboundOccurredAt, businessHours.timeZone);
      const dayConfig = businessHours.weeklySchedule.find(
        (day) => day.dayOfWeek === local.dayOfWeek
      );

      const withinBusinessHours =
        !!dayConfig?.enabled &&
        dayConfig.windows.some((window) => {
          const start = toMinutes(window.start);
          const end = toMinutes(window.end);
          return local.minutes >= start && local.minutes <= end;
        });

      isOutsideBusinessHours = !withinBusinessHours;
    }

    const shouldRunAutoReplyForWindow =
      effectiveAutoReplyMode === "all" ||
      (effectiveAutoReplyMode === "after_hours_only" && isOutsideBusinessHours) ||
      (effectiveAutoReplyMode === "business_hours_only" && !isOutsideBusinessHours);

    if (!shouldRunAutoReplyForWindow) {
      await this.recordSkip({
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        reason: "Auto-reply mode does not allow this time window",
        data: {
          autoReplyMode: effectiveAutoReplyMode,
          outsideBusinessHours: isOutsideBusinessHours,
        },
      });
      return;
    }

    if (
      conversation.aiState === "needs_human" ||
      conversation.aiState === "human_requested" ||
      conversation.aiState === "human_active"
    ) {
      const recentMessages = await messageService.listRecentCanonicalByConversation(
        params.conversationId,
        12
      );

      const pendingAckSent = await this.sendHumanPendingAcknowledgement({
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        fallbackText: aiSettings?.fallbackMessage,
        inboundOccurredAt,
        confidence: 0.4,
        sourceHints: [],
        message: params.message,
        isOutsideBusinessHours,
        recentMessages,
      });

      await this.recordSkip({
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        reason: "Conversation is in human-handoff state",
        data: {
          aiState: conversation.aiState,
          pendingAckSent,
        },
      });
      return;
    }

    if (isOutsideBusinessHours && !afterHoursRule) {
      await this.recordSkip({
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        reason: "Outside business hours but no active after-hours rule",
        data: {
          outsideBusinessHours: true,
        },
      });
      return;
    }

    const afterHoursFallbackText =
      aiSettings?.fallbackMessage?.trim() ||
      (typeof (afterHoursRule?.action as { fallbackText?: string } | undefined)
        ?.fallbackText === "string"
        ? ((afterHoursRule?.action as { fallbackText: string }).fallbackText ?? "").trim()
        : "");
    const shouldSendRuleFallback =
      effectiveFallbackRepliesEnabled && isOutsideBusinessHours;
    const afterHoursRuleId = afterHoursRule ? String(afterHoursRule._id) : undefined;

    const recentMessages = await messageService.listRecentCanonicalByConversation(
      params.conversationId,
      12
    );

    const suggestion = await aiReplyService.generateReply({
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      message: params.message,
      channel: conversation.channel,
      recentMessages,
      workspaceAiOverride: aiSettings
        ? {
            encryptedApiKey:
              aiSettings.geminiApiKey || aiSettings.assistantApiKey || undefined,
            modelOverride:
              aiSettings.geminiModel || aiSettings.assistantModel || undefined,
            assistantInstructions: aiSettings.assistantInstructions || undefined,
          }
        : undefined,
      contactProfile: contact
        ? {
            primaryName: contact.primaryName,
            phones: contact.phones,
            deliveryAddress: contact.deliveryAddress,
            notes: contact.notes,
            aiNotes: contact.aiNotes,
          }
        : undefined,
    });

    const updatedContact =
      contact && suggestion.contactUpdates
        ? await contactService.applyAIProfileUpdate({
            workspaceId: params.workspaceId,
            contactId: String(contact._id),
            update: suggestion.contactUpdates,
          })
        : null;

    if (updatedContact) {
      emitRealtimeEvent("contact.updated", {
        workspaceId: params.workspaceId,
        contactId: String(updatedContact._id),
        contact: updatedContact.toObject(),
      });
    }

    await auditLogService.record({
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      actorType: "automation",
      eventType: "automation.decision.evaluated",
      reason: suggestion.reason,
      confidence: suggestion.confidence,
      sourceHints: suggestion.sourceHints,
      data: {
        decisionKind: suggestion.kind,
        messageKind: params.message.kind,
        outsideBusinessHours: isOutsideBusinessHours,
        contactUpdated: !!updatedContact,
        internalNote:
          "internalNote" in suggestion ? suggestion.internalNote || undefined : undefined,
      },
    });

    if (suggestion.kind === "review") {
      const fallbackSent =
        shouldSendRuleFallback &&
        (await this.sendAfterHoursFallback({
          workspaceId: params.workspaceId,
          conversationId: params.conversationId,
          ruleId: afterHoursRuleId,
          fallbackText: afterHoursFallbackText,
          inboundOccurredAt,
          confidence: suggestion.confidence,
          sourceHints: suggestion.sourceHints,
        }));
      const pendingAckSent =
        !fallbackSent &&
        (await this.sendHumanPendingAcknowledgement({
          workspaceId: params.workspaceId,
          conversationId: params.conversationId,
          ruleId: afterHoursRuleId,
          fallbackText: aiSettings?.fallbackMessage,
          inboundOccurredAt,
          confidence: suggestion.confidence,
          sourceHints: suggestion.sourceHints,
          message: params.message,
          isOutsideBusinessHours,
          recentMessages,
        }));

      const draftMessages = this.extractDraftMessages(suggestion.blocks);
      const reviewNote = await this.createReviewNote({
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        channel: conversation.channel,
        channelAccountId: conversation.channelAccountId,
        externalChatId: conversation.externalChatId,
        reason: suggestion.reason,
        confidence: suggestion.confidence,
        sourceHints: suggestion.sourceHints,
        internalNote: suggestion.internalNote,
        draftMessages,
        customerAcknowledged: fallbackSent || pendingAckSent,
        occurredAt: new Date(
          inboundOccurredAt.getTime() + (fallbackSent || pendingAckSent ? 2000 : 1000)
        ),
      });

      const handoffConversation = await conversationService.requestHumanHandoff(
        params.conversationId
      );

      emitRealtimeEvent("conversation.updated", {
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        status: handoffConversation?.status ?? conversation.status,
      });

      await auditLogService.record({
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        messageId: reviewNote ? String(reviewNote._id) : undefined,
        actorType: "automation",
        eventType: "automation.review.requested",
        reason: suggestion.reason,
        confidence: suggestion.confidence,
        sourceHints: suggestion.sourceHints,
        data: {
          draftMessages,
          internalNote: suggestion.internalNote,
          fallbackSent,
          pendingAckSent,
          messageKind: params.message.kind,
          ruleId: afterHoursRuleId,
          outsideBusinessHours: isOutsideBusinessHours,
        },
      });
      return;
    }

    if (
      suggestion.kind === "unsupported" ||
      suggestion.kind === "requires_human" ||
      suggestion.kind === "low_confidence" ||
      suggestion.confidence < effectiveConfidenceThreshold
    ) {
      const fallbackSent =
        shouldSendRuleFallback &&
        (await this.sendAfterHoursFallback({
          workspaceId: params.workspaceId,
          conversationId: params.conversationId,
          ruleId: afterHoursRuleId,
          fallbackText: afterHoursFallbackText,
          inboundOccurredAt,
          confidence: suggestion.confidence,
          sourceHints: suggestion.sourceHints,
        }));

      const pendingAckSent =
        !fallbackSent &&
        (await this.sendHumanPendingAcknowledgement({
          workspaceId: params.workspaceId,
          conversationId: params.conversationId,
          ruleId: afterHoursRuleId,
          fallbackText: aiSettings?.fallbackMessage,
          inboundOccurredAt,
          confidence: suggestion.confidence,
          sourceHints: suggestion.sourceHints,
          message: params.message,
          isOutsideBusinessHours,
          recentMessages,
        }));

      if (fallbackSent) {
        return;
      }

      const handoffConversation = await conversationService.requestHumanHandoff(
        params.conversationId
      );

      emitRealtimeEvent("conversation.updated", {
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        status: handoffConversation?.status ?? conversation.status,
      });

      await auditLogService.record({
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        actorType: "automation",
        eventType: "automation.handoff.requested",
        reason: suggestion.reason,
        confidence: suggestion.confidence,
        sourceHints: suggestion.sourceHints,
        data: {
          messageKind: params.message.kind,
          ruleId: afterHoursRuleId,
          outsideBusinessHours: isOutsideBusinessHours,
          pendingAckSent,
          internalNote:
            "internalNote" in suggestion ? suggestion.internalNote || undefined : undefined,
          escalationReason:
            suggestion.kind === "requires_human" ? suggestion.reason : undefined,
        },
      });
      return;
    }

    if (!(suggestion.kind === "canned" || suggestion.kind === "knowledge")) {
      return;
    }

    const replyOccurredAt = new Date(inboundOccurredAt.getTime() + 1000);

    const result = await outboundContentExecutorService.sendBlocks({
      conversationId: params.conversationId,
      senderType: "automation",
      blocks: suggestion.blocks,
      meta: {
        automationRuleId: afterHoursRuleId,
        sourceHints: suggestion.sourceHints,
      },
      source: "automation",
      occurredAt: replyOccurredAt,
    });
    const finalMessage = result.messages[result.messages.length - 1];

    await conversationService.setAIState(params.conversationId, "auto_replied");

    await auditLogService.record({
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      messageId: finalMessage ? String(finalMessage._id) : undefined,
      actorType: "automation",
      eventType: "automation.reply.sent",
      reason: suggestion.reason,
      confidence: suggestion.confidence,
      sourceHints: suggestion.sourceHints,
      data: {
        messageIds: result.messages.map((message) => String(message._id)),
        blockKinds: suggestion.blocks.map((block) => block.kind),
        ruleId: afterHoursRuleId,
        replyType: suggestion.kind,
        outsideBusinessHours: isOutsideBusinessHours,
      },
    });
  }
}

export const automationService = new AutomationService();
