import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { platform } from "../lib/platform";
import { AuthContext, type AuthState } from "./useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const signedInAs = useRef<string | null>(null);

  useEffect(() => {
    platform.auth.getSession().then(({ data }) => {
      setSession(data.session);
      signedInAs.current = data.session?.user.id ?? null;
      setSessionLoaded(true);
    });
    const { data } = platform.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // Another person may be signing in on this browser: drop cached data.
      // On a real sign-out, and whenever the account itself changes — a demo
      // investor signing in with her own wallet does so without signing out,
      // and nothing the demo account read may show under her address. A
      // visitor with no session also gets events without one (INITIAL_SESSION),
      // and clearing then would orphan the queries a page without an account —
      // a shared report — is running.
      const user = next?.user.id ?? null;
      if (event === "SIGNED_OUT" || (user !== null && user !== signedInAs.current && signedInAs.current !== null)) {
        queryClient.clear();
      }
      signedInAs.current = user;
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user.id;
  const profileQuery = useQuery({
    queryKey: ["platform", "profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await platform.from("profiles").select("*").eq("id", userId!).single();
      if (error) throw error;
      return data;
    },
  });

  const value: AuthState = {
    session,
    profile: profileQuery.data ?? null,
    loading: !sessionLoaded || (Boolean(userId) && profileQuery.isLoading),
    profileError: profileQuery.error,
    retryProfile: () => void profileQuery.refetch(),
    signIn: async (email, password) => {
      const { error } = await platform.auth.signInWithPassword({ email, password });
      return { error: error ? error.message : null };
    },
    switchAccount: async (email, password) => {
      const { error } = await platform.auth.signInWithPassword({ email, password });
      // Nothing the previous account read may show under the next one.
      if (!error) queryClient.clear();
      return { error: error ? error.message : null };
    },
    signOut: async () => {
      await platform.auth.signOut();
      queryClient.clear();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
