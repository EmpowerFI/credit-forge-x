import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { tr } from "../i18n";
import type { Role } from "../lib/platform";
import { type Area, canOpen, DEMO_PASSWORD, isDemoAccount } from "../lib/stories";
import { opensView, type View } from "../lib/views";
import { useAuth } from "./useAuth";

/**
 * Opens an area or a view. If the account's role cannot, a demo account enters
 * as its demo persona first, in one click, keeping the language; any other
 * account is only ever shown what its role opens.
 */
export function useOpenArea() {
  const { profile, session, switchAccount } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState<string | null>(null);
  const demo = isDemoAccount(session?.user.email);

  const enterAs = async (key: string, persona: { email: string; name: string }, allowed: boolean, to: string) => {
    if (allowed) {
      navigate(to);
      return;
    }
    if (!demo) return;
    setSwitching(key);
    const { error } = await switchAccount(persona.email, DEMO_PASSWORD);
    setSwitching(null);
    if (error) {
      toast.error(tr({ en: `Could not enter as ${persona.name}: ${error}`, pt: `Não foi possível entrar como ${persona.name}: ${error}` }));
      return;
    }
    navigate(to);
  };

  // A leader's community opens from her home, which knows which one she leads.
  const open = (area: Area, to: string = area.to) =>
    enterAs(area.id, area.persona, canOpen(area, profile?.role), !canOpen(area, profile?.role) && area.id === "community" ? "/app" : to);

  const openView = (view: View, to: string) => enterAs(`view:${view.id}`, view.persona, opensView(view, profile?.role as Role | undefined), to);

  return {
    open, openView, switching, demo,
    visible: (area: Area) => demo || canOpen(area, profile?.role),
    viewVisible: (view: View) => !view.hidden && (demo || opensView(view, profile?.role)),
  };
}
