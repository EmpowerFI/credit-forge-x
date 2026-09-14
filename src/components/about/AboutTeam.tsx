import { Globe, Instagram, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOUNDER_LINKEDIN_URL } from "@/config/company";
import { INSTAGRAM_URL } from "@/config/links";
import type { AboutContent } from "@/content/about";

interface AboutTeamProps {
  team: AboutContent["team"];
  /** Imported founder portrait. Falls back to a monogram when absent. */
  founderPhotoSrc?: string;
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter((part) => part.length > 2)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const linkButton = "border-primary/40 text-foreground hover:bg-primary/10 gap-2";

const AboutTeam = ({ team, founderPhotoSrc }: AboutTeamProps) => {
  const { founder, advisory } = team;

  return (
    <section id="time" className="section-padding gradient-subtle">
      <div className="container mx-auto max-w-5xl space-y-16">
        <div className="text-center space-y-4">
          <p className="text-sm font-medium text-accent uppercase tracking-widest">{team.eyebrow}</p>
          <h2 className="section-title">
            {team.titleLead}
            <span className="text-gradient">{team.titleAccent}</span>
          </h2>
        </div>

        {/* Keeps the old /sobre#fundadora links landing on the founder. */}
        <div
          id="fundadora"
          className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-10 md:gap-14 items-center"
        >
          {/* Capped at the portrait's native 266px rather than filling the column:
              the only copy of this photo we have is small, and upscaling it reads
              as sloppy. Widen this once a higher-resolution original exists. */}
          <div className="mx-auto w-full max-w-[266px]">
            {founderPhotoSrc ? (
              <img
                src={founderPhotoSrc}
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
            <div className="space-y-1">
              <h3 className="section-title !text-3xl md:!text-4xl">{founder.name}</h3>
              <p className="font-heading text-lg text-accent">{founder.role}</p>
            </div>

            {founder.paragraphs.map((p) => (
              <p key={p.slice(0, 32)} className="text-muted-foreground leading-relaxed">
                {p}
              </p>
            ))}

            <dl className="grid grid-cols-2 gap-6 border-t border-border pt-6">
              {founder.facts.map(({ label, items }) => (
                <div key={label} className="space-y-1">
                  <dt className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    {label}
                  </dt>
                  {items.map((item) => (
                    <dd key={item} className="font-heading text-foreground">
                      {item}
                    </dd>
                  ))}
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap gap-3 pt-1">
              <Button asChild variant="outline" className={linkButton}>
                <a href={FOUNDER_LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
                  <Linkedin size={16} /> {founder.linkedinLabel}
                </a>
              </Button>
              <Button asChild variant="outline" className={linkButton}>
                <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                  <Instagram size={16} /> {founder.instagramLabel}
                </a>
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="mx-auto max-w-3xl text-center space-y-3">
            <h3 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
              {advisory.heading}
            </h3>
            <p className="text-muted-foreground leading-relaxed">{advisory.note}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {advisory.advisors.map((a) => (
              <article key={a.name} className="glass rounded-2xl p-6 sm:p-8 glow-border flex flex-col">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
                  <img
                    src={a.photo}
                    alt={a.photoAlt}
                    width={96}
                    height={96}
                    loading="lazy"
                    className="h-20 w-20 shrink-0 rounded-xl object-cover glow-border sm:h-24 sm:w-24"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      {a.title}
                    </p>
                    <h4 className="font-heading text-xl font-bold text-foreground">{a.name}</h4>
                    <p className="text-sm text-accent">{a.focus}</p>
                  </div>
                </div>

                <p className="mt-6 flex-1 text-muted-foreground leading-relaxed">{a.bio}</p>

                <ul className="mt-6 flex flex-wrap gap-2">
                  {a.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full border border-primary/30 px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild variant="outline" size="sm" className={linkButton}>
                    <a href={a.linkedinUrl} target="_blank" rel="noopener noreferrer">
                      <Linkedin size={14} /> {advisory.linkedinLabel}
                    </a>
                  </Button>
                  {a.website && (
                    <Button asChild variant="outline" size="sm" className={linkButton}>
                      <a href={a.website.href} target="_blank" rel="noopener noreferrer">
                        <Globe size={14} /> {a.website.label}
                      </a>
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutTeam;
