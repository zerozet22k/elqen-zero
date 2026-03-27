import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../hooks/use-session";
import { apiRequest } from "../services/api";
import { connectWorkspaceSocket } from "../services/realtime";
import { BillingState } from "../types/models";
import {
  shouldPlayInboundNotification,
  type MessageReceivedRealtimePayload,
} from "../utils/inbound-notification";
import {
  buildWorkspacePath,
  getWorkspaceSectionFromPathname,
  type WorkspaceSection,
} from "../utils/workspace-routes";
import {
  formatPlatformRoleLabel,
  isPortalPlatformRole,
} from "../utils/platform-role";
import {
  formatWorkspaceRoleLabel,
  isWorkspaceOwnerRole,
} from "../utils/workspace-role";

const navSections = [
  {
    title: "Workspace",
    items: [
      { section: "inbox", label: "Inbox", adminOnly: false },
      { section: "billing", label: "Billing", adminOnly: false },
      { section: "channels", label: "Channels", adminOnly: true },
      { section: "analytics", label: "Analytics", adminOnly: false },
      { section: "workspace-profile", label: "Workspace Profile", adminOnly: false },
    ],
  },
  {
    title: "Settings",
    items: [
      { section: "knowledge", label: "Knowledge", adminOnly: false },
      { section: "canned-replies", label: "Canned Replies", adminOnly: true },
      { section: "stickers", label: "Workspace Stickers", adminOnly: true },
      { section: "business-hours", label: "Business Hours", adminOnly: true },
      { section: "workspace-members", label: "Workspace Members", adminOnly: true },
    ],
  },
  {
    title: "AI Settings",
    items: [{ section: "ai-settings", label: "AI Settings", adminOnly: true }],
  },
] as const;

const SIDEBAR_COLLAPSED_WIDTH = 76;
const SIDEBAR_EXPANDED_WIDTH = 260;
const SIDEBAR_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

