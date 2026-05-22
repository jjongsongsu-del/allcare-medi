import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import {
  AuthSession,
  clearSession,
  getRecentLoginProvider,
  loadStoredSession,
  LoginProvider,
  refreshStoredSession,
  startGuestSession,
  startSocialSession
} from "@/services/authService";

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  recentProvider: LoginProvider | null;
  continueAsGuest: () => Promise<void>;
  continueWithSocial: (provider: Exclude<LoginProvider, "GUEST">) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [recentProvider, setRecentProvider] = useState<LoginProvider | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrapAuth() {
      try {
        const [storedSession, provider] = await Promise.all([loadStoredSession(), getRecentLoginProvider()]);
        setRecentProvider(provider);
        if (storedSession?.mode === "member") {
          setSession(await refreshStoredSession());
          return;
        }
        setSession(storedSession);
      } catch {
        setSession(null);
      } finally {
        setLoading(false);
      }
    }

    bootstrapAuth();
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      recentProvider,
      continueAsGuest: async () => {
        const nextSession = await startGuestSession();
        setSession(nextSession);
        setRecentProvider("GUEST");
      },
      continueWithSocial: async (provider: Exclude<LoginProvider, "GUEST">) => {
        const nextSession = await startSocialSession(provider);
        setSession(nextSession);
        setRecentProvider(provider);
      },
      logout: async () => {
        await clearSession(session);
        setSession(null);
      }
    }),
    [loading, recentProvider, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
