import { Router } from "express";
import { AISettingsModel } from "../../models";
import { asyncHandler } from "../../lib/async-handler";
import { updateAISettingsSchema } from "../../lib/validators";
import { requireWorkspace } from "../../middleware/require-workspace";
import { requireRole } from "../../middleware/require-role";
import { encryptField } from "../../lib/crypto";
import { env } from "../../config/env";
import {
  channelSupportService,
  DEFAULT_SUPPORTED_CHANNELS,
} from "../../services/channel-support.service";

const router = Router();
router.use(requireWorkspace);

const encryptionSecret = () => env.FIELD_ENCRYPTION_KEY || env.SESSION_SECRET;

const serializeSettings = (settings: InstanceType<typeof AISettingsModel> | null) => {
  if (!settings) return null;
  const storedGeminiModel = settings.geminiModel || settings.assistantModel || "";
  const storedGeminiApiKey = settings.geminiApiKey || settings.assistantApiKey || "";
  const autoReplyMode =
    settings.autoReplyMode || (settings.autoReplyEnabled ? "all" : "none");
  return {
    workspaceId: String(settings.workspaceId),
    enabled: settings.enabled,
    autoReplyEnabled: settings.autoReplyEnabled,
    autoReplyMode,
    afterHoursEnabled: settings.afterHoursEnabled,
    confidenceThreshold: settings.confidenceThreshold,
    fallbackMessage: settings.fallbackMessage,
    assistantInstructions: settings.assistantInstructions || "",
    geminiModel: storedGeminiModel,
    supportedChannels: {
      ...DEFAULT_SUPPORTED_CHANNELS,
      ...(settings.supportedChannels ?? {}),
    },
    hasGeminiApiKey: !!storedGeminiApiKey,
  };
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.workspace?._id ?? "");
    const settings = await AISettingsModel.findOne({ workspaceId });
    res.json({ settings: serializeSettings(settings) });
  })
);

router.patch(
  "/",
  requireRole(["owner", "admin"]),
  asyncHandler(async (req, res) => {
    const payload = updateAISettingsSchema.parse({
      ...req.body,
      workspaceId: String(req.workspace?._id ?? ""),
    });

    const updateFields: Record<string, unknown> = {
      workspaceId: payload.workspaceId,
    };

    if (payload.enabled !== undefined) updateFields.enabled = payload.enabled;
    if (payload.autoReplyMode !== undefined) {
      updateFields.autoReplyMode = payload.autoReplyMode;
      updateFields.autoReplyEnabled = payload.autoReplyMode !== "none";
    } else if (payload.autoReplyEnabled !== undefined) {
      updateFields.autoReplyEnabled = payload.autoReplyEnabled;
      updateFields.autoReplyMode = payload.autoReplyEnabled ? "all" : "none";
    }
    if (payload.afterHoursEnabled !== undefined) updateFields.afterHoursEnabled = payload.afterHoursEnabled;
    if (payload.confidenceThreshold !== undefined) updateFields.confidenceThreshold = payload.confidenceThreshold;
    if (payload.fallbackMessage !== undefined) updateFields.fallbackMessage = payload.fallbackMessage;
    if (payload.assistantInstructions !== undefined) updateFields.assistantInstructions = payload.assistantInstructions;
    if (payload.geminiModel !== undefined) {
      updateFields.geminiModel = payload.geminiModel;
      updateFields.assistantModel = "";
    }
    if (payload.geminiApiKey !== undefined) {
      updateFields.geminiApiKey = payload.geminiApiKey
        ? encryptField(payload.geminiApiKey, encryptionSecret())
        : "";
      updateFields.assistantApiKey = "";
    }
    if (payload.supportedChannels !== undefined) {
      const currentSupportedChannels =
        await channelSupportService.getSupportedChannels(payload.workspaceId);
      updateFields.supportedChannels = {
        ...currentSupportedChannels,
        ...payload.supportedChannels,
      };
    }

    const settings = await AISettingsModel.findOneAndUpdate(
      { workspaceId: payload.workspaceId },
      { $set: updateFields },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ settings: serializeSettings(settings) });
  })
);

export default router;
