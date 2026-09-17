import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, FlaskConical, Gauge, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import LoadError from "../../components/LoadError";
import PageHeader from "../../components/product/PageHeader";
import StatTile from "../../components/product/StatTile";
import { useAuth } from "../../auth/useAuth";
import { formatNumber, tr } from "../../i18n";
import { REASON } from "../../lib/capital";
import { ELIGIBILITY_REASON } from "../../lib/credit";
import {
  BEARER_LABEL, bps, DECISION_LABEL, duration, fetchOperatingEconomics, type OperatingEconomics as Data, PHASE_LABEL, share,
  STAGE_LABEL, staffHours, STEP_LABEL,
} from "../../lib/economics";
import { fetchPrograms } from "../../lib/impact";
import { money } from "../../lib/readiness";

// Can productive credit become cheaper to operate without becoming weaker
// credit? (refactor spec §2A.) Four pairs: what must improve beside what must
// not be sacrificed, each with how the prototype measures it. The prototype
// measures; the pilot tests.

const ALL = "all";

/** One pair: a number that must improve, beside the discipline it must not cost. */
function Pair({ id, improve, keep, measured }: {
  id: string;
  improve: { title: string; body: ReactNode };
  keep: { id?: string; title: string; body: ReactNode };
  measured: string;
}) {
  return (
    <section id={id} className="panel scroll-mt-32 overflow-hidden">
      <div className="grid lg:grid-cols-2">
        <div className="space-y-4 p-5 sm:p-6">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-accent"><Gauge size={13} aria-hidden /> {tr({ en: "Must improve", pt: "Precisa melhorar" })}</p>
          <h2 className="font-heading text-lg font-bold text-foreground">{improve.title}</h2>
          {improve.body}
        </div>
        <div id={keep.id} className="scroll-mt-32 space-y-4 border-t border-border bg-secondary/25 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-positive"><ShieldCheck size={13} aria-hidden /> {tr({ en: "Must not be sacrificed", pt: "Não pode ser sacrificado" })}</p>
          <h2 className="font-heading text-lg font-bold text-foreground">{keep.title}</h2>
          {keep.body}
        </div>
      </div>
      <p className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground sm:px-6">
        <span className="font-medium text-foreground">{tr({ en: "How it is measured: ", pt: "Como é medido: " })}</span>{measured}
      </p>
    </section>
  );
}

