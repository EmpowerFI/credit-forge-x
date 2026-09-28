import { ArrowRight } from "lucide-react";
import Panel from "../../../components/product/Panel";
import StatusPill from "../../../components/product/StatusPill";
import { tr } from "../../../i18n";
import { LOCAL_TX, units, type LocalEconomyDashboard, type LocalMovement } from "../../../lib/localEconomy";

// The movements themselves, because every figure above is a sum of these rows
// and a dashboard that only shows its own totals is asking to be believed.

const BAR: Record<string, string> = {
  positive: "bg-positive", info: "bg-info", caution: "bg-caution", alert: "bg-alert", neutral: "bg-muted-foreground",
};

/** Who was on one side of a movement. Merchants are named; nobody else is. */
function side(type: LocalMovement["from_owner_type"], name: string | null) {
  if (name) return name;
  return type === "treasury"
    ? tr({ en: "Treasury", pt: "Tesouraria" })
    : tr({ en: "A business here", pt: "Um negócio daqui" });
}

function Movement({ m, code }: { m: LocalMovement; code: string }) {
  const kind = LOCAL_TX[m.tx_type];
  return (
    <li className="min-w-0 space-y-1 border-b border-border/60 py-2.5 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <StatusPill tone={kind.tone} dot={false}>{kind.label}</StatusPill>
          <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <span className="truncate">{side(m.from_owner_type, m.from_name)}</span>
            <ArrowRight size={12} className="shrink-0" aria-hidden />
            <span className="truncate">{side(m.to_owner_type, m.to_name)}</span>
          </span>
        </div>
        <p className="num shrink-0 text-sm font-medium text-foreground">{units(m.amount_units, code)}</p>
      </div>
      {m.note && <p className="text-xs text-muted-foreground">{m.note}</p>}
    </li>
  );
}

export default function Ledger({ d }: { d: LocalEconomyDashboard }) {
  const code = d.economy.currency_code;
  const widest = Math.max(0, ...d.by_type.map((t) => t.units));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel
        title={tr({ en: "How the capital moved", pt: "Como o capital se moveu" })}
        description={tr({
          en: "The six movements this rail knows, and which of them the ledger has actually exercised.",
          pt: "Os seis movimentos que este trilho conhece, e quais deles o razão de fato exerceu.",
        })}
      >
        {d.by_type.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tr({ en: "Nothing has moved on this rail yet.", pt: "Nada se moveu neste trilho ainda." })}
          </p>
        ) : (
          <ul className="space-y-3">
            {d.by_type.map((t) => {
              const kind = LOCAL_TX[t.tx_type];
              const width = widest > 0 ? Math.max(2, Math.round((t.units * 100) / widest)) : 0;
              return (
                <li key={t.tx_type} className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <p className="text-sm font-medium text-foreground">{kind.label}</p>
                    <p className="num shrink-0 text-sm text-foreground">{units(t.units, code)}</p>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="presentation">
                    <div className={`h-full rounded-full ${BAR[kind.tone]}`} style={{ width: `${width}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="num">
                      {t.movements === 1
                        ? tr({ en: "1 movement", pt: "1 movimento" })
                        : tr({ en: `${t.movements} movements`, pt: `${t.movements} movimentos` })}
                    </span>
                    {" · "}{kind.what}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel
        title={tr({ en: "The last movements", pt: "Os últimos movimentos" })}
        description={tr({
          en: "In the order the ledger numbered them. Merchants are named because they are businesses in a network; the other side is not.",
          pt: "Na ordem em que o razão os numerou. Comerciantes são nomeados porque são negócios de uma rede; o outro lado não é.",
        })}
      >
        {d.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tr({ en: "No movement has been recorded.", pt: "Nenhum movimento foi registrado." })}
          </p>
        ) : (
          <ul>
            {d.recent.map((m) => <Movement key={m.id} m={m} code={code} />)}
          </ul>
        )}
      </Panel>
    </div>
  );
}
