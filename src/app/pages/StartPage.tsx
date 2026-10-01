import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import RoleLanding, { ViewChoice } from "../components/views/RoleLanding";
import { useAuth } from "../auth/useAuth";
import { useOpenArea } from "../auth/useOpenArea";
import { tr } from "../i18n";
import { ROLE_LABEL } from "../lib/platform";
import { opensView, type Tool, toolPath, viewById, viewOf, VIEWS } from "../lib/views";
import { useLedCommunity } from "./community/queries";

/**
 * The platform's landing, signed in: the chosen view's value and its tools.
 * "View platform as" in the header lands here. A view the account's role does
 * not hold stays readable, and its tools open only for demo accounts, as that
 * view's demo persona.
 */
export default function StartPage() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const { openView, switching, demo } = useOpenArea();
  const led = useLedCommunity();
  const [busy, setBusy] = useState<Tool | null>(null);
  const view = viewById(params.get("as")) ?? viewOf(profile?.role) ?? VIEWS[0];
  const opens = opensView(view, profile?.role);

  const go = async (tool: Tool) => {
    setBusy(tool);
    // After a switch the leader's community is not known yet: home finds it.
    await openView(view, toolPath(tool, opens ? led.data?.id : null));
    setBusy(null);
  };

  const locked = !opens && !demo && profile
    ? tr({
        en: `Your account (${ROLE_LABEL[profile.role]}) does not open this view. What it shows stays behind its role's permissions.`,
        pt: `Sua conta (${ROLE_LABEL[profile.role]}) não abre esta visão. O que ela mostra continua protegido pelas permissões do papel.`,
      })
    : undefined;

  return (
    <div className="space-y-10">
      <ViewChoice value={view.id} onChange={(id) => setParams({ as: id }, { replace: true })} />
      <RoleLanding view={view} locked={locked}
        cta={
          <>
            <Button size="lg" className="gap-2" disabled={Boolean(locked) || switching !== null} onClick={() => go(view.home)}>
              {tr({ en: `Open ${view.home.label}`, pt: `Abrir ${view.home.label}` })}
              {busy === view.home ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            </Button>
            {!opens && demo && (
              <span className="text-sm text-muted-foreground">
                {tr({ en: `Opens as the demo ${view.persona.name}.`, pt: `Abre como ${view.persona.name}, conta demo.` })}
              </span>
            )}
          </>
        } />
    </div>
  );
}
