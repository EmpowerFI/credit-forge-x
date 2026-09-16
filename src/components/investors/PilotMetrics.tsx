import { Activity, Banknote, PieChart, Store, Undo2, Users } from "lucide-react";
import { investorCopy, type InvestorLang } from "@/components/investors/copy";

// Icons by tile position, the same for both pools.
const tileIcons = [Banknote, Store, Activity, PieChart, Undo2, Users];

/**
 * The metrics an investor will see, split by pool: the domestic pool in reais
 * and the global pool in USDC are reported separately, never summed across
 * currencies.
 *
 * No values, by design. Nothing here gets a number until real P2P operations
 * produce one — and anything shown from the devnet build must be labelled as such.
 */
const PilotMetrics = ({ lang }: { lang: InvestorLang }) => {
  const t = investorCopy[lang].metrics;

  return (
    <section id="metrics" className="section-padding">
      <div className="container mx-auto space-y-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-widest text-accent">
              {t.eyebrow}
            </p>
            <h2 className="section-title !text-3xl md:!text-4xl">
              {t.titleLead} <span className="text-gradient">{t.titleAccent}</span>
            </h2>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-accent glass glow-border">
            <span className="h-2 w-2 animate-pulse-glow rounded-full bg-accent" />
            {t.badge}
          </span>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {t.pools.map((pool) => (
            <section key={pool.name} aria-label={pool.name} className="space-y-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-heading text-lg font-bold text-foreground">{pool.name}</h3>
                <p className="text-xs font-medium uppercase tracking-widest text-accent">
                  {pool.rail}
                </p>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                {t.tiles.map(({ label, hint }, i) => {
                  const Icon = tileIcons[i % tileIcons.length];
                  return (
                    <div
                      key={label}
                      className="rounded-2xl border border-border bg-card/60 p-6 transition-colors hover:border-accent/40"
                    >
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <dt className="font-heading text-sm font-semibold text-foreground">
                          {label}
                        </dt>
                        <Icon size={18} className="shrink-0 text-accent" aria-hidden />
                      </div>
                      <dd>
                        <p
                          className="font-heading text-4xl font-bold tracking-tight text-muted-foreground/40"
                          aria-label={t.noData}
                        >
                          —
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {hint}
                        </p>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}
        </div>

        <p className="rounded-xl border border-border bg-card/50 p-5 text-sm leading-relaxed text-muted-foreground">
          {t.noteBefore}{" "}
          <span className="font-medium text-foreground">{t.demoLabel}</span> {t.noteAfter}
        </p>
      </div>
    </section>
  );
};

export default PilotMetrics;
