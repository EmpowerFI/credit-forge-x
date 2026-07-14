import { Instagram, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOUNDER_LINKEDIN_URL } from "@/config/company";
import { INSTAGRAM_URL } from "@/config/links";
import type { AboutContent } from "@/content/about";

interface AboutFounderProps {
  founder: AboutContent["founder"];
  /** Imported founder portrait. Falls back to a monogram when absent. */
  photoSrc?: string;
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter((part) => part.length > 2)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const AboutFounder = ({ founder, photoSrc }: AboutFounderProps) => (
  <section id="fundadora" className="section-padding">
    <div className="container mx-auto max-w-5xl">
      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-10 md:gap-14 items-center">
        {/* Capped at the portrait's native 266px rather than filling the column:
            the only copy of this photo we have is small, and upscaling it reads
            as sloppy. Widen this once a higher-resolution original exists. */}
        <div className="mx-auto w-full max-w-[266px]">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={founder.photoAlt}
              width={266}
              height={266}
              loading="lazy"
              className="aspect-square w-full rounded-2xl object-cover glow-border shadow-glow"
            />
          ) : (
            <div
              role="img"
              aria-label={founder.photoAlt}
              className="aspect-square w-full rounded-2xl glass glow-border shadow-glow flex items-center justify-center"
            >
              <span className="font-heading text-6xl font-bold text-gradient">
                {initials(founder.name)}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <p className="text-sm font-medium text-accent uppercase tracking-widest">{founder.eyebrow}</p>
          <div className="space-y-1">
            <h2 className="section-title !text-3xl md:!text-4xl">{founder.name}</h2>
            <p className="font-heading text-lg text-accent">{founder.role}</p>
          </div>

          {founder.paragraphs.map((p) => (
            <p key={p.slice(0, 32)} className="text-muted-foreground leading-relaxed">
              {p}
            </p>
          ))}

          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild variant="outline" className="border-primary/40 text-foreground hover:bg-primary/10 gap-2">
              <a href={FOUNDER_LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
                <Linkedin size={16} /> {founder.linkedinLabel}
              </a>
            </Button>
            <Button asChild variant="outline" className="border-primary/40 text-foreground hover:bg-primary/10 gap-2">
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                <Instagram size={16} /> {founder.instagramLabel}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default AboutFounder;
