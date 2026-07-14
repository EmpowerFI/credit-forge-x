import type { AboutContent } from "@/content/about";

const AboutValues = ({ values }: { values: AboutContent["values"] }) => (
  <section id="valores" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">{values.eyebrow}</p>
        <h2 className="section-title">
          {values.titleLead}
          <span className="text-gradient">{values.titleAccent}</span>
        </h2>
        <p className="section-subtitle">{values.subtitle}</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {values.items.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="glass rounded-xl p-8 glow-border hover:shadow-glow transition-shadow duration-300"
          >
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
              <Icon className="text-primary-foreground" size={22} />
            </div>
            <h3 className="font-heading font-bold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default AboutValues;
