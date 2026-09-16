import { ArrowRight, ArrowDown, Gauge, Split } from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "../../../i18n";

function EngineCard({ n, icon: Icon, name, question, inputs, outputs, active }: {
  n: 1 | 2; icon: typeof Gauge; name: string; question: string; inputs: string[]; outputs: string[]; active: boolean;
}) {
  return (
    <div className={cn("flex-1 space-y-3 rounded-2xl border p-4 transition-colors duration-500",
      active ? "border-accent/60 bg-accent/[0.06]" : "border-border bg-card")}>
      <div className="flex items-center gap-3">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-accent text-accent-foreground" : "bg-secondary text-accent")}>
          <Icon size={18} aria-hidden />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{tr({ en: `Engine ${n}`, pt: `Motor ${n}` })}</p>
          <p className="font-heading text-base font-bold leading-tight text-foreground">{name}</p>
        </div>
      </div>
      <p className="text-sm text-foreground">{question}</p>
      <div className="flex flex-wrap gap-1.5">
        {inputs.map((i) => <span key={i} className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{i}</span>)}
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{tr({ en: "Output:", pt: "Resultado:" })}</span> {outputs.join(tr({ en: " · or ", pt: " · ou " }))}
      </p>
    </div>
  );
}

/** EmpowerFI runs two engines, in order: whether a business is credit-ready, then which pool can fund it. */
export default function TwoEngines({ active }: { active: 0 | 1 | 2 }) {
  return (
    <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
      <EngineCard n={1} icon={Gauge} active={active === 1}
        name={tr({ en: "Credit engine", pt: "Motor de crédito" })}
        question={tr({ en: "Should this business become a qualified credit opportunity?", pt: "Este negócio deve virar uma oportunidade de crédito qualificada?" })}
        inputs={[
          tr({ en: "business history", pt: "histórico do negócio" }), tr({ en: "education", pt: "formação" }), tr({ en: "readiness", pt: "prontidão" }),
          tr({ en: "affordability", pt: "capacidade de pagamento" }), tr({ en: "risk", pt: "risco" }), tr({ en: "credit intent", pt: "pedido de crédito" }),
        ]}
        outputs={[tr({ en: "QUALIFIED CREDIT OPPORTUNITY", pt: "OPORTUNIDADE DE CRÉDITO QUALIFICADA" })]} />
      <div className="flex justify-center text-accent" aria-hidden>
        <ArrowDown size={18} className="lg:hidden" /><ArrowRight size={18} className="hidden lg:block" />
      </div>
      <EngineCard n={2} icon={Split} active={active === 2}
        name={tr({ en: "Capital Allocation Engine", pt: "Motor de Alocação de Capital" })}
        question={tr({ en: "Which available pool should fund it?", pt: "Qual pool disponível deve financiá-la?" })}
        inputs={[
          tr({ en: "qualified opportunity", pt: "oportunidade qualificada" }), tr({ en: "capital availability", pt: "capital disponível" }),
          tr({ en: "ticket policy", pt: "política de ticket" }), tr({ en: "risk appetite", pt: "apetite a risco" }),
          tr({ en: "mandate", pt: "mandato" }), tr({ en: "economics", pt: "economia" }),
        ]}
        outputs={[tr({ en: "DOMESTIC P2P", pt: "P2P DOMÉSTICO" }), tr({ en: "GLOBAL P2P / USDC", pt: "P2P GLOBAL / USDC" }), tr({ en: "WAITING FOR CAPITAL", pt: "AGUARDANDO CAPITAL" })]} />
    </div>
  );
}
