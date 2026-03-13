import { Router } from "express";
import {
  AutomationRuleModel,
  BusinessHoursModel,
} from "../../models";
import { asyncHandler } from "../../lib/async-handler";
import { updateAutomationsSchema } from "../../lib/validators";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.query.workspaceId ?? "");
    const [businessHours, afterHoursRule] = await Promise.all([
      BusinessHoursModel.findOne({ workspaceId }),
      AutomationRuleModel.findOne({
        workspaceId,
        type: "after_hours_auto_reply",
      }),
    ]);

    res.json({
      businessHours,
      afterHoursRule,
    });
  })
);

router.patch(
  "/",
  asyncHandler(async (req, res) => {
    const payload = updateAutomationsSchema.parse(req.body);

    const [businessHours, afterHoursRule] = await Promise.all([
      payload.businessHours
        ? BusinessHoursModel.findOneAndUpdate(
            { workspaceId: payload.workspaceId },
            {
              $set: {
                workspaceId: payload.workspaceId,
                ...payload.businessHours,
              },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
          )
        : BusinessHoursModel.findOne({ workspaceId: payload.workspaceId }),
      payload.afterHoursRule
        ? AutomationRuleModel.findOneAndUpdate(
            {
              workspaceId: payload.workspaceId,
              type: "after_hours_auto_reply",
            },
            {
              $set: {
                workspaceId: payload.workspaceId,
                type: "after_hours_auto_reply",
                name: payload.afterHoursRule.name,
                isActive: payload.afterHoursRule.isActive,
                action: {
                  fallbackText: payload.afterHoursRule.fallbackText,
                },
              },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
          )
        : AutomationRuleModel.findOne({
            workspaceId: payload.workspaceId,
            type: "after_hours_auto_reply",
          }),
    ]);

    res.json({
      businessHours,
      afterHoursRule,
    });
  })
);

export default router;
