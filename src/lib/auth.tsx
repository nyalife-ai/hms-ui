"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "./api";
import { ROLE_LABELS, type Role } from "./roles";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  position: string;
  permissions: string[];
  twoFactorEnabled?: boolean;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
  tokenType?: string;
  user: SessionUser;
}

export type LoginOutcome =
  | { kind: "session"; user: SessionUser }
  | {
      kind: "twoFactor";
      hash: string;
      expiresInMinutes: number;
      message: string;
    };

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  demoAuthEnabled: boolean;
  /** Demo role picker — only when backend ENABLE_DEMO_AUTH allows it */
  loginAsRole: (role: Role) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<LoginOutcome>;
  verifyLoginOtp: (hash: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  setTwoFactorEnabled: (enabled: boolean) => Promise<SessionUser>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "nyalife.session";

function normalizeUser(user: SessionUser): SessionUser {
  return {
    ...user,
    permissions: user.permissions ?? [],
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoAuthEnabled, setDemoAuthEnabled] = useState(false);

  const applySession = useCallback((res: AuthResponse) => {
    setAccessToken(res.accessToken);
    setRefreshToken(res.refreshToken);
    const next = normalizeUser(res.user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setUser(next);
  }, []);

  useEffect(() => {
    const boot = async () => {
      try {
        try {
          const features = await api<{ demoAuthEnabled: boolean }>(
            "/auth/features",
          );
          setDemoAuthEnabled(Boolean(features.demoAuthEnabled));
        } catch {
          setDemoAuthEnabled(false);
        }

        const raw = localStorage.getItem(STORAGE_KEY);
        const token = getAccessToken();
        if (raw && token) {
          try {
            const me = await api<SessionUser>("/auth/me");
            const next = normalizeUser(me);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            setUser(next);
          } catch {
            clearTokens();
            localStorage.removeItem(STORAGE_KEY);
            setUser(null);
          }
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        clearTokens();
      }
      setLoading(false);
    };
    void boot();
  }, []);

  const loginAsRole = async (role: Role) => {
    const res = await api<AuthResponse>("/auth/demo-login", {
      method: "POST",
      body: JSON.stringify({ role }),
    });
    applySession(res);
  };

  const loginWithPassword = async (
    email: string,
    password: string,
  ): Promise<LoginOutcome> => {
    const res = await api<
      AuthResponse & {
        twoFactorRequired?: boolean;
        hash?: string;
        expiresInMinutes?: number;
        message?: string;
      }
    >("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (res.twoFactorRequired && res.hash) {
      return {
        kind: "twoFactor",
        hash: res.hash,
        expiresInMinutes: res.expiresInMinutes ?? 10,
        message: res.message || "Enter the verification code sent to your email.",
      };
    }

    applySession(res);
    return { kind: "session", user: normalizeUser(res.user) };
  };

  const verifyLoginOtp = async (hash: string, otp: string) => {
    const res = await api<AuthResponse>("/auth/verify-login-otp", {
      method: "POST",
      body: JSON.stringify({ hash, otp }),
    });
    applySession(res);
  };

  const logout = async () => {
    const refreshToken = getRefreshToken();
    try {
      if (getAccessToken()) {
        await api("/auth/logout", {
          method: "POST",
          body: JSON.stringify(refreshToken ? { refreshToken } : {}),
        });
      }
    } catch {
      // local clear still happens
    }
    clearTokens();
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    await api("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    clearTokens();
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  const setTwoFactorEnabled = async (enabled: boolean) => {
    const me = await api<SessionUser>("/auth/me/two-factor", {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    const next = normalizeUser(me);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setUser(next);
    return next;
  };

  const refreshMe = async () => {
    const me = await api<SessionUser>("/auth/me");
    const next = normalizeUser(me);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setUser(next);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        demoAuthEnabled,
        loginAsRole,
        loginWithPassword,
        verifyLoginOtp,
        logout,
        changePassword,
        setTwoFactorEnabled,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

/** Demo account directory for login UI hints (emails only). */
export const DEMO_ACCOUNT_HINTS: Array<{
  email: string;
  role: Role;
  name: string;
}> = [
  { email: "super@nyalife.health", role: "SUPER_ADMIN", name: "System Administrator" },
  { email: "admin@nyalife.health", role: "ADMIN", name: "Terrine Herman" },
  { email: "a.okello@nyalife.health", role: "DOCTOR", name: "Dr. Amina Okello" },
  { email: "g.wanjiru@nyalife.health", role: "NURSE", name: "Grace Wanjiru" },
  { email: "b.otieno@nyalife.health", role: "RECEPTIONIST", name: "Brian Otieno" },
  { email: "f.njeri@nyalife.health", role: "PHARMACIST", name: "Faith Njeri" },
  { email: "s.kiptoo@nyalife.health", role: "LAB_TECHNICIAN", name: "Samuel Kiptoo" },
  { email: "m.achieng@nyalife.health", role: "RADIOLOGIST", name: "Dr. Mercy Achieng" },
  { email: "p.mwangi@nyalife.health", role: "ACCOUNTANT", name: "Peter Mwangi" },
];
