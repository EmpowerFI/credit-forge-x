import type { PoolId } from "@empowerfi/capital-allocation";
import { CAPITAL_ALLOCATION_MODEL_VERSION } from "@empowerfi/capital-allocation";
import { ShieldCheck } from "lucide-react";
import ExplorerLink from "../../../components/product/ExplorerLink";
import StatusPill from "../../../components/product/StatusPill";
import VerifyOnSolana from "../../../components/product/VerifyOnSolana";
import { formatDateTime, localized, tr } from "../../../i18n";
import { POOL } from "../../../lib/capital";
import type { EngineOpportunity } from "../../../lib/engine";

const KIND = localized({
  readiness: { en: "Readiness attestation", pt: "Atestado de prontidão" },
  eligibility: { en: "Eligibility attestation", pt: "Atestado de elegibilidade" },
  opportunity: { en: "Opportunity commitment", pt: "Compromisso da oportunidade" },
});

const short = (hex: string | null) => (hex ? `${hex.slice(0, 10)}…${hex.slice(-6)}` : "—");

/**
 * "Verify decision on Solana": only what is public by design. A pseudonymous
 * code, model versions, commitments (hashes), times, the route and the
 * transactions. Never a name, a figure of hers, a Pix key or a check-in.
 */
export default function VerifyDecision({ o, route }: { o: EngineOpportunity; route: PoolId | null }) {
  const proofs = o.proofs.filter((p) => p.kind in KIND);
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-background/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-positive" aria-hidden />
          <p className="font-heading text-sm font-bold text-foreground">{tr({ en: "Verify decision on Solana", pt: "Verificar decisão na Solana" })}</p>
        </div>
        {proofs.some((p) => p.signature && p.commitment) && <VerifyOnSolana proofs={proofs} />}
      </div>

      <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        <div><dt className="text-muted-foreground">{tr({ en: "Opportunity", pt: "Oportunidade" })}</dt><dd className="font-mono text-foreground">{o.code}</dd></div>
        <div><dt className="text-muted-foreground">{tr({ en: "Route selected by this run", pt: "Rota escolhida nesta execução" })}</dt><dd className="text-foreground">{route ? POOL[route].name : tr({ en: "Waiting for capital", pt: "Aguardando capital" })}</dd></div>
        <div><dt className="text-muted-foreground">{tr({ en: "Engine versions", pt: "Versões dos motores" })}</dt><dd className="font-mono text-foreground">{o.readiness.model_version} · {o.eligibility.model_version} · {o.allocation_model_version ?? CAPITAL_ALLOCATION_MODEL_VERSION}</dd></div>
        <div><dt className="text-muted-foreground">{tr({ en: "Allocated at listing", pt: "Alocada na abertura" })}</dt><dd className="text-foreground">{o.allocated_at ? formatDateTime(o.allocated_at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</dd></div>
      </dl>

      {proofs.length === 0 ? (
        <p className="text-xs text-muted-foreground">{tr({ en: "No commitment recorded for this opportunity yet.", pt: "Ainda não há compromisso registrado para esta oportunidade." })}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {proofs.map((p) => (
            <li key={`${p.kind}-${p.signature ?? p.commitment}`} className="grid gap-1 px-3 py-2 text-xs sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
              <span className="font-medium text-foreground">{KIND[p.kind as keyof typeof KIND]}</span>
              <span className="min-w-0 truncate font-mono text-muted-foreground" title={p.commitment ?? undefined}>
                {short(p.commitment)}{p.confirmed_at && <> · {formatDateTime(p.confirmed_at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</>}
              </span>
              <span className="flex items-center gap-2">
                {p.signature ? <ExplorerLink tx={p.signature} /> : <StatusPill tone="caution" dot={false}>{tr({ en: "Pending", pt: "Pendente" })}</StatusPill>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] leading-snug text-muted-foreground">
        {tr({
          en: "The chain holds the credit decision: readiness and eligibility attestations and the opportunity's commitment, as hashes. The route is recorded in the database with its model version, and re-runs here. No name, revenue, costs, Pix key or check-in goes on chain.",
          pt: "A blockchain guarda a decisão de crédito: os atestados de prontidão e elegibilidade e o compromisso da oportunidade, como hashes. A rota fica registrada no banco de dados com a versão do modelo, e é reprocessada aqui. Nenhum nome, faturamento, custo, chave Pix ou check-in vai para a blockchain.",
        })}
      </p>
    </div>
  );
}
