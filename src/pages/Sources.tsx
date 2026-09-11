import { ExternalLink } from "lucide-react";
import Seo from "@/components/Seo";
import FooterEn from "@/components/en/FooterEn";
import NavbarEn from "@/components/en/NavbarEn";
import SectionHeading from "@/components/SectionHeading";
import { sourceGroups } from "@/content/sources";

const alternates = [
  { hreflang: "en", path: "/sources" },
  { hreflang: "x-default", path: "/sources" },
];

/**
 * Every external figure the site quotes, with its provenance and the scope a
 * careful reader needs before reusing it.
 *
 * English only: the page exists for investors and partners running diligence,
 * and most of the underlying documents are Brazilian government sources in
 * Portuguese, linked directly.
 */
const Sources = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="Sources — EmpowerFI"
      description="Official sources behind every figure EmpowerFI publishes: market data, unit-economics benchmarks and the Brazilian regulation governing guided productive microcredit."
      path="/sources"
      lang="en"
      alternates={alternates}
    />
    <NavbarEn />

    <main className="section-padding pt-28">
      <div className="container mx-auto space-y-14">
        <SectionHeading
          eyebrow="References"
          title="Every number,"
          accent="with its provenance."
          subtitle="We publish the source, the year and the scope for each figure the site uses — including the readings we refuse. A statistic without its definition is not evidence."
        />

        <div className="mx-auto max-w-4xl space-y-12">
          {sourceGroups.map(({ heading, entries }) => (
            <section key={heading} className="space-y-5">
              <h2 className="font-heading text-sm font-semibold uppercase tracking-widest text-accent">
                {heading}
              </h2>

              <ul className="space-y-4">
                {entries.map(({ title, supports, caveat, url }) => (
                  <li key={url} className="rounded-2xl p-7 glass glow-border">
                    <h3 className="font-heading font-bold text-foreground">{title}</h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">{supports}</p>
                    {caveat && (
                      <p className="mt-3 border-l-2 border-accent/50 pl-4 text-sm leading-relaxed text-foreground">
                        {caveat}
                      </p>
                    )}
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 break-all text-sm font-medium text-accent transition-colors hover:text-foreground"
                    >
                      Open source <ExternalLink size={14} className="shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-border bg-card/50 p-8 md:p-10">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            How we use these numbers
          </p>
          <p className="leading-relaxed text-muted-foreground">
            Always with the year, the scope and the definition attached. A financing gap
            measures unmet need, never addressable revenue, and we do not convert one into
            the other. Where a figure is commonly misread, the reading we reject is stated
            next to it rather than left for someone else to discover.
          </p>
        </div>
      </div>
    </main>

    <FooterEn />
  </div>
);

export default Sources;
