import { SessionData } from "../types/models";

export const WORKSPACE_SECTIONS = [
  "inbox",
  "billing",
  "channels",
  "analytics",
  "workspace-profile",
  "knowledge",
  "canned-replies",
  "stickers",
  "business-hours",
  "workspace-members",
  "ai-settings",
] as const;

export type WorkspaceSection = (typeof WORKSPACE_SECTIONS)[number];

export const buildWorkspacePath = (
  slug: string,
  section?: WorkspaceSection
) => {
  const base = `/workspace/${encodeURIComponent(slug)}`;
  return section ? `${base}/${section}` : base;
};

export const buildPublicWorkspacePath = (slug: string, view?: "chat") => {
  const base = `/w/${encodeURIComponent(slug)}`;
  return view === "chat" ? `${base}/chat` : base;
};

export const getWorkspaceSectionFromPathname = (
  pathname: string
): WorkspaceSection | null => {
  const match = pathname.match(/^\/workspace\/[^/]+\/([^/?#]+)/i);
  if (!match) {
    return null;
  }

  const section = match[1] as WorkspaceSection;
  return WORKSPACE_SECTIONS.includes(section) ? section : null;
};

export const resolveWorkspaceFromSession = (
  workspaces: SessionData["workspaces"],
  slug: string
) => workspaces.find((workspace) => workspace.slug === slug) ?? null;
