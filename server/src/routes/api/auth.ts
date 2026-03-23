import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  AISettingsModel,
  BusinessHoursModel,
  UserModel,
  WorkspaceModel,
  WorkspaceMembershipModel,
} from "../../models";
import { asyncHandler } from "../../lib/async-handler";
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "../../lib/errors";
import { env } from "../../config/env";
import { authenticate } from "../../middleware/authenticate";
import { DEFAULT_SUPPORTED_CHANNELS } from "../../services/channel-support.service";
import { workspaceInviteService } from "../../services/workspace-invite.service";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  workspaceName: z.string().min(1),
  workspaceSlug: z.string().min(1),
  timeZone: z.string().min(1).default("Asia/Bangkok"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

const inviteTokenParamSchema = z.object({
  token: z.string().min(1),
});

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
  "/register",
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    const name = payload.name.trim();
    const email = payload.email.trim().toLowerCase();
    const workspaceSlug = payload.workspaceSlug.trim().toLowerCase();
    const workspaceName = payload.workspaceName.trim();
    const timeZone = payload.timeZone.trim();

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      throw new ConflictError("An account with this email already exists");
    }

    // Tenant policy enforcement
    if (env.APP_TENANT_MODE === "single") {
      const workspaceCount = await WorkspaceModel.countDocuments();
      if (workspaceCount > 0) {
        throw new ForbiddenError(
          "Single-tenant mode: this deployment has already been bootstrapped. No further workspace registration is allowed."
        );
      }
    } else {
      // Multi-tenant: respect signup and workspace creation flags
      if (!env.ALLOW_SELF_SIGNUP) {
        throw new ForbiddenError("Self-registration is disabled on this deployment.");
      }
      if (!env.ALLOW_WORKSPACE_CREATION) {
        throw new ForbiddenError("Workspace creation is disabled on this deployment.");
      }
    }

    let workspace = await WorkspaceModel.findOne({ slug: workspaceSlug });
    if (workspace) {
      throw new ConflictError("Workspace slug already exists");
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);

    const user = await UserModel.create({
      email,
      name,
      passwordHash,
      role: "owner",
      workspaceIds: [],
    });

    workspace = await WorkspaceModel.create({
      name: workspaceName,
      slug: workspaceSlug,
      timeZone,
      createdByUserId: user._id,
    });

    await WorkspaceMembershipModel.create({
      workspaceId: workspace._id,
      userId: user._id,
      role: "owner",
      status: "active",
      invitedByUserId: null,
      lastActiveAt: new Date(),
    });

    user.workspaceIds = [workspace._id];
    await user.save();

    await AISettingsModel.findOneAndUpdate(
      { workspaceId: workspace._id },
      {
        $setOnInsert: {
          workspaceId: workspace._id,
          enabled: false,
          autoReplyEnabled: false,
          afterHoursEnabled: false,
          confidenceThreshold: 0.7,
          supportedChannels: DEFAULT_SUPPORTED_CHANNELS,
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

    const token = jwt.sign(
      {
        userId: String(user._id),
        email: user.email,
      },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        _id: String(user._id),
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      workspaces: [
        {
          _id: String(workspace._id),
          name: workspace.name,
          slug: workspace.slug,
          timeZone: workspace.timeZone,
          role: "owner",
        },
      ],
      activeWorkspaceId: String(workspace._id),
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const email = payload.email.trim().toLowerCase();

    const user = await UserModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (user.passwordHash === "!invited-account") {
      throw new UnauthorizedError(
        "This invited account has not been activated yet. Use the invitation link to set your password."
      );
    }

    const passwordMatches = await bcrypt.compare(
      payload.password,
      user.passwordHash
    );
    if (!passwordMatches) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const memberships = await WorkspaceMembershipModel.find({
      userId: user._id,
      status: { $in: ["active", "invited"] },
    });

    const workspaceIds = memberships.map((membership) => membership.workspaceId);
    const workspaces = workspaceIds.length
      ? await WorkspaceModel.find({ _id: { $in: workspaceIds } })
      : [];
    const workspaceMap = new Map(
      workspaces.map((workspace) => [String(workspace._id), workspace])
    );

    const workspaceItems = memberships
      .map((membership) => {
        const workspace = workspaceMap.get(String(membership.workspaceId));
        if (!workspace) {
          return null;
        }
        return {
          _id: String(workspace._id),
          name: workspace.name,
          slug: workspace.slug,
          timeZone: workspace.timeZone,
          role: membership.role,
          status: membership.status,
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item);

    if (!workspaceItems.length) {
      throw new ValidationError("No workspace memberships found for this account");
    }

    const token = jwt.sign(
      {
        userId: String(user._id),
        email: user.email,
      },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        _id: String(user._id),
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      workspaces: workspaceItems,
      activeWorkspaceId: workspaceItems[0]._id,
    });
  })
);

router.get(
  "/invitations/:token",
  asyncHandler(async (req, res) => {
    const { token } = inviteTokenParamSchema.parse(req.params);
    const inviteTokenHash = workspaceInviteService.hashInviteToken(token);

    const membership = await WorkspaceMembershipModel.findOne({
      inviteTokenHash,
      status: "invited",
    });
    if (!membership || !membership.inviteExpiresAt || membership.inviteExpiresAt < new Date()) {
      throw new ValidationError("This invitation link is invalid or has expired");
    }

    const [workspace, user] = await Promise.all([
      WorkspaceModel.findById(membership.workspaceId),
      UserModel.findById(membership.userId),
    ]);
    if (!workspace || !user) {
      throw new ValidationError("This invitation is no longer available");
    }

    res.json({
      invitation: {
        workspace: {
          _id: String(workspace._id),
          name: workspace.name,
          slug: workspace.slug,
        },
        role: membership.role,
        email: user.email,
        name: user.name,
        expiresAt: membership.inviteExpiresAt,
      },
    });
  })
);

router.post(
  "/invitations/accept",
  asyncHandler(async (req, res) => {
    const payload = acceptInviteSchema.parse(req.body);
    const inviteTokenHash = workspaceInviteService.hashInviteToken(payload.token);

    const membership = await WorkspaceMembershipModel.findOne({
      inviteTokenHash,
      status: "invited",
    });
    if (!membership || !membership.inviteExpiresAt || membership.inviteExpiresAt < new Date()) {
      throw new ValidationError("This invitation link is invalid or has expired");
    }

    const [workspace, user] = await Promise.all([
      WorkspaceModel.findById(membership.workspaceId),
      UserModel.findById(membership.userId),
    ]);
    if (!workspace || !user) {
      throw new ValidationError("This invitation is no longer available");
    }

    user.passwordHash = await bcrypt.hash(payload.password, 10);
    if (payload.name?.trim()) {
      user.name = payload.name.trim();
    }
    if (!user.workspaceIds.some((id) => String(id) === String(workspace._id))) {
      user.workspaceIds.push(workspace._id);
    }

    membership.status = "active";
    membership.inviteAcceptedAt = new Date();
    membership.inviteTokenHash = null;
    membership.inviteExpiresAt = null;
    membership.lastActiveAt = new Date();

    await Promise.all([user.save(), membership.save()]);

    const memberships = await WorkspaceMembershipModel.find({
      userId: user._id,
      status: { $in: ["active", "invited"] },
    });
    const workspaceIds = memberships.map((nextMembership) => nextMembership.workspaceId);
    const workspaces = workspaceIds.length
      ? await WorkspaceModel.find({ _id: { $in: workspaceIds } })
      : [];
    const workspaceMap = new Map(
      workspaces.map((nextWorkspace) => [String(nextWorkspace._id), nextWorkspace])
    );

    const workspaceItems = memberships
      .map((nextMembership) => {
        const nextWorkspace = workspaceMap.get(String(nextMembership.workspaceId));
        if (!nextWorkspace) {
          return null;
        }
        return {
          _id: String(nextWorkspace._id),
          name: nextWorkspace.name,
          slug: nextWorkspace.slug,
          timeZone: nextWorkspace.timeZone,
          role: nextMembership.role,
          status: nextMembership.status,
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item);

    const token = jwt.sign(
      {
        userId: String(user._id),
        email: user.email,
      },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        _id: String(user._id),
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      workspaces: workspaceItems,
      activeWorkspaceId:
        workspaceItems.find((item) => item._id === String(workspace._id))?._id ??
        workspaceItems[0]?._id ??
        String(workspace._id),
    });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const authUser = req.auth?.user;
    if (!authUser) {
      throw new UnauthorizedError("Authentication required");
    }

    const memberships = await WorkspaceMembershipModel.find({
      userId: authUser._id,
      status: "active",
    });
    const workspaceIds = memberships.map((membership) => membership.workspaceId);
    const workspaces = workspaceIds.length
      ? await WorkspaceModel.find({ _id: { $in: workspaceIds } })
      : [];
    const workspaceMap = new Map(
      workspaces.map((workspace) => [String(workspace._id), workspace])
    );

    const workspaceItems = memberships
      .map((membership) => {
        const workspace = workspaceMap.get(String(membership.workspaceId));
        if (!workspace) {
          return null;
        }

        return {
          _id: String(workspace._id),
          name: workspace.name,
          slug: workspace.slug,
          timeZone: workspace.timeZone,
          role: membership.role,
          status: membership.status,
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item);

    // In single-tenant mode with a pinned slug, surface only the default workspace
    // if the user is a member of it and reorder it to the front.
    let resolvedWorkspaces = workspaceItems;
    if (env.APP_TENANT_MODE === "single" && env.DEFAULT_WORKSPACE_SLUG) {
      const pinned = workspaceItems.find(
        (ws) => ws.slug === env.DEFAULT_WORKSPACE_SLUG
      );
      if (pinned) {
        resolvedWorkspaces = [pinned];
      }
    }

    res.json({
      user: {
        _id: String(authUser._id),
        email: authUser.email,
        name: authUser.name,
        avatarUrl: authUser.avatarUrl,
      },
      workspaces: resolvedWorkspaces,
      deployment: {
        tenantMode: env.APP_TENANT_MODE,
        allowSignup: env.ALLOW_SELF_SIGNUP,
        defaultWorkspaceSlug: env.DEFAULT_WORKSPACE_SLUG || null,
      },
    });
  })
);

router.post(
  "/logout",
  authenticate,
  asyncHandler(async (_req, res) => {
    res.json({ loggedOut: true });
  })
);

export default router;
