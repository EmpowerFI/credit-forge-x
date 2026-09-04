import { useState } from "react";
import { ExternalLink, Languages, Play } from "lucide-react";
import type { MediaContent, MediaItem } from "@/content/media";

/**
 * YouTube player as a facade: a thumbnail and a play button, swapped for the
 * real iframe only on click.
 *
 * An embedded player pulls roughly a megabyte of YouTube script into every
 * visit to this page, whether or not anyone watches — on an institutional page
 * that mostly gets read, almost nobody does. It also uses the -nocookie host so
 * a reader who never presses play is not tracked.
 */
const YouTubePlayer = ({ id, title, label }: { id: string; title: string; label: string }) => {
  const [playing, setPlaying] = useState(false);
  // maxresdefault is missing for some uploads; hqdefault always exists.
  const [thumb, setThumb] = useState(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);

  if (playing) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="aspect-video w-full rounded-xl border-0"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={label.replace("{title}", title)}
      className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-primary/5 ring-1 ring-border transition-shadow hover:shadow-glow"
    >
      <img
        src={thumb}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setThumb(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)}
        className="h-full w-full object-cover"
      />
      <span className="absolute inset-0 bg-primary/20 transition-colors group-hover:bg-primary/10" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full gradient-primary shadow-glow transition-transform duration-300 group-hover:scale-110">
          <Play className="ml-1 text-primary-foreground" size={26} fill="currentColor" />
        </span>
      </span>
    </button>
  );
};

interface AboutMediaProps {
  media: MediaContent;
  items: MediaItem[];
  /** Language of the surrounding page, to decide when to flag a piece's language. */
  pageLang: "pt-BR" | "en";
}

const AboutMedia = ({ media, items, pageLang }: AboutMediaProps) => {
  if (items.length === 0) return null;

  return (
    <section id="midia" className="section-padding">
      <div className="container mx-auto space-y-12">
        <div className="space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            {media.eyebrow}
          </p>
          <h2 className="section-title">
            {media.titleLead}
            <span className="text-gradient">{media.titleAccent}</span>
          </h2>
          <p className="section-subtitle">{media.subtitle}</p>
        </div>

        <div
          className={
            items.length === 1
              ? "mx-auto max-w-2xl"
              : "mx-auto grid max-w-5xl gap-8 md:grid-cols-2"
          }
        >
          {items.map((item) => (
            <article key={item.title} className="flex flex-col gap-4">
              {item.youtubeId && (
                <YouTubePlayer
                  id={item.youtubeId}
                  title={item.title}
                  label={media.playLabel}
                />
              )}

              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-accent/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
                    {media.kindLabels[item.kind]}
                  </span>
                  <span className="text-sm font-medium text-foreground">{item.outlet}</span>
                  {item.date && (
                    <span className="text-sm text-muted-foreground">· {item.date}</span>
                  )}
                  {item.lang !== pageLang && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      <Languages size={11} aria-hidden /> {media.otherLanguageLabel}
                    </span>
                  )}
                </div>

                <h3 className="font-heading text-lg font-bold leading-snug text-foreground">
                  {item.title}
                </h3>
                <p className="leading-relaxed text-muted-foreground">{item.desc}</p>

                {item.href && (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-foreground"
                  >
                    {item.linkLabel} <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutMedia;
