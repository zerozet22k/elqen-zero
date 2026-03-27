import {
  useCallback,
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiRequest, setApiAuthContext } from "../services/api";
import { SessionData } from "../types/models";
import { isWorkspaceAdminRole } from "../utils/workspace-role";

const STORAGE_KEY = "omni-chat-session";

export type TenantMode = "single" | "multi";

export type DeploymentConfig = {
  tenantMode: TenantMode;
  allowSignup: boolean;
  allowWorkspaceCreation: boolean;
  defaultWorkspaceSlug: string | null;
  googleAuthEnabled: boolean;
};

/** Read deployment config from build-time VITE_ env. */
const readDeploymentConfig = (): DeploymentConfig => ({
  tenantMode:
    (import.meta.env.VITE_TENANT_MODE as TenantMode | undefined) === "single"
      ? "single"
      : "multi",
  allowSignup: import.meta.env.VITE_ALLOW_SIGNUP !== "false",
  allowWorkspaceCreation: true,
  defaultWorkspaceSlug: null,
  googleAuthEnabled: false,
});

type SessionContextValue = {
  session: SessionData | null;
  activeWorkspace: SessionData["workspaces"][number] | null;
  isAdmin: boolean;
  loading: boolean;
  deployment: DeploymentConfig;
  login: (payload: {
    email: string;
    password: string;
  }) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    workspaceSlug: string;
    workspaceName: string;
    timeZone?: string;
  }) => Promise<void>;
  acceptInvite: (payload: {
    token: string;
    password: string;
    name?: string;
  }) => Promise<void>;
  createWorkspace: (payload: {
    workspaceName: string;
    workspaceSlug: string;
    timeZone?: string;
    billingSelection?:
      | {
          type: "existing";
          billingAccountId: string;
        }
      | {
          type: "new";
          billingAccountName?: string;
        };
  }) => Promise<void>;
  establishSession: (session: SessionData) => void;
  refreshSession: () => Promise<void>;
  setActiveWorkspaceId: (workspaceId: string) => void;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deployment, setDeployment] = useState<DeploymentConfig>(readDeploymentConfig());

  const establishSession = useCallback((nextSession: SessionData) => {
    setApiAuthContext({
      token: nextSession.token,
      workspaceId: nextSession.activeWorkspaceId,
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }, []);

  const refreshSession = useCallback(async () => {
    const currentToken = session?.token;
    if (!currentToken) {
      return;
    }

    const me = await apiRequest<{
      user: SessionData["user"];
      workspaces: SessionData["workspaces"];
      blockedAccess?: SessionData["blockedAccess"];
      deployment?: Partial<DeploymentConfig>;
    }>("/api/auth/me");

    const fallbackWorkspaceId = me.workspaces[0]?._id ?? "";
    const activeWorkspaceId = me.workspaces.some(
      (workspace) => workspace._id === session?.activeWorkspaceId
    )
      ? session?.activeWorkspaceId ?? fallbackWorkspaceId
      : fallbackWorkspaceId;

    const nextSession: SessionData = {
      token: currentToken,
      user: me.user,
      workspaces: me.workspaces,
      activeWorkspaceId,
      blockedAccess: me.blockedAccess ?? null,
    };

    establishSession(nextSession);

    if (me.deployment) {
      setDeployment((current) => ({
        ...current,
        ...me.deployment,
      }));
    }
  }, [establishSession, session?.activeWorkspaceId, session?.token]);

  useEffect(() => {
    const hydrate = async () => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setLoading(false);
        return;
      }

      const parsed = JSON.parse(raw) as SessionData;
      setApiAuthContext({
        token: parsed.token,
        workspaceId: parsed.activeWorkspaceId,
      });

      try {
        const me = await apiRequest<{
          user: SessionData["user"];
          workspaces: SessionData["workspaces"];
          blockedAccess?: SessionData["blockedAccess"];
          deployment?: Partial<DeploymentConfig>;
        }>("/api/auth/me");

        const fallbackWorkspaceId = me.workspaces[0]?._id ?? "";
        const activeWorkspaceId = me.workspaces.some(
          (workspace) => workspace._id === parsed.activeWorkspaceId
        )
          ? parsed.activeWorkspaceId
          : fallbackWorkspaceId;

        const nextSession: SessionData = {
          token: parsed.token,
          user: me.user,
          workspaces: me.workspaces,
          activeWorkspaceId,
          blockedAccess: me.blockedAccess ?? null,
        };

        establishSession(nextSession);

        if (me.deployment) {
          setDeployment((current) => ({
            ...current,
            ...me.deployment,
          }));
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        setApiAuthContext({ token: null, workspaceId: null });
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    void hydrate();
  }, [establishSession]);

  useEffect(() => {
    const loadDeployment = async () => {
      try {
        const response = await apiRequest<{
          deployment: Partial<DeploymentConfig>;
        }>("/api/auth/deployment");
        setDeployment((current) => ({
          ...current,
          ...response.deployment,
        }));
      } catch {
        // Keep build-time defaults when the public deployment endpoint is unavailable.
      }
    };

    void loadDeployment();
  }, []);

  const login = async (payload: {
    email: string;
    password: string;
  }) => {
    const nextSession = await apiRequest<SessionData>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    establishSession(nextSession);
  };

  const register = async (payload: {
    name: string;
    email: string;
    password: string;
    workspaceSlug: string;
    workspaceName: string;
    timeZone?: string;
  }) => {
    const nextSession = await apiRequest<SessionData>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    establishSession(nextSession);
  };

  const acceptInvite = async (payload: {
    token: string;
    password: string;
    name?: string;
  }) => {
    const nextSession = await apiRequest<SessionData>("/api/auth/invitations/accept", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    establishSession(nextSession);
  };

  const createWorkspace = async (payload: {
    workspaceName: string;
    workspaceSlug: string;
    timeZone?: string;
    billingSelection?:
      | {
          type: "existing";
          billingAccountId: string;
        }
      | {
          type: "new";
          billingAccountName?: string;
        };
  }) => {
    const nextSession = await apiRequest<SessionData>("/api/auth/workspaces", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    establishSession(nextSession);
  };

  const setActiveWorkspaceId = (workspaceId: string) => {
    setSession((current) => {
      if (!current) {
        return current;
      }

      const exists = current.workspaces.some((workspace) => workspace._id === workspaceId);
      if (!exists) {
        return current;
      }

      const nextSession = {
        ...current,
        activeWorkspaceId: workspaceId,
      };
      setApiAuthContext({
        token: nextSession.token,
        workspaceId,
      });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      return nextSession;
    });
  };

  const activeWorkspace = useMemo(() => {
    if (!session) {
      return null;
    }
    return (
      session.workspaces.find(
        (workspace) => workspace._id === session.activeWorkspaceId
      ) ?? null
    );
  }, [session]);

  const isAdmin = isWorkspaceAdminRole(activeWorkspace?.workspaceRole);

  const logout = async () => {
    if (session?.token) {
      try {
        await apiRequest<{ loggedOut: boolean }>("/api/auth/logout", {
          method: "POST",
        });
      } catch {
        // Ignore logout API errors and clear local session regardless.
      }
    }
    window.localStorage.removeItem(STORAGE_KEY);
    setApiAuthContext({ token: null, workspaceId: null });
    setSession(null);
  };

  return (
    <SessionContext.Provider
      value={{
        session,
        activeWorkspace,
        isAdmin,
        loading,
        deployment,
        login,
        register,
        acceptInvite,
        createWorkspace,
        establishSession,
        refreshSession,
        setActiveWorkspaceId,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return value;
}
