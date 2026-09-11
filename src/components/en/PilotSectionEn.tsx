import { ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SectionHeading from "@/components/SectionHeading";

// Hypotheses, phrased as hypotheses. The pilot is large enough to validate a
// process and its costs, and far too small to support a population claim about
// default rates — so none of these is written as a result.
const tests = [
  "Whether preparing a business before the request produces useful signals and a better pipeline",
  "Whether digitalization lowers the cost to serve without degrading credit quality",
  "Whether programmes and sponsors pay for cohort management, dashboards and evidence",
  "Whether financial partners value and convert qualified opportunities",
  "Whether longitudinal data helps explain repayment capacity and exceptions",
  "Whether capital is used productively and produces observable economic value",
];

const PilotSectionEn = () => (
  <section id="pilot" className="section-padding">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Pilot"
        title="Building the first"
        accent="real-world pilot."
        subtitle="EmpowerFI is preparing its first productive microcredit pilot with women entrepreneurs and partner communities in Brazil. It is designed to measure a process and its costs — not to prove a default rate."
      />

      <div className="mx-auto max-w-4xl space-y-10 rounded-2xl p-10 glass glow-border shadow-glow md:p-14">
        <div className="space-y-5">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            What the pilot will test
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {tests.map((test) => (
              <li key={test} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full gradient-primary">
                  <Check className="text-primary-foreground" size={12} strokeWidth={3} />
                </span>
                <span className="text-sm leading-relaxed text-foreground">{test}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-center gap-3 border-t border-border pt-8 sm:flex-row sm:justify-center">
          <Button
            asChild
            size="lg"
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link to="/investors">
              Follow the pilot <ArrowRight size={18} />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-primary/40 text-foreground hover:bg-primary/10"
          >
            <Link to="/investors#waitlist">Join the Investor Waitlist</Link>
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default PilotSectionEn;
