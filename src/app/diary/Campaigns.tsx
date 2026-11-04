import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "../i18n";
import { diary, diaryErrorText, type DiaryProfile, type OpenCampaign, PROFILE_KEY, type Reward } from "./diary";
import SponsorLogo from "./SponsorLogo";

const ddmm = (day: string) => day.slice(0, 10).split("-").reverse().join("/");

/**
 * Open campaigns, joined with one tap. Shown only while she is EmpowerFI's:
 * one campaign at a time, so whoever is in one sees none. What a sponsor sees
 * and that leaving is for good are said before the tap, not after.
 */
export function OpenCampaigns({ profile }: { profile: DiaryProfile }) {
  const queryClient = useQueryClient();
  const house = profile.campaign?.is_default ?? false;
  const list = useQuery({ queryKey: [...PROFILE_KEY, "open-campaigns"], queryFn: diary.openCampaigns, enabled: house });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);

  if (!house || !list.data?.length) return null;

  const join = async (c: OpenCampaign) => {
    setBusy(c.id);
    setError(null);
    try {
      await diary.joinCampaign(c.id);
      await queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    } catch (e) {
      setError({ id: c.id, text: diaryErrorText(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3" aria-labelledby="open-campaigns">
      <h2 id="open-campaigns" className="font-heading text-xl font-semibold">
        {tr({ en: "Campaigns you can join", pt: "Campanhas abertas para você" })}
      </h2>
      {list.data.map((c) => (
        <article key={c.id} className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted-foreground">{c.sponsor_name}</p>
              <h3 className="font-heading text-xl font-semibold">{c.name}</h3>
            </div>
            {c.logo_path && <SponsorLogo sponsor={c.sponsor_name} logoPath={c.logo_path} linkUrl={c.link_url} />}
          </div>
          {c.description && <p>{c.description}</p>}
          <p className="text-muted-foreground">
            {tr({ en: `Until ${ddmm(c.period_end)}`, pt: `Até ${ddmm(c.period_end)}` })}
            {c.offers_rewards && tr({ en: " · rewards for recording", pt: " · tem prêmios por registrar" })}
          </p>
          {c.blocked_by ? (
            <p className="rounded-md bg-muted p-3">
              {tr({
                en: `You are already in "${c.blocked_by}" for part of this period, so you cannot join this one.`,
                pt: `Você já está em "${c.blocked_by}" em parte deste período, por isso não pode participar desta.`,
              })}
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">
                {tr({
                  en: `From today your days count for this campaign. ${c.sponsor_name} sees only totals of groups of at least 5 women, never your name. You can leave whenever you like, but not come back to it.`,
                  pt: `A partir de hoje, os seus dias contam para esta campanha. ${c.sponsor_name} vê só números somados de grupos de pelo menos 5 empreendedoras, nunca o seu nome. Você pode sair quando quiser, mas não volta para ela.`,
                })}
              </p>
              <Button className="h-12 w-full" disabled={busy !== null} onClick={() => void join(c)}>
                {busy === c.id && <Loader2 className="animate-spin" aria-hidden="true" />}
                {tr({ en: "Join", pt: "Participar" })}
              </Button>
            </>
          )}
          {error?.id === c.id && <p role="alert" className="font-medium text-destructive">{error.text}</p>}
        </article>
      ))}
    </section>
  );
}

/** Leaving a campaign she joined by herself: asked twice, because she cannot come back. */
export function LeaveCampaign({ profile }: { profile: DiaryProfile }) {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = profile.campaign;
  if (!c || c.is_default || !c.joined_herself) return null;

  if (c.leaving) {
    return (
      <p className="rounded-md bg-muted p-3">
        {tr({
          en: "You left this campaign: today is your last day in it. From tomorrow your days count for EmpowerFI's diary.",
          pt: "Você saiu desta campanha: hoje é o seu último dia nela. A partir de amanhã, os seus dias contam para o diário da EmpowerFI.",
        })}
      </p>
    );
  }

  const leave = async () => {
    setBusy(true);
    setError(null);
    try {
      await diary.leaveCampaign();
      await queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      setAsking(false);
    } catch (e) {
      setError(diaryErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {asking ? (
        <div className="space-y-3 rounded-md border border-destructive/40 p-3" role="group" aria-labelledby="leave-ask">
          <p id="leave-ask">
            {tr({
              en: `Leave "${c.name}"? Today still counts for it; from tomorrow you are back in EmpowerFI's diary. You cannot join this campaign again.`,
              pt: `Sair de "${c.name}"? Hoje ainda conta para ela; a partir de amanhã você volta para o diário da EmpowerFI. Não dá para participar desta campanha de novo.`,
            })}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="destructive" className="h-11" disabled={busy} onClick={() => void leave()}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {tr({ en: "Yes, leave", pt: "Sim, sair" })}
            </Button>
            <Button variant="outline" className="h-11" disabled={busy} onClick={() => setAsking(false)}>
              {tr({ en: "Stay", pt: "Ficar" })}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="h-11" onClick={() => setAsking(true)}>
          {tr({ en: "Leave this campaign", pt: "Sair desta campanha" })}
        </Button>
      )}
      {error && <p role="alert" className="font-medium text-destructive">{error}</p>}
    </div>
  );
}

/** One reward: what it is, whose, and how to get it. */
export function RewardCard({ reward }: { reward: Reward }) {
  const link = reward.redeem_url && /^https:\/\/\S+$/.test(reward.redeem_url) ? reward.redeem_url : null;
  return (
    <section className="space-y-2 rounded-2xl border border-primary/40 bg-primary/5 p-5 text-sm">
      <p className="font-heading text-xl font-semibold">
        🎁 {reward.title}
        {reward.sponsor_name && (
          <span className="font-normal text-muted-foreground">{tr({ en: `, from ${reward.sponsor_name}`, pt: `, de ${reward.sponsor_name}` })}</span>
        )}
      </p>
      {reward.how_to_redeem && <p className="whitespace-pre-line">{reward.how_to_redeem}</p>}
      {link && (
        <Button asChild variant="outline" className="h-11">
          <a href={link} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            {tr({ en: "Redeem", pt: "Resgatar" })}
          </a>
        </Button>
      )}
      {reward.granted_at && (
        <p className="text-xs text-muted-foreground">
          {tr({ en: "Earned on ", pt: "Ganho em " })}
          {new Date(reward.granted_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </p>
      )}
    </section>
  );
}

/** Everything she has earned, so a code is never lost once the moment has passed. */
export function MyRewards({ profile }: { profile: DiaryProfile }) {
  const rewards = profile.rewards ?? [];
  if (!rewards.length) return null;
  return (
    <section className="space-y-3" aria-labelledby="my-rewards">
      <h2 id="my-rewards" className="font-heading text-xl font-semibold">{tr({ en: "Your rewards", pt: "Seus prêmios" })}</h2>
      {rewards.map((r, i) => <RewardCard key={`${r.title}-${r.granted_at ?? i}`} reward={r} />)}
    </section>
  );
}
