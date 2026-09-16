import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowLeft, BadgeCheck, BookOpen, CalendarCheck, Check, CircleDashed, Coins, Flag, Gauge, HandCoins,
  Loader2, MessageCircle, ShieldCheck, Sprout, UserPlus, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsentSummary } from "../../components/consent/ConsentScopes";
import LoadError from "../../components/LoadError";
import { DataTag } from "../../components/product/DataLegend";
import ExplorerLink from "../../components/product/ExplorerLink";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import {
  ACTION, type JourneyEvent, READINESS_TONE, requirementForLeader, type Requirement, scorePct, shortDate, STAGE_LABEL,
} from "../../lib/community";
import { CAPITAL_USE_LABEL, DECISION_LABEL, ELIGIBILITY_REASON, LOAN_LABEL, OPPORTUNITY_LABEL } from "../../lib/credit";
import { CHANNEL_LABEL, SCOPE_TEXT, SCOPES } from "../../lib/consent";
import { describeError } from "../../lib/errors";
import { platform } from "../../lib/platform";
import { money, monthLabel, PURPOSE_LABEL, REASON_LABEL, sectorLabel, STATUS_LABEL } from "../../lib/readiness";
import { useCommunity } from "./context";
import ConsentDialog from "./ConsentDialog";
import OutreachDialog from "./OutreachDialog";
import { useJourney } from "./queries";
import { localized, tr } from "../../i18n";

const KIND_ICON: Record<JourneyEvent["kind"], LucideIcon> = {
  joined: UserPlus, consent: ShieldCheck, education: BookOpen, checkin: CalendarCheck, readiness: Gauge, intent: HandCoins,
  intent_withdrawn: HandCoins, eligibility: Flag, referred: Coins, partner_decision: BadgeCheck, loan: Coins,
  payment: Check, outcome: Sprout, outreach: MessageCircle,
};

// Instalments mean something only once the money is out.
const REPAYING = ["DISBURSED", "ACTIVE", "PAID", "DEFAULTED"];

// A proof not yet confirmed, in words: the status itself is the database's.
const PROOF_STATUS: Record<string, string> = localized({
  pending: { en: "pending", pt: "pendente" },
  submitted: { en: "submitted", pt: "enviada" },
  failed: { en: "failed", pt: "falhou" },
});

const VERDICT: Record<string, string> = localized({
  approved: { en: "approved", pt: "aprovou" },
  declined: { en: "declined", pt: "recusou" },
  more_information: { en: "asked for more information", pt: "pediu mais informações" },
});

function describe(e: JourneyEvent): { title: string; sub?: string } {
  const d = (e.detail ?? {}) as Record<string, unknown>;
  switch (e.kind) {
    case "joined": return { title: tr({ en: `Joined ${e.label}`, pt: `Entrou em ${e.label}` }) };
    case "consent": return {
      title: tr({ en: `Consent record #${e.label}`, pt: `Registro de consentimento #${e.label}` }),
      sub: `${SCOPES.filter((sc) => d[sc]).map((sc) => SCOPE_TEXT[sc].title.toLowerCase()).join("; ") || tr({ en: "nothing allowed", pt: "nada autorizado" })} · ${CHANNEL_LABEL[d.channel as keyof typeof CHANNEL_LABEL] ?? ""}`,
    };
    case "education": return { title: tr({ en: `Completed “${e.label}”`, pt: `Concluiu “${e.label}”` }) };
    case "checkin": return {
      title: tr({ en: `Reported ${monthLabel(e.label)}`, pt: `Informou ${monthLabel(e.label)}` }),
      sub: d.keeps_records ? tr({ en: "records kept", pt: "com registros" }) : tr({ en: "no records kept that month", pt: "sem registros naquele mês" }),
    };
    case "readiness": return {
      title: tr({ en: "Readiness", pt: "Prontidão" }) + `: ${STATUS_LABEL[e.label as keyof typeof STATUS_LABEL]?.title ?? e.label}`,
      sub: tr({ en: `score ${d.score ?? "—"} · ${d.model_version ?? ""}`, pt: `nota ${d.score ?? "—"} · ${d.model_version ?? ""}` }),
    };
    case "intent": return {
      title: tr({ en: "Asked for credit", pt: "Pediu crédito" }) + `: ${PURPOSE_LABEL[e.label as keyof typeof PURPOSE_LABEL] ?? e.label}`,
      sub: money(d.amount_cents as number),
    };
    case "intent_withdrawn": return { title: tr({ en: "Withdrew the credit request", pt: "Retirou o pedido de crédito" }) };
    case "eligibility": return { title: DECISION_LABEL[e.label as keyof typeof DECISION_LABEL]?.title ?? e.label, sub: String(d.model_version ?? "") };
    case "referred": return { title: tr({ en: "Opened to P2P investors", pt: "Aberta a investidores P2P" }) };
    case "partner_decision": return {
      title: e.label === "approved"
        ? tr({ en: "Formalised by EmpowerFI's P2P desk", pt: "Formalizado pela mesa P2P da EmpowerFI" })
        : tr({ en: `EmpowerFI's P2P desk ${VERDICT[e.label] ?? e.label}`, pt: `A mesa P2P da EmpowerFI ${VERDICT[e.label] ?? e.label}` }),
    };
    case "loan": return {
      title: tr({ en: "Loan", pt: "Empréstimo" }) + ` ${LOAN_LABEL[e.label as keyof typeof LOAN_LABEL]?.toLowerCase() ?? e.label}`,
    };
    case "payment": return { title: tr({ en: `Instalment ${e.label} paid`, pt: `Parcela ${e.label} paga` }) };
    case "outcome": return { title: tr({ en: "Productive outcome measured", pt: "Resultado produtivo medido" }), sub: CAPITAL_USE_LABEL[e.label as keyof typeof CAPITAL_USE_LABEL] };
    case "outreach": return { title: ACTION[e.label as keyof typeof ACTION]?.label ?? e.label, sub: (d.note as string) || tr({ en: "logged by the community", pt: "registrado pela comunidade" }) };
  }
}