/** Counts as bars against the largest, labelled. */
function Bars({ rows, tone = "bg-accent" }: { rows: { key: string; label: string; n: number }[]; tone?: string }) {
  const top = Math.max(1, ...rows.map((r) => r.n));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{tr({ en: "Nothing recorded yet.", pt: "Nada registrado ainda." })}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 text-foreground">{r.label}</span>
            <span className="num shrink-0 font-semibold text-foreground">{formatNumber(r.n)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className={cn("h-full rounded-full", tone)} style={{ width: `${(r.n / top) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Line({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}{hint && <span className="block text-xs">{hint}</span>}</span>
      <span className="num shrink-0 text-right font-semibold text-foreground">{value}</span>
    </div>
  );
}

function CostPair({ d }: { d: Data }) {
  const c = d.cost;
  const phases = (["preparation", "origination", "servicing"] as const);
  const total = Math.max(1, c.total_cents);
  const decisions = (["ELIGIBLE", "ELIGIBLE_REDUCED", "MANUAL_REVIEW", "NOT_ELIGIBLE"] as const)
    .map((k) => ({ key: k, label: DECISION_LABEL[k], n: d.discipline.decisions[k] ?? 0 }));
  return (
    <Pair id="cost"
      improve={{
        title: tr({ en: "Cost to serve", pt: "Custo de servir" }),
        body: (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={tr({ en: "Credit, per R$ 100 lent", pt: "Crédito, por R$ 100 emprestados" })} value={money(c.credit_per_100_disbursed_cents)}
                hint={tr({ en: "origination + servicing", pt: "originação + acompanhamento" })} />
              <StatTile label={tr({ en: "All-in, per R$ 100 lent", pt: "Tudo, por R$ 100 emprestados" })} value={money(c.per_100_disbursed_cents)}
                hint={tr({ en: "preparation included", pt: "com o preparo" })} />
              <StatTile label={tr({ en: "Per qualified opportunity", pt: "Por oportunidade qualificada" })} value={money(c.per_opportunity_cents)} />
              <StatTile label={tr({ en: "Per participant", pt: "Por participante" })} value={money(c.per_participant_cents)}
                hint={tr({ en: `${formatNumber(d.scope.participants)} reached`, pt: `${formatNumber(d.scope.participants)} alcançadas` })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary" role="img"
                aria-label={phases.map((p) => `${PHASE_LABEL[p]} ${money(c.by_phase[p])}`).join(", ")}>
                <div className="bg-muted-foreground/40" style={{ width: `${(c.by_phase.preparation / total) * 100}%` }} />
                <div className="bg-accent" style={{ width: `${(c.by_phase.origination / total) * 100}%` }} />
                <div className="bg-positive" style={{ width: `${(c.by_phase.servicing / total) * 100}%` }} />
              </div>
              <p className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                {phases.map((p, i) => (
                  <span key={p}><span className={["text-muted-foreground/60", "text-accent", "text-positive"][i]}>■</span> {PHASE_LABEL[p]} {money(c.by_phase[p])}</span>
                ))}
              </p>
              <p className="text-xs text-muted-foreground">{tr({
                en: "Preparation reaches every participant, whether or not she borrows: in this model, it is what a sponsored program funds. What a loan adds is its origination and servicing.",
                pt: "O preparo alcança todas as participantes, peçam crédito ou não: neste modelo, é o que um programa patrocinado financia. O que um empréstimo acrescenta é a originação e o acompanhamento.",
              })}</p>
            </div>
            <details className="rounded-lg border border-border">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">{tr({ en: "Cost by stage", pt: "Custo por etapa" })}</summary>
              <div className="overflow-x-auto px-3 pb-3">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3 font-medium">{tr({ en: "Stage", pt: "Etapa" })}</th>
                      <th className="py-2 pr-3 font-medium">{tr({ en: "Borne by", pt: "Quem arca" })}</th>
                      <th className="py-2 pr-3 text-right font-medium">{tr({ en: "Events", pt: "Eventos" })}</th>
                      <th className="py-2 pr-3 text-right font-medium">{tr({ en: "Staff time", pt: "Tempo de equipe" })}</th>
                      <th className="py-2 text-right font-medium">{tr({ en: "Cost", pt: "Custo" })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {c.by_stage.map((s) => (
                      <tr key={s.stage}>
                        <td className="py-1.5 pr-3 text-foreground">{STAGE_LABEL[s.stage] ?? s.stage}<span className="block text-[11px] text-muted-foreground">{PHASE_LABEL[s.phase]}</span></td>
                        <td className="py-1.5 pr-3 text-muted-foreground">{BEARER_LABEL[s.borne_by]}</td>
                        <td className="num py-1.5 pr-3 text-right">{formatNumber(s.events)}</td>
                        <td className="num py-1.5 pr-3 text-right">{staffHours(s.staff_minutes)}</td>
                        <td className="num py-1.5 text-right font-medium">{money(s.cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <p className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
              {tr({
                en: <>Reference, not a comparison: a World Bank study found microfinance institutions' median operating expense near <span className="text-foreground">US$ 14 per US$ 100 of loans outstanding</span> (WPS 8252, 2005–2009). It counts a whole institution's costs against its portfolio; this counts modelled stage costs against reais lent. Neither is EmpowerFI's measured cost.</>,
                pt: <>Referência, não comparação: um estudo do Banco Mundial encontrou despesa operacional mediana perto de <span className="text-foreground">US$ 14 a cada US$ 100 de carteira</span> em instituições de microfinanças (WPS 8252, 2005–2009). Ele conta os custos de uma instituição inteira contra sua carteira; aqui, custos modelados por etapa contra reais emprestados. Nenhum dos dois é o custo medido da EmpowerFI.</>,
              })}
            </p>
          </>
        ),
      }}
      keep={{
        id: "discipline",
        title: tr({ en: "Eligibility discipline", pt: "Disciplina de elegibilidade" }),
        body: (
          <>
            <p className="text-sm text-muted-foreground">{tr({
              en: `${formatNumber(d.discipline.runs)} eligibility runs, every one by the same published rules (${d.discipline.model_versions.join(", ") || "—"}).`,
              pt: `${formatNumber(d.discipline.runs)} rodadas de elegibilidade, todas pelas mesmas regras publicadas (${d.discipline.model_versions.join(", ") || "—"}).`,
            })}</p>
            <Bars rows={decisions} tone="bg-positive" />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr({ en: "Reason codes", pt: "Códigos de motivo" })}</p>
              <Bars rows={d.discipline.reasons.slice(0, 6).map((r) => ({ key: r.code, label: ELIGIBILITY_REASON[r.code] ?? r.code, n: r.n }))} tone="bg-primary" />
            </div>
          </>
        ),
      }}
      measured={tr({
        en: "cost events by stage and opportunity, priced by the pilot rate card; the engines' decisions and reason codes.",
        pt: "eventos de custo por etapa e oportunidade, precificados pela tabela do piloto; as decisões e os códigos de motivo dos motores.",
      })} />
  );
}

function TimePair({ d }: { d: Data }) {
  const reasons = Object.fromEntries(d.discipline.reasons.map((r) => [r.code, r.n]));
  return (
    <Pair id="time"
      improve={{
        title: tr({ en: "Time to decision", pt: "Tempo até a decisão" }),
        body: (
          <ul className="divide-y divide-border/60">
            {d.timing.map((s) => (
              <li key={s.step} className={cn("flex items-baseline justify-between gap-4 py-2.5", s.step === "intent_to_disbursement" && "font-semibold")}>
                <span className="min-w-0">
                  <span className="block text-sm text-foreground">{STEP_LABEL[s.step].label}</span>
                  <span className="block text-xs text-muted-foreground">{STEP_LABEL[s.step].who} · {tr({ en: `${s.n} cases`, pt: `${s.n} casos` })}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="num block font-heading text-lg font-bold text-foreground">{duration(s.median_seconds)}</span>
                  <span className="num block text-[11px] text-muted-foreground">{tr({ en: `median · 90% within ${duration(s.p90_seconds)}`, pt: `mediana · 90% em até ${duration(s.p90_seconds)}` })}</span>
                </span>
              </li>
            ))}
          </ul>
        ),
      }}
      keep={{
        title: tr({ en: "Affordability checks", pt: "Checagem de capacidade de pagamento" }),
        body: (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={tr({ en: "Runs with the check", pt: "Rodadas com a checagem" })} value={share(d.discipline.affordability_checked, d.discipline.runs)}
                hint={`${d.discipline.affordability_checked}/${d.discipline.runs}`} hintTone="positive" />
              <StatTile label={tr({ en: "Offered less than asked", pt: "Oferta menor que o pedido" })} value={formatNumber(d.discipline.decisions.ELIGIBLE_REDUCED ?? 0)}
                hint={tr({ en: "the instalment did not fit", pt: "a parcela não cabia" })} />
            </div>
            <Line label={ELIGIBILITY_REASON.AMOUNT_ABOVE_CAPACITY} value={formatNumber(reasons.AMOUNT_ABOVE_CAPACITY ?? 0)} />
            <Line label={ELIGIBILITY_REASON.TIGHT_AFFORDABILITY} value={formatNumber(reasons.TIGHT_AFFORDABILITY ?? 0)} />
            <Line label={ELIGIBILITY_REASON.NO_REPAYMENT_CAPACITY} value={formatNumber(reasons.NO_REPAYMENT_CAPACITY ?? 0)} />
            <p className="text-xs text-muted-foreground">{tr({
              en: "Speed never skips the check: the instalment is tested against what the business makes after household expenses, on every run.",
              pt: "A velocidade nunca pula a checagem: a parcela é testada contra o que o negócio ganha depois das despesas da casa, em toda rodada.",
            })}</p>
          </>
        ),
      }}
      measured={tr({
        en: "timestamps of the request, each engine run, the opportunity, the desk's decision and the disbursement; reason codes.",
        pt: "datas e horas do pedido, de cada rodada dos motores, da oportunidade, da decisão da mesa e do desembolso; códigos de motivo.",
      })} />
  );
}

function ScalePair({ d }: { d: Data }) {
  const f = d.follow_up;
  return (
    <Pair id="scale"
      improve={{
        title: tr({ en: "Operational scalability", pt: "Escalabilidade operacional" }),
        body: (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={tr({ en: "Steps that took no one's time", pt: "Etapas sem tempo de equipe" })} value={bps(d.cost.automated_events_share_bps)}
                hint={tr({ en: `of ${formatNumber(d.cost.events)} events`, pt: `de ${formatNumber(d.cost.events)} eventos` })} />
              <StatTile label={tr({ en: "Credit staff time per loan", pt: "Tempo de equipe no crédito, por empréstimo" })} value={staffHours(d.cost.credit_minutes_per_loan)} />
            </div>
            <Line label={tr({ en: "Check-ins sent by the entrepreneur herself", pt: "Check-ins enviados pela própria empreendedora" })} value={share(f.self_reported, f.checkins)}
              hint={tr({ en: "the rest typed in by the community, at ten minutes each", pt: "os demais digitados pela comunidade, a dez minutos cada" })} />
            <Line label={tr({ en: "Staff time, preparation", pt: "Tempo de equipe, preparo" })} value={staffHours(d.cost.minutes_by_phase.preparation)} />
            <Line label={tr({ en: "Staff time, credit", pt: "Tempo de equipe, crédito" })} value={staffHours(d.cost.minutes_by_phase.credit)} />
          </>
        ),
      }}
      keep={{
        title: tr({ en: "Continuous follow-up", pt: "Acompanhamento contínuo" }),
        body: (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={tr({ en: "Reporting this month", pt: "Reportando neste mês" })} value={share(f.reporting, d.scope.participants)}
                hint={`${f.reporting}/${d.scope.participants}`} />
              <StatTile label={tr({ en: "Follow-ups open", pt: "Acompanhamentos em aberto" })} value={formatNumber(f.open_follow_ups)} hintTone="caution" />
            </div>
            <Line label={tr({ en: "Community contacts logged", pt: "Contatos registrados pela comunidade" })} value={formatNumber(f.contacts)} />
            <Line label={tr({ en: "Instalments recorded", pt: "Parcelas registradas" })} value={formatNumber(f.instalments_recorded)} />
            <Line label={tr({ en: "Productive outcomes measured", pt: "Resultados produtivos medidos" })} value={formatNumber(f.outcomes_measured)} />
          </>
        ),
      }}
      measured={tr({
        en: "digital check-ins, the community's logged contacts, instalments and outcome measurements, as servicing events.",
        pt: "check-ins digitais, contatos registrados pela comunidade, parcelas e medições de resultado, como eventos de acompanhamento.",
      })} />
  );
}

function CapitalPair({ d }: { d: Data }) {
  const k = d.capital;
  const q = d.quality;
  return (
    <Pair id="capital"
      improve={{
        title: tr({ en: "Capital access and coverage", pt: "Acesso a capital e cobertura" }),
        body: (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatTile label={tr({ en: "Domestic", pt: "Doméstico" })} value={formatNumber(k.domestic)} />
              <StatTile label={tr({ en: "Global", pt: "Global" })} value={formatNumber(k.global)} />
              <StatTile label={tr({ en: "Waiting", pt: "Aguardando" })} value={formatNumber(k.waiting)} hintTone="caution" />
            </div>
            <Line label={tr({ en: "Qualified opportunities routed", pt: "Oportunidades qualificadas encaminhadas" })} value={`${k.allocated}/${k.opportunities}`} />
            <Line label={tr({ en: "Funded or lent", pt: "Captadas ou emprestadas" })} value={formatNumber(k.funded)} />
            <Bars rows={k.reasons.slice(0, 5).map((r) => ({ key: r.code, label: REASON[r.code as keyof typeof REASON]?.label ?? r.code, n: r.n }))} tone="bg-primary" />
          </>
        ),
      }}
      keep={{
        title: tr({ en: "Portfolio quality", pt: "Qualidade da carteira" }),
        body: (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={tr({ en: "Instalments on schedule", pt: "Parcelas em dia" })} value={share(q.instalments_paid, q.instalments_due)}
                hint={`${q.instalments_paid}/${q.instalments_due}`} hintTone="positive" />
              <StatTile label={tr({ en: "Loans", pt: "Empréstimos" })} value={formatNumber(q.loans)} />
            </div>
            <Line label={tr({ en: "Repaying on time", pt: "Pagando em dia" })} value={formatNumber(q.repaying)} />
            <Line label={tr({ en: "Late", pt: "Em atraso" })} value={<span className={q.late ? "text-caution" : undefined}>{formatNumber(q.late)}</span>} />
            <Line label={tr({ en: "Paid off", pt: "Quitados" })} value={formatNumber(q.paid)} />
            <Line label={tr({ en: "Defaulted", pt: "Inadimplentes" })} value={<span className={q.defaulted ? "text-alert" : undefined}>{formatNumber(q.defaulted)}</span>} />
          </>
        ),
      }}
      measured={tr({
        en: "the allocation engine's routes and reason codes; repayment, delinquency and outcome states of each loan.",
        pt: "as rotas e os códigos de motivo do motor de alocação; os estados de pagamento, atraso e resultado de cada empréstimo.",
      })} />
  );
}

export default function OperatingEconomics() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const sponsor = profile?.role === "sponsor";
  const programs = useQuery({ queryKey: ["platform", "programs"], queryFn: fetchPrograms });
  const asked = params.get("program");
  const programId = sponsor
    ? (programs.data?.find((p) => p.id === asked) ?? programs.data?.[0])?.id ?? null
    : asked && asked !== ALL ? asked : null;
  const ready = !sponsor || Boolean(programId);
  const economics = useQuery({
    queryKey: ["platform", "operating-economics", programId ?? ALL],
    queryFn: () => fetchOperatingEconomics(programId),
    enabled: ready,
  });
  const d = economics.data;

  if (economics.isError) return <LoadError error={economics.error} onRetry={() => economics.refetch()} />;
  if (programs.isError && sponsor) return <LoadError error={programs.error} onRetry={() => programs.refetch()} />;

  const scopes = [...(sponsor ? [] : [{ id: ALL, name: tr({ en: "Every community", pt: "Todas as comunidades" }) }]), ...(programs.data ?? [])];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={tr({ en: "Credit & Capital Engine", pt: "Motor de Crédito e Capital" })}
        title={tr({ en: "Operating economics", pt: "Economia operacional" })}
        description={tr({
          en: "Can productive credit become cheaper to operate without becoming weaker credit?",
          pt: "O crédito produtivo pode ficar mais barato de operar sem virar um crédito pior?",
        })}
        about={tr({
          en: "EmpowerFI tests a data-driven operating model designed to compress cost to serve while preserving credit discipline, continuous servicing and auditable outcomes. Costs come from the events each stage records, priced by the pilot's rate card; times from the timestamps of the request, the engine runs, the desk's decision and the disbursement; discipline and routing from the engines' own reason codes.",
          pt: "A EmpowerFI testa um modelo operacional baseado em dados, desenhado para reduzir o custo de servir preservando a disciplina de crédito, o acompanhamento contínuo e resultados auditáveis. Os custos vêm dos eventos que cada etapa registra, precificados pela tabela do piloto; os tempos, das datas do pedido, das rodadas dos motores, da decisão da mesa e do desembolso; a disciplina e o roteamento, dos códigos de motivo dos próprios motores.",
        })}
        actions={
          <>
            {scopes.length > 1 && (
              <Select value={programId ?? ALL} onValueChange={(v) => setParams({ program: v }, { replace: true })}>
                <SelectTrigger className="w-64" aria-label={tr({ en: "Scope", pt: "Escopo" })}><SelectValue /></SelectTrigger>
                <SelectContent>{scopes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Button asChild variant="outline" className="gap-2">
              <Link to="/app/capital"><ArrowLeft size={16} /> {tr({ en: "Credit & Capital Engine", pt: "Motor de Crédito e Capital" })}</Link>
            </Button>
          </>
        } />

      <p className="flex items-start gap-2.5 rounded-xl border tone-caution px-4 py-3 text-sm">
        <FlaskConical size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>{tr({
          en: "A hypothesis this prototype measures, not a result. The pilot must show cost to serve falling without weaker eligibility discipline, affordability checks, follow-up or portfolio quality. Costs are priced by the pilot rate card, an assumption (staff time at R$ 30/h); the demo's businesses, loans and timings are simulated.",
          pt: "Uma hipótese que este protótipo mede, não um resultado. O piloto precisa mostrar o custo de servir caindo sem piorar a disciplina de elegibilidade, a checagem de capacidade de pagamento, o acompanhamento ou a qualidade da carteira. Os custos seguem a tabela do piloto, uma premissa (tempo de equipe a R$ 30/h); os negócios, empréstimos e prazos da demonstração são simulados.",
        })}</span>
      </p>

      {!d ? (
        <div className="space-y-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-72 w-full rounded-xl" />)}</div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{tr({
            en: `${formatNumber(d.scope.participants)} participants in ${formatNumber(d.scope.communities)} communities · ${formatNumber(d.cost.opportunities)} qualified opportunities · ${formatNumber(d.cost.loans)} loans, ${money(d.cost.disbursed_cents)} lent.`,
            pt: `${formatNumber(d.scope.participants)} participantes em ${formatNumber(d.scope.communities)} comunidades · ${formatNumber(d.cost.opportunities)} oportunidades qualificadas · ${formatNumber(d.cost.loans)} empréstimos, ${money(d.cost.disbursed_cents)} emprestados.`,
          })}</p>
          <CostPair d={d} />
          <TimePair d={d} />
          <ScalePair d={d} />
          <CapitalPair d={d} />
        </>
      )}
    </div>
  );
}
