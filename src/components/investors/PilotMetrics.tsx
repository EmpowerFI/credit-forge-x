import { Activity, Banknote, Coins, PieChart, Store, Undo2 } from "lucide-react";

// No values, by design. Nothing here gets a number until a real pilot produces
// one — and anything shown from the devnet build must be labelled as such.
const metrics = [
  {
    icon: Banknote,
    label: "Productive Capital Deployed",
    hint: "Total capital placed into productive credit.",
  },
  {
    icon: Coins,
    label: "Productive Stablecoin Volume",
    hint: "Stablecoin activity deployed into real economic activity.",
  },
  {
    icon: Store,
    label: "Businesses Funded",
    hint: "Microbusinesses that received productive credit.",
  },
  {
    icon: PieChart,
    label: "Repayment Rate",
    hint: "Share of scheduled repayments performed.",
  },
  {
    icon: Undo2,
    label: "Capital Repaid",
    hint: "Capital returned and available to redeploy.",
  },
  {
    icon: Activity,
    label: "Average Productive Loan",
    hint: "Typical ticket size across funded businesses.",
  },
];

const PilotMetrics = () => (
  <section id="metrics" className="section-padding">
    <div className="container mx-auto space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            Pilot metrics
          </p>
          <h2 className="section-title !text-3xl md:!text-4xl">
            What we will report, <span className="text-gradient">once it is real.</span>
          </h2>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-accent glass glow-border">
          <span className="h-2 w-2 animate-pulse-glow rounded-full bg-accent" />
          Coming soon
        </span>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(({ icon: Icon, label, hint }) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-card/60 p-6 transition-colors hover:border-accent/40"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <dt className="font-heading text-sm font-semibold text-foreground">{label}</dt>
              <Icon size={18} className="shrink-0 text-accent" aria-hidden />
            </div>
            <dd>
              <p
                className="font-heading text-4xl font-bold tracking-tight text-muted-foreground/40"
                aria-label="No data yet"
              >
                —
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>
            </dd>
          </div>
        ))}
      </dl>

      <p className="rounded-xl border border-border bg-card/50 p-5 text-sm leading-relaxed text-muted-foreground">
        This area becomes the Public Investor Dashboard once the pilot runs. Until then it
        carries no figures — and any data shown from a pre-production build will be labelled{" "}
        <span className="font-medium text-foreground">Demo / Solana Devnet</span> on the
        page itself.
      </p>
    </div>
  </section>
);

export default PilotMetrics;
