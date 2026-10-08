import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, CreditCard, Globe2, Lock, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import PageHeader from "../../components/product/PageHeader";
import Panel from "../../components/product/Panel";
import StatusPill from "../../components/product/StatusPill";
import { useAuth } from "../../auth/useAuth";
import { localized, tr } from "../../i18n";
import { platform } from "../../lib/platform";
import {
  type BecauseCode, type Fit, type GapCode, type Match, matchProducts, MATCHING_MODEL_VERSION,
  type ProductCategory,
} from "../../lib/products";
import { STATUS_LABEL, type ReadinessStatus } from "../../lib/readiness";

const FIT: Record<Fit, { label: string; tone: "positive" | "info" | "neutral" }> = localized({
  ready: { label: { en: "Ready", pt: "Pronta" }, tone: "positive" },
  potential: { label: { en: "Potential fit", pt: "Pode servir" }, tone: "info" },
  explore: { label: { en: "Explore", pt: "Conhecer" }, tone: "neutral" },
});

const CATEGORY: Record<ProductCategory, string> = localized({
  working_capital: { en: "Working capital", pt: "Capital de giro" },
  payments: { en: "Payment infrastructure", pt: "Infraestrutura de pagamentos" },
  cross_border: { en: "Cross-border · stablecoin", pt: "Transfronteiriço · stablecoin" },
});

const CATEGORY_ICON: Record<ProductCategory, typeof Wallet> = {
  working_capital: Wallet, payments: CreditCard, cross_border: Globe2,
};

const BECAUSE: Record<BecauseCode, string> = localized({
  READY_AND_ASKED: {
    en: "Your months show a business prepared for credit, and you have already asked.",
    pt: "Seus meses mostram um negócio preparado para crédito, e você já pediu.",
  },
  READY_NOT_ASKED: {
    en: "Your months show a business prepared for credit. Nothing happens unless you ask.",
    pt: "Seus meses mostram um negócio preparado para crédito. Nada acontece se você não pedir.",
  },
  MONTHS_BEING_RECORDED: {
    en: "Your months are being recorded, which is what this is read from.",
    pt: "Seus meses estão sendo registrados, que é de onde isso é lido.",
  },
  STEADY_AND_ORGANISED: {
    en: "You report every month and the numbers hold together — what a payments provider looks for.",
    pt: "Você informa todo mês e os números batem — o que uma provedora de pagamentos procura.",
  },
  REGULARITY_OPENS_IT: {
    en: "Months reported regularly are what opens this.",
    pt: "Meses informados com regularidade são o que abre isso.",
  },
  SALES_ARE_LOCAL: {
    en: "Your sales are local, so there is nothing to cross a border yet. Here if that changes.",
    pt: "Suas vendas são locais, então ainda não há o que atravessar fronteira. Fica aqui se isso mudar.",
  },
});

const GAP: Record<GapCode, (n?: number) => string> = {
  REQUIREMENTS_OPEN: (n = 0) => tr({
    en: `${n} requirement${n === 1 ? "" : "s"} still open on your readiness.`,
    pt: `${n} requisito${n === 1 ? "" : "s"} ainda em aberto na sua prontidão.`,
  }),
  ONE_MORE_MONTH: () => tr({ en: "One more month reported.", pt: "Mais um mês informado." }),
  A_FEW_MORE_MONTHS: () => tr({ en: "A few more months in a row.", pt: "Mais alguns meses seguidos." }),
};

/** The four parts her readiness is made of, each out of 25, as the engine computes them. */
const COMPONENT: { key: keyof Match["product"] extends never ? never : string; label: string }[] = localized([
  { key: "preparation", label: { en: "Preparation", pt: "Preparação" } },
  { key: "regularity", label: { en: "Regularity", pt: "Regularidade" } },
  { key: "data_quality", label: { en: "Record quality", pt: "Qualidade dos registros" } },
  { key: "business", label: { en: "Business", pt: "Negócio" } },
]);

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="num text-sm font-semibold text-foreground">{value}<span className="text-muted-foreground">/25</span></span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary/60">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (value / 25) * 100)}%` }} />
      </div>
    </li>
  );
}

