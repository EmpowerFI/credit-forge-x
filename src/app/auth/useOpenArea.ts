import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { tr } from "../i18n";
import { type Area, canOpen, DEMO_PASSWORD, isDemoAccount } from "../lib/stories";
import { useAuth } from "./useAuth";

/**
 * Opens an area. If the account's role cannot, a demo account enters as that
 * area's demo persona first, in one click, keeping the language; any other
 * account is only ever shown the areas its role opens.
 */
export function useOpenArea() {
  const { profile, session, switchAccount } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState<Area["id"] | null>(null);
  const demo = isDemoAccount(session?.user.email);

  const open = async (area: Area, to: string = area.to) => {
    if (canOpen(area, profile?.role)) {
      navigate(to);
      return;
    }
    if (!demo) return;
    setSwitching(area.id);
    const { error } = await switchAccount(area.persona.email, DEMO_PASSWORD);
    setSwitching(null);
    if (error) {
      toast.error(tr({ en: `Could not enter as ${area.persona.name}: ${error}`, pt: `Não foi possível entrar como ${area.persona.name}: ${error}` }));
      return;
    }
    // A leader's community opens from her home, which knows which one she leads.
    navigate(area.id === "community" ? "/app" : to);
  };

  return { open, switching, demo, visible: (area: Area) => demo || canOpen(area, profile?.role) };
}
