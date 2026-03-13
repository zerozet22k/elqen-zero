import {
  AISettingsModel,
  AutomationRuleModel,
  BusinessHoursModel,
} from "../models";
import { CanonicalMessage } from "../channels/types";
import { aiReplyService } from "./ai-reply.service";
import { auditLogService } from "./audit-log.service";
import { conversationService } from "./conversation.service";
import { outboundMessageService } from "./outbound-message.service";

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

class AutomationService {
  async handleInbound(params: {
    workspaceId: string;
    conversationId: string;
    message: CanonicalMessage;
  }) {
    if (
      params.message.direction !== "inbound" ||
      params.message.senderType !== "customer"
    ) {
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
      return;
    }

    if (
      conversation.aiState === "human_requested" ||
      conversation.aiState === "human_active"
    ) {
      return;
    }

    if (
      !aiSettings?.enabled ||
      !aiSettings.autoReplyEnabled ||
      !aiSettings.afterHoursEnabled
    ) {
      return;
    }

    if (!businessHours || !afterHoursRule) {
      return;
    }

    const inboundOccurredAt = params.message.occurredAt ?? new Date();
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

    if (withinBusinessHours) {
      return;
    }

    const suggestion = await aiReplyService.generateReply({
      workspaceId: params.workspaceId,
      message: params.message,
    });

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
      },
    });

    if (
      suggestion.kind === "unsupported" ||
      suggestion.confidence < (aiSettings.confidenceThreshold ?? 0.7)
    ) {
      await conversationService.requestHumanHandoff(params.conversationId);

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
          ruleId: String(afterHoursRule._id),
        },
      });
      return;
    }

    if (!(suggestion.kind === "canned" || suggestion.kind === "knowledge")) {
      return;
    }

    const responseText = suggestion.text;
    const replyOccurredAt = new Date(inboundOccurredAt.getTime() + 1000);

    const result = await outboundMessageService.send({
      conversationId: params.conversationId,
      command: {
        senderType: "automation",
        kind: "text",
        text: {
          body: responseText,
          plain: responseText,
        },
        meta: {
          automationRuleId: String(afterHoursRule._id),
          sourceHints: suggestion.sourceHints,
        },
        occurredAt: replyOccurredAt,
      },
      source: "automation",
    });

    await conversationService.setAIState(
      params.conversationId,
      "auto_replied"
    );

    await auditLogService.record({
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      messageId: String(result.message._id),
      actorType: "automation",
      eventType: "automation.reply.sent",
      reason: suggestion.reason,
      confidence: suggestion.confidence,
      sourceHints: suggestion.sourceHints,
      data: {
        ruleId: String(afterHoursRule._id),
        replyType: suggestion.kind,
      },
    });
  }
}

export const automationService = new AutomationService();