import { ArrowLeft, Info } from "lucide-react";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import InstitutionalFooter from "@/components/InstitutionalFooter";
import { aboutEn, aboutPt } from "@/content/about";
import type { LegalDoc } from "@/content/legal";

interface LegalPageProps {
  doc: LegalDoc;
  lang: "pt-BR" | "en";
  /** This document's own route, e.g. "/privacidade". */
  path: string;
  /** The same document in the other language, for hreflang. */
  alternates: { hreflang: string; path: string }[];
}

/** Shared shell for the legal documents — a readable single-column document. */
const LegalPage = ({ doc, lang, path, alternates }: LegalPageProps) => {
  const pt = lang === "pt-BR";
  const content = pt ? aboutPt : aboutEn;
  const homePath = pt ? "/" : "/en";

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={`${doc.title} — EmpowerFI`}
        description={doc.description}
        path={path}
        lang={lang}
        alternates={alternates}
      />

      <div className="gradient-subtle border-b border-border">
        <div className="container mx-auto px-4 pt-16 pb-14 max-w-3xl space-y-5">
          <Link
            to={homePath}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} /> {content.footer.backToHome}
          </Link>
          <h1 className="section-title !text-3xl md:!text-4xl">{doc.title}</h1>
          <p className="text-sm text-muted-foreground">
            {pt ? "Última atualização" : "Last updated"}: {doc.lastUpdated}
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">{doc.intro}</p>
        </div>
      </div>

      <main className="container mx-auto px-4 py-16 max-w-3xl space-y-10">
        {doc.prevailingNote && (
          <p className="glass rounded-xl glow-border p-5 flex gap-3 text-sm text-muted-foreground leading-relaxed">
            <Info size={18} className="text-accent shrink-0 mt-0.5" aria-hidden="true" />
            <span>{doc.prevailingNote}</span>
          </p>
        )}

        <ol className="space-y-10">
          {doc.sections.map((section, i) => (
            <li key={section.title} className="space-y-4">
              <h2 className="font-heading text-xl font-bold text-foreground">
                <span className="text-accent mr-2">{i + 1}.</span>
                {section.title}
              </h2>
              {section.paragraphs?.map((p) => (
                <p key={p.slice(0, 32)} className="text-muted-foreground leading-relaxed">
                  {p}
                </p>
              ))}
              {section.bullets && (
                <ul className="space-y-2 pl-1">
                  {section.bullets.map((b) => (
                    <li key={b.slice(0, 32)} className="flex gap-3 text-muted-foreground leading-relaxed">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </main>

      <InstitutionalFooter footer={content.footer} homePath={homePath} lang={lang} />
    </div>
  );
};

export default LegalPage;