const NAV_ICONS: Record<WorkspaceSection, React.ReactNode> = {
  inbox: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <rect x="2" y="4" width="16" height="13" rx="1" />
      <path d="M2 11h4.5l1 2h5l1-2H18" />
    </svg>
  ),
  billing: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="5" width="14" height="10" rx="2" />
      <path d="M3 9h14" />
      <path d="M7 13h2" />
    </svg>
  ),
  channels: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
      <path d="M4 8h12M4 12h12M8 3.5L6.5 16.5M13.5 3.5L12 16.5" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
      <path d="M3 17V12M7.5 17V7M12 17V10M16.5 17V4" />
    </svg>
  ),
  knowledge: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M5 3h7l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path d="M12 3v5h4" />
      <path d="M7 10h6M7 13h4" />
    </svg>
  ),
  "canned-replies": (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M3 5a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H6.5L3 17V5z" />
      <path d="M7 8h6M7 11h4" />
    </svg>
  ),
  stickers: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="4" width="14" height="12" rx="3" />
      <circle cx="7.5" cy="8.5" r="1.1" />
      <circle cx="12.5" cy="8.5" r="1.1" />
      <path d="M7 12.5c.8.7 1.8 1 3 1s2.2-.3 3-1" />
    </svg>
  ),
  "business-hours": (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v4l2.5 2.5" />
    </svg>
  ),
  "workspace-members": (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <circle cx="8" cy="7" r="3" />
      <path d="M2 17c0-3.3 2.7-5 6-5s6 1.7 6 5" />
      <path d="M14 4.5a3 3 0 010 5" />
      <path d="M17 17c0-1.9-.9-3.4-2-4.2" />
    </svg>
  ),
  "ai-settings": (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M10 2l1.8 4H16l-3.4 2.5 1.3 4L10 10l-3.9 2.5 1.3-4L4 6h4.2z" />
      <path d="M10 13v5M8 16.5h4" />
    </svg>
  ),
  "workspace-profile": (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M4 4h12v12H4z" />
      <path d="M7 8h6M7 11h6M7 14h4" />
    </svg>
  ),
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AppShell() {
  const {
    session,
    activeWorkspace,
    isAdmin,
    deployment,
    refreshSession,
    setActiveWorkspaceId,
    logout,
  } = useSession();

  const navigate = useNavigate();
  const location = useLocation();
  const notifiedInboundMessageIdsRef = useRef<Set<string>>(new Set());

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("omni-chat-sidebar-collapsed") === "true";
  });

  const [isToggleHovered, setIsToggleHovered] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [billingPlanLabel, setBillingPlanLabel] = useState<string | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const activeWorkspaceId = activeWorkspace?._id ?? null;
  const activeWorkspaceSlug = activeWorkspace?.slug ?? "";
  const sidebarWidth = isSidebarCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : SIDEBAR_EXPANDED_WIDTH;
  const currentSection =
    getWorkspaceSectionFromPathname(location.pathname) ?? "inbox";

  const showWorkspaceSwitcher =
    deployment.tenantMode !== "single" &&
    (session?.workspaces?.length ?? 0) > 1;
  const isWorkspaceOwner = isWorkspaceOwnerRole(activeWorkspace?.workspaceRole);

  useEffect(() => {
    if (
      !activeWorkspaceId ||
      typeof window === "undefined" ||
      typeof Notification === "undefined"
    ) {
      return;
    }

    const socket = connectWorkspaceSocket(activeWorkspaceId);

    const showBrowserNotification = async (
      payload: MessageReceivedRealtimePayload
    ) => {
      if (
        activeWorkspaceSlug &&
        location.pathname === buildWorkspacePath(activeWorkspaceSlug, "inbox") &&
        document.visibilityState === "visible"
      ) {
        return;
      }

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        return;
      }

      const notification = new Notification("New message received", {
        body: "Open inbox to view the latest customer message.",
        tag: payload.messageId ?? payload.conversationId ?? "omni-chat-inbound",
      });

      notification.onclick = () => {
        window.focus();
        navigate(
          activeWorkspaceSlug
            ? buildWorkspacePath(activeWorkspaceSlug, "inbox")
            : "/account/workspaces"
        );
        notification.close();
      };
    };

    const onMessageReceived = (payload: unknown) => {
      const normalized =
        typeof payload === "object" && payload
          ? (payload as MessageReceivedRealtimePayload)
          : {};

      if (
        !shouldPlayInboundNotification(
          normalized,
          notifiedInboundMessageIdsRef.current
        )
      ) {
        return;
      }

      const messageId = normalized.messageId?.trim();
      if (!messageId) {
        return;
      }

      notifiedInboundMessageIdsRef.current.add(messageId);
      void showBrowserNotification(normalized);
    };

    const onUserUpdated = (payload: unknown) => {
      const normalized =
        typeof payload === "object" && payload
          ? (payload as { user?: { _id?: string } })
          : {};
      const nextUserId = normalized.user?._id?.trim();
      if (!nextUserId || nextUserId !== session?.user?._id) {
        return;
      }

      void refreshSession();
    };

    socket.on("message.received", onMessageReceived);
    socket.on("user.updated", onUserUpdated);

    return () => {
      socket.off("message.received", onMessageReceived);
      socket.off("user.updated", onUserUpdated);
      socket.disconnect();
    };
  }, [
    activeWorkspaceId,
    location.pathname,
    navigate,
    refreshSession,
    session?.user?._id,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      "omni-chat-sidebar-collapsed",
      isSidebarCollapsed ? "true" : "false"
    );
  }, [isSidebarCollapsed]);

  useEffect(() => {
    let cancelled = false;

    if (!activeWorkspaceId || !isWorkspaceOwner) {
      setBillingPlanLabel(null);
      return;
    }

    const loadBillingPlan = async () => {
      try {
        const response = await apiRequest<{ billing: BillingState }>(
          "/api/billing/account"
        );
        if (!cancelled) {
          setBillingPlanLabel(response.billing.subscription.planDisplayName);
        }
      } catch {
        if (!cancelled) {
          setBillingPlanLabel(null);
        }
      }
    };

    void loadBillingPlan();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, isWorkspaceOwner]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && accountMenuRef.current?.contains(target)) {
        return;
      }
      setIsAccountMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isAccountMenuOpen]);

  const handleToggleMouseEnter = () => setIsToggleHovered(true);
  const handleToggleMouseLeave = () => setIsToggleHovered(false);
  const handleToggleFocus = () => setIsToggleHovered(true);
  const handleToggleBlurCapture = (
    event: React.FocusEvent<HTMLDivElement>
  ) => {
    const nextFocused = event.relatedTarget as Node | null;
    if (!event.currentTarget.contains(nextFocused)) {
      setIsToggleHovered(false);
    }
  };

  return (
    <div className="relative isolate h-dvh max-h-dvh overflow-hidden bg-slate-100 text-slate-900">
      <div
        className="grid h-full min-h-0 transition-[grid-template-columns] duration-300"
        style={{
          gridTemplateColumns: `${sidebarWidth}px minmax(0, 1fr)`,
          transitionTimingFunction: SIDEBAR_EASING,
        }}
      >
        <aside
          id="app-sidebar"
          className="relative z-30 flex h-full min-h-0 flex-col border-r border-slate-200 bg-slate-950 text-slate-100"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-6">
              <div
                className={cn(
                  "flex items-center",
                  isSidebarCollapsed ? "justify-center" : "gap-2"
                )}
              >
                {!isSidebarCollapsed ? (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Workspace
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                      Elqen Zero
                    </h1>
                    <p className="mt-1 text-sm text-slate-400">
                      {activeWorkspace?.name ?? "Workspace"}
                    </p>
                  </div>
                ) : (
                  <h1 className="mx-auto text-lg font-semibold tracking-tight">
                    EZ
                  </h1>
                )}
              </div>

              {showWorkspaceSwitcher && !isSidebarCollapsed ? (
                <div className="mt-3 space-y-2">
                  <Link
                    to="/account/workspaces"
                    className="inline-flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                  >
                    All workspaces
                  </Link>

                  <select
                    value={activeWorkspace?._id ?? ""}
                    onChange={(event) => {
                      const nextWorkspaceId = event.target.value;
                      const nextWorkspace =
                        (session?.workspaces ?? []).find(
                          (workspace) => workspace._id === nextWorkspaceId
                        ) ?? null;

                      setActiveWorkspaceId(nextWorkspaceId);
                      if (nextWorkspace) {
                        navigate(buildWorkspacePath(nextWorkspace.slug, currentSection));
                      }
                    }}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                  >
                    {(session?.workspaces ?? []).map((workspace) => (
                      <option key={workspace._id} value={workspace._id}>
                        {workspace.name} ({formatWorkspaceRoleLabel(workspace.workspaceRole)})
                      </option>
                    ))}
                  </select>

                  {deployment.allowWorkspaceCreation &&
                  deployment.tenantMode !== "single" ? (
                    <Link
                      to="/account/workspaces/new"
                      className="inline-flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                    >
                      Create workspace
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>

            <nav className="space-y-4">
              {navSections.map((section) => {
                const visibleItems = section.items.filter(
                  (item) => !item.adminOnly || isAdmin
                );

                if (!visibleItems.length) {
                  return null;
                }

                return (
                  <div key={section.title} className="space-y-1">
                    {!isSidebarCollapsed ? (
                      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {section.title}
                      </p>
                    ) : null}

                    {visibleItems.map((item) => (
                      <NavLink
                        key={item.section}
                        to={
                          activeWorkspaceSlug
                            ? buildWorkspacePath(activeWorkspaceSlug, item.section)
                            : "/account/workspaces"
                        }
                        end={item.section === "inbox"}
                        title={item.label}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                            isSidebarCollapsed && "justify-center px-2",
                            isActive
                              ? "bg-white text-slate-950 shadow-sm"
                              : "text-slate-300 hover:bg-slate-900 hover:text-white"
                          )
                        }
                      >
                        {isSidebarCollapsed
                          ? NAV_ICONS[item.section] ?? item.label.slice(0, 1)
                          : item.label}
                      </NavLink>
                    ))}
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="relative border-t border-white/10 p-4" ref={accountMenuRef}>
            {isAccountMenuOpen ? (
              <div
                className={cn(
                  "absolute bottom-[calc(100%+12px)] rounded-[28px] border border-white/10 bg-[#2b2b2b] p-4 text-white shadow-2xl",
                  isSidebarCollapsed ? "left-0 w-80" : "left-4 right-4"
                )}
              >
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-sm font-semibold text-slate-950">
                    {(session?.user?.name?.[0] ?? "U").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {session?.user?.name ?? "Workspace member"}
                    </p>
                    <p className="truncate text-sm text-slate-300">
                      {isWorkspaceOwner
                        ? billingPlanLabel ?? "Owner"
                        : formatWorkspaceRoleLabel(activeWorkspace?.workspaceRole)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      navigate("/account/workspaces");
                    }}
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-medium text-white transition hover:bg-white/5"
                  >
                    <span>Back to workspaces</span>
                    <span className="text-slate-500">&gt;</span>
                  </button>

                  {isWorkspaceOwner ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        navigate(
                          activeWorkspaceSlug
                            ? `${buildWorkspacePath(activeWorkspaceSlug, "billing")}?plans=1`
                            : "/account/billings"
                        );
                      }}
                      className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-medium text-white transition hover:bg-white/5"
                    >
                      <span>Upgrade plan</span>
                      <span className="text-slate-500">&gt;</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      navigate("/account");
                    }}
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-medium text-white transition hover:bg-white/5"
                  >
                    <span>My account</span>
                    <span className="text-slate-500">&gt;</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      void logout();
                    }}
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-medium text-white transition hover:bg-white/5"
                  >
                    <span>Sign out</span>
                    <span className="text-slate-500">&gt;</span>
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setIsAccountMenuOpen((current) => !current)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:bg-white/10",
                isSidebarCollapsed && "justify-center px-0"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-white">
                {(session?.user?.name?.[0] ?? "U").toUpperCase()}
              </div>

              {!isSidebarCollapsed ? (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {session?.user?.name ?? "Workspace member"}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {isWorkspaceOwner
                        ? billingPlanLabel ?? "Owner"
                        : isPortalPlatformRole(session?.user?.platformRole)
                          ? formatPlatformRoleLabel(session?.user?.platformRole)
                          : formatWorkspaceRoleLabel(activeWorkspace?.workspaceRole)}
                    </p>
                  </div>
                  <span className="text-sm text-slate-500">
                    {isAccountMenuOpen ? "-" : "+"}
                  </span>
                </>
              ) : null}
            </button>
          </div>
        </aside>

        <main className="relative z-0 h-full min-w-0 min-h-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <div
        className="pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 transition-[left] duration-300"
        style={{
          left: `${sidebarWidth - 1}px`,
          transitionTimingFunction: SIDEBAR_EASING,
        }}
      >
        <div
          className="pointer-events-auto relative h-14 w-12 overflow-visible"
          onMouseEnter={handleToggleMouseEnter}
          onMouseLeave={handleToggleMouseLeave}
          onFocusCapture={handleToggleFocus}
          onBlurCapture={handleToggleBlurCapture}
        >
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-controls="app-sidebar"
            aria-expanded={!isSidebarCollapsed}
            className={cn(
              "absolute left-0 top-1/2 z-60 flex h-14 w-12 items-center justify-center border border-l-0 border-slate-200/85 bg-white/95 text-slate-500 backdrop-blur-md",
              "rounded-r-full rounded-l-none shadow-[0_10px_30px_rgba(15,23,42,0.18)]",
              "hover:bg-white hover:text-slate-900 hover:shadow-[0_14px_36px_rgba(15,23,42,0.22)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:text-slate-900"
            )}
            style={{
              transform: `translate(${isToggleHovered ? "0%" : "-60%"}, -50%)`,
              transition: [
                `transform 240ms ${SIDEBAR_EASING}`,
                "background-color 180ms ease",
                "color 180ms ease",
                "box-shadow 220ms ease",
              ].join(", "),
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-2.5 left-0 w-px bg-slate-200/70"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-3 left-2.5 w-px rounded-full bg-slate-200"
            />

            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              focusable="false"
              className="relative ml-1.5 h-4 w-4 shrink-0"
            >
              <path
                d={isSidebarCollapsed ? "M7 4l6 6-6 6" : "M13 4l-6 6 6 6"}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

