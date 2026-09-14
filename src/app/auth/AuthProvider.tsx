import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { platform } from "../lib/platform";
import { AuthContext, type AuthState } from "./useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    platform.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = platform.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Another person may be signing in on this browser: drop cached data.
      if (!next) queryClient.clear();
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
    signIn: async (email, password) => {
      const { error } = await platform.auth.signInWithPassword({ email, password });
      return { error: error ? error.message : null };
    },
    signOut: async () => {
      await platform.auth.signOut();
      queryClient.clear();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
