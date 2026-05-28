import { createContext, useContext, useState, ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";

export type UserRole = "hr" | "employee" | "supervisor" | "gm" | "accounting";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string | null;
  outlet?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string, role?: UserRole) => Promise<void>;
  logout: () => void;
  changePassword: (userId: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_STORAGE_KEY = "buenaventura_hris_user";

const getStoredUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;

  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    const rawUser = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    return rawUser ? (JSON.parse(rawUser) as AuthUser) : null;
  } catch {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

const storeUser = (user: AuthUser | null) => {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(AUTH_STORAGE_KEY);

  if (user) {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
  }
};

const SYSTEM_ACCOUNTS: Record<string, { user: AuthUser; password: string }> = {
  admin: {
    user: { id: "SYS-HR", name: "HR Admin", email: "admin", role: "hr" },
    password: "admin123",
  },
  "hr@company.com": {
    user: { id: "SYS-HR", name: "HR Admin", email: "hr@company.com", role: "hr" },
    password: "password",
  },
  "employee@company.com": {
    user: { id: "SYS-EMP", name: "Juan Dela Cruz", email: "employee@company.com", role: "employee" },
    password: "password",
  },
  "supervisor@company.com": {
    user: { id: "SYS-SUP", name: "Maria Santos", email: "supervisor@company.com", role: "supervisor" },
    password: "password",
  },
  "gm@company.com": {
    user: { id: "SYS-GM", name: "General Manager", email: "gm@company.com", role: "gm" },
    password: "password",
  },
  "accounting@company.com": {
    user: { id: "SYS-ACC", name: "Accounting Staff", email: "accounting@company.com", role: "accounting" },
    password: "password",
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());

  const login = async (email: string, password: string, role?: UserRole) => {
  const loginEmail = email.trim().toLowerCase();

  const systemMatch = SYSTEM_ACCOUNTS[loginEmail] || SYSTEM_ACCOUNTS[email.trim()];
  if (systemMatch && password === systemMatch.password) {
    if (role && systemMatch.user.role !== role) {
      throw new Error("Selected role does not match this account.");
    }

    setUser(systemMatch.user);
    storeUser(systemMatch.user);
    return;
  }

  let query = supabase
    .from("user_accounts")
    .select("*")
    .eq("email", loginEmail)
    .eq("password", password)
    .eq("is_active", true);

  if (role) {
    query = query.eq("role", role);
  }

  const { data: account, error } = await query.maybeSingle();

  if (error) throw error;

  if (account) {
    const authenticatedUser = {
      id: account.user_id,
      name: account.full_name,
      email: account.email,
      role: account.role as UserRole,
      employeeId: account.employee_id ?? null,
      outlet: account.outlet ?? null,
    };

    setUser(authenticatedUser);
    storeUser(authenticatedUser);
    return;
  }

  throw new Error("Invalid credentials or selected role does not match.");
};

  const logout = () => {
    setUser(null);
    storeUser(null);
  };

  const changePassword = async (userId: string, newPassword: string) => {
    const { error } = await supabase
      .from("user_accounts")
      .update({ password: newPassword })
      .eq("user_id", userId);

    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
