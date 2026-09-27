import { Building2, FileCheck2, Globe2, Handshake } from "lucide-react";
import Panel from "../../../components/product/Panel";
import StatusPill from "../../../components/product/StatusPill";
import { localized, tr } from "../../../i18n";
import { PROVIDER_TYPE, reportingLabel, type Provider } from "../../../lib/capitalNetwork";

// Who is in the network. A provider's regulated role, where it has one, is a
// fact about that provider and not something this registry decides: partner_id
// is set only where the provider is also the counterparty that approves credit.

const COMMERCIAL_MODEL: Record<string, string> = localized({
  referral_fee: { en: "Referral fee", pt: "Taxa de indicação" },
  success_fee: { en: "Success fee", pt: "Taxa de sucesso" },
  platform_fee: { en: "Platform fee", pt: "Taxa de plataforma" },
  no_fee: { en: "No fee", pt: "Sem taxa" },
});

const modelOf = (p: Provider): string | null => {
  const model = (p.commercial_model as { model?: string } | null)?.model;
  return model ? COMMERCIAL_MODEL[model] ?? model : null;
};

/**
 * A provider's counterparty checks (addendum v2 §6). Nothing here was verified:
 * the fund is invented, and the object says so rather than a screen implying a
 * check that never happened.
 */
const kybOf = (p: Provider): { status: string; note: string | null } => {
  const kyb = (p.kyb as { status?: string; note?: string } | null) ?? {};
  return { status: kyb.status ?? "unknown", note: kyb.note ?? null };
};

/** Whether the counterparty check says anything the "Simulated" pill has not. */
const showKyb = (p: Provider): boolean =>
  p.domicile !== null && !(p.is_simulated && kybOf(p).status === "simulated");

const KYB_STATUS: Record<string, { label: string; tone: "positive" | "caution" | "neutral" }> = localized({
  verified: { label: { en: "Counterparty verified", pt: "Contraparte verificada" }, tone: "positive" },
  simulated: { label: { en: "No check performed", pt: "Nenhuma verificação feita" }, tone: "caution" },
  pending: { label: { en: "Check pending", pt: "Verificação pendente" }, tone: "caution" },
  unknown: { label: { en: "Nothing stated", pt: "Nada declarado" }, tone: "neutral" },
});

export default function Providers({ providers }: { providers: Provider[] }) {
  return (
    <Panel
      id="providers"
      title={tr({ en: "Providers", pt: "Provedores" })}
      description={tr({
        en: "Who offers capital through the network. Every one of them is invented for this prototype; a real institution appears here only after it has agreed to.",
        pt: "Quem oferece capital pela rede. Todos foram inventados para este protótipo; uma instituição real só aparece aqui depois de concordar.",
      })}
    >
      {providers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tr({ en: "No provider is registered yet. A provider arrives by migration, as a funding pool does.", pt: "Nenhum provedor cadastrado ainda. Um provedor entra por migração, como um pool de capital." })}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {providers.map((p) => {
            const model = modelOf(p);
            return (
              <li key={p.id} className="panel min-w-0 space-y-2.5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-heading text-sm font-bold text-foreground">{p.display_name}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 size={12} aria-hidden /> {PROVIDER_TYPE[p.provider_type]}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.is_simulated && (
                      <StatusPill tone="caution" dot={false}>{tr({ en: "Simulated", pt: "Simulado" })}</StatusPill>
                    )}
                    {!p.active && (
                      <StatusPill tone="neutral" dot={false}>{tr({ en: "Closed", pt: "Fechado" })}</StatusPill>
                    )}
                    {/* A simulated provider has said it already: two pills saying
                        "nothing was checked" is one pill too many. */}
                    {showKyb(p) && (
                      <StatusPill tone={KYB_STATUS[kybOf(p).status]?.tone ?? "neutral"} dot={false}>
                        {KYB_STATUS[kybOf(p).status]?.label ?? kybOf(p).status}
                      </StatusPill>
                    )}
                  </div>
                </div>
                <dl className="space-y-1 text-xs">
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-muted-foreground">{tr({ en: "Where it operates", pt: "Onde opera" })}</dt>
                    <dd className="text-foreground">
                      {p.coverage_uf.length > 0 ? p.coverage_uf.join(", ") : tr({ en: "No restriction stated", pt: "Nenhuma restrição declarada" })}
                      {p.coverage_note && <span className="text-muted-foreground"> · {p.coverage_note}</span>}
                    </dd>
                  </div>
                  {model && (
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="text-muted-foreground">{tr({ en: "Commercial model", pt: "Modelo comercial" })}</dt>
                      {/* Metadata. Nothing in this prototype bills anything, and
                          every arrangement would need its own validation first. */}
                      <dd className="text-foreground">{model} <span className="text-muted-foreground">{tr({ en: "· recorded, never billed", pt: "· registrado, nunca cobrado" })}</span></dd>
                    </div>
                  )}
                  {/* §6's fund profile, for a provider that states one. Where the
                      money is domiciled decides which rules reach it, and what it
                      asks for its capital is not her rate: the engine adds
                      expected loss, cost to serve and the cost of moving it. */}
                  {p.domicile && (
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="flex items-center gap-1.5 text-muted-foreground">
                        <Globe2 size={12} aria-hidden /> {tr({ en: "Domiciled in", pt: "Domiciliado em" })}
                      </dt>
                      <dd className="text-foreground">
                        {p.domicile}
                        {showKyb(p) && kybOf(p).note && <span className="text-muted-foreground"> · {kybOf(p).note}</span>}
                      </dd>
                    </div>
                  )}
                  {p.required_return_bps !== null && (
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="text-muted-foreground">{tr({ en: "Asks for its capital", pt: "Pede pelo capital dele" })}</dt>
                      <dd className="num text-foreground">
                        {(p.required_return_bps / 100).toFixed(1)}% {tr({ en: "a year", pt: "ao ano" })}
                        <span className="text-muted-foreground"> {tr({ en: "· before expected loss, cost to serve and the cost of moving it", pt: "· antes da perda esperada, do custo de servir e do custo de mover" })}</span>
                      </dd>
                    </div>
                  )}
                  {p.reporting_requirements.length > 0 && (
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="flex items-center gap-1.5 text-muted-foreground">
                        <FileCheck2 size={12} aria-hidden /> {tr({ en: "Wants back", pt: "Quer de volta" })}
                      </dt>
                      <dd className="text-foreground">{p.reporting_requirements.map(reportingLabel).join(", ")}</dd>
                    </div>
                  )}
                  {p.partner_id && (
                    <div className="flex items-center gap-1.5 pt-0.5 text-info">
                      <Handshake size={12} aria-hidden />
                      <dt className="sr-only">{tr({ en: "Approving partner", pt: "Parceiro que aprova" })}</dt>
                      <dd>{tr({ en: "Also an approving counterparty on the partner desk", pt: "Também é contraparte que aprova na mesa de parceiros" })}</dd>
                    </div>
                  )}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
