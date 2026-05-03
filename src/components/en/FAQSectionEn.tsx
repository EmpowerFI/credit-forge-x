import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What stage is the product at today?",
    a: "We are in the development and validation phase. Thesis validated through primary research, clickable prototype tested, accelerated by Sebrae. Next milestones are a technical MVP via the Solana hackathon and a pre-seed round. Real credit origination is expected in 12–18 months, after proper regulatory structuring.",
  },
  {
    q: "How will you raise and originate credit?",
    a: "Capital will come from investors via a tokenized structure backed by Brazilian Treasury bonds (similar to Ondo Finance, adapted to the Brazilian context). Initial origination will run via partnerships with regulated institutions; the long-term vision is to internalize it.",
  },
  {
    q: "What is the regulatory path?",
    a: "We are mapping the proper structure with a specialized law firm. The likely path involves a banking correspondent or our own SCD, in parallel to a tokenization structure via a partner securitization vehicle.",
  },
  {
    q: "Who is the team?",
    a: "Daniele Rodrigues dos Santos (founder) — computer engineer with 20 years of experience in corporate IT. A technical co-founder with blockchain and capital markets background is a priority for the next phase.",
  },
  {
    q: "How can I get involved?",
    a: "Investors: book a conversation through the form. Acceleration programs: we are open to participating. Institutional partners (tokenization platforms, MFIs, development banks): we'd love to talk. Talents with fintech or Web3 experience: we are forming the founding team.",
  },
];

const FAQSectionEn = () => (
  <section id="faq" className="section-padding gradient-subtle">
    <div className="container mx-auto max-w-3xl space-y-10">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Frequently asked questions</p>
        <h2 className="section-title">
          Straight to the <span className="text-gradient">point</span>
        </h2>
      </div>

      <Accordion type="single" collapsible className="glass rounded-xl glow-border px-6">
        {faqs.map((item, i) => (
          <AccordionItem key={item.q} value={`item-${i}`} className="border-border">
            <AccordionTrigger className="text-left font-heading text-foreground hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

export default FAQSectionEn;
