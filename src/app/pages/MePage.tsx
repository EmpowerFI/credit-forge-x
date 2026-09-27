import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight, CalendarClock, CircleCheck, CircleDashed, ClipboardPlus, Gauge, HandCoins, Lightbulb, Loader2,
  RefreshCw, ShieldCheck, type LucideIcon,
} from "lucide-react";
import type { ReadinessFeatures } from "@empowerfi/readiness-engine";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import MemberEducation from "../components/MemberEducation";
import PageHeader from "../components/product/PageHeader";
import ProofStatus from "../components/ProofStatus";
import { useAuth } from "../auth/useAuth";
import { anchorsSettled } from "../lib/anchors";
import { loadEducation } from "../lib/education";
import { describeError } from "../lib/errors";
import { insightsFrom } from "../lib/insights";
import { requestAssessment, requestEligibility } from "../lib/assessments";
import { DECISION_LABEL, ELIGIBILITY_REASON, LOAN_LABEL, OPPORTUNITY_LABEL } from "../lib/credit";
import { platform } from "../lib/platform";
import {
  describeRequirement,
  money,
  monthLabel,
  PURPOSE_LABEL,
  REASON_LABEL,
  recentPeriods,
  STATUS_LABEL,
  type CreditPurpose,
} from "../lib/readiness";
import LoadError from "../components/LoadError";
import { MyCapitalPlan } from "./capital/network/CapitalPlanPanel";
import { formatNumber, tr } from "../i18n";

type Credit = {
  eligibility: {
    decision: keyof typeof DECISION_LABEL;
    proposed_amount_cents: number | null;
    term_months: number | null;
    instalment_cents: number | null;
    reason_codes: string[];
  } | null;
  opportunity: {
    id: string;
    status: keyof typeof OPPORTUNITY_LABEL;
    amount_cents: number;
    funding_pool: "domestic" | "global" | null;
    funding_status: string | null;
    funded_micro_usdc: number;
    funding_target_micro_usdc: number | null;
    partner: { name: string } | null;
    partner_decisions: { verdict: string; approved_amount_cents: number | null; rate_bps: number | null; term_months: number | null; reason: string | null }[];
    loans: { status: keyof typeof LOAN_LABEL; principal_cents: number; term_months: number; instalment_cents: number; payments: { instalment_no: number }[] }[];
  } | null;
} | null;

/** Her request's path: EmpowerFI's eligibility, P2P funding in reais, the loan. */
/** What investors have funded of her request, in reais. */
const fundedReais = (o: NonNullable<NonNullable<Credit>["opportunity"]>) =>
  o.funding_target_micro_usdc ? Math.min(o.amount_cents, Math.round((o.funded_micro_usdc / o.funding_target_micro_usdc) * o.amount_cents)) : 0;

