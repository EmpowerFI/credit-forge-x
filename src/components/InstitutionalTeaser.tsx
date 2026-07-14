import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface InstitutionalTeaserProps {
  title: string;
  body: string;
  cta: string;
  /** /about route for this language. */
  to: string;
}

/**
 * The one institutional block on the home page. Kept deliberately small: the
 * home page's job is app downloads, so this hands the "who is behind this"
 * question off to /about instead of answering it here.
 */
const InstitutionalTeaser = ({ title, body, cta, to }: InstitutionalTeaserProps) => (
  <section className="px-4 md:px-8 pb-20 md:pb-28">
    <div className="container mx-auto">
      <div className="glass rounded-2xl glow-border p-10 md:p-14 flex flex-col md:flex-row md:items-center gap-8 justify-between">
        <div className="space-y-3 max-w-2xl">
          <h2 className="section-title !text-2xl md:!text-3xl">{title}</h2>
          <p className="text-muted-foreground leading-relaxed">{body}</p>
        </div>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="shrink-0 border-primary/40 text-foreground hover:bg-primary/10 gap-2"
        >
          <Link to={to}>
            {cta} <ArrowRight size={18} />
          </Link>
        </Button>
      </div>
    </div>
  </section>
);

export default InstitutionalTeaser;
