import type { AboutContent } from "@/content/about";

const AboutProblem = ({ problem }: { problem: AboutContent["problem"] }) => (
  <section id="problema" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">{problem.eyebrow}</p>
        <h2 className="section-title">
          {problem.titleLead}
          <span className="text-gradient">{problem.titleAccent}</span>
        </h2>
        <p className="section-subtitle">{problem.subtitle}</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        {problem.stats.map(({ value, label }) => (
          <div key={label} className="glass rounded-xl p-8 glow-border text-center">
            <p className="text-4xl md:text-5xl font-heading font-bold text-gradient mb-2">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {problem.items.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-2xl p-8 glow-border text-left">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
              <Icon className="text-primary-foreground" size={24} />
            </div>
            <h3 className="text-xl font-heading font-bold text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default AboutProblem;
