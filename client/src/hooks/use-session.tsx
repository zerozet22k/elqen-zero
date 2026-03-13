import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiRequest } from "../services/api";
import { SessionData } from "../types/models";

const STORAGE_KEY = "unified-chat-session";

type SessionContextValue = {
  session: SessionData | null;
  loading: boolean;
  login: (payload: {
    name: string;
    email: string;
    workspaceSlug: string;
    workspaceName?: string;
  }) => Promise<void>;
  logout: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      setSession(JSON.parse(raw));
    }
    setLoading(false);
  }, []);

  const login = async (payload: {
    name: string;
    email: string;
    workspaceSlug: string;
    workspaceName?: string;
  }) => {
    const nextSession = await apiRequest<SessionData>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  };

  const logout = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  };

  return (
    <SessionContext.Provider value={{ session, loading, login, logout }}>
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
