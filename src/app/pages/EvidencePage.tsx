import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../components/LoadError";
import DataLegend from "../components/product/DataLegend";
import EvidenceTag, { EvidenceLegend } from "../components/product/EvidenceTag";
import PageHeader from "../components/product/PageHeader";
import Panel from "../components/product/Panel";
import StatTile from "../components/product/StatTile";
import { tr } from "../i18n";
import { prototypeNotice } from "../lib/capital";
import { EVIDENCE } from "../lib/evidence";
import { evidenceKey, FAMILY, fetchEvidenceLedger, type Family } from "../lib/evidenceLedger";
import { REALITY, type Reality } from "../lib/settlement";

// What every number in this product is made of (addendum v3 §9).
//
// The addendum asks that every figure carry one of four evidence labels. Taken
// literally that is a pill beside two hundred tiles, and a word repeated on
// every tile is wallpaper — a reader learns nothing from something that never
// varies. So each screen states what kind of numbers it holds, and this page
// states it for the product: family by family, derived from the rows rather
// than declared, which is why it tells a different and still true story on a
// deployment that has confirmed a Solana transaction and one that has not.
//
// It also says out loud that three vocabularies live here and are not the same
// axis. Three sets of pills invite the assumption that they are synonyms, and
// they are not: a figure can be Derived, Simulated and unanchored all at once,
// and each of those words answers a different question.

function FamilyRow({ f }: { f: Family }) {
  const meta = FAMILY[f.key];
  return (
    <li className="min-w-0 space-y-1.5 border-b border-border/60 pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="min-w-0 font-heading text-sm font-bold text-foreground">{meta.title}</h3>
        <EvidenceTag label={f.evidence} />
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{meta.what}</p>
      <p className="num text-xs text-muted-foreground">
        {f.rows === 0
          ? tr({ en: `No ${meta.unit} recorded yet`, pt: `Nenhum registro de ${meta.unit} ainda` })
          : tr({
            en: `${f.rows} ${meta.unit}${f.real_rows > 0 ? `, ${f.real_rows} of them not this prototype's invention` : ""}`,
            pt: `${f.rows} ${meta.unit}${f.real_rows > 0 ? `, ${f.real_rows} deles não inventados por este protótipo` : ""}`,
          })}
      </p>
    </li>
  );
}