function CreditProgress({ credit }: { credit: Credit }) {
  if (!credit?.eligibility) return null;
  const e = credit.eligibility;
  const o = credit.opportunity;
  const decision = o?.partner_decisions?.at(-1);
  const loan = o?.loans?.[0];
  return (
    <ol className="space-y-3 border-l-2 border-accent/40 pl-4 text-sm">
      <li>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${DECISION_LABEL[e.decision].tone}`}>
          EmpowerFI · {DECISION_LABEL[e.decision].title}
        </span>
        {e.proposed_amount_cents !== null && (
          <p className="mt-1 text-foreground">
            {tr({
              en: `${money(e.proposed_amount_cents)} over ${e.term_months} months — about ${money(e.instalment_cents)} a month.`,
              pt: `${money(e.proposed_amount_cents)} em ${e.term_months} meses — cerca de ${money(e.instalment_cents)} por mês.`,
            })}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{e.reason_codes.map((r) => ELIGIBILITY_REASON[r] ?? r).join(" · ")}</p>
      </li>
      {o && (
        <li className="text-foreground">
          {o.status === "referred" && o.funding_status ? (
            <>
              {tr({
                en: `Your request is open to investors — ${money(fundedReais(o))} of ${money(o.amount_cents)} funded.`,
                pt: `Seu pedido está aberto a investidores — ${money(fundedReais(o))} de ${money(o.amount_cents)} captados.`,
              })}
              <span className="block text-xs text-muted-foreground">
                {o.funding_pool === "global"
                  ? tr({
                      en: "Funded by global investors in USDC, converted: you receive it in reais, by Pix.",
                      pt: "Captado com investidores globais em USDC, convertido: você recebe em reais, via Pix.",
                    })
                  : tr({
                      en: "Funded by Brazilian investors: you receive it in reais, by Pix.",
                      pt: "Captado com investidores brasileiros: você recebe em reais, via Pix.",
                    })}
              </span>
            </>
          ) : o.status === "referred" ? (
            <>{tr({
              en: "Your request waits for capital: no pool of investors can take it yet.",
              pt: "Seu pedido aguarda capital: nenhum pool de investidores pode assumi-lo ainda.",
            })}</>
          ) : <>{OPPORTUNITY_LABEL[o.status]}.</>}
          {decision?.verdict === "approved" && (
            <span className="block text-xs text-muted-foreground">
              {(() => {
                const rate = formatNumber((decision.rate_bps ?? 0) / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return tr({
                  en: `Formalised: ${money(decision.approved_amount_cents)} at ${rate}% a month over ${decision.term_months} months.`,
                  pt: `Formalizado: ${money(decision.approved_amount_cents)} a ${rate}% ao mês em ${decision.term_months} meses.`,
                });
              })()}
            </span>
          )}
          {decision?.verdict === "declined" && decision.reason && (
            <span className="block text-xs text-muted-foreground">{tr({ en: "Reason given:", pt: "Motivo informado:" })} {decision.reason}</span>
          )}
        </li>
      )}
      {loan && (
        <li className="text-foreground">
          {tr({
            en: `Loan · ${LOAN_LABEL[loan.status]} — ${loan.payments.length} of ${loan.term_months} instalments of ${money(loan.instalment_cents)} paid.`,
            pt: `Empréstimo · ${LOAN_LABEL[loan.status]} — ${loan.payments.length} de ${loan.term_months} parcelas de ${money(loan.instalment_cents)} pagas.`,
          })}
        </li>
      )}
    </ol>
  );
}

/**
 * The one thing to do next. Everything below on the page explains where the
 * business stands; this says what moves it, and there is always exactly one.
 */
type NextStep = { icon: LucideIcon; title: string; why: string; cta: string; to?: string; onClick?: () => void; busy?: boolean };

function NextStepCard({ step }: { step: NextStep }) {
  const Icon = step.icon;
  return (
    <section className="space-y-3 rounded-2xl p-5 glass glow-border" aria-labelledby="next-step">
      <p className="text-xs font-medium uppercase tracking-widest text-accent">{tr({ en: "Your next step", pt: "Seu próximo passo" })}</p>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Icon size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0 space-y-1">
            <h2 id="next-step" className="font-heading text-lg font-bold text-foreground">{step.title}</h2>
            {step.why && <p className="text-sm text-muted-foreground">{step.why}</p>}
          </div>
        </div>
        {step.to ? (
          <Button asChild className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to={step.to}>{step.cta} <ArrowRight size={16} /></Link>
          </Button>
        ) : (
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" disabled={step.busy} onClick={step.onClick}>
            {step.busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} {step.cta}
          </Button>
        )}
      </div>
    </section>
  );
}

export default function MePage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ["platform", "me", profile?.id],
    queryFn: async () => {
      const { data, error } = await platform
        .from("entrepreneurs")
        .select("id, display_name, business_name, business_sector, city, state, community_memberships(community_id)")
        .eq("profile_id", profile!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(profile),
  });
  const id = me.data?.id;
  const communityId = me.data?.community_memberships?.[0]?.community_id;

  const business = useQuery({
    queryKey: ["platform", "my-business", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [readiness, intent, months, consent] = await Promise.all([
        platform.from("latest_readiness").select("*").eq("entrepreneur_id", id!).maybeSingle(),
        platform.from("credit_intents").select("*").eq("entrepreneur_id", id!).eq("status", "active").maybeSingle(),
        platform.from("checkin_cash_flow").select("*").eq("entrepreneur_id", id!).order("period", { ascending: false }).limit(6),
        platform.from("consents").select("*").eq("entrepreneur_id", id!).order("consent_no", { ascending: false }).limit(1).maybeSingle(),
      ]);
      for (const r of [readiness, intent, months, consent]) if (r.error) throw r.error;
      // What became of her request: EmpowerFI's eligibility, the opportunity
      // and its funding, the desk's formalisation, the loan.
      let credit = null;
      if (intent.data) {
        const [eligibility, opportunity] = await Promise.all([
          platform.from("eligibility_assessments").select("*").eq("intent_id", intent.data.id).order("eligibility_no", { ascending: false }).limit(1).maybeSingle(),
          platform.from("qualified_credit_opportunities")
            .select("*, partner:partners(name), partner_decisions(verdict, approved_amount_cents, rate_bps, term_months, reason), loans(id, status, principal_cents, term_months, rate_bps, instalment_cents, payments(instalment_no))")
            .eq("intent_id", intent.data.id).maybeSingle(),
        ]);
        if (eligibility.error) throw eligibility.error;
        if (opportunity.error) throw opportunity.error;
        credit = { eligibility: eligibility.data, opportunity: opportunity.data };
      }
      return { readiness: readiness.data, intent: intent.data, months: months.data ?? [], credit, consent: consent.data };
    },
  });

  const entityIds = [business.data?.readiness?.id, ...(business.data?.months.map((m) => m.checkin_id) ?? [])].filter(
    Boolean,
  ) as string[];
  const anchors = useQuery({
    queryKey: ["platform", "my-anchors", entityIds],
    enabled: entityIds.length > 0,
    queryFn: async () => {
      const { data, error } = await platform.from("chain_anchors").select("*").in("entity_id", entityIds);
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (anchorsSettled(q.state.data) ? false : 4000),
  });
  const anchorOf = (entityId: string | undefined) => anchors.data?.find((a) => a.entity_id === entityId);

  const education = useQuery({
    queryKey: ["platform", "education", communityId, id],
    enabled: Boolean(communityId && id),
    queryFn: () => loadEducation(communityId!, [id!]),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["platform"] });

  const assess = useMutation({
    mutationFn: () => requestAssessment(id!),
    onSuccess: (r) => {
      refresh();
      toast.success(r.reused
        ? tr({ en: "Nothing has changed since your last assessment.", pt: "Nada mudou desde a sua última avaliação." })
        : tr({
            en: `Assessment ${r.assessment_no}: ${STATUS_LABEL[r.result.status].title}.`,
            pt: `Avaliação ${r.assessment_no}: ${STATUS_LABEL[r.result.status].title}.`,
          }));
    },
    onError: (e) => toast.error(describeError(e)),
  });

  const [asking, setAsking] = useState(false);
  const [intentForm, setIntentForm] = useState({ purpose: "" as CreditPurpose | "", amount: "", description: "" });
  const declare = useMutation({
    mutationFn: async () => {
      const { error } = await platform.rpc("declare_credit_intent", {
        p_purpose: intentForm.purpose as CreditPurpose,
        p_requested_amount_cents: Math.round(Number(intentForm.amount) * 100),
        p_description: intentForm.description || undefined,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setAsking(false);
      try {
        const e = await requestEligibility(id!);
        const decision = DECISION_LABEL[e.result.decision as keyof typeof DECISION_LABEL].title;
        toast.success(tr({
          en: `Request recorded. EmpowerFI's assessment: ${decision}. If eligible, it opens to P2P investors.`,
          pt: `Pedido registrado. Avaliação da EmpowerFI: ${decision}. Se for elegível, ele fica aberto a investidores P2P.`,
        }));
      } catch (err) {
        toast.error(describeError(err));
      }
      refresh();
    },
    onError: (e) => toast.error(describeError(e)),
  });
  const checkEligibility = useMutation({
    mutationFn: () => requestEligibility(id!),
    onSuccess: refresh,
    onError: (e) => toast.error(describeError(e)),
  });
  const withdraw = useMutation({
    mutationFn: async () => {
      const { error } = await platform.rpc("withdraw_credit_intent");
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success(tr({ en: "Request withdrawn.", pt: "Pedido retirado." }));
    },
    onError: (e) => toast.error(describeError(e)),
  });

  if (me.isLoading || business.isLoading) return <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Loading", pt: "Carregando" })} />;
  if (me.isError || business.isError) {
    return <LoadError error={me.error ?? business.error} onRetry={() => { me.refetch(); business.refetch(); }} />;
  }
  if (!me.data) {
    return (
      <p className="text-muted-foreground">
        {tr({
          en: "This page is for entrepreneurs. Your account has no business on record.",
          pt: "Esta página é para empreendedoras. Sua conta não tem um negócio registrado.",
        })}
      </p>
    );
  }

  const readiness = business.data?.readiness;
  const status = readiness ? STATUS_LABEL[readiness.status] : null;
  const missing = (readiness?.missing_requirements ?? []) as { code: string; current: number | null; required: number }[];
  const intent = business.data?.intent;

  // What she has not given permission for; nothing is assessed or shared without it.
  const consent = business.data?.consent;
  const consentGap = !consent
    ? tr({
        en: "You have not recorded your consent yet: nothing of yours is assessed or shared until you do.",
        pt: "Você ainda não registrou seu consentimento: nada seu é avaliado ou compartilhado até você fazer isso.",
      })
    : !consent.assessment
      ? tr({ en: "You have not allowed your business to be assessed.", pt: "Você não autorizou a avaliação do seu negócio." })
      : !consent.partner
        ? tr({
            en: "You have not allowed EmpowerFI's P2P desk to see a request, so you cannot ask for credit here.",
            pt: "Você não autorizou a mesa P2P da EmpowerFI a ver um pedido, então não pode pedir crédito aqui.",
          })
        : null;

  // The last closed month: the one a check-in can already report in full.
  const reported = new Set((business.data?.months ?? []).map((m) => m.period));
  const monthDue = recentPeriods().slice(1).find((period) => !reported.has(period)) ?? null;
  // Any month still open to report, the month in progress included: what actually
  // moves a readiness requirement asking for more months.
  const monthOpen = recentPeriods().find((period) => !reported.has(period)) ?? null;
  const credit = business.data?.credit ?? null;
  const opportunity = credit?.opportunity ?? null;
  const loan = opportunity?.loans?.[0];
  const raising = opportunity?.status === "referred" && opportunity.funding_status !== null;

  const nextStep: NextStep = consentGap
    ? { icon: ShieldCheck, title: tr({ en: "Record your consent", pt: "Registre seu consentimento" }), why: consentGap,
        cta: tr({ en: "Review consent", pt: "Revisar consentimento" }), to: "/app/consent" }
    : monthDue
      ? { icon: ClipboardPlus,
          title: tr({ en: `Send your check-in for ${monthLabel(monthDue)}`, pt: `Envie o check-in de ${monthLabel(monthDue)}` }),
          why: tr({
            en: "A few numbers about the month, two minutes on your phone. Each month reported is what your readiness is read from.",
            pt: "Alguns números do mês, dois minutos no celular. Cada mês informado é o que a sua prontidão lê.",
          }),
          cta: tr({ en: "Do the check-in", pt: "Fazer o check-in" }), to: "/app/check-in" }
      : !readiness
        ? { icon: Gauge, title: tr({ en: "Ask for your first assessment", pt: "Peça a primeira avaliação" }),
            why: tr({
              en: "Your months are recorded. The assessment says whether the business is prepared for a credit conversation.",
              pt: "Seus meses estão registrados. A avaliação diz se o negócio está preparado para uma conversa sobre crédito.",
            }),
            cta: tr({ en: "Assess my business", pt: "Avaliar meu negócio" }), onClick: () => assess.mutate(), busy: assess.isPending }
        : loan
          ? { icon: CalendarClock, title: tr({ en: "Your loan is running", pt: "Seu empréstimo está em andamento" }),
              why: tr({
                en: `${loan.payments.length} of ${loan.term_months} instalments of ${money(loan.instalment_cents)} paid, by Pix.`,
                pt: `${loan.payments.length} de ${loan.term_months} parcelas de ${money(loan.instalment_cents)} pagas, por Pix.`,
              }),
              cta: tr({ en: "See the loan", pt: "Ver o empréstimo" }), to: "#capital" }
          : raising
            ? { icon: HandCoins, title: tr({ en: "Your request is raising with investors", pt: "Seu pedido está captando com investidores" }),
                why: tr({
                  en: `${money(fundedReais(opportunity!))} of ${money(opportunity!.amount_cents)} funded. You receive it in reais, by Pix.`,
                  pt: `${money(fundedReais(opportunity!))} de ${money(opportunity!.amount_cents)} captados. Você recebe em reais, por Pix.`,
                }),
                cta: tr({ en: "Follow it", pt: "Acompanhar" }), to: "#capital" }
            : intent && !credit?.eligibility
              ? { icon: HandCoins, title: tr({ en: "Your request has not been assessed yet", pt: "Seu pedido ainda não foi avaliado" }),
                  why: tr({
                    en: "EmpowerFI checks whether the amount fits the business. It takes a moment.",
                    pt: "A EmpowerFI verifica se o valor cabe no negócio. Leva um instante.",
                  }),
                  cta: tr({ en: "Assess my request", pt: "Avaliar meu pedido" }),
                  onClick: () => checkEligibility.mutate(), busy: checkEligibility.isPending }
              : intent
                ? { icon: HandCoins, title: tr({ en: "Your request is on its way", pt: "Seu pedido está a caminho" }),
                    why: tr({ en: "Follow each step below: assessment, investors, the desk, the loan.", pt: "Acompanhe cada passo abaixo: avaliação, investidores, a mesa, o empréstimo." }),
                    cta: tr({ en: "See where it stands", pt: "Ver o andamento" }), to: "#capital" }
                : readiness.status === "CREDIT_READY"
                  ? { icon: HandCoins, title: tr({ en: "You can ask for capital when you need it", pt: "Você pode pedir capital quando precisar" }),
                      why: tr({
                        en: "Your business is ready for the conversation. Nothing happens unless you ask — being ready and not needing credit is a good place to be.",
                        pt: "Seu negócio está pronto para essa conversa. Nada acontece se você não pedir — estar pronta e não precisar de crédito é uma ótima situação.",
                      }),
                      cta: tr({ en: "Ask for capital", pt: "Pedir capital" }), to: "#capital" }
                  : missing.length > 0
                    ? { icon: monthOpen ? ClipboardPlus : CircleDashed, title: describeRequirement(missing[0]),
                        why: [
                          monthOpen
                            ? tr({
                              en: `Sending ${monthLabel(monthOpen)} is what moves it — you can report a month while it is still running.`,
                              pt: `Enviar ${monthLabel(monthOpen)} é o que avança isso — você pode informar o mês ainda em andamento.`,
                            })
                            : tr({ en: "It moves with your next monthly check-in.", pt: "Isso avança com o seu próximo check-in mensal." }),
                          missing.length > 1
                            ? tr({
                              en: `${missing.length - 1} more after that.`,
                              pt: missing.length === 2 ? "Depois disso, falta mais 1." : `Depois disso, faltam mais ${missing.length - 1}.`,
                            })
                            : "",
                        ].filter(Boolean).join(" "),
                        cta: monthOpen
                          ? tr({ en: `Check in for ${monthLabel(monthOpen)}`, pt: `Fazer o check-in de ${monthLabel(monthOpen)}` })
                          : tr({ en: "See what is missing", pt: "Ver o que falta" }),
                        to: monthOpen ? "/app/check-in" : "#readiness" }
                    : { icon: CircleCheck, title: tr({ en: "You are up to date", pt: "Está tudo em dia" }),
                        why: tr({ en: "Keep sending the check-in each month: that is what builds the history.", pt: "Continue enviando o check-in todo mês: é isso que constrói o histórico." }),
                        cta: tr({ en: "See your readiness", pt: "Ver sua prontidão" }), to: "#readiness" };

  const submitIntent = (e: FormEvent) => {
    e.preventDefault();
    if (!intentForm.purpose) return toast.error(tr({ en: "Choose what the capital is for.", pt: "Escolha para que é o capital." }));
    declare.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow={me.data.display_name}
        title={me.data.business_name ?? tr({ en: "My business", pt: "Meu negócio" })}
        description={tr({
          en: "Where your business stands, what is missing, and what happened to your request.",
          pt: "Onde seu negócio está, o que falta, e o que aconteceu com o seu pedido.",
        })}
        actions={
          <Button asChild variant="secondary" className="gap-2">
            <Link to="/app/check-in"><ClipboardPlus size={16} /> {tr({ en: "Monthly check-in", pt: "Check-in mensal" })}</Link>
          </Button>
        } />

      <NextStepCard step={nextStep} />

      {/* Consent, when it is in force: what is missing is said by the next step, with a button. */}
      {!consentGap && consent && (
        <Link to="/app/consent"
          className="flex items-start justify-between gap-3 rounded-2xl border border-border p-4 text-sm transition-colors hover:bg-secondary/40">
          <span className="flex items-start gap-2">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-positive" />
            <span className="text-muted-foreground">
              {tr({
                en: `Your consent is in force (record #${consent.consent_no}). You decide what your data is used for.`,
                pt: `Seu consentimento está em vigor (registro nº ${consent.consent_no}). Você decide para que seus dados são usados.`,
              })}
            </span>
          </span>
          <span className="shrink-0 font-medium">{tr({ en: "Review", pt: "Revisar" })}</span>
        </Link>
      )}

      {/* ------------------------------------------------------ readiness */}
      <section id="readiness" className="scroll-mt-32 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-bold text-foreground">{tr({ en: "Readiness", pt: "Prontidão" })}</h2>
          <Button variant="outline" size="sm" disabled={assess.isPending} onClick={() => assess.mutate()} className="gap-2">
            {assess.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {tr({ en: "Re-assess", pt: "Reavaliar" })}
          </Button>
        </div>

        {!readiness || !status ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            {tr({
              en: "No assessment yet. Send your first monthly check-in, and the business will be assessed.",
              pt: "Nenhuma avaliação ainda. Envie seu primeiro check-in mensal e o negócio será avaliado.",
            })}
          </p>
        ) : (
          <div className="space-y-4">
            <div className={`rounded-2xl border p-5 ${status.tone}`}>
              <p className="text-xs font-medium uppercase tracking-widest opacity-80">
                {tr({
                  en: `Assessment ${readiness.assessment_no} · ${monthLabel(readiness.as_of_period)} · band ${readiness.band.toLowerCase()}`,
                  pt: `Avaliação ${readiness.assessment_no} · ${monthLabel(readiness.as_of_period)} · faixa ${({ LOW: "baixa", MEDIUM: "média", HIGH: "alta" } as Record<string, string>)[readiness.band] ?? readiness.band.toLowerCase()}`,
                })}
              </p>
              <p className="mt-1 font-heading text-2xl font-bold">{status.title}</p>
              <p className="text-sm">{status.summary}</p>
            </div>

            {missing.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{tr({ en: "Still to do", pt: "Falta fazer" })}</p>
                <ul className="space-y-2">
                  {missing.map((m) => (
                    <li key={m.code} className="flex items-start gap-2 text-sm text-foreground">
                      <CircleDashed size={16} className="mt-0.5 shrink-0 text-accent" /> {describeRequirement(m)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insightsFrom(readiness.features as unknown as ReadinessFeatures).length > 0 && (
              <ul className="space-y-2 rounded-xl border border-border bg-background/60 p-4">
                {insightsFrom(readiness.features as unknown as ReadinessFeatures).map((i) => (
                  <li key={i.text} className="flex items-start gap-2 text-sm text-foreground">
                    <Lightbulb size={15} className={`mt-0.5 shrink-0 ${i.tone === "watch" ? "text-caution" : i.tone === "good" ? "text-positive" : "text-muted-foreground"}`} />
                    {i.text}
                  </li>
                ))}
              </ul>
            )}

            {readiness.reason_codes.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {readiness.reason_codes.map((code) => {
                  const r = REASON_LABEL[code] ?? { text: code, positive: true };
                  return (
                    <li key={code} className={`rounded-full border px-3 py-1 text-xs ${r.positive ? "border-positive/40 text-positive" : "border-caution/40 text-caution"}`}>
                      {r.text}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="rounded-xl border border-border bg-background/60 px-4">
              <ProofStatus loading={anchors.isPending} label={tr({ en: "Assessment attested", pt: "Avaliação atestada" })} anchor={anchorOf(readiness.id)} />
            </div>
            <p className="text-xs text-muted-foreground">
              {tr({
                en: `Model ${readiness.model_version}. Readiness is not a credit decision: it says whether the business is prepared to have that conversation.`,
                pt: `Modelo ${readiness.model_version}. Prontidão não é uma decisão de crédito: ela diz se o negócio está preparado para essa conversa.`,
              })}
            </p>
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- credit */}
      {/* A live request stays visible even if a later assessment drops below ready. */}
      {/* Capital is a place on this page in every state: "Credit intent" and */}
      {/* "Loan and payments" both open #capital, and an anchor that exists */}
      {/* only once you qualify is a link that goes nowhere until then. */}
      {(readiness?.status === "CREDIT_READY" || intent) ? (
        <section id="capital" className="scroll-mt-32 space-y-4 rounded-2xl p-6 glass glow-border">
          <h2 className="font-heading text-xl font-bold text-foreground">{tr({ en: "Capital", pt: "Capital" })}</h2>
          {intent ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                {tr({
                  en: (
                    <>
                      You asked for <strong>{money(intent.requested_amount_cents)}</strong> for{" "}
                      {PURPOSE_LABEL[intent.purpose].toLowerCase()}. EmpowerFI assesses whether it fits the business; if it does,
                      P2P investors fund it and you receive and repay in reais, by Pix.
                    </>
                  ),
                  pt: (
                    <>
                      Você pediu <strong>{money(intent.requested_amount_cents)}</strong> para{" "}
                      {PURPOSE_LABEL[intent.purpose].toLowerCase()}. A EmpowerFI avalia se o valor cabe no negócio; se couber,
                      investidores P2P financiam o pedido e você recebe e paga em reais, via Pix.
                    </>
                  ),
                })}
              </p>
              <CreditProgress credit={business.data?.credit ?? null} />
              {!business.data?.credit?.eligibility && (
                <Button size="sm" variant="outline" disabled={checkEligibility.isPending} onClick={() => checkEligibility.mutate()}>
                  {checkEligibility.isPending && <Loader2 size={14} className="mr-1 animate-spin" />} {tr({ en: "Assess my request", pt: "Avaliar meu pedido" })}
                </Button>
              )}
              {!business.data?.credit?.opportunity?.loans?.length && (
                <Button variant="ghost" size="sm" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>
                  {tr({ en: "Withdraw the request", pt: "Retirar o pedido" })}
                </Button>
              )}
            </div>
          ) : !asking ? (
            <div className="space-y-3">
              <p className="flex items-start gap-2 text-sm text-foreground">
                <CircleCheck size={16} className="mt-0.5 shrink-0 text-positive" />
                {tr({
                  en: "Your business is ready for a credit conversation. Nothing happens unless you ask — being ready and not needing credit is a good place to be.",
                  pt: "Seu negócio está pronto para uma conversa sobre crédito. Nada acontece se você não pedir — estar pronta e não precisar de crédito é uma ótima situação.",
                })}
              </p>
              <Button variant="outline" onClick={() => setAsking(true)}>{tr({ en: "I would like to request capital", pt: "Quero pedir capital" })}</Button>
            </div>
          ) : (
            <form onSubmit={submitIntent} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="i-purpose">{tr({ en: "What is it for?", pt: "Para que é?" })}</Label>
                <Select value={intentForm.purpose} onValueChange={(v) => setIntentForm({ ...intentForm, purpose: v as CreditPurpose })}>
                  <SelectTrigger id="i-purpose"><SelectValue placeholder={tr({ en: "Choose a purpose", pt: "Escolha uma finalidade" })} /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PURPOSE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="i-amount">{tr({ en: "How much? (R$ 100 to R$ 50,000)", pt: "Quanto? (de R$ 100 a R$ 50.000)" })}</Label>
                <Input id="i-amount" type="number" inputMode="decimal" min={100} max={50000} step="0.01" required
                  value={intentForm.amount} onChange={(e) => setIntentForm({ ...intentForm, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i-desc">
                  {tr({ en: "In a sentence", pt: "Em uma frase" })}{" "}
                  <span className="font-normal text-muted-foreground">{tr({ en: "— optional", pt: "— opcional" })}</span>
                </Label>
                <Textarea id="i-desc" rows={2} maxLength={500} value={intentForm.description}
                  onChange={(e) => setIntentForm({ ...intentForm, description: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={declare.isPending} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  {declare.isPending && <Loader2 size={16} className="animate-spin" />} {tr({ en: "Send request", pt: "Enviar pedido" })}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setAsking(false)}>{tr({ en: "Not now", pt: "Agora não" })}</Button>
              </div>
            </form>
          )}
        </section>
      ) : (
        <section id="capital" className="scroll-mt-32 space-y-2 rounded-2xl p-6 glass">
          <h2 className="font-heading text-xl font-bold text-foreground">{tr({ en: "Capital", pt: "Capital" })}</h2>
          <p className="text-sm text-muted-foreground">
            {tr({
              en: (
                <>
                  Asking for capital opens once your readiness reaches credit-ready.{" "}
                  <a href="#readiness" className="underline underline-offset-4 hover:text-foreground">Your readiness</a> says
                  what is still missing.
                </>
              ),
              pt: (
                <>
                  O pedido de capital abre quando sua prontidão chega a pronta para crédito.{" "}
                  <a href="#readiness" className="underline underline-offset-4 hover:text-foreground">Sua prontidão</a> diz
                  o que ainda falta.
                </>
              ),
            })}
          </p>
        </section>
      )}

      {/* The routes a person found for her: not only the P2P pool, and not only
          credit. It sits under Capital because that is where she looks, and it
          appears only once someone has run the engine over her request. */}
      {opportunity && <MyCapitalPlan opportunityId={opportunity.id} />}

      {/* ------------------------------------------------------ cash flow */}
      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-foreground">{tr({ en: "Cash flow", pt: "Fluxo de caixa" })}</h2>
        {business.data?.months.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr({ en: "No months reported yet.", pt: "Nenhum mês informado ainda." })}</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-background/60">
            {business.data?.months.map((m) => (
              <li key={m.checkin_id} className="grid gap-2 px-4 py-3 sm:grid-cols-[6rem_1fr] sm:items-center">
                <p className="font-medium text-foreground">{monthLabel(m.period!)}</p>
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                    <span><span className="text-xs text-muted-foreground">{tr({ en: "Sales", pt: "Vendas" })}</span><br />{money(m.revenue_cents)}</span>
                    <span><span className="text-xs text-muted-foreground">{tr({ en: "Costs", pt: "Custos" })}</span><br />{money((m.cogs_cents ?? 0) + (m.opex_cents ?? 0))}</span>
                    <span><span className="text-xs text-muted-foreground">{tr({ en: "Household", pt: "Despesas da casa" })}</span><br />{money(m.household_cents)}</span>
                    <span>
                      <span className="text-xs text-muted-foreground">{tr({ en: "Business result", pt: "Resultado do negócio" })}</span><br />
                      <span className={(m.net_business_cents ?? 0) > 0 ? "text-positive" : "text-alert"}>{money(m.net_business_cents)}</span>
                    </span>
                  </div>
                  <ProofStatus loading={anchors.isPending} label={tr({ en: "Month anchored", pt: "Mês registrado na blockchain" })} anchor={anchorOf(m.checkin_id!)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------ education */}
      {education.data && (
        <section className="space-y-3">
          <h2 className="font-heading text-xl font-bold text-foreground">{tr({ en: "Education", pt: "Formação" })}</h2>
          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <MemberEducation programmes={education.data.programmes} completed={education.data.completed.get(id!)} />
          </div>
        </section>
      )}
    </div>
  );
}
