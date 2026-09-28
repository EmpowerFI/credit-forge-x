import { useQuery } from "@tanstack/react-query";
import { Banknote, Coins, Landmark, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Cite from "../../../components/product/Cite";
import Panel from "../../../components/product/Panel";
import StatTile from "../../../components/product/StatTile";
import { formatNumber, localized, tr } from "../../../i18n";
import { share } from "../../../lib/localEconomy";
import { fetchReferencePoints, pointOf, referencePointsKey, type Benchmark } from "../../../lib/referencePoints";

// Where this product stands, in four numbers none of which are its own.
//
// The objection a local currency always draws is "you invented money", and the
// answer is not a paragraph about our design — it is that Brazil has been doing
// this since 1998, at scale, under regulation, and that the thing it runs short
// of is capital rather than infrastructure. Which makes the honest claim a
// small one: this is a capital layer for somebody else's rail.
//
// So the four figures are cited and linked, and a figure whose citation is
// missing is left out rather than printed bare. A number published under
// another organisation's name is the one kind of number on these screens that a
// mistake turns into a misquotation.

// localized(), not tr(): a label resolved in a module-level constant freezes in
// whatever language happened to be set when the module loaded, and switching
// language would leave these four tiles behind. The value functions run at
// render, so tr() inside one is read at the right moment.
const FIGURES: { key: string; icon: typeof Landmark; label: string; value: (b: Benchmark) => string }[] = localized([
  {
    key: "bcd_count",
    icon: Landmark,
    label: { en: "Community development banks in Brazil", pt: "Bancos comunitários de desenvolvimento no Brasil" },
    value: (b: Benchmark) => formatNumber(b.value_count ?? 0),
  },
  {
    key: "mumbuca_users",
    icon: Users,
    label: { en: "People paying with the Mumbuca, in one city", pt: "Pessoas pagando com a Mumbuca, numa cidade só" },
    value: (b: Benchmark) => formatNumber(b.value_count ?? 0),
  },
  {
    key: "pnmpo_portfolio",
    icon: Banknote,
    label: { en: "Oriented productive microcredit outstanding", pt: "Carteira de microcrédito produtivo orientado" },
    value: (b: Benchmark) => tr({
      en: `R$ ${formatNumber((b.value_cents ?? 0) / 100 / 1e9, { maximumFractionDigits: 2 })} bn`,
      pt: `R$ ${formatNumber((b.value_cents ?? 0) / 100 / 1e9, { maximumFractionDigits: 2 })} bi`,
    }),
  },
  {
    key: "women_default_advantage",
    icon: Coins,
    label: { en: "Less default among women borrowers", pt: "Menos inadimplência entre tomadoras" },
    value: (b: Benchmark) => share(b.value_bps ?? 0),
  },
]);

export default function Positioning() {
  const q = useQuery({ queryKey: referencePointsKey, queryFn: fetchReferencePoints, staleTime: 60 * 60 * 1000 });
  // A panel that cannot cite anything has nothing to say, and an error here is
  // not worth interrupting the loop above it.
  if (q.isError) return null;

  return (
    <Panel
      title={tr({ en: "Brazil already has this rail", pt: "O Brasil já tem esse trilho" })}
      description={tr({
        en: "Not one of the four figures below is ours.",
        pt: "Nenhum dos quatro números abaixo é nosso.",
      })}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {q.isPending
          ? FIGURES.map((f) => <Skeleton key={f.key} className="h-24 rounded-2xl bg-card" />)
          : FIGURES.map((f) => {
            const b = pointOf(q.data, f.key);
            if (!b) return null;
            const Icon = f.icon;
            return (
              <StatTile
                key={f.key}
                label={f.label}
                value={f.value(b)}
                hint={<Cite b={b} />}
                icon={<Icon size={14} aria-hidden />}
              />
            );
          })}
      </div>

      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          {tr({
            en: "Community development banks have issued local currencies in Brazil since Banco Palmas in 1998, and oriented productive microcredit is a regulated national programme with a rate ceiling of 4% a month. The rail is built, it is supervised, and the communities running it are trusted by the people who live there. None of that is a thing a hackathon invents.",
            pt: "Bancos comunitários de desenvolvimento emitem moeda local no Brasil desde o Banco Palmas, em 1998, e o microcrédito produtivo orientado é um programa nacional regulado, com teto de juros de 4% ao mês. O trilho está construído, é supervisionado, e as comunidades que o operam têm a confiança de quem mora ali. Nada disso é coisa que um hackathon invente.",
          })}
        </p>
        <p className="text-foreground">
          {tr({
            en: "What the rail does not have is capital. That portfolio is how far Brazilian capital reaches, and it stops where domestic liquidity stops — which is the residual the allocation engine keeps arriving at. EmpowerFI is not a currency and issues none: it is the layer that lets capital from outside reach a rail somebody else already built. The four movements above are what that looks like when it works.",
            pt: "O que falta ao trilho é capital. Aquela carteira é até onde o capital brasileiro alcança, e ela para onde a liquidez doméstica para — que é justamente o resíduo em que o motor de alocação não para de chegar. A EmpowerFI não é uma moeda e não emite nenhuma: é a camada que faz o capital de fora alcançar um trilho que outra gente já construiu. Os quatro movimentos acima são como isso fica quando funciona.",
          })}
        </p>
      </div>
    </Panel>
  );
}