export default function EvidencePage() {
  const ledger = useQuery({ queryKey: evidenceKey, queryFn: fetchEvidenceLedger, staleTime: 60_000 });
  const d = ledger.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr({ en: "What every number here is made of", pt: "De que é feito cada número daqui" })}
        description={tr({
          en: "Four words for how strong a claim a figure makes, and which one each family of figures in this product carries.",
          pt: "Quatro palavras para a força da afirmação que um número faz, e qual delas cada família de números deste produto carrega.",
        })}
        meta={d ? <EvidenceTag label={d.weakest} /> : undefined}
        about={
          <>
            <p>
              {tr({
                en: "Nothing on this page is a declaration. Each family's label is derived from its own rows, so a deployment that has confirmed a Solana transaction says so and one that has not says that instead — and both are true of the thing you are actually looking at.",
                pt: "Nada nesta página é uma declaração. O rótulo de cada família é derivado das próprias linhas, então uma instalação que confirmou uma transação na Solana diz isso e uma que não confirmou diz o contrário — e as duas são verdadeiras sobre aquilo que você está de fato olhando.",
              })}
            </p>
            <p>
              {tr({
                en: "A label travels upwards, never downwards: a figure computed from a simulated month is a simulated figure however carefully it was computed. That is why readiness cannot be stronger than the check-ins under it, and why the product as a whole may claim only what its weakest family claims.",
                pt: "Um rótulo sobe, nunca desce: um número calculado a partir de um mês simulado é um número simulado, por mais cuidadoso que tenha sido o cálculo. É por isso que a prontidão não pode ser mais forte que os check-ins abaixo dela, e por isso o produto como um todo só pode afirmar o que a família mais fraca dele afirma.",
              })}
            </p>
            <p>{prototypeNotice()}</p>
          </>
        }
      />

      {ledger.error ? (
        <LoadError error={ledger.error} onRetry={() => void ledger.refetch()} />
      ) : !d ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              label={tr({ en: "What this product may claim", pt: "O que este produto pode afirmar" })}
              value={EVIDENCE[d.weakest].label}
              hint={tr({ en: "its weakest family, and no more", pt: "a família mais fraca dele, e nada além" })}
              hintTone={EVIDENCE[d.weakest].tone}
            />
            <StatTile
              label={tr({ en: "Families of figures", pt: "Famílias de números" })}
              value={d.families_total}
              hint={tr({ en: "each labelled from its own rows", pt: "cada uma rotulada pelas próprias linhas" })}
            />
            <StatTile
              label={tr({ en: "Families that are observed", pt: "Famílias observadas" })}
              value={d.observed_families}
              hint={d.observed_families === 0
                ? tr({ en: "nothing here has been observed yet", pt: "nada aqui foi observado ainda" })
                : tr({ en: "recorded doing the thing they describe", pt: "registradas fazendo aquilo que descrevem" })}
              hintTone={d.observed_families > 0 ? "positive" : "caution"}
            />
          </div>

          <Panel
            title={tr({ en: "The four words", pt: "As quatro palavras" })}
            description={tr({
              en: "The addendum's vocabulary, used here for how strong a claim a number makes.",
              pt: "O vocabulário do adendo, usado aqui para a força da afirmação que um número faz.",
            })}
          >
            <EvidenceLegend linked={false} />
          </Panel>

          <Panel
            title={tr({ en: "Family by family", pt: "Família por família" })}
            description={tr({
              en: "Every kind of figure this product holds, and what kind of claim it is.",
              pt: "Todo tipo de número que este produto guarda, e que tipo de afirmação ele é.",
            })}
          >
            <ul className="space-y-4">
              {d.families.map((f) => <FamilyRow key={f.key} f={f} />)}
            </ul>
          </Panel>

          {/* Three vocabularies, three questions. Saying so once here is
              cheaper than a reader guessing they are synonyms on every screen. */}
          <Panel
            title={tr({ en: "Three marks, three different questions", pt: "Três marcas, três perguntas diferentes" })}
            description={tr({
              en: "They look alike and they do not mean the same thing. A figure can wear one of each at the same time.",
              pt: "Elas se parecem e não querem dizer a mesma coisa. Um número pode usar uma de cada ao mesmo tempo.",
            })}
          >
            <div className="grid gap-6 lg:grid-cols-3">
              <section className="min-w-0 space-y-2">
                <h3 className="font-heading text-sm font-bold text-foreground">
                  {tr({ en: "How strong is the claim?", pt: "Quão forte é a afirmação?" })}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {tr({ en: "The four words above. This is the addendum's axis.", pt: "As quatro palavras acima. Este é o eixo do adendo." })}
                </p>
              </section>
              <section className="min-w-0 space-y-2">
                <h3 className="font-heading text-sm font-bold text-foreground">
                  {tr({ en: "Who may see it, and is it proven?", pt: "Quem pode ver, e está provado?" })}
                </h3>
                <DataLegend compact />
              </section>
              <section className="min-w-0 space-y-2">
                <h3 className="font-heading text-sm font-bold text-foreground">
                  {tr({ en: "Is the rail actually running?", pt: "O trilho está mesmo rodando?" })}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {tr({
                    en: "Finer than four words on purpose: a devnet transaction and a partner's sandbox quote are both “not production” and are not the same kind of claim.",
                    pt: "Mais fino que quatro palavras de propósito: uma transação na devnet e uma cotação de sandbox de um parceiro são ambas “fora de produção” e não são o mesmo tipo de afirmação.",
                  })}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {(["real", "zcash", "sandbox", "simulated", "mock", "indicative"] as Reality[]).map((r) => (
                    <li key={r} className={`rounded-full border px-2.5 py-0.5 text-xs font-medium tone-${REALITY[r].tone}`}>
                      {REALITY[r].label}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
