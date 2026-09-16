import InvestorWaitlistForm from "@/components/investors/InvestorWaitlistForm";
import { investorCopy, type InvestorLang } from "@/components/investors/copy";
import { INVESTOR_EMAIL } from "@/config/links";

/** The #waitlist section of both investor pages: heading, form, direct email. */
const InvestorWaitlistSection = ({ lang }: { lang: InvestorLang }) => {
  const t = investorCopy[lang].waitlist;

  return (
    <section id="waitlist" className="section-padding">
      <div className="container mx-auto space-y-10">
        <div className="space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            {t.eyebrow}
          </p>
          <h2 className="section-title !text-3xl md:!text-4xl">
            {t.titleLead} <span className="text-gradient">{t.titleAccent}</span>
          </h2>
          <p className="section-subtitle">{t.subtitle}</p>
        </div>

        <InvestorWaitlistForm lang={lang} />

        {/* Institutional investors usually want a person, not a form. */}
        <p className="text-center text-sm text-muted-foreground">
          {t.institutionalLead}{" "}
          <a
            href={`mailto:${INVESTOR_EMAIL}?subject=${encodeURIComponent(t.mailSubject)}`}
            className="font-medium text-accent transition-colors hover:text-foreground"
          >
            {INVESTOR_EMAIL}
          </a>
          .
        </p>
      </div>
    </section>
  );
};

export default InvestorWaitlistSection;
