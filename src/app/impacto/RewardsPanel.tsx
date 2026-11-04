import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { tr } from "../i18n";
import { diaryErrorText } from "../diary/diary";
import { type Campaign, impacto, newMilestoneCode, rewardsProblem, type SponsorMilestone } from "./impacto";

const span = (days: number) =>
  days % 7 === 0 && days <= 56
    ? tr({ en: days === 7 ? "1 week" : `${days / 7} weeks`, pt: days === 7 ? "1 semana" : `${days / 7} semanas` })
    : tr({ en: days === 1 ? "1 day" : `${days} days`, pt: days === 1 ? "1 dia" : `${days} dias` });

const blank = (): SponsorMilestone => ({ code: newMilestoneCode(), threshold_days: 0, title: "", how_to_redeem: "", redeem_url: "" });

/**
 * A sponsor's own rewards for its campaign: whoever hands a reward over sets
 * it. The sponsor's people turn them on or off and publish milestones -- a
 * gift redeemed by a code or a link, so nothing of hers reaches the sponsor.
 * EmpowerFI's team reads them here and edits only EmpowerFI's own, in its
 * dashboard. A published version is frozen; publishing makes the next one.
 */
export default function RewardsPanel({ campaign }: { campaign: Campaign }) {
  const queryClient = useQueryClient();
  const key = ["impacto", "rewards", campaign.id];
  const q = useQuery({ queryKey: key, queryFn: () => impacto.rewards(campaign.id) });
  const [draft, setDraft] = useState<SponsorMilestone[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const published = q.data?.programme?.milestones ?? [];
  useEffect(() => {
    if (q.data) setDraft(null);
  }, [q.data]);
  const rows = draft ?? published.map((m) => ({ ...m, how_to_redeem: m.how_to_redeem ?? "", redeem_url: m.redeem_url ?? "" }));
  const changed = draft !== null;

  const edit = (next: SponsorMilestone[]) => {
    setDraft(next);
    setConfirming(false);
    setNotice(null);
    setError(null);
  };
  const update = (i: number, patch: Partial<SponsorMilestone>) => edit(rows.map((m, k) => (k === i ? { ...m, ...patch } : m)));

  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const done = await work();
      await queryClient.invalidateQueries({ queryKey: ["impacto"] });
      setNotice(done);
    } catch (e) {
      setError(diaryErrorText(e));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const publish = () => {
    const problem = rewardsProblem(rows);
    if (problem) {
      setError(problem);
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }
    void run(async () => {
      const r = await impacto.publishRewards(campaign.id, [...rows].sort((a, b) => a.threshold_days - b.threshold_days));
      return tr({ en: `Published as version ${r.version}.`, pt: `Publicado como versão ${r.version}.` });
    });
  };

  const d = q.data;
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5 print:hidden" aria-labelledby="rewards-title">
      <div className="space-y-1">
        <h2 id="rewards-title" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Gift size={18} aria-hidden="true" />{tr({ en: "Campaign rewards", pt: "Prêmios da campanha" })}
        </h2>
        <p className="text-sm text-muted-foreground">
          {tr({
            en: `${campaign.sponsor_name} sets and delivers these rewards: a code or a link the woman uses by herself when she reaches a number of days recorded in the campaign. Nothing about her reaches the sponsor.`,
            pt: `${campaign.sponsor_name} define e entrega estes prêmios: um código ou link que a empreendedora usa sozinha ao chegar a um número de dias registrados na campanha. Nada dela chega ao patrocinador.`,
          })}
        </p>
      </div>

      {q.isLoading && <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Loading", pt: "Carregando" })} />}
      {q.error && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">{diaryErrorText(q.error)}</p>
          <Button variant="outline" onClick={() => void q.refetch()}>{tr({ en: "Try again", pt: "Tentar de novo" })}</Button>
        </div>
      )}

      {d && (
        <>
          <div className="flex min-h-12 items-center justify-between gap-4 rounded-md border border-border p-3">
            <Label htmlFor="offers-rewards" className="text-sm">
              {tr({ en: "Offer rewards in this campaign", pt: "Oferecer prêmios nesta campanha" })}
              <span className="block text-xs font-normal text-muted-foreground">
                {d.offers_rewards
                  ? tr({ en: "On: women earn the published rewards.", pt: "Ligado: as empreendedoras ganham os prêmios publicados." })
                  : tr({ en: "Off: nobody earns anything new; what was earned stays.", pt: "Desligado: ninguém ganha nada novo; o que já foi ganho continua valendo." })}
              </span>
            </Label>
            <Switch id="offers-rewards" checked={d.offers_rewards} disabled={!d.can_edit || busy}
              onCheckedChange={(on) => void run(async () => {
                await impacto.offerRewards(campaign.id, on);
                return on ? tr({ en: "Rewards on.", pt: "Prêmios ligados." }) : tr({ en: "Rewards off.", pt: "Prêmios desligados." });
              })} />
          </div>

          <p className="text-xs text-muted-foreground">
            {d.programme
              ? tr({
                en: `Version ${d.programme.version}, published ${new Date(d.programme.published_at).toLocaleDateString("en-GB")}.`,
                pt: `Versão ${d.programme.version}, publicada em ${new Date(d.programme.published_at).toLocaleDateString("pt-BR")}.`,
              })
              : tr({ en: "No rewards published yet.", pt: "Nenhum prêmio publicado ainda." })}
            {!d.can_edit && tr({
              en: " Only the sponsor's people can change them.",
              pt: " Só as pessoas do patrocinador podem mudá-los.",
            })}
          </p>

          <ol className="space-y-3">
            {rows.map((m, i) => {
              const id = `reward-${i}`;
              const earned = d.earned[m.code] ?? 0;
              return (
                <li key={m.code} className="grid gap-4 rounded-md border border-border p-4 lg:grid-cols-[1fr_18rem]">
                  {d.can_edit ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">{tr({ en: `Reward ${i + 1}`, pt: `Prêmio ${i + 1}` })}</h3>
                        <Button variant="ghost" size="sm" className="h-10" disabled={busy}
                          onClick={() => edit(rows.filter((_, k) => k !== i))}>
                          <Trash2 aria-hidden="true" />{tr({ en: "Remove", pt: "Remover" })}
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                        <div className="space-y-1">
                          <Label htmlFor={`${id}-days`}>{tr({ en: "Days recorded", pt: "Dias registrados" })}</Label>
                          <Input id={`${id}-days`} type="number" inputMode="numeric" min={1} max={3650} disabled={busy}
                            value={m.threshold_days > 0 ? m.threshold_days : ""}
                            onChange={(e) => update(i, { threshold_days: e.target.valueAsNumber || 0 })} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`${id}-title`}>{tr({ en: "Reward", pt: "Prêmio" })}</Label>
                          <Input id={`${id}-title`} maxLength={80} disabled={busy} value={m.title}
                            placeholder={tr({ en: "10% off at our shop", pt: "10% de desconto na nossa loja" })}
                            onChange={(e) => update(i, { title: e.target.value })} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`${id}-how`}>{tr({ en: "How to redeem (code or instruction)", pt: "Como resgatar (código ou instrução)" })}</Label>
                        <Textarea id={`${id}-how`} rows={2} maxLength={300} disabled={busy} value={m.how_to_redeem ?? ""}
                          placeholder={tr({ en: "Use the code REDE10 at checkout.", pt: "Use o cupom REDE10 ao finalizar a compra." })}
                          onChange={(e) => update(i, { how_to_redeem: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`${id}-link`}>{tr({ en: "Link to redeem (optional)", pt: "Link para resgatar (opcional)" })}</Label>
                        <Input id={`${id}-link`} type="url" inputMode="url" autoComplete="off" maxLength={500} disabled={busy}
                          value={m.redeem_url ?? ""} placeholder="https://"
                          onChange={(e) => update(i, { redeem_url: e.target.value })} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold">{m.title}</p>
                      <p className="text-muted-foreground">{tr({ en: `After ${span(m.threshold_days)} of recording`, pt: `Ao completar ${span(m.threshold_days)} registrando` })}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{tr({ en: "What she reads", pt: "O que ela lê" })}</p>
                    <div className="space-y-1 rounded-md bg-muted p-3 text-sm">
                      <p>🎁 <strong>{m.title || "…"}</strong>, {tr({ en: "from", pt: "de" })} {campaign.sponsor_name}</p>
                      {m.how_to_redeem && <p className="whitespace-pre-line">{m.how_to_redeem}</p>}
                      {m.redeem_url && <p className="break-all text-primary underline">{m.redeem_url}</p>}
                    </div>
                    {published.some((p) => p.code === m.code) && (
                      <p className="text-xs text-muted-foreground">
                        {earned === 1
                          ? tr({ en: "Earned by 1 woman so far.", pt: "1 empreendedora ganhou até agora." })
                          : tr({ en: `Earned by ${earned} women so far.`, pt: `${earned} empreendedoras ganharam até agora.` })}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {d.can_edit && (
            <div className="space-y-3">
              <Button variant="outline" className="h-10" disabled={busy} onClick={() => edit([...rows, blank()])}>
                <Plus aria-hidden="true" />{tr({ en: "Add a reward", pt: "Incluir prêmio" })}
              </Button>
              {confirming && (
                <p className="rounded-md border border-border p-3 text-sm" role="status">
                  {tr({
                    en: `Publish version ${(d.programme?.version ?? 0) + 1}? From the next day recorded, women earn by these rules. Rewards already earned stay as they were. Changing the days of a published reward does not make whoever earned it earn it again.`,
                    pt: `Publicar a versão ${(d.programme?.version ?? 0) + 1}? A partir do próximo dia registrado, as empreendedoras ganham por estas regras. O que já foi ganho continua como era. Mudar os dias de um prêmio já publicado não faz quem ganhou ganhar de novo.`,
                  })}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button className="h-10" disabled={busy || !changed} onClick={publish}>
                  {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {confirming ? tr({ en: "Yes, publish", pt: "Sim, publicar" }) : tr({ en: "Publish", pt: "Publicar" })}
                </Button>
                {changed && (
                  <Button variant="outline" className="h-10" disabled={busy} onClick={() => { setDraft(null); setConfirming(false); setError(null); }}>
                    {tr({ en: "Discard changes", pt: "Descartar mudanças" })}
                  </Button>
                )}
              </div>
              {d.offers_rewards === false && d.programme && (
                <p className="text-xs text-muted-foreground">
                  {tr({ en: "Rewards are off: turn them on above for women to earn them.", pt: "Os prêmios estão desligados: ligue acima para que elas possam ganhar." })}
                </p>
              )}
            </div>
          )}
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          {notice && <p role="status" className="text-sm">{notice}</p>}
        </>
      )}
    </section>
  );
}
