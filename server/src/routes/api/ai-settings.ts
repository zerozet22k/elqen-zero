import { Router } from "express";
import { AISettingsModel } from "../../models";
import { asyncHandler } from "../../lib/async-handler";
import { updateAISettingsSchema } from "../../lib/validators";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.query.workspaceId ?? "");
    const settings = await AISettingsModel.findOne({ workspaceId });
    res.json({ settings });
  })
);

router.patch(
  "/",
  asyncHandler(async (req, res) => {
    const payload = updateAISettingsSchema.parse(req.body);
    const settings = await AISettingsModel.findOneAndUpdate(
      { workspaceId: payload.workspaceId },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ settings });
  })
);

export default router;
