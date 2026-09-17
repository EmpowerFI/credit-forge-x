import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HOME, type Lang } from "./copy";

const HomeHero = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].hero;
  return (
    <section className="relative flex min-h-[88vh] items-center overflow-hidden gradient-subtle">
      <div className="absolute -right-24 -top-32 h-[30rem] w-[30rem] rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute -bottom-24 left-1/4 h-[24rem] w-[24rem] rounded-full bg-primary/5 blur-3xl" />
      <div className="container relative mx-auto px-4 pb-16 pt-28">
        <div className="mx-auto max-w-4xl">
          <div className="space-y-7">
            <div className="inline-flex animate-fade-in items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-accent opacity-0 glow-border">
              <span className="h-2 w-2 animate-pulse-glow rounded-full bg-accent" />
              {t.badge}
            </div>
            <h1 className="section-title !text-4xl !leading-[1.08] opacity-0 animate-fade-in-delay-1 md:!text-6xl">
              {t.title} <span className="text-gradient">{t.accent}</span>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground opacity-0 animate-fade-in-delay-2 md:text-xl">{t.body}</p>
            <div className="space-y-4 pt-2 opacity-0 animate-fade-in-delay-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link to={`/app?lang=${lang}`}>{t.explore} <ArrowUpRight size={18} /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="gap-2 border-primary/40 text-foreground hover:bg-primary/10">
                  <a href="#contact">{t.partner} <ArrowRight size={18} /></a>
                </Button>
              </div>
              <div className="space-y-1.5">
                {t.status.map((line) => (
                  <p key={line} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 animate-pulse-glow rounded-full bg-accent" />
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeHero;
