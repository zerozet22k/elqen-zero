import { useEffect } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { useSession } from "./hooks/use-session";
import { AISettingsPage } from "./pages/AISettingsPage";
import { AccountPage } from "./pages/AccountPage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AutomationsPage } from "./pages/AutomationsPage";
import { BillingAccountPage } from "./pages/BillingAccountPage";
import { CannedRepliesPage } from "./pages/CannedRepliesPage";
import { ChannelsPage } from "./pages/ChannelsPage";
import { CreateWorkspacePage } from "./pages/CreateWorkspacePage";
import { DataDeletionPage } from "./pages/DataDeletionPage";
import { InboxPage } from "./pages/InboxPage";
import { LandingPage } from "./pages/LandingPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { LoginPage } from "./pages/LoginPage";
import { PortalDashboardPage } from "./pages/PortalDashboardPage";
import { PortalPaymentsPage } from "./pages/PortalPaymentsPage";
import { PortalPlanCatalogPage } from "./pages/PortalPlanCatalogPage";
import { PortalPlansPage } from "./pages/PortalPlansPage";
import { PortalStaffPage } from "./pages/PortalStaffPage";
import { PortalWorkspaceAuditPage } from "./pages/PortalWorkspaceAuditPage";
import { PortalWorkspaceBillingPage } from "./pages/PortalWorkspaceBillingPage";
import { PortalWorkspaceChannelsPage } from "./pages/PortalWorkspaceChannelsPage";
import { PortalWorkspaceLayout } from "./pages/PortalWorkspaceLayout";
import { PortalWorkspaceMembersPage } from "./pages/PortalWorkspaceMembersPage";
import { PortalWorkspacePage } from "./pages/PortalWorkspacePage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { PublicWorkspacePage } from "./pages/PublicWorkspacePage";
import { StickerLibraryPage } from "./pages/StickerLibraryPage";
import { TermsPage } from "./pages/TermsPage";
import { WorkspaceBillingPage } from "./pages/WorkspaceBillingPage";
import { WorkspaceAccessBlockedPage } from "./pages/WorkspaceAccessBlockedPage";
import { WorkspacesPage } from "./pages/WorkspacesPage";
import { WorkspaceProfilePage } from "./pages/WorkspaceProfilePage";
import { WorkspaceMembersPage } from "./pages/WorkspaceMembersPage";
import {
  buildWorkspacePath,
  resolveWorkspaceFromSession,
  type WorkspaceSection,
} from "./utils/workspace-routes";
import { isPortalPlatformRole } from "./utils/platform-role";

