import { Router } from "express";
import { z } from "zod";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors";
import { asyncHandler } from "../../lib/async-handler";
import { requireWorkspace } from "../../middleware/require-workspace";
import { requireRole } from "../../middleware/require-role";
import {
  WORKSPACE_MEMBER_ROLES,
  UserModel,
  WorkspaceMembershipDocument,
  WorkspaceMembershipModel,
  WorkspaceModel,
} from "../../models";
import { workspaceInviteService } from "../../services/workspace-invite.service";
import { emailService } from "../../services/email.service";

const router = Router();

const createMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "staff"]).default("staff"),
});

const updateMemberSchema = z.object({
  role: z.enum(WORKSPACE_MEMBER_ROLES).optional(),
  status: z.enum(["active", "invited", "disabled"]).optional(),
});

const workspaceParamSchema = z.object({
  workspaceId: z.string().min(1),
});

const memberParamSchema = z.object({
  memberId: z.string().min(1),
});

const serializeMembershipWithUser = async (membership: WorkspaceMembershipDocument) => {
  const user = await UserModel.findById(membership.userId);

  return {
    _id: String(membership._id),
    workspaceId: String(membership.workspaceId),
    role: membership.role,
    status: membership.status,
    invitedByUserId: membership.invitedByUserId
      ? String(membership.invitedByUserId)
      : null,
    lastActiveAt: membership.lastActiveAt,
    inviteExpiresAt: membership.inviteExpiresAt ?? null,
    inviteEmailSentAt: membership.inviteEmailSentAt ?? null,
    inviteAcceptedAt: membership.inviteAcceptedAt ?? null,
    user: user
      ? {
          _id: String(user._id),
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        }
      : null,
  };
};

const issueWorkspaceInvite = async (params: {
  membership: WorkspaceMembershipDocument;
  workspaceName: string;
  inviterName?: string | null;
}) => {
  const user = await UserModel.findById(params.membership.userId);
  if (!user) {
    throw new NotFoundError("Invited user not found");
  }

  const inviteToken = workspaceInviteService.createInviteToken();
  const inviteExpiresAt = workspaceInviteService.buildInviteExpiry();
  params.membership.inviteTokenHash = workspaceInviteService.hashInviteToken(inviteToken);
  params.membership.inviteExpiresAt = inviteExpiresAt;
  params.membership.inviteAcceptedAt = null;

  const inviteUrl = workspaceInviteService.buildInviteUrl(inviteToken);
  const emailResult = await emailService.sendWorkspaceInvitation({
    toEmail: user.email,
    toName: user.name,
    workspaceName: params.workspaceName,
    inviterName: params.inviterName,
    inviteUrl,
    role: params.membership.role,
  });

  params.membership.inviteEmailSentAt = emailResult.sent ? new Date() : null;
  await params.membership.save();

  return {
    inviteUrl,
    emailSent: emailResult.sent,
    emailSkipped: emailResult.skipped,
    emailReason: emailResult.reason ?? null,
  };
};

router.use("/:workspaceId/members", requireWorkspace);

router.get(
  "/:workspaceId/members",
  requireRole(["owner", "admin"]),
  asyncHandler(async (req, res) => {
    workspaceParamSchema.parse(req.params);
    const memberships = await WorkspaceMembershipModel.find({
      workspaceId: req.workspace?._id,
    }).sort({ createdAt: 1 });

    const userIds = memberships.map((membership) => membership.userId);
    const users = userIds.length ? await UserModel.find({ _id: { $in: userIds } }) : [];
    const userMap = new Map(users.map((user) => [String(user._id), user]));

    const items = memberships.map((membership) => ({
      _id: String(membership._id),
      workspaceId: String(membership.workspaceId),
      role: membership.role,
      status: membership.status,
      invitedByUserId: membership.invitedByUserId
        ? String(membership.invitedByUserId)
        : null,
      lastActiveAt: membership.lastActiveAt,
      inviteExpiresAt: membership.inviteExpiresAt ?? null,
      inviteEmailSentAt: membership.inviteEmailSentAt ?? null,
      inviteAcceptedAt: membership.inviteAcceptedAt ?? null,
      user: (() => {
        const user = userMap.get(String(membership.userId));
        return user
          ? {
              _id: String(user._id),
              email: user.email,
              name: user.name,
              avatarUrl: user.avatarUrl,
            }
          : null;
      })(),
    }));

    res.json({ items });
  })
);

