import { ExternalLink } from "lucide-react";
import SupportLogo from "@/components/SupportLogo";
import type { AboutContent } from "@/content/about";

const AboutRecognitions = ({ recognitions }: { recognitions: AboutContent["recognitions"] }) => (
  <section id="reconhecimentos" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">{recognitions.eyebrow}</p>
        <h2 className="section-title">
          {recognitions.titleLead}
          <span className="text-gradient">{recognitions.titleAccent}</span>
        </h2>
        <p className="section-subtitle">{recognitions.subtitle}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {recognitions.items.map(({ icon: Icon, title, desc, href, linkLabel, logo }) => (
          <div key={title} className="glass rounded-2xl p-8 glow-border flex flex-col">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
              <Icon className="text-primary-foreground" size={24} />
            </div>
            <h3 className="text-lg font-heading font-bold text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground leading-relaxed flex-1">{desc}</p>
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-foreground transition-colors"
              >
                {linkLabel} <ExternalLink size={14} />
              </a>
            )}
            {logo && <SupportLogo {...logo} />}
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default AboutRecognitions;