function SessionOnlyLayout() {
  const { session, loading } = useSession();

  if (loading) {
    return <div className="page-loader">Loading account...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function PortalOnlyLayout() {
  const { session, loading } = useSession();

  if (loading) {
    return <div className="page-loader">Loading portal...</div>;
  }

  if (!session) {
    return <Navigate to="/portal/login" replace />;
  }

  if (!isPortalPlatformRole(session.user.platformRole)) {
    return <Navigate to="/account/workspaces" replace />;
  }

  return <Outlet />;
}

function WorkspaceLayout() {
  const { session, activeWorkspace, loading, setActiveWorkspaceId } = useSession();
  const { slug = "" } = useParams();
  const matchedWorkspace = session
    ? resolveWorkspaceFromSession(session.workspaces, slug)
    : null;

  useEffect(() => {
    if (
      matchedWorkspace &&
      activeWorkspace?._id !== matchedWorkspace._id
    ) {
      setActiveWorkspaceId(matchedWorkspace._id);
    }
  }, [activeWorkspace?._id, matchedWorkspace, setActiveWorkspaceId]);

  if (loading) {
    return <div className="page-loader">Loading workspace...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!matchedWorkspace) {
    return <Navigate to="/account/workspaces" replace />;
  }

  if (!activeWorkspace || activeWorkspace._id !== matchedWorkspace._id) {
    return <div className="page-loader">Loading workspace...</div>;
  }

  return <AppShell />;
}

function AccountWorkspacesEntry() {
  const { session, loading } = useSession();

  if (loading) {
    return <div className="page-loader">Loading workspaces...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!session.workspaces.length && session.blockedAccess) {
    return <Navigate to="/account/access-blocked" replace />;
  }

  return <WorkspacesPage />;
}

function WorkspaceIndexRedirect() {
  const { slug = "" } = useParams();
  const location = useLocation();

  return (
    <Navigate
      to={`${buildWorkspacePath(slug, "inbox")}${location.search}`}
      replace
    />
  );
}

function LegacyWorkspaceRedirect({ section }: { section: WorkspaceSection }) {
  const { session, activeWorkspace, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return <div className="page-loader">Loading workspace...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const fallbackWorkspace =
    activeWorkspace ?? session.workspaces[0] ?? null;

  if (!fallbackWorkspace) {
    return <Navigate to="/account/workspaces" replace />;
  }

  return (
    <Navigate
      to={`${buildWorkspacePath(fallbackWorkspace.slug, section)}${location.search}`}
      replace
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/portal/login" element={<LoginPage audience="staff" />} />
      <Route path="/staff/login" element={<Navigate to="/portal/login" replace />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/data-deletion" element={<DataDeletionPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/w/:slug" element={<PublicWorkspacePage />} />
      <Route path="/w/:slug/chat" element={<PublicWorkspacePage />} />

      <Route element={<PortalOnlyLayout />}>
        <Route path="/portal" element={<PortalDashboardPage />} />
        <Route path="/portal/account" element={<AccountPage audience="portal" />} />
        <Route path="/portal/payments" element={<PortalPaymentsPage />} />
        <Route path="/portal/plans" element={<PortalPlansPage />} />
        <Route path="/portal/staff" element={<PortalStaffPage />} />
        <Route path="/portal/plans/:planCatalogId" element={<PortalPlanCatalogPage />} />
        <Route path="/portal/workspaces/:workspaceId" element={<PortalWorkspaceLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<PortalWorkspacePage />} />
          <Route path="billing" element={<PortalWorkspaceBillingPage />} />
          <Route path="members" element={<PortalWorkspaceMembersPage />} />
          <Route path="channels" element={<PortalWorkspaceChannelsPage />} />
          <Route path="audit" element={<PortalWorkspaceAuditPage />} />
        </Route>
      </Route>

      <Route element={<SessionOnlyLayout />}>
        <Route path="/account" element={<AccountPage audience="client" />} />
        <Route path="/account/workspaces" element={<AccountWorkspacesEntry />} />
        <Route path="/account/access-blocked" element={<WorkspaceAccessBlockedPage />} />
        <Route path="/account/billings" element={<BillingAccountPage />} />
        <Route path="/account/workspaces/new" element={<CreateWorkspacePage />} />
        <Route path="/workspaces" element={<Navigate to="/account/workspaces" replace />} />
        <Route path="/workspaces/billing" element={<Navigate to="/account/billings" replace />} />
        <Route path="/workspaces/new" element={<Navigate to="/account/workspaces/new" replace />} />

        <Route path="/inbox" element={<LegacyWorkspaceRedirect section="inbox" />} />
        <Route path="/billing" element={<LegacyWorkspaceRedirect section="billing" />} />
        <Route path="/channels" element={<LegacyWorkspaceRedirect section="channels" />} />
        <Route path="/knowledge" element={<LegacyWorkspaceRedirect section="knowledge" />} />
        <Route
          path="/canned-replies"
          element={<LegacyWorkspaceRedirect section="canned-replies" />}
        />
        <Route path="/stickers" element={<LegacyWorkspaceRedirect section="stickers" />} />
        <Route
          path="/business-hours"
          element={<LegacyWorkspaceRedirect section="business-hours" />}
        />
        <Route
          path="/automations"
          element={<LegacyWorkspaceRedirect section="business-hours" />}
        />
        <Route
          path="/ai-settings"
          element={<LegacyWorkspaceRedirect section="ai-settings" />}
        />
        <Route
          path="/workspace-profile"
          element={<LegacyWorkspaceRedirect section="workspace-profile" />}
        />
        <Route
          path="/workspace-members"
          element={<LegacyWorkspaceRedirect section="workspace-members" />}
        />
        <Route path="/analytics" element={<LegacyWorkspaceRedirect section="analytics" />} />

        <Route path="/workspace/:slug" element={<WorkspaceLayout />}>
          <Route index element={<WorkspaceIndexRedirect />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="billing" element={<WorkspaceBillingPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="canned-replies" element={<CannedRepliesPage />} />
          <Route path="stickers" element={<StickerLibraryPage />} />
          <Route path="business-hours" element={<AutomationsPage />} />
          <Route path="automations" element={<Navigate to="../business-hours" replace />} />
          <Route path="ai-settings" element={<AISettingsPage />} />
          <Route path="workspace-profile" element={<WorkspaceProfilePage />} />
          <Route path="workspace-members" element={<WorkspaceMembersPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
