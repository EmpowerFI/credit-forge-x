import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { AboutContent } from "@/content/about";

const AboutFaq = ({ faq }: { faq: AboutContent["faq"] }) => (
  <section id="faq" className="section-padding gradient-subtle">
    <div className="container mx-auto max-w-3xl space-y-10">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">{faq.eyebrow}</p>
        <h2 className="section-title">
          {faq.titleLead}
          <span className="text-gradient">{faq.titleAccent}</span>
        </h2>
      </div>

      <Accordion type="single" collapsible className="glass rounded-xl glow-border px-6">
        {faq.items.map((item, i) => (
          <AccordionItem key={item.q} value={`item-${i}`} className="border-border">
            <AccordionTrigger className="text-left font-heading text-foreground hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              {item.a}
              {item.link && (
                <Link
                  to={item.link.href}
                  className="mt-3 flex w-fit items-center gap-1 font-medium text-accent transition-colors hover:text-foreground"
                >
                  {item.link.label} <ArrowRight size={14} aria-hidden />
                </Link>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

export default AboutFaq;
