import { Banknote, Brain, Building2, LineChart } from "lucide-react";
import SectionHeading from "./SectionHeading";

const lines = [
  {
    icon: Banknote,
    title: "Credit Infrastructure",
    desc: "Technology and servicing infrastructure for productive credit portfolios.",
  },
  {
    icon: LineChart,
    title: "Impact as a Service",
    desc: "Economic monitoring and impact measurement for companies, foundations and impact programs.",
  },
  {
    icon: Brain,
    title: "Credit Intelligence",
    desc: "Alternative underwriting and business-performance intelligence.",
  },
  {
    icon: Building2,
    title: "Institutional Infrastructure",
    desc: "Technology for financial institutions and public or private entrepreneurship programs.",
  },
];

const BusinessModelSectionEn = () => (
  <section id="business-model" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Business model"
        title="Infrastructure that scales"
        accent="with productive capital."
        subtitle="Four lines of business built on the same infrastructure — each one stronger as more productive capital moves through it."
      />

      <div className="grid gap-6 sm:grid-cols-2">
        {lines.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-2xl p-8 glow-border">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={22} />
            </div>
            <h3 className="mb-2 font-heading text-lg font-bold text-foreground">{title}</h3>
            <p className="leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default BusinessModelSectionEn;
