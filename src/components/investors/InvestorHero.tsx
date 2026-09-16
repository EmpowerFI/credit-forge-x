import { ArrowDown, ArrowUpRight, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { investorCopy, type InvestorLang } from "@/components/investors/copy";

interface InvestorHeroProps {
  lang: InvestorLang;
  /** This page's own path, so the waitlist anchor stays on the same page. */
  path: string;
}

const InvestorHero = ({ lang, path }: InvestorHeroProps) => {
  const t = investorCopy[lang].hero;

  return (
    <section className="relative overflow-hidden gradient-subtle">
      <div className="absolute -right-24 -top-32 h-[30rem] w-[30rem] rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute -bottom-32 left-1/4 h-[24rem] w-[24rem] rounded-full bg-primary/5 blur-3xl" />

      <div className="container relative mx-auto px-4 pb-20 pt-32 md:pb-28 md:pt-40">
        <div className="mx-auto max-w-3xl space-y-7 text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-accent glow-border">
            <span className="h-2 w-2 animate-pulse-glow rounded-full bg-accent" />
            {t.badge}
          </div>

          <h1 className="section-title !text-4xl !leading-[1.08] md:!text-6xl">
            {t.titleLead} <span className="text-gradient">{t.titleAccent}</span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            {t.subtitle}
          </p>

          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Link to={`${path}#waitlist`}>
                  {t.ctaWaitlist} <ArrowDown size={18} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2">
                {/* The app opens in the language of the page it is launched from. */}
                <Link to={`/app?lang=${lang}`}>
                  {t.ctaApp} <ArrowUpRight size={18} />
                </Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{t.appNote}</p>
          </div>

          {/* Kept immediately visible, above the fold, not buried in the footer. */}
          <div className="mx-auto flex max-w-2xl items-start gap-3 rounded-xl border border-border bg-card/70 p-5 text-left">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <p>{t.disclaimer}</p>
              <p>{t.notOffer}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InvestorHero;
