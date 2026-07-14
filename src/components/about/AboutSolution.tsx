import type { AboutContent } from "@/content/about";

const AboutSolution = ({ solution }: { solution: AboutContent["solution"] }) => (
  <section id="solucao" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">{solution.eyebrow}</p>
        <h2 className="section-title">
          {solution.titleLead}
          <span className="text-gradient">{solution.titleAccent}</span>
        </h2>
        <p className="section-subtitle">{solution.subtitle}</p>
      </div>

      {/* A vertical rail rather than a card grid: the whole point of these five
          layers is that they are ordered, each feeding the next. */}
      <ol className="relative max-w-3xl mx-auto">
        {solution.steps.map(({ icon: Icon, title, desc, status, live }, i) => (
          <li key={title} className="relative flex gap-5 sm:gap-7 pb-10 last:pb-0">
            <div className="relative flex flex-col items-center shrink-0">
              <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center shadow-glow">
                <Icon className="text-primary-foreground" size={22} />
              </div>
              {i < solution.steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="w-px flex-1 mt-3 bg-gradient-to-b from-accent/40 to-accent/5"
                />
              )}
            </div>

            <div className="flex-1 pb-2">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="text-xs font-mono text-accent">0{i + 1}</span>
                <h3 className="text-xl font-heading font-bold text-foreground">{title}</h3>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    live ? "glow-border text-accent" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {live && <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-accent" />}
                  {status}
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export default AboutSolution;
