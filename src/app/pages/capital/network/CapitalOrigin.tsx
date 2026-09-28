import { Globe2, Handshake, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../../components/LoadError";
import Panel from "../../../components/product/Panel";
import StatTile from "../../../components/product/StatTile";
import StatusPill from "../../../components/product/StatusPill";
import { tr } from "../../../i18n";
import { INSTRUMENT_TYPE, type CapitalOrigin as Origin, type CapitalSource } from "../../../lib/capitalNetwork";
import { money } from "../../../lib/readiness";
import { useCapitalOrigin } from "./queries";

// Where the capital came from.
//
// The rest of this page counts routes — four open, two of them global — and a
// network whose routes are all equal on screen argues for nothing. The claim
// this product makes is that domestic capital has several sources rather than
// one pool, and that money from abroad is two different things: many investors
// each funding a share, and one fund lending on a mandate it wrote. Either the
// book shows that or it does not, and this is where it is checked.
//
// Over the latest plan recorded for each request, so a request routed twice
// counts once.

const pct = (bps: number) => `${(bps / 100).toFixed(1)}%`;

function Source({ s, widest }: { s: CapitalSource; widest: number }) {
  const kind = INSTRUMENT_TYPE[s.instrument_type];
  // Bars are relative to the largest source anywhere on the panel, not to the
  // whole book and not to the group: six routes of 8–29% against a full width
  // would all read as "almost nothing", and scaling each column to its own
  // largest would make a domestic bar and a global bar of equal length two
  // different amounts, side by side.
  const width = widest > 0 ? Math.max(2, Math.round((s.routed_cents * 100) / widest)) : 0;
  return (
    <li className="min-w-0 space-y-1.5 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{s.name}</p>
          <p className="text-xs text-muted-foreground">{kind.label} · {s.provider}</p>
        </div>
        <p className="num shrink-0 font-heading text-lg font-bold text-foreground">{money(s.routed_cents)}</p>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="presentation">
        <div className={`h-full rounded-full ${s.is_domestic ? "bg-positive" : "bg-info"}`} style={{ width: `${width}%` }} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="num">
          {pct(s.share_bps)} {tr({ en: "of the book", pt: "do livro" })}
          {" · "}
          {s.requests === 1
            ? tr({ en: "1 request", pt: "1 pedido" })
            : tr({ en: `${s.requests} requests`, pt: `${s.requests} pedidos` })}
        </span>
        {/* Two different kinds of number, never merged: a partner states what
            it has and nothing here draws that down, because a recommendation is
            not a drawdown; a pool's is arithmetic on its own book. */}
        <span className="num">
          {s.capacity_basis === "declared"
            ? tr({ en: `${money(s.capacity_cents)} stated, undrawn`, pt: `${money(s.capacity_cents)} declarados, sem baixa` })
            : tr({ en: `${money(s.capacity_cents)} left in the pool`, pt: `${money(s.capacity_cents)} restando no pool` })}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {!s.is_credit && <StatusPill tone="caution" dot={false}>{tr({ en: "Not credit", pt: "Não é crédito" })}</StatusPill>}
        {s.requires_partner_approval && (
          <StatusPill tone="info" dot={false}>
            <Handshake size={11} className="mr-0.5" aria-hidden /> {tr({ en: "Its owner still decides", pt: "O dono dela ainda decide" })}
          </StatusPill>
        )}
      </div>
    </li>
  );
}

function Group({ title, says, icon, sources, widest }: {
  title: string; says: string; icon: React.ReactNode; sources: CapitalSource[]; widest: number;
}) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="space-y-0.5">
        <h3 className="flex items-center gap-2 font-heading text-sm font-bold text-foreground">{icon}{title}</h3>
        <p className="text-xs text-muted-foreground">{says}</p>
      </div>
      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tr({ en: "No route on this side carried anything yet.", pt: "Nenhuma rota deste lado carregou nada ainda." })}
        </p>
      ) : (
        <ul className="space-y-3">
          {sources.map((s) => <Source key={s.code} s={s} widest={widest} />)}
        </ul>
      )}
    </section>
  );
}