function ProductCard({ m }: { m: Match }) {
  const Icon = CATEGORY_ICON[m.product.category];
  const fit = FIT[m.fit];
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {/* A placeholder rather than a logo: no provider here is real, and a
              borrowed mark would be the one thing on this page that lied. */}
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground" aria-hidden>
            <Building2 size={18} />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="font-heading text-base font-bold leading-tight text-foreground">{m.product.name}</p>
            <p className="text-xs text-muted-foreground">
              {m.product.provider} · {CATEGORY[m.product.category]}
            </p>
          </div>
        </div>
        <StatusPill tone={fit.tone} dot={false}>{fit.label}</StatusPill>
      </div>

      <p className="text-sm text-muted-foreground">{m.product.need}</p>
      <p className="flex items-start gap-2 rounded-lg bg-secondary/40 p-3 text-sm text-foreground">
        <Icon size={15} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          {BECAUSE[m.because]}
          {m.gap && <span className="mt-1 block text-xs text-muted-foreground">{GAP[m.gap](m.open_requirements)}</span>}
        </span>
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        <span className="text-xs text-muted-foreground">
          {m.product.provider_id === "efi-p2p"
            ? tr({ en: "This platform · nothing is applied for here", pt: "Esta plataforma · nada é solicitado aqui" })
            : tr({ en: "Fictional provider · nothing is applied for here", pt: "Provedora fictícia · nada é solicitado aqui" })}
        </span>
        {m.product.to
          ? (
            <Button asChild size="sm" className="gap-2">
              <Link to={m.product.to}>
                {tr({ en: "Explore financing", pt: "Explorar financiamento" })} <ArrowRight size={15} />
              </Link>
            </Button>
          )
          : <Button size="sm" variant="secondary" disabled>{tr({ en: "Not connected", pt: "Sem integração" })}</Button>}
      </div>
    </li>
  );
}

/**
 * What her months already qualify her for, elsewhere.
 *
 * The third stage of the journey: the sponsor sees the programme, she reports
 * her months, those months are matched against financial products, and the one
 * this platform can answer leads into the capital flow that already exists.
 *
 * Everything here is read from the readiness assessment her own check-ins
 * produced — the same score the rest of the product shows, never a second one
 * invented for this screen.
 */
