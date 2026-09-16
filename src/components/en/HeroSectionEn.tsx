import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CapitalStack from "./CapitalStack";

const HeroSectionEn = () => (
  <section className="relative flex min-h-screen items-center overflow-hidden gradient-subtle">
    {/* Decorative brand glows. */}
    <div className="absolute -right-24 -top-32 h-[30rem] w-[30rem] rounded-full bg-accent/10 blur-3xl" />
    <div className="absolute -bottom-24 left-1/4 h-[24rem] w-[24rem] rounded-full bg-primary/5 blur-3xl" />

    <div className="container relative mx-auto px-4 pb-16 pt-28">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-16">
        <div className="space-y-7">
          <div className="inline-flex animate-fade-in items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-accent opacity-0 glow-border">
            <span className="h-2 w-2 animate-pulse-glow rounded-full bg-accent" />
            P2P productive credit · Brazil first
          </div>

          <h1 className="section-title !text-4xl !leading-[1.08] opacity-0 animate-fade-in-delay-1 md:!text-6xl">
            From readiness{" "}
            <span className="text-gradient">to capital.</span>
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground opacity-0 animate-fade-in-delay-2 md:text-xl">
            EmpowerFI is P2P productive credit for women micro-entrepreneurs in Brazil, from
            readiness to capital, with every step proven on Solana. Communities prepare the
            businesses; in the P2P model, two pools of investors — in reais and in USDC — fund
            the ones that are ready and choose to ask.
          </p>

          <div className="space-y-4 pt-2 opacity-0 animate-fade-in-delay-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <a href="#problem">
                  Explore EmpowerFI <ArrowRight size={18} />
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="gap-2 border-primary/40 text-foreground hover:bg-primary/10"
              >
                <Link to="/investors">Join the Investor Waitlist</Link>
              </Button>
            </div>

            {/* Two phases, said apart: what runs today, and what the pilot will be. */}
            <div className="space-y-1.5">
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 animate-pulse-glow rounded-full bg-accent" />
                The P2P model runs today as a working prototype on Solana devnet, with simulated
                money.
              </p>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 animate-pulse-glow rounded-full bg-accent" />
                Our first pilot is being prepared in Brazil, with a regulated financial partner's
                capital.
              </p>
            </div>
          </div>
        </div>

        {/* Secondary to the headline on a phone, so it comes after the copy. */}
        <div className="opacity-0 animate-fade-in-delay-3">
          <CapitalStack />
        </div>
      </div>
    </div>
  </section>
);

export default HeroSectionEn;
