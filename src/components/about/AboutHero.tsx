import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/config/links";
import type { AboutContent } from "@/content/about";

const AboutHero = ({ hero }: { hero: AboutContent["hero"] }) => (
  <section className="relative flex items-center overflow-hidden gradient-subtle pt-28 pb-20 md:pt-36 md:pb-28">
    {/* Same decorative brand glows as the home hero, at a calmer scale — this
        page opens a document, it does not have to shout. */}
    <div className="absolute -top-32 -right-24 w-[30rem] h-[30rem] rounded-full bg-accent/10 blur-3xl" />
    <div className="absolute -bottom-24 left-1/4 w-[24rem] h-[24rem] rounded-full bg-primary/5 blur-3xl" />

    <div className="relative container mx-auto px-4">
      <div className="max-w-3xl space-y-7">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glow-border text-xs text-accent font-medium opacity-0 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
          {hero.badge}
        </div>

        <h1 className="section-title !text-4xl md:!text-6xl !leading-[1.08] opacity-0 animate-fade-in-delay-1">
          {hero.titleLead}
          <span className="text-gradient">{hero.titleAccent}</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl opacity-0 animate-fade-in-delay-2">
          {hero.subtitle}
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-2 opacity-0 animate-fade-in-delay-3">
          <Button asChild size="lg" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
            <a href="#contato">
              {hero.primaryCta} <ArrowRight size={18} />
            </a>
          </Button>
          {/* Two buttons, not one: a single "see the app" had to pick a store,
              and it was picking Android for everyone who read it. */}
          {[["Google Play", PLAY_STORE_URL], ["App Store", APP_STORE_URL]].map(([label, href]) => (
            <Button key={label} asChild size="lg" variant="outline" className="border-primary/40 text-foreground hover:bg-primary/10 gap-2">
              <a href={href} target="_blank" rel="noopener noreferrer">
                {hero.secondaryCta} · {label} <ExternalLink size={16} />
              </a>
            </Button>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default AboutHero;