function Body({ o }: { o: Origin }) {
  const share = (cents: number) => (o.routed_cents > 0 ? `${Math.round((cents * 100) / o.routed_cents)}%` : "—");
  const domestic = o.sources.filter((s) => s.is_domestic);
  const abroad = o.sources.filter((s) => !s.is_domestic);
  const widest = Math.max(0, ...o.sources.map((s) => s.routed_cents));
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <StatTile
          label={tr({ en: "Routed inside Brazil", pt: "Encaminhado dentro do Brasil" })}
          value={money(o.domestic_cents)}
          hint={tr({ en: `${share(o.domestic_cents)} of the book`, pt: `${share(o.domestic_cents)} do livro` })}
          hintTone="positive"
          icon={<MapPin size={14} aria-hidden />}
        />
        <StatTile
          label={tr({ en: "Routed from abroad", pt: "Encaminhado de fora do Brasil" })}
          value={money(o.global_cents)}
          hint={tr({ en: `${share(o.global_cents)} of the book`, pt: `${share(o.global_cents)} do livro` })}
          hintTone="info"
          icon={<Globe2 size={14} aria-hidden />}
        />
        <StatTile
          label={tr({ en: "Across plans", pt: "Em planos" })}
          value={o.plans}
          hint={tr({ en: `${money(o.requested_cents)} asked for`, pt: `${money(o.requested_cents)} pedidos` })}
        />
        <StatTile
          label={tr({ en: "Still without a route", pt: "Ainda sem rota" })}
          value={money(o.unfunded_cents)}
          hint={o.unfunded_cents > 0
            ? tr({ en: "qualified demand nothing reached", pt: "demanda qualificada que nada alcançou" })
            : tr({ en: "every plan was covered", pt: "todo plano foi coberto" })}
          hintTone={o.unfunded_cents > 0 ? "alert" : "positive"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Group
          title={tr({ en: "Domestic capital, and it is not one thing", pt: "Capital doméstico, e não é uma coisa só" })}
          says={tr({
            en: "A regional product, a microcredit line, an exchange that is not money, and people in Brazil lending in reais.",
            pt: "Um produto regional, uma linha de microcrédito, uma troca que não é dinheiro, e pessoas no Brasil emprestando em reais.",
          })}
          icon={<MapPin size={14} className="text-positive" aria-hidden />}
          sources={domestic}
          widest={widest}
        />
        <Group
          title={tr({ en: "Capital from abroad, and it is two things", pt: "Capital de fora, e são duas coisas" })}
          says={tr({
            en: "Many investors each funding a share of one loan, with nobody to approve it; and one fund lending from its own balance sheet, on a mandate it wrote.",
            pt: "Muitos investidores financiando cada um uma cota de um mesmo empréstimo, sem ninguém para aprovar; e um fundo emprestando do próprio balanço, com um mandato que ele escreveu.",
          })}
          icon={<Globe2 size={14} className="text-info" aria-hidden />}
          sources={abroad}
          widest={widest}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {tr({
          en: "Over the latest plan recorded for each request, so a request routed twice is counted once. These are recommendations, not drawdowns: nothing here moved money, and a partner's stated capacity is not reduced when a plan names it.",
          pt: "Sobre o plano mais recente registrado para cada pedido, então um pedido encaminhado duas vezes conta uma. São recomendações, não desembolsos: nada aqui moveu dinheiro, e a capacidade declarada de um parceiro não diminui quando um plano a nomeia.",
        })}
      </p>
    </>
  );
}

/** Where the capital came from, domestic sources and international sources apart. */
export default function CapitalOrigin() {
  const origin = useCapitalOrigin();

  return (
    <Panel
      id="origin"
      title={tr({ en: "Where the capital came from", pt: "De onde veio o capital" })}
      description={tr({
        en: "How much of everything the network has routed each source carried — the domestic ones and the two from abroad, told apart.",
        pt: "Quanto do que a rede já encaminhou cada fonte carregou — as domésticas e as duas de fora, separadas.",
      })}
      actions={<StatusPill tone="caution" dot={false}>{tr({ en: "Simulated", pt: "Simulado" })}</StatusPill>}
    >
      {origin.isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : origin.error ? (
        <LoadError error={origin.error} onRetry={() => void origin.refetch()} compact />
      ) : !origin.data || origin.data.plans === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tr({
            en: "No plan has been recorded yet, so there is no book to divide. Run the engine on a qualified request below and this fills in.",
            pt: "Nenhum plano foi registrado ainda, então não há livro para dividir. Rode o motor sobre um pedido qualificado abaixo e isto se preenche.",
          })}
        </p>
      ) : (
        <Body o={origin.data} />
      )}
    </Panel>
  );
}
