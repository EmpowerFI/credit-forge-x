import { FileText, Handshake, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../../components/LoadError";
import Panel from "../../../components/product/Panel";
import StatTile from "../../../components/product/StatTile";
import StatusPill from "../../../components/product/StatusPill";
import { formatDate, tr } from "../../../i18n";
import { documentLabel, INSTRUMENT_TYPE, missingDocuments } from "../../../lib/capitalNetwork";
import { money } from "../../../lib/readiness";
import PlanView from "./PlanView";
import { useCapitalPlan } from "./queries";

// The capital plan, where the people it concerns read it: the woman whose
// request it is, her community's leader, the desk, an investor deciding whether
// to fund what local capital could not, a sponsor, an auditor.
//
// Two readings of one decision. The full one is the operator's and the
// investor's: every route, every refusal, both sides of every gate. Hers is
// shorter on purpose — what was recommended, what is still missing, and the one
// thing she can actually do about it. The engine's ranking is not her question.

/**
 * The policy versions a run used, said in a line. Almost always every route is
 * on the same version, and listing five of them hides the one that moved.
 */
function policyLine(policy: Record<string, number>): string {
  const versions = Object.values(policy);
  if (versions.length === 0) return tr({ en: "no policy recorded", pt: "nenhuma política registrada" });
  const commonest = [...versions].sort(
    (a, b) => versions.filter((v) => v === b).length - versions.filter((v) => v === a).length || a - b,
  )[0];
  const others = Object.entries(policy).filter(([, v]) => v !== commonest);
  const all = tr({
    en: `policy v${commonest} on ${versions.length} routes`,
    pt: `política v${commonest} em ${versions.length} rotas`,
  });
  if (others.length === 0) return all;
  return `${all}, ${tr({ en: "except", pt: "exceto" })} ${others.map(([k, v]) => `${k} v${v}`).join(", ")}`;
}

/**
 * The whole decision, for whoever routes or funds it.
 *
 * `intro` and `empty` are for callers who are showing this plan inside another
 * reading of the same request — the engine page shows it under the pool the
 * allocation engine chose — and who therefore have something to say about it
 * that the plan itself cannot know. Neither is shown while the plan is loading
 * or failing: a heading over a spinner promises a section that may not arrive.
 */
export function CapitalPlanPanel({ opportunityId, intro, empty }: {
  opportunityId: string;
  /** Said above the plan, where there is one. */
  intro?: React.ReactNode;
  /** Said instead of it, where the engine has not run on this request yet. */
  empty?: React.ReactNode;
}) {
  const stored = useCapitalPlan(opportunityId);

  if (stored.isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  if (stored.error) return <LoadError error={stored.error} onRetry={() => void stored.refetch()} compact />;
  if (!stored.data) return empty ?? null;

  const { plan, instruments, decision_no, decided_at, instrument_policy, global_eligibility } = stored.data;
  return (
    <div className="space-y-4">
      {intro}
      <PlanView
        plan={plan}
        instruments={instruments}
        global={global_eligibility}
        meta={
          <p className="text-xs text-muted-foreground">
            {tr({ en: "Decision", pt: "Decisão" })} <span className="num text-foreground">{decision_no}</span>
            {" · "}{formatDate(decided_at)}
            {" · "}{tr({ en: "engine", pt: "motor" })} <span className="font-mono text-foreground">{plan.model_version}</span>
            {" · "}
            {/* What the routes' policies said when this ran, so a plan read weeks
                later is not mistaken for one made under today's terms. Naming all
                of them buries the one that matters, so only the routes that were
                not on the commonest version are spelled out. */}
            {policyLine(instrument_policy)}
          </p>
        }
      />
    </div>
  );
}

/** Her own reading: what was recommended, and what she can do next. */
export function MyCapitalPlan({ opportunityId }: { opportunityId: string }) {
  const stored = useCapitalPlan(opportunityId);

  if (stored.isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  // Nothing recorded yet is not an error, and not worth a panel telling her so.
  if (stored.error || !stored.data) return null;

  const { plan, instruments, decided_at } = stored.data;
  const named = new Map(instruments.map((i) => [i.code, i]));
  const missing = missingDocuments(plan);
  const covered = plan.domestic_coverage_cents + plan.global_coverage_cents;

  return (
    <Panel
      id="capital-plan"
      title={tr({ en: "The routes we found for you", pt: "As rotas que encontramos para você" })}
      description={tr({
        en: "Where the capital you asked for could come from. Each of these still has to be agreed with whoever offers it — nothing here is approved, and nothing is a debt yet.",
        pt: "De onde pode vir o capital que você pediu. Cada uma ainda precisa ser combinada com quem a oferece — nada aqui está aprovado, e nada é dívida ainda.",
      })}
      actions={<StatusPill tone="caution" dot={false}>{tr({ en: "Simulated", pt: "Simulado" })}</StatusPill>}
    >
      {plan.status === "manual_review" ? (
        <p className="text-sm text-muted-foreground">
          {tr({
            en: "Your request is with a person to look at. Nothing is needed from you right now.",
            pt: "Seu pedido está com uma pessoa para analisar. Nada é necessário de você agora.",
          })}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label={tr({ en: "You asked for", pt: "Você pediu" })} value={money(plan.requested_cents)} />
            <StatTile
              label={tr({ en: "The routes cover", pt: "As rotas cobrem" })}
              value={money(covered)}
              hint={covered >= plan.requested_cents ? tr({ en: "all of it", pt: "tudo" }) : `${Math.floor((covered * 100) / plan.requested_cents)}%`}
              hintTone={covered >= plan.requested_cents ? "positive" : "caution"}
            />
            <StatTile
              label={tr({ en: "Still without a route", pt: "Ainda sem rota" })}
              value={money(plan.unfunded_cents)}
              hint={plan.unfunded_cents > 0
                ? tr({ en: "we keep looking", pt: "seguimos procurando" })
                : tr({ en: "nothing left over", pt: "nada sobrando" })}
              hintTone={plan.unfunded_cents > 0 ? "caution" : "positive"}
            />
          </div>

          {plan.allocations.length > 0 ? (
            <ul className="space-y-2">
              {plan.allocations.map((a) => {
                const i = named.get(a.instrument_id);
                return (
                  <li key={a.instrument_id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-sm font-medium text-foreground">{i?.name ?? a.instrument_id}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {!a.is_credit && (
                          <StatusPill tone="caution" dot={false}>
                            {tr({ en: "Not a loan: goods and services, inside a network", pt: "Não é empréstimo: bens e serviços, dentro de uma rede" })}
                          </StatusPill>
                        )}
                        {a.requires_partner_approval && (
                          <StatusPill tone="info" dot={false}>
                            <Handshake size={11} className="mr-0.5" aria-hidden />
                            {tr({ en: "Still needs their approval", pt: "Ainda depende da aprovação deles" })}
                          </StatusPill>
                        )}
                        {i && !i.is_domestic && (
                          <StatusPill tone="info" dot={false}>{tr({ en: "International capital", pt: "Capital internacional" })}</StatusPill>
                        )}
                      </div>
                      {i && <p className="text-xs text-muted-foreground">{INSTRUMENT_TYPE[i.instrument_type].what}</p>}
                    </div>
                    <p className="num font-heading text-lg font-bold text-foreground">{money(a.amount_cents)}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tr({
                en: "Nothing in the network can take this request as it stands. It is not a refusal of you — it is what the routes available today reach.",
                pt: "Nada na rede consegue atender este pedido como ele está. Não é uma recusa a você — é o que as rotas disponíveis hoje alcançam.",
              })}
            </p>
          )}

          {/* The one refusal she can act on. Everything else about the ranking
              is the operator's business, not hers. */}
          {missing.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border tone-caution p-3 text-sm">
              <FileText size={16} className="mt-0.5 shrink-0" aria-hidden />
              <p>
                {tr({
                  en: "More routes would open with these papers: ",
                  pt: "Mais rotas se abririam com estes documentos: ",
                })}
                <span className="font-medium">{missing.map(documentLabel).join(", ")}</span>.{" "}
                {tr({
                  en: "Tell your community leader when you have them and the search runs again.",
                  pt: "Avise a liderança da sua comunidade quando tiver e a busca roda de novo.",
                })}
              </p>
            </div>
          )}
        </>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
        {tr({
          en: `Found on ${formatDate(decided_at)}. A recommendation, not an offer: EmpowerFI does not lend and does not approve credit.`,
          pt: `Encontradas em ${formatDate(decided_at)}. Uma recomendação, não uma oferta: a EmpowerFI não empresta e não aprova crédito.`,
        })}
      </p>
    </Panel>
  );
}
