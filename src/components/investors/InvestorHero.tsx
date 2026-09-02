import { ArrowDown, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const InvestorHero = () => (
  <section className="relative overflow-hidden gradient-subtle">
    <div className="absolute -right-24 -top-32 h-[30rem] w-[30rem] rounded-full bg-accent/10 blur-3xl" />
    <div className="absolute -bottom-32 left-1/4 h-[24rem] w-[24rem] rounded-full bg-primary/5 blur-3xl" />

    <div className="container relative mx-auto px-4 pb-20 pt-32 md:pb-28 md:pt-40">
      <div className="mx-auto max-w-3xl space-y-7 text-center">
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-accent glow-border">
          <span className="h-2 w-2 animate-pulse-glow rounded-full bg-accent" />
          Pilot in preparation · Brazil
        </div>

        <h1 className="section-title !text-4xl !leading-[1.08] md:!text-6xl">
          Put stablecoins to work in{" "}
          <span className="text-gradient">the real economy.</span>
        </h1>

        <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
          Join the waitlist for EmpowerFI's first productive microcredit pilot connecting
          global capital with women-led microbusinesses in Brazil.
        </p>

        <div className="flex justify-center pt-1">
          <Button
            asChild
            size="lg"
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link to="/investors#waitlist">
              Join the Investor Waitlist <ArrowDown size={18} />
            </Link>
          </Button>
        </div>

        {/* Kept immediately visible, above the fold, not buried in the footer. */}
        <div className="mx-auto flex max-w-2xl items-start gap-3 rounded-xl border border-border bg-card/70 p-5 text-left">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <p className="text-sm leading-relaxed text-muted-foreground">
            The waitlist represents non-binding interest only. EmpowerFI is not currently
            offering securities, investment products or accepting investor funds through
            this page.
          </p>
        </div>
      </div>
    </div>
  </section>
);

export default InvestorHero;
