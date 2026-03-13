import { Router } from "express";
import {
  AISettingsModel,
  BusinessHoursModel,
  UserModel,
  WorkspaceModel,
} from "../../models";
import { asyncHandler } from "../../lib/async-handler";
import { ValidationError } from "../../lib/errors";

const router = Router();

const buildDefaultBusinessHours = () => [
  {
    dayOfWeek: 1,
    enabled: true,
    windows: [{ start: "09:00", end: "18:00" }],
  },
  {
    dayOfWeek: 2,
    enabled: true,
    windows: [{ start: "09:00", end: "18:00" }],
  },
  {
    dayOfWeek: 3,
    enabled: true,
    windows: [{ start: "09:00", end: "18:00" }],
  },
  {
    dayOfWeek: 4,
    enabled: true,
    windows: [{ start: "09:00", end: "18:00" }],
  },
  {
    dayOfWeek: 5,
    enabled: true,
    windows: [{ start: "09:00", end: "18:00" }],
  },
];

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const name =
      typeof req.body?.name === "string" && req.body.name.trim()
        ? req.body.name.trim()
        : "";
    const email =
      typeof req.body?.email === "string" && req.body.email.trim()
        ? req.body.email.trim().toLowerCase()
        : "";
    const workspaceSlug =
      typeof req.body?.workspaceSlug === "string" && req.body.workspaceSlug.trim()
        ? req.body.workspaceSlug.trim().toLowerCase()
        : "";
    const workspaceName =
      typeof req.body?.workspaceName === "string" && req.body.workspaceName.trim()
        ? req.body.workspaceName.trim()
        : "";
    const timeZone =
      typeof req.body?.timeZone === "string" && req.body.timeZone.trim()
        ? req.body.timeZone.trim()
        : "Asia/Bangkok";

    if (!name || !email || !workspaceSlug) {
      throw new ValidationError(
        "Name, email, and workspace slug are required to open a workspace"
      );
    }

    let workspace = await WorkspaceModel.findOne({ slug: workspaceSlug });
    if (!workspace) {
      if (!workspaceName) {
        throw new ValidationError(
          "Workspace not found. Provide a workspace name to create it."
        );
      }

      workspace = await WorkspaceModel.create({
        name: workspaceName,
        slug: workspaceSlug,
        timeZone,
      });
    }

    let user = await UserModel.findOne({ email });
    if (!user) {
      user = await UserModel.create({
        email,
        name,
        workspaceIds: [workspace._id],
      });
    } else {
      user.name = name;
      if (!user.workspaceIds.some((id) => String(id) === String(workspace!._id))) {
        user.workspaceIds.push(workspace._id);
      }
      await user.save();
    }

    await AISettingsModel.findOneAndUpdate(
      { workspaceId: workspace._id },
      {
        $setOnInsert: {
          workspaceId: workspace._id,
          enabled: false,
          autoReplyEnabled: false,
          afterHoursEnabled: false,
          confidenceThreshold: 0.7,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    await BusinessHoursModel.findOneAndUpdate(
      { workspaceId: workspace._id },
      {
        $setOnInsert: {
          workspaceId: workspace._id,
          timeZone,
          weeklySchedule: buildDefaultBusinessHours(),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    res.json({
      user,
      workspace,
    });
  })
);

export default router;
