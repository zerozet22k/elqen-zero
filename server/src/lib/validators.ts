import { z } from "zod";
import {
  CHANNELS,
  CONVERSATION_AI_STATES,
  CONVERSATION_STATUSES,
  OUTBOUND_MESSAGE_KINDS,
  SENDER_TYPES,
} from "../channels/types";

export const objectIdParamSchema = z.object({
  id: z.string().min(1),
});

export const createChannelConnectionSchema = z.object({
  workspaceId: z.string().min(1),
  displayName: z.string().min(1).optional(),
  externalAccountId: z.string().min(1).optional(),
  credentials: z.record(z.any()).default({}),
  webhookConfig: z.record(z.any()).default({}),
});

export const conversationQuerySchema = z.object({
  workspaceId: z.string().min(1),
  status: z.enum(CONVERSATION_STATUSES).optional(),
  channel: z.enum(CHANNELS).optional(),
  assigneeUserId: z.string().optional(),
  search: z.string().optional(),
});

export const createOutboundMessageSchema = z.object({
  senderType: z.enum(["agent"]).default("agent"),
  kind: z.enum(OUTBOUND_MESSAGE_KINDS),
  text: z
    .object({
      body: z.string().min(1),
      plain: z.string().optional(),
    })
    .optional(),
  media: z
    .array(
      z.object({
        url: z.string().min(1),
        mimeType: z.string().optional(),
        filename: z.string().optional(),
      })
    )
    .optional(),
  meta: z.record(z.any()).optional(),
});

export const updateConversationSchema = z.object({
  status: z.enum(CONVERSATION_STATUSES).optional(),
  assigneeUserId: z.string().nullable().optional(),
  aiEnabled: z.boolean().optional(),
  aiState: z.enum(CONVERSATION_AI_STATES).optional(),
  tags: z.array(z.string()).optional(),
});

export const createKnowledgeItemSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

export const updateKnowledgeItemSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const createCannedReplySchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  triggers: z.array(z.string()).default([]),
  category: z.string().default("general"),
});

export const updateCannedReplySchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  triggers: z.array(z.string()).optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateAISettingsSchema = z.object({
  workspaceId: z.string().min(1),
  enabled: z.boolean().optional(),
  autoReplyEnabled: z.boolean().optional(),
  afterHoursEnabled: z.boolean().optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  fallbackMessage: z.string().optional(),
});

export const updateAutomationsSchema = z.object({
  workspaceId: z.string().min(1),
  businessHours: z
    .object({
      timeZone: z.string().min(1),
      weeklySchedule: z.array(
        z.object({
          dayOfWeek: z.number().min(0).max(6),
          enabled: z.boolean(),
          windows: z.array(
            z.object({
              start: z.string().regex(/^\d{2}:\d{2}$/),
              end: z.string().regex(/^\d{2}:\d{2}$/),
            })
          ),
        })
      ),
    })
    .optional(),
  afterHoursRule: z
    .object({
      isActive: z.boolean(),
      name: z.string().min(1),
      fallbackText: z.string().optional(),
    })
    .optional(),
});

export const auditLogQuerySchema = z.object({
  workspaceId: z.string().min(1),
  conversationId: z.string().optional(),
  eventType: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
});
