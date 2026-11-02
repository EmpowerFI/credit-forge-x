import { useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { isShowroom } from "../lib/stories";

// The diary's own Supabase client and session.
//
// The platform client points at the showroom: a project of simulated people
// whose password is published and whose data is reset by a script. A real
// woman's sales cannot go there. The diary points at the mobile app's
// database instead, where she already has an account under the same e-mail
// (one auth, one person), so whoever uses the app does not register again.
//
// VITE_DIARY_SUPABASE_URL / _PUBLISHABLE_KEY name that database. Without them
// the diary falls back to the platform's project, which is what local
// development wants; a production build that would land on the showroom
// refuses to open instead (see diaryClosed).
const url = (import.meta.env.VITE_DIARY_SUPABASE_URL ?? import.meta.env.VITE_PLATFORM_SUPABASE_URL) as string | undefined;
const key = (import.meta.env.VITE_DIARY_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_PLATFORM_SUPABASE_PUBLISHABLE_KEY) as
  | string
  | undefined;

/** True when this build has no real database for the diary: nothing configured, or the showroom in production. */
export const diaryClosed = !url || !key || (import.meta.env.PROD && isShowroom(url));

export const diaryDb = createClient(url ?? "http://diary.invalid", key ?? "missing", {
  auth: {
    storageKey: "empowerfi-diary-auth",
    persistSession: true,
    autoRefreshToken: true,
  },
});

/** Her diary session: null when signed out, and loading until the stored one has been read. */
export function useDiarySession(): { session: Session | null; loading: boolean } {
  const [state, setState] = useState<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
  useEffect(() => {
    let live = true;
    void diaryDb.auth.getSession().then(({ data }) => {
      if (live) setState({ session: data.session, loading: false });
    });
    const { data } = diaryDb.auth.onAuthStateChange((_event, session) => {
      if (live) setState({ session, loading: false });
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return state;
}
