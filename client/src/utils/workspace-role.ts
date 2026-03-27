import { WorkspaceRole } from "../types/models";

export const ASSIGNABLE_WORKSPACE_ROLES = [
  "admin",
  "manager",
  "agent",
  "viewer",
] as const;

export type AssignableWorkspaceRole = (typeof ASSIGNABLE_WORKSPACE_ROLES)[number];

export const isWorkspaceOwnerRole = (role?: WorkspaceRole | null) =>
  role === "owner";

export const isWorkspaceAdminRole = (role?: WorkspaceRole | null) =>
  role === "owner" || role === "admin";

export const formatWorkspaceRoleLabel = (role?: WorkspaceRole | null) => {
  if (!role) {
    return "Workspace member";
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
};
