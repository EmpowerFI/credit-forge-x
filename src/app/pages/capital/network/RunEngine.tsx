import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, History, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import Panel from "../../../components/product/Panel";
import StatusPill from "../../../components/product/StatusPill";
import { formatDateTime, tr } from "../../../i18n";
import {
  documentLabel, documentsAsked, runCapitalEngine,
  type CapitalPlan, type EngineRun, type Instrument, type RouteDecision,
} from "../../../lib/capitalNetwork";
import { describeError } from "../../../lib/errors";
import { money } from "../../../lib/readiness";
import type { EngineOpportunity } from "../../../lib/engine";
import OpportunityPicker from "../engine/OpportunityPicker";
import PlanView from "./PlanView";
import { useDecisions } from "./queries";

// Running the engine over one opportunity.
//
// This button writes. It is not a dry run, and calling it one would be the
// easier lie: the need is assembled by private.capital_need() from the
// opportunity, the eligibility assessment it points at, her state and her
// check-in history, and rebuilding that in the browser would be a second place
// for the same rules to disagree from. So the run is the recorded one — and it
// is idempotent, so pressing it again on a need that has not moved records
// nothing and says so.

/** The documents a previous run was told she has, so a second run starts where the last one left off. */
const documentsOf = (decision: RouteDecision | undefined): string[] => {
  const need = decision?.need as { documents?: unknown } | null;
  return Array.isArray(need?.documents) ? (need!.documents as string[]).filter((d): d is string => typeof d === "string") : [];
};