export default function FinancialOpportunities() {
  const { profile } = useAuth();
  const me = useQuery({
    queryKey: ["platform", "me", profile?.id],
    enabled: Boolean(profile),
    queryFn: async () => {
      const { data, error } = await platform
        .from("entrepreneurs").select("id, business_name").eq("profile_id", profile!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const id = me.data?.id;
  const state = useQuery({
    queryKey: ["platform", "my-readiness-and-intent", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [readiness, intent] = await Promise.all([
        platform.from("latest_readiness").select("*").eq("entrepreneur_id", id!).maybeSingle(),
        platform.from("credit_intents").select("id").eq("entrepreneur_id", id!).eq("status", "active").maybeSingle(),
      ]);
      if (readiness.error) throw readiness.error;
      if (intent.error) throw intent.error;
      return { readiness: readiness.data, has_request: Boolean(intent.data) };
    },
  });

  const r = state.data?.readiness as
    | { status: ReadinessStatus; score: number; components: Record<string, number>; missing_requirements: unknown[] }
    | null
    | undefined;

  const matches = useMemo(() => r ? matchProducts({
    status: r.status,
    components: {
      preparation: Number(r.components?.preparation ?? 0),
      regularity: Number(r.components?.regularity ?? 0),
      data_quality: Number(r.components?.data_quality ?? 0),
      business: Number(r.components?.business ?? 0),
    },
    missing: (r.missing_requirements ?? []).map((x) => String((x as { code?: string })?.code ?? x)),
    has_request: Boolean(state.data?.has_request),
  }) : [], [r, state.data?.has_request]);

  if (me.isError) return <LoadError error={me.error} onRetry={() => me.refetch()} />;
  if (state.isError) return <LoadError error={state.error} onRetry={() => state.refetch()} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={tr({ en: "Financial opportunities", pt: "Oportunidades financeiras" })}
        title={tr({ en: "What your months open", pt: "O que seus meses abrem" })}
        description={tr({
          en: "Your check-ins already say how the business is doing. Here is what that opens — here and elsewhere.",
          pt: "Seus check-ins já dizem como o negócio vai. Aqui está o que isso abre — aqui e em outros lugares.",
        })}
        about={tr({
          en: (
            <>
              <p>Matched by rules you can read, against the readiness your own check-ins produced. It is not machine learning and there is no second score: the figures here are the ones the rest of your pages show.</p>
              <p>Nothing here is an approval. Each provider decides with its own rules. No provider pays to appear, none is told you looked, and the order is by fit alone.</p>
              <p>The providers are invented for this prototype.</p>
            </>
          ),
          pt: (
            <>
              <p>Casado por regras que você pode ler, contra a prontidão que os seus próprios check-ins produziram. Não é machine learning e não há um segundo score: os números aqui são os mesmos das suas outras páginas.</p>
              <p>Nada aqui é aprovação. Cada provedora decide com as regras dela. Nenhuma paga para aparecer, nenhuma é avisada de que você olhou, e a ordem é só por adequação.</p>
              <p>As provedoras são inventadas para este protótipo.</p>
            </>
          ),
        })}
      />

      {!r ? (
        state.isLoading || me.isLoading
          ? <div className="space-y-4"><Skeleton className="h-40 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-xl" /></div>
          : (
            <Panel title={tr({ en: "Not yet", pt: "Ainda não" })}>
              <p className="text-sm text-muted-foreground">
                {tr({
                  en: "This opens after your first readiness assessment. Report a month, then ask for the assessment on My business.",
                  pt: "Isto abre depois da sua primeira avaliação de prontidão. Informe um mês e peça a avaliação em Meu negócio.",
                })}
              </p>
              <Button asChild className="mt-4 gap-2"><Link to="/app/me">{tr({ en: "My business", pt: "Meu negócio" })} <ArrowRight size={15} /></Link></Button>
            </Panel>
          )
      ) : (
        <>
          <Panel title={tr({ en: "What your readiness is made of", pt: "Do que a sua prontidão é feita" })}
            actions={<StatusPill tone="info" dot={false}>{STATUS_LABEL[r.status].title}</StatusPill>}
            description={tr({
              en: "The same assessment your business page shows, in its four parts. It says whether the business is prepared for a credit conversation — it is not a credit score and not a decision.",
              pt: "A mesma avaliação que a sua página do negócio mostra, nas suas quatro partes. Ela diz se o negócio está preparado para uma conversa sobre crédito — não é score de crédito nem decisão.",
            })}>
            <p className="num mb-4 font-heading text-3xl font-bold text-foreground">
              {r.score}<span className="text-lg text-muted-foreground">/100</span>
            </p>
            <ul className="space-y-3">
              {COMPONENT.map((c) => <Bar key={c.key} label={c.label} value={Number(r.components?.[c.key] ?? 0)} />)}
            </ul>
          </Panel>

          <section aria-labelledby="products" className="space-y-3">
            <h2 id="products" className="font-heading text-lg font-bold text-foreground">
              {tr({ en: "What this opens", pt: "O que isso abre" })}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {matches.map((m) => <ProductCard key={m.product.id} m={m} />)}
            </ul>
          </section>

          <p className="flex items-start gap-2.5 rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
            <Lock size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {tr({
                en: `Nothing on this page was sent anywhere. No provider is told you looked, none pays to be listed, and your business figures stay where they were. Matching model ${MATCHING_MODEL_VERSION}.`,
                pt: `Nada desta página foi enviado a lugar nenhum. Nenhuma provedora é avisada de que você olhou, nenhuma paga para ser listada, e os números do seu negócio ficam onde estavam. Modelo de casamento ${MATCHING_MODEL_VERSION}.`,
              })}
            </span>
          </p>
        </>
      )}
    </div>
  );
}
