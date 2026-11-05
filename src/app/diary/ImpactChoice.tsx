import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { tr } from "../i18n";
import { AiReadingSwitch } from "./BusinessWeek";
import { LeaveCampaign } from "./Campaigns";
import { diary, diaryErrorText, type DiaryProfile, IMPACT_ASKED_IN, PROFILE_KEY } from "./diary";

/** The question itself, the same words wherever it is asked. Its version is CONSENT_TEXT_VERSION. */
export function ImpactChoiceText() {
  return (
    <>
      {tr({
        en: "Count my business in the impact figures: my sales and expenses added to other women's, in groups of at least 5, for whoever sponsors my participation. Never my name, never my figures alone.",
        pt: "Incluir o meu negócio nos números de impacto: as minhas vendas e gastos somados aos de outras empreendedoras, em grupos de pelo menos 5, para quem patrocina a minha participação. Nunca o meu nome, nunca os meus números sozinhos.",
      })}
    </>
  );
}

function useSetImpact() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = async (share: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await diary.setImpactConsent(share);
      await queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    } catch (e) {
      setError(diaryErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  return { set, busy, error };
}

/** Asked once of whoever signed up before the question existed. Either answer is kept, and can be changed under Lembretes. */
export function ImpactAsk({ profile }: { profile: DiaryProfile }) {
  const { set, busy, error } = useSetImpact();
  if (!profile.impact_consent || IMPACT_ASKED_IN.includes(profile.impact_consent.text_version)) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
      <h2 className="font-heading text-xl font-semibold">{tr({ en: "A question, once", pt: "Uma pergunta, só uma vez" })}</h2>
      <p><ImpactChoiceText /></p>
      <p className="text-muted-foreground">
        {tr({
          en: "The diary works the same either way, and you can change your answer under Reminders.",
          pt: "O diário funciona igual nos dois casos, e você pode mudar a resposta em Lembretes.",
        })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button className="h-11" disabled={busy} onClick={() => void set(true)}>
          {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
          {tr({ en: "Yes, count my business", pt: "Sim, pode incluir" })}
        </Button>
        <Button variant="outline" className="h-11" disabled={busy} onClick={() => void set(false)}>
          {tr({ en: "No, thanks", pt: "Não, obrigada" })}
        </Button>
      </div>
      {error && <p role="alert" className="font-medium text-destructive">{error}</p>}
    </section>
  );
}

/** Under Lembretes: whose campaign her days count for, and the switch. */
export function YourData({ profile }: { profile: DiaryProfile }) {
  const { set, busy, error } = useSetImpact();
  const c = profile.campaign;
  const share = profile.impact_consent?.share ?? false;
  const until = c?.until ? c.until.split("-").reverse().join("/") : null;
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
      <h2 className="font-heading text-xl font-semibold">{tr({ en: "Your participation and your data", pt: "Sua participação e seus dados" })}</h2>
      {c && (
        <p>
          {c.is_default
            ? tr({ en: "You take part in EmpowerFI's diary.", pt: "Você participa do diário da EmpowerFI." })
            : tr({
              en: `You take part in "${c.name}", backed by ${c.sponsor_name}${until ? `, until ${until}` : ""}.`,
              pt: `Você participa de "${c.name}", com apoio de ${c.sponsor_name}${until ? `, até ${until}` : ""}.`,
            })}
        </p>
      )}
      <LeaveCampaign profile={profile} />
      <div className="flex items-start justify-between gap-4">
        <Label htmlFor="impact-share" className="text-sm font-normal leading-relaxed"><ImpactChoiceText /></Label>
        <Switch id="impact-share" checked={share} disabled={busy} onCheckedChange={(v) => void set(v)} className="mt-1 shrink-0" />
      </div>
      <AiReadingSwitch profile={profile} />
      {error && <p role="alert" className="font-medium text-destructive">{error}</p>}
    </section>
  );
}