router.post(
  "/:workspaceId/members",
  requireRole(["owner", "admin"]),
  asyncHandler(async (req, res) => {
    workspaceParamSchema.parse(req.params);
    const payload = createMemberSchema.parse(req.body);

    const email = payload.email.trim().toLowerCase();
    const workspace = await WorkspaceModel.findById(req.workspace?._id);
    if (!workspace) {
      throw new NotFoundError("Workspace not found");
    }
    let user = await UserModel.findOne({ email });
    if (!user) {
      user = await UserModel.create({
        email,
        name: payload.name?.trim() || email.split("@")[0],
        passwordHash: "!invited-account",
        role: "staff",
        workspaceIds: [],
      });
    }

    const existingMembership = await WorkspaceMembershipModel.findOne({
      workspaceId: req.workspace?._id,
      userId: user._id,
    });
    if (existingMembership) {
      throw new ConflictError("User is already attached to this workspace");
    }

    const status = user.passwordHash === "!invited-account" ? "invited" : "active";

    const membership = await WorkspaceMembershipModel.create({
      workspaceId: req.workspace?._id,
      userId: user._id,
      role: payload.role,
      status,
      invitedByUserId: req.auth?.userId ?? null,
      inviteTokenHash: null,
      inviteExpiresAt: null,
      inviteEmailSentAt: null,
      inviteAcceptedAt: null,
      lastActiveAt: null,
    });

    if (!user.workspaceIds.some((id) => String(id) === String(req.workspace?._id))) {
      user.workspaceIds.push(req.workspace!._id);
      await user.save();
    }

    const inviter = req.auth?.userId ? await UserModel.findById(req.auth.userId) : null;
    const inviteDelivery =
      status === "invited"
        ? await issueWorkspaceInvite({
            membership,
            workspaceName: workspace.name,
            inviterName: inviter?.name ?? null,
          })
        : null;

    res.status(201).json({
      membership: await serializeMembershipWithUser(membership),
      user: {
        _id: String(user._id),
        email: user.email,
        name: user.name,
      },
      inviteDelivery,
    });
  })
);

router.post(
  "/:workspaceId/members/:memberId/resend-invite",
  requireRole(["owner", "admin"]),
  asyncHandler(async (req, res) => {
    workspaceParamSchema.parse(req.params);
    const { memberId } = memberParamSchema.parse(req.params);

    const membership = await WorkspaceMembershipModel.findById(memberId);
    if (!membership || String(membership.workspaceId) !== String(req.workspace?._id)) {
      throw new NotFoundError("Workspace membership not found");
    }

    if (membership.status !== "invited") {
      throw new ValidationError("Only invited members can receive a new invite link");
    }

    const workspace = await WorkspaceModel.findById(req.workspace?._id);
    if (!workspace) {
      throw new NotFoundError("Workspace not found");
    }

    const inviter = req.auth?.userId ? await UserModel.findById(req.auth.userId) : null;
    const inviteDelivery = await issueWorkspaceInvite({
      membership,
      workspaceName: workspace.name,
      inviterName: inviter?.name ?? null,
    });

    res.json({
      membership: await serializeMembershipWithUser(membership),
      inviteDelivery,
    });
  })
);

router.patch(
  "/:workspaceId/members/:memberId",
  requireRole(["owner", "admin"]),
  asyncHandler(async (req, res) => {
    workspaceParamSchema.parse(req.params);
    const { memberId } = memberParamSchema.parse(req.params);
    const patch = updateMemberSchema.parse(req.body);

    const membership = await WorkspaceMembershipModel.findById(memberId);
    if (!membership || String(membership.workspaceId) !== String(req.workspace?._id)) {
      throw new NotFoundError("Workspace membership not found");
    }

    const requesterRole = req.workspaceMembership?.role;
    if (
      (patch.role === "owner" || membership.role === "owner" || patch.status === "disabled") &&
      requesterRole !== "owner"
    ) {
      throw new ForbiddenError("Only owner can change owner role or disable owner membership");
    }

    if (patch.role) {
      membership.role = patch.role;
    }
    if (patch.status) {
      if (membership.role === "owner" && patch.status !== "active") {
        const ownerCount = await WorkspaceMembershipModel.countDocuments({
          workspaceId: membership.workspaceId,
          role: "owner",
          status: "active",
        });
        if (ownerCount <= 1) {
          throw new ValidationError("The last active owner cannot be disabled");
        }
      }
      membership.status = patch.status;
      if (patch.status !== "invited") {
        membership.inviteTokenHash = null;
        membership.inviteExpiresAt = null;
      }
    }

    await membership.save();
    res.json({ membership });
  })
);

router.delete(
  "/:workspaceId/members/:memberId",
  requireRole(["owner", "admin"]),
  asyncHandler(async (req, res) => {
    workspaceParamSchema.parse(req.params);
    const { memberId } = memberParamSchema.parse(req.params);

    const membership = await WorkspaceMembershipModel.findById(memberId);
    if (!membership || String(membership.workspaceId) !== String(req.workspace?._id)) {
      throw new NotFoundError("Workspace membership not found");
    }

    if (membership.role === "owner") {
      if (req.workspaceMembership?.role !== "owner") {
        throw new ForbiddenError("Only owner can remove owner memberships");
      }

      const ownerCount = await WorkspaceMembershipModel.countDocuments({
        workspaceId: membership.workspaceId,
        role: "owner",
        status: "active",
      });
      if (ownerCount <= 1) {
        throw new ValidationError("The last active owner cannot be removed");
      }
    }

    await WorkspaceMembershipModel.findByIdAndDelete(memberId);
    res.json({ deleted: true });
  })
);

export default router;
