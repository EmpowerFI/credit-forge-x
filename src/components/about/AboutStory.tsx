import { Quote } from "lucide-react";
import type { AboutContent } from "@/content/about";

const AboutStory = ({ story }: { story: AboutContent["story"] }) => (
  <section id="historia" className="section-padding">
    <div className="container mx-auto max-w-4xl space-y-10">
      <div className="space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">{story.eyebrow}</p>
        <h2 className="section-title">
          {story.titleLead}
          <span className="text-gradient">{story.titleAccent}</span>
        </h2>
      </div>

      <div className="space-y-6">
        {/* The opening paragraph carries the whole thesis — size it so a skimming
            reader gets the point without reading the other three. */}
        {story.paragraphs.map((p, i) => (
          <p
            key={p.slice(0, 32)}
            className={
              i === 0
                ? "text-lg md:text-xl text-foreground leading-relaxed"
                : "text-muted-foreground leading-relaxed"
            }
          >
            {p}
          </p>
        ))}
      </div>

      <figure className="glass rounded-2xl p-8 md:p-10 glow-border shadow-glow">
        <Quote className="text-accent mb-4" size={28} aria-hidden="true" />
        <blockquote className="font-heading text-xl md:text-2xl font-bold text-foreground leading-snug">
          {story.pullQuote}
        </blockquote>
      </figure>
    </div>
  </section>
);

export default AboutStory;
