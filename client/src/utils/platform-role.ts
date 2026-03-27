import { PlatformRole } from "../types/models";

export const MANAGEABLE_PLATFORM_ROLES = [
  "support",
  "ops",
  "billing",
  "staff",
] as const;

export type ManageablePlatformRole = (typeof MANAGEABLE_PLATFORM_ROLES)[number];

export const isPortalPlatformRole = (
  role?: PlatformRole | null
): role is PlatformRole => !!role;

export const isPlatformAdminRole = (role?: PlatformRole | null) =>
  role === "founder" || role === "platform_admin";

export const formatPlatformRoleLabel = (role?: PlatformRole | null) => {
  if (!role) {
    return "No portal access";
  }

  if (role === "platform_admin") {
    return "Platform Admin";
  }

  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const getPostLoginHomePath = (role?: PlatformRole | null) =>
  isPortalPlatformRole(role) ? "/portal" : "/account/workspaces";
