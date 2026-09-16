import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { ACTION, bpsPct, type OutreachAction, STAGE_HINT, STAGE_LABEL } from "../../lib/community";
import { money, monthLabel } from "../../lib/readiness";
import { useCommunity } from "./context";
import OutreachDialog from "./OutreachDialog";
import { useOverview } from "./queries";
import { tr } from "../../i18n";

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

// The stages a community produces are gold; the ones others decide are slate.
const OWN_STAGE = new Set(["credit_ready", "eligible", "p2p_opportunity"]);

export default function CommunityOverview() {
  const { community, leads } = useCommunity();
  const overview = useOverview(community.id);
  const [dialog, setDialog] = useState<OutreachAction | null>(null);

  if (overview.isError) return <LoadError error={overview.error} onRetry={() => overview.refetch()} />;
  const o = overview.data;
  const h = o?.hero;
  const top = Math.max(1, o?.funnel[0]?.n ?? 1);
  const queue = o?.queue.filter((q) => q.pending + q.contacted > 0) ?? [];
  const open = queue.find((q) => q.action === dialog);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {tr({
          en: <>Where the community stands{o?.as_of_period ? <> as of <span className="text-foreground">{monthLabel(o.as_of_period)}</span>, the latest month reported</> : null}.</>,
          pt: <>Como está a comunidade{o?.as_of_period ? <> em <span className="text-foreground">{monthLabel(o.as_of_period)}</span>, o último mês informado</> : null}.</>,
        })}
        {" "}{tr({
          en: "The community produces preparation, data and qualified P2P demand; investors fund it, domestic or global.",
          pt: "A comunidade gera preparo, dados e demanda qualificada P2P; investidores, domésticos ou globais, financiam essa demanda.",
        })}
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {!o ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />) : (
          <>
            <StatTile label={tr({ en: "Qualified capital demand", pt: "Demanda qualificada de capital" })} value={money(o.hero.qualified_demand_cents)}
              hint={tr({ en: `${o.hero.p2p_opportunity} P2P opportunities`, pt: `${o.hero.p2p_opportunity} oportunidades P2P` })} hintTone="info" />
            <StatTile label={tr({ en: "Funded", pt: "Captado" })} value={money(o.capital.funded_cents)}
              hint={tr({ en: `${bpsPct(o.capital.domestic_coverage_bps + o.capital.global_coverage_bps)} of demand`, pt: `${bpsPct(o.capital.domestic_coverage_bps + o.capital.global_coverage_bps)} da demanda` })} hintTone="positive" />
            <StatTile label={tr({ en: "Funding gap", pt: "Lacuna de captação" })} value={money(o.capital.gap_cents)}
              hint={o.capital.waiting_for_capital
                ? tr({ en: `${o.capital.waiting_for_capital} waiting for a pool`, pt: `${o.capital.waiting_for_capital} aguardando um pool` })
                : tr({ en: "still raising", pt: "captação em andamento" })}
              hintTone={o.capital.gap_cents ? "caution" : "positive"} />
            <StatTile label={tr({ en: "Coverage", pt: "Cobertura" })} value={`${bpsPct(o.capital.domestic_coverage_bps)} · ${bpsPct(o.capital.global_coverage_bps)}`}
              hint={tr({ en: "domestic · global", pt: "doméstico · global" })} />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {!h ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />) : (
          <>
            <StatTile label={tr({ en: "Participants", pt: "Participantes" })} value={h.participants}
              hint={h.joined_this_month ? tr({ en: `+${h.joined_this_month} this month`, pt: `+${h.joined_this_month} este mês` }) : undefined} hintTone="positive" />
            <StatTile label={tr({ en: "Education complete", pt: "Formação concluída" })} value={h.education_complete} hint={`${pct(h.education_complete, h.participants)}%`} />
            <StatTile label={tr({ en: "Credit ready", pt: "Prontas para crédito" })} value={h.credit_ready} hint={`${pct(h.credit_ready, h.participants)}%`} />
            <StatTile label={tr({ en: "Credit intent", pt: "Pedidos de crédito" })} value={h.credit_intent} hint={`${pct(h.credit_intent, h.participants)}%`} />
            <StatTile label={tr({ en: "Eligible", pt: "Elegíveis" })} value={h.eligible} hint={`${pct(h.eligible, h.participants)}%`} />
            <StatTile label={tr({ en: "Funded", pt: "Captadas" })} value={h.funded}
              hint={tr({ en: `of ${h.p2p_opportunity} P2P opportunities`, pt: `de ${h.p2p_opportunity} oportunidades P2P` })} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title={tr({ en: "Readiness funnel", pt: "Funil de prontidão" })} className="lg:col-span-3"
          description={tr({
            en: "Participants who reached at least each stage. Credit ready without asking is a complete outcome.",
            pt: "Participantes que chegaram pelo menos a cada etapa. Estar pronta para crédito sem pedir é um resultado completo.",
          })}>
          {!o ? <Skeleton className="h-64 w-full" /> : (
            <ul className="space-y-2.5">
              {o.funnel.map((f, i) => {
                const prev = i > 0 ? o.funnel[i - 1].n : f.n;
                return (
                  <li key={f.stage} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_5rem]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help truncate text-muted-foreground underline decoration-dotted underline-offset-4">
                          {STAGE_LABEL[f.stage]}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">{STAGE_HINT[f.stage]}</TooltipContent>
                    </Tooltip>
                    <div className="h-6 overflow-hidden rounded-md bg-secondary/50">
                      <div className={`h-full rounded-md ${OWN_STAGE.has(f.stage) ? "bg-primary" : "bg-info/40"}`}
                        style={{ width: `${Math.max(f.n ? 2 : 0, (f.n / top) * 100)}%` }} />
                    </div>
                    <span className="num text-right">
                      <span className="font-semibold text-foreground">{f.n}</span>
                      {i > 0 && prev > 0 && <span className="ml-1.5 hidden text-xs text-muted-foreground sm:inline">{pct(f.n, prev)}%</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={tr({ en: "Cohort health", pt: "Saúde da turma" })} className="lg:col-span-2"
          description={tr({ en: "How well the community is keeping its record.", pt: "Como a comunidade está mantendo seus registros." })}>
          {!o ? <Skeleton className="h-64 w-full" /> : (
            <dl className="divide-y divide-border text-sm">
              {[
                { key: "checkin", label: tr({ en: "Check-in completion", pt: "Check-ins feitos" }), value: bpsPct(o.health.checkin_completion_bps), tone: "text-positive",
                  hint: o.as_of_period ? tr({ en: `reported ${monthLabel(o.as_of_period)}`, pt: `informados em ${monthLabel(o.as_of_period)}` }) : "" },
                { key: "quality", label: tr({ en: "Data quality", pt: "Qualidade dos dados" }), value: bpsPct(o.health.data_quality_bps), tone: "text-info",
                  hint: tr({ en: "consistency of what is reported", pt: "coerência do que é informado" }) },
                { key: "regularity", label: tr({ en: "Reporting regularity", pt: "Regularidade dos dados" }), value: bpsPct(o.health.regularity_bps), tone: "text-info",
                  hint: tr({ en: "month after month", pt: "mês após mês" }) },
                { key: "human", label: tr({ en: "Needs human follow-up", pt: "Precisam de acompanhamento pessoal" }), value: String(o.health.needs_human_followup), tone: "text-caution",
                  hint: tr({ en: "manual review", pt: "revisão manual" }) },
                { key: "days", label: tr({ en: "Avg. time to readiness", pt: "Tempo médio até a prontidão" }),
                  value: o.health.avg_days_to_ready !== null ? tr({ en: `${o.health.avg_days_to_ready} days`, pt: `${o.health.avg_days_to_ready} dias` }) : "—",
                  tone: "text-foreground", hint: tr({ en: "from joining", pt: "desde a entrada" }) },
                { key: "alerts", label: tr({ en: "Credit alerts", pt: "Alertas de crédito" }), value: String(o.health.credit_alerts), tone: o.health.credit_alerts ? "text-alert" : "text-foreground",
                  hint: tr({ en: "late or defaulted loans", pt: "empréstimos em atraso ou inadimplentes" }) },
              ].map((r) => (
                <div key={r.key} className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt>
                    <span className="text-foreground">{r.label}</span>
                    {r.hint && <span className="block text-xs text-muted-foreground">{r.hint}</span>}
                  </dt>
                  <dd className={`num font-heading text-lg font-bold ${r.tone}`}>{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Panel>
      </div>

      <Panel title={tr({ en: "Action queue", pt: "Fila de ações" })}
        description={tr({
          en: "Who needs the community's attention now. Log each contact after you make it: it moves the queue and counts in cost to serve.",
          pt: "Quem precisa da atenção da comunidade agora. Registre cada contato depois de fazê-lo: a fila anda e o contato entra no custo de servir.",
        })}
        actions={<Link to="participants" className="inline-flex items-center gap-1 text-sm text-info hover:underline">{tr({ en: "All participants", pt: "Todas as participantes" })} <ArrowRight size={14} /></Link>}>
        {!o ? <Skeleton className="h-40 w-full" /> : queue.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-positive"><Check size={16} /> {tr({ en: "Nobody is waiting on the community right now.", pt: "Ninguém está esperando pela comunidade agora." })}</p>
        ) : (
          <ul className="divide-y divide-border">
            {queue.map((q) => (
              <li key={q.action} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-foreground">
                      {tr({ en: `${q.pending} participant${q.pending === 1 ? "" : "s"}`, pt: `${q.pending} participante${q.pending === 1 ? "" : "s"}` })}
                    </span>
                    <span className="text-muted-foreground">{ACTION[q.action].queue}</span>
                    {q.contacted > 0 && <StatusPill tone="neutral">{tr({ en: `${q.contacted} contacted this week`, pt: `${q.contacted} contatadas esta semana` })}</StatusPill>}
                  </p>
                  {q.participants.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">
                      {q.participants.slice(0, 5).map((p) => p.display_name).join(", ")}
                      {q.participants.length > 5 && tr({ en: ` and ${q.participants.length - 5} more`, pt: ` e mais ${q.participants.length - 5}` })}
                    </p>
                  )}
                </div>
                {leads && q.pending > 0 && (
                  <Button variant="secondary" size="sm" className="gap-2" onClick={() => setDialog(q.action)}>
                    <MessageCircle size={14} /> {ACTION[q.action].button}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {dialog && open && (
        <OutreachDialog communityId={community.id} action={dialog} people={open.participants}
          open={Boolean(dialog)} onOpenChange={(v) => !v && setDialog(null)} />
      )}
    </div>
  );
}