function Documents({ asked, value, onChange }: { asked: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <FileText size={13} aria-hidden /> {tr({ en: "What she has on file", pt: "O que ela tem no arquivo" })}
      </legend>
      <p className="text-xs text-muted-foreground">
        {tr({
          en: "Nothing in this product records a business's documents yet, so an operator states them here. What you state is kept with the decision, so the next run reproduces this one.",
          pt: "Nada neste produto registra ainda os documentos de um negócio, então um operador os declara aqui. O que você declarar fica guardado com a decisão, para que a próxima execução reproduza esta.",
        })}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {asked.map((d) => (
          <label key={d} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={value.includes(d)}
              onCheckedChange={() => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d])}
            />
            {documentLabel(d)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function RunEngine({ opportunities, instruments, loading }: {
  opportunities: EngineOpportunity[];
  instruments: Instrument[];
  loading: boolean;
}) {
  const [selected, setSelected] = useState<EngineOpportunity | null>(null);
  const [documents, setDocuments] = useState<string[]>([]);
  const [run, setRun] = useState<EngineRun | null>(null);
  const queryClient = useQueryClient();
  const decisions = useDecisions(selected?.opportunity_id ?? null);
  const asked = useMemo(() => documentsAsked(instruments), [instruments]);

  // Pick up where the last recorded run left off — once per opportunity, so a
  // background refetch cannot wipe what an operator is in the middle of stating.
  const seeded = useRef<string | null>(null);
  useEffect(() => {
    const id = selected?.opportunity_id ?? null;
    if (id === null) {
      seeded.current = null;
      setRun(null);
      setDocuments([]);
      return;
    }
    if (seeded.current === id || decisions.isLoading) return;
    seeded.current = id;
    setRun(null);
    setDocuments(documentsOf(decisions.data?.[0]));
  }, [selected?.opportunity_id, decisions.data, decisions.isLoading]);

  const engine = useMutation({
    mutationFn: () => runCapitalEngine(selected!.opportunity_id, documents),
    onSuccess: (result) => {
      setRun(result);
      queryClient.invalidateQueries({ queryKey: ["platform"] });
      toast.success(result.recorded
        ? tr({
            en: `Recorded as decision ${result.decision_no}.`,
            pt: `Registrado como decisão ${result.decision_no}.`,
          })
        : tr({
            en: "The engine reached the same answer as the last run, so nothing was recorded.",
            pt: "O motor chegou à mesma resposta da última execução, então nada foi registrado.",
          }));
    },
    onError: (error) => toast.error(describeError(error)),
  });

  const earlier = (decisions.data ?? []).filter((d) => d.decision_no !== run?.decision_no);

  return (
    <div className="space-y-4">
      <Panel
        id="run"
        title={tr({ en: "Run the engine", pt: "Rodar o motor" })}
        description={tr({
          en: "Match one qualified opportunity against the whole network. This records a decision — and reaching the same answer twice records nothing.",
          pt: "Compare uma oportunidade qualificada com a rede inteira. Isto registra uma decisão — e chegar duas vezes à mesma resposta não registra nada.",
        })}
      >
        {loading ? (
          <Skeleton className="h-16 w-full rounded-xl" />
        ) : opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tr({
              en: "No qualified opportunity to route yet. One appears once a request has cleared readiness and eligibility.",
              pt: "Nenhuma oportunidade qualificada para encaminhar ainda. Uma aparece quando um pedido passa pela prontidão e pela elegibilidade.",
            })}
          </p>
        ) : (
          <>
            <OpportunityPicker options={opportunities} value={selected} onChange={setSelected} disabled={engine.isPending} />
            {selected && (
              <>
                <Documents asked={asked} value={documents} onChange={setDocuments} />
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => engine.mutate()} disabled={engine.isPending} className="gap-1.5">
                    <Play size={14} aria-hidden />
                    {engine.isPending
                      ? tr({ en: "Running…", pt: "Rodando…" })
                      : tr({ en: "Run the capital engine", pt: "Rodar o motor de capital" })}
                  </Button>
                  {run && (
                    <StatusPill tone={run.recorded ? "positive" : "neutral"} dot={false}>
                      {run.recorded
                        ? tr({ en: `Decision ${run.decision_no}`, pt: `Decisão ${run.decision_no}` })
                        : tr({ en: "Unchanged, nothing recorded", pt: "Sem mudança, nada registrado" })}
                    </StatusPill>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {tr({
                    en: "Her months of reported history stand in for the age of the business: this product records no incorporation date, and that proxy is what some routes' minimum history is checked against.",
                    pt: "Os meses de histórico reportado dela fazem o papel da idade do negócio: este produto não registra data de constituição, e é contra esse proxy que o histórico mínimo de algumas rotas é verificado.",
                  })}
                </p>
              </>
            )}
          </>
        )}
      </Panel>

      {run && (
        <PlanView
          plan={run.plan as CapitalPlan}
          instruments={instruments}
          meta={
            <p className="text-xs text-muted-foreground">
              {tr({ en: "Engine", pt: "Motor" })} <span className="font-mono text-foreground">{run.plan.model_version}</span>
              {" · "}
              {tr({ en: "decision", pt: "decisão" })} <span className="num text-foreground">{run.decision_no}</span>
              {" · "}
              {tr({ en: "every provider in this network is simulated", pt: "todo provedor desta rede é simulado" })}
            </p>
          }
        />
      )}

      {earlier.length > 0 && (
        <Panel
          title={tr({ en: "Earlier runs", pt: "Execuções anteriores" })}
          description={tr({
            en: "Kept, so a recommendation can be read against the engine and the policy versions that produced it.",
            pt: "Mantidas, para que uma recomendação possa ser lida contra o motor e as versões de política que a produziram.",
          })}
        >
          <ul className="space-y-2">
            {earlier.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border/60 pb-2 text-xs last:border-0 last:pb-0">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <History size={12} aria-hidden />
                  <span className="num text-foreground">#{d.decision_no}</span>
                  {formatDateTime(d.decided_at)}
                </span>
                <span className="num text-muted-foreground">
                  {tr({ en: "gap", pt: "lacuna" })} <span className="text-foreground">{money(d.external_capital_gap_cents)}</span>
                  {" · "}
                  <span className="font-mono">{d.engine_version}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