export default function Participant() {
  const { entrepreneurId = "" } = useParams();
  const { community, leads } = useCommunity();
  const journey = useJourney(community.id, entrepreneurId);
  const queryClient = useQueryClient();
  const [logging, setLogging] = useState(false);
  const [consenting, setConsenting] = useState(false);

  const recordModule = useMutation({
    mutationFn: async (moduleId: string) => {
      const { error } = await platform.rpc("record_education_progress", {
        p_entrepreneur_id: entrepreneurId, p_module_id: moduleId, p_status: "completed",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      for (const key of ["ci-journey", "ci-participants", "ci-overview"]) queryClient.invalidateQueries({ queryKey: ["platform", key, community.id] });
      toast.success(tr({ en: "Module recorded.", pt: "Módulo registrado." }));
    },
    onError: (error) => toast.error(describeError(error)),
  });

  const back = (
    <Link to=".." relative="path" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft size={14} /> {tr({ en: "Participants", pt: "Participantes" })}
    </Link>
  );

  if (journey.isError) return <div className="space-y-4">{back}<LoadError error={journey.error} onRetry={() => journey.refetch()} /></div>;
  if (!journey.data) return <div className="space-y-4">{back}<Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;

  const { state: s, consent, education, timeline } = journey.data;
  const nextModule = education.find((m) => m.status !== "completed");
  const missing = (s.missing_requirements ?? []) as Requirement[];
  const events = [...timeline].reverse();

  return (
    <div className="space-y-6">
      {back}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-heading text-2xl font-bold text-foreground">{s.display_name}</h2>
          <p className="text-sm text-muted-foreground">
            {[s.business_name, sectorLabel(s.business_sector), tr({ en: `joined ${shortDate(s.joined_at)}`, pt: `entrou em ${shortDate(s.joined_at)}` })].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="info">{STAGE_LABEL[s.stage]}</StatusPill>
          {s.readiness_status && <StatusPill tone={READINESS_TONE[s.readiness_status]}>{STATUS_LABEL[s.readiness_status].title}</StatusPill>}
          {s.is_simulated && <StatusPill tone="caution">{tr({ en: "Simulated", pt: "Simulada" })}</StatusPill>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={tr({ en: "Core education", pt: "Formação essencial" })} value={`${s.core_done}/${s.core_total}`}
          hint={s.education_complete ? tr({ en: "complete", pt: "concluída" }) : tr({ en: "in progress", pt: "em andamento" })}
          hintTone={s.education_complete ? "positive" : "info"} />
        <StatTile label={tr({ en: "Months reported", pt: "Meses informados" })} value={s.months_reported ?? s.checkins}
          hint={s.last_period ? tr({ en: `last ${monthLabel(s.last_period)}`, pt: `último: ${monthLabel(s.last_period)}` }) : tr({ en: "none yet", pt: "nenhum ainda" })} hintTone={s.reported_latest ? "positive" : "caution"} />
        <StatTile label={tr({ en: "Regularity", pt: "Regularidade" })} value={scorePct(s.regularity) !== null ? `${scorePct(s.regularity)}%` : "—"}
          hint={tr({ en: "reporting month after month", pt: "dados informados mês após mês" })} />
        <StatTile label={tr({ en: "Data quality", pt: "Qualidade dos dados" })} value={scorePct(s.data_quality) !== null ? `${scorePct(s.data_quality)}%` : "—"}
          hint={tr({ en: "consistency of the figures", pt: "coerência dos números" })} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={tr({ en: "Next best action", pt: "Próxima melhor ação" })}>
          {s.next_action ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">{ACTION[s.next_action].queue}.</p>
              {s.contacted_at ? (
                <p className="text-sm text-muted-foreground">
                  {tr({
                    en: `Contacted ${shortDate(s.contacted_at)}: it will come back to the queue after a week if nothing changes.`,
                    pt: `Contatada em ${shortDate(s.contacted_at)}: volta para a fila depois de uma semana se nada mudar.`,
                  })}
                </p>
              ) : leads ? (
                <Button size="sm" className="gap-2" onClick={() => setLogging(true)}>
                  <MessageCircle size={14} /> {ACTION[s.next_action].button}
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check size={16} className="mt-0.5 shrink-0 text-positive" />
              {s.readiness_status === "CREDIT_READY" && !s.intent_purpose
                ? tr({
                  en: "Ready for credit and not asking for any. That is a complete outcome: nothing is needed from the community.",
                  pt: "Pronta para crédito e sem pedir nenhum. Isso é um resultado completo: a comunidade não precisa fazer nada.",
                })
                : tr({ en: "Nothing is needed from the community right now.", pt: "A comunidade não precisa fazer nada agora." })}
            </p>
          )}
        </Panel>

        <Panel title={<span className="flex items-center gap-2"><DataTag kind="derived" /> {tr({ en: "Readiness", pt: "Prontidão" })}</span>}
          description={s.readiness_status ? STATUS_LABEL[s.readiness_status].summary
            : tr({ en: "Not assessed yet: it runs after her first check-in.", pt: "Ainda não avaliada: a avaliação roda depois do primeiro check-in dela." })}>
          {s.readiness_status && (
            <div className="space-y-3 text-sm">
              {missing.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{tr({ en: "Missing", pt: "Falta" })}</p>
                  <ul className="space-y-1">
                    {missing.map((m) => (
                      <li key={m.code} className="flex items-start gap-2 text-foreground">
                        <CircleDashed size={14} className="mt-0.5 shrink-0 text-caution" aria-hidden /> {requirementForLeader(m)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {s.readiness_reasons?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {s.readiness_reasons.map((r) => (
                    <StatusPill key={r} tone={REASON_LABEL[r]?.positive === false ? "caution" : "positive"} dot={false}>
                      {REASON_LABEL[r]?.text ?? r}
                    </StatusPill>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {tr({
                  en: `Score ${s.readiness_score ?? "—"} · ${s.model_version} · assessed ${shortDate(s.assessed_at)}`,
                  pt: `Nota ${s.readiness_score ?? "—"} · ${s.model_version} · avaliada em ${shortDate(s.assessed_at)}`,
                })}
              </p>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={tr({ en: "Credit", pt: "Crédito" })}
          description={tr({
            en: "The community prepares; EmpowerFI's rules check eligibility; P2P investors fund it, and EmpowerFI's desk formalises and services the loan.",
            pt: "A comunidade prepara; as regras da EmpowerFI verificam a elegibilidade; investidores P2P financiam, e a mesa da EmpowerFI formaliza e acompanha os pagamentos do empréstimo.",
          })}>
          {!s.intent_purpose && !s.loan_status ? (
            <p className="text-sm text-muted-foreground">{tr({ en: "No credit request. Being ready does not mean borrowing.", pt: "Nenhum pedido de crédito. Estar pronta não significa pegar empréstimo." })}</p>
          ) : (
            <dl className="divide-y divide-border text-sm">
              <Row label={tr({ en: "Request", pt: "Pedido" })}>{s.intent_purpose ? `${PURPOSE_LABEL[s.intent_purpose]} · ${money(s.intent_cents)}` : "—"}</Row>
              <Row label={tr({ en: "Eligibility", pt: "Elegibilidade" })}>
                {s.eligibility_decision ? DECISION_LABEL[s.eligibility_decision].title : tr({ en: "Not evaluated", pt: "Não avaliada" })}
                {s.eligibility_reasons?.length > 0 && (
                  <span className="block text-xs text-muted-foreground">{s.eligibility_reasons.map((r) => ELIGIBILITY_REASON[r] ?? r).join("; ")}</span>
                )}
              </Row>
              <Row label={tr({ en: "Opportunity", pt: "Oportunidade" })}>{s.opportunity_status ? OPPORTUNITY_LABEL[s.opportunity_status] : "—"}</Row>
              <Row label={tr({ en: "Loan", pt: "Empréstimo" })}>
                {s.loan_status ? `${LOAN_LABEL[s.loan_status]}${s.loan_term && REPAYING.includes(s.loan_status) ? tr({ en: ` · ${s.instalments_paid}/${s.loan_term} instalments`, pt: ` · ${s.instalments_paid}/${s.loan_term} parcelas` }) : ""}` : "—"}
                {s.late && <span className="mt-1 flex items-center gap-1.5 text-xs text-alert"><AlertTriangle size={13} /> {tr({ en: "An instalment is late", pt: "Uma parcela está em atraso" })}</span>}
              </Row>
            </dl>
          )}
        </Panel>

        <Panel title={tr({ en: "Education", pt: "Formação" })}
          description={tr({ en: "EmpowerFI's core programme, and the community's own.", pt: "A formação essencial da EmpowerFI, e a da própria comunidade." })}>
          <ul className="space-y-1.5 text-sm">
            {education.map((m) => (
              <li key={m.module_id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  {m.status === "completed"
                    ? <Check size={14} className="text-positive" aria-label={tr({ en: "Completed", pt: "Concluído" })} />
                    : <CircleDashed size={14} className="text-muted-foreground" aria-label={tr({ en: "Not completed", pt: "Não concluído" })} />}
                  <span className={m.status === "completed" ? "text-foreground" : "text-muted-foreground"}>{m.title}</span>
                  {!m.core && <span className="text-xs text-muted-foreground">· {m.program}</span>}
                </span>
                {m.completed_at && <span className="text-xs text-muted-foreground">{shortDate(m.completed_at)}</span>}
              </li>
            ))}
          </ul>
          {leads && nextModule && (
            <Button variant="secondary" size="sm" className="gap-2" disabled={recordModule.isPending}
              onClick={() => recordModule.mutate(nextModule.module_id)}>
              {recordModule.isPending ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
              {tr({ en: `Record “${nextModule.title}” as completed`, pt: `Registrar “${nextModule.title}” como concluído` })}
            </Button>
          )}
          {education.length === 0 && <p className="text-sm text-muted-foreground">{tr({ en: "No programme yet.", pt: "Nenhum programa ainda." })}</p>}
        </Panel>
      </div>

      <Panel title={<span className="flex items-center gap-2"><ShieldCheck size={16} className="text-positive" aria-hidden /> {tr({ en: "Consent", pt: "Consentimento" })}</span>}
        description={tr({
          en: "What she allows her data to be used for. The platform enforces it: nothing is assessed, referred or shown to investors without it.",
          pt: "Para que ela autoriza o uso dos dados dela. A plataforma garante isso: sem consentimento, nada é avaliado, encaminhado ou mostrado a investidores.",
        })}
        actions={leads ? (
          <Button size="sm" variant="secondary" className="gap-2" onClick={() => setConsenting(true)}>
            <ShieldCheck size={14} /> {consent
              ? tr({ en: "Record a new form", pt: "Registrar novo formulário" })
              : tr({ en: "Record her consent form", pt: "Registrar o formulário de consentimento dela" })}
          </Button>
        ) : undefined}>
        <ConsentSummary record={consent} />
      </Panel>

      <Panel title={tr({ en: "Journey", pt: "Jornada" })}
        description={tr({
          en: "Every step, newest first. Steps marked ✓ have a commitment on Solana: the record stays private, the proof is public.",
          pt: "Cada etapa, da mais recente para a mais antiga. As etapas marcadas com ✓ têm um registro na blockchain Solana: o dado fica privado, a prova é pública.",
        })}>
        <ol className="relative space-y-4 border-l border-border pl-6">
          {events.map((e, i) => {
            const Icon = KIND_ICON[e.kind];
            const { title, sub } = describe(e);
            return (
              <li key={`${e.kind}-${e.at}-${i}`} className="relative">
                <span className="absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                  <Icon size={13} aria-hidden />
                </span>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm text-foreground">{title}{sub && <span className="ml-2 text-xs text-muted-foreground">{sub}</span>}</p>
                  <span className="text-xs text-muted-foreground">{shortDate(e.at)}</span>
                </div>
                {e.proof && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {e.proof.status === "confirmed" ? (
                      <>
                        <DataTag kind="proven" withLabel />
                        {e.proof.signature && <ExplorerLink tx={e.proof.signature} />}
                        <Link to={`/app/audit/${e.proof.kind}/${e.proof.entity_id}`} className="text-info hover:underline">{tr({ en: "Verify", pt: "Verificar" })}</Link>
                      </>
                    ) : (
                      <span className="text-muted-foreground">{tr({ en: "Proof", pt: "Prova" })} {PROOF_STATUS[e.proof.status] ?? e.proof.status}</span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Panel>

      {consenting && (
        <ConsentDialog communityId={community.id} entrepreneur={s} current={consent}
          open onOpenChange={(v) => !v && setConsenting(false)} />
      )}

      {logging && s.next_action && (
        <OutreachDialog communityId={community.id} action={s.next_action}
          people={[{ entrepreneur_id: s.entrepreneur_id, display_name: s.display_name }]}
          open onOpenChange={(v) => !v && setLogging(false)} />
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}
