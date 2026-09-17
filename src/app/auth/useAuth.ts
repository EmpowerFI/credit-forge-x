import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "../lib/platform";

export interface AuthState {
  session: Session | null;
  profile: Profile | null;
  /** True until the stored session has been read, and its profile loaded. */
  loading: boolean;
  /** Set when the session is valid but the profile could not be loaded. */
  profileError: unknown;
  retryProfile: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Signs in as another account in place, dropping what the previous one had loaded. */
  switchAccount: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
