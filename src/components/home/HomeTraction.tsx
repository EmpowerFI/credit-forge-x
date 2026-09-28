import { useState } from "react";
import { ArrowRight, ExternalLink, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CONTACT_EMAIL, SEBRAE_LOGO_SRC, UNICAMP_SEAL_SRC } from "@/config/links";
import SectionHeading from "@/components/SectionHeading";
import SupportLogo from "@/components/SupportLogo";
import StoreLinks from "@/components/StoreLinks";
import { GradedRule } from "@/components/site/editorial";
import { HOME, type Lang, PATHS } from "./copy";

type Interest = "sponsor" | "capital" | "community" | "other";

/** Contact, with who is writing: the founder reads it in the message's first line. */
function ContactForm({ lang, interest, setInterest }: { lang: Lang; interest: Interest; setInterest: (i: Interest) => void }) {
  const t = HOME[lang].contact;
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const schema = z.object({
    name: z.string().trim().min(1, t.errors.name).max(100),
    email: z.string().trim().email(t.errors.email).max(255),
    message: z.string().trim().min(5, t.errors.short).max(1900, t.errors.long),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: t.invalid, description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const id = crypto.randomUUID();
      const message = `[${HOME.en.contact.interests[interest]} · ${lang.toUpperCase()}]\n\n${parsed.data.message}`;
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: { templateName: "contact-question-for-founder", idempotencyKey: `contact-question-${id}`, templateData: { ...parsed.data, message } },
      });
      if (error) throw error;
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "contact-question-confirmation", recipientEmail: parsed.data.email,
          idempotencyKey: `contact-confirm-${id}`, templateData: { name: parsed.data.name },
        },
      });
      toast({ title: t.sent.title, description: t.sent.desc });
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      console.error("Error sending contact message", err);
      toast({ title: t.failed.title, description: t.failed.desc, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-7">
      <fieldset className="border-0 p-0">
        <legend className="eyebrow p-0">{t.interest}</legend>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {(Object.keys(t.interests) as Interest[]).map((k) => (
            <button key={k} type="button" onClick={() => setInterest(k)} aria-pressed={interest === k}
              className={`min-h-[2.75rem] rounded-sm px-5 text-[1.0625rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                interest === k
                  ? "border-[1.5px] border-gold bg-gold/14 text-foreground"
                  : "border border-foreground/25 text-foreground/90 hover:bg-foreground/[0.04]"
              }`}>
              {t.interests[k]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2.5">
          <Label htmlFor="contact-name" className="label-ui text-foreground/90">{t.name}</Label>
          <Input id="contact-name" required maxLength={100} autoComplete="name" value={form.name} placeholder={t.namePlaceholder}
            className="h-[3.25rem] rounded-sm border-foreground/25 bg-transparent px-4 text-lg"
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="contact-email" className="label-ui text-foreground/90">{t.email}</Label>
          <Input id="contact-email" type="email" required maxLength={255} autoComplete="email" value={form.email} placeholder={t.emailPlaceholder}
            className="h-[3.25rem] rounded-sm border-foreground/25 bg-transparent px-4 text-lg"
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>

      <div className="space-y-2.5">
        <Label htmlFor="contact-message" className="label-ui text-foreground/90">{t.message}</Label>
        <Textarea id="contact-message" required rows={6} maxLength={1900} value={form.message} placeholder={t.messagePlaceholder}
          className="rounded-sm border-foreground/25 bg-transparent p-4 text-lg"
          onChange={(e) => setForm({ ...form, message: e.target.value })} />
      </div>

      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
        <button type="submit" disabled={sending} className="btn-site btn-site-primary disabled:opacity-60">
          {sending ? t.sending : <>{t.send} <Send size={16} className="text-accent" aria-hidden /></>}
        </button>
        <span className="text-[1.0625rem] text-foreground/85">
          {t.orWrite}{" "}
          <a href={`mailto:${CONTACT_EMAIL}?subject=EmpowerFI`} className="text-accent underline-offset-4 hover:underline">{CONTACT_EMAIL}</a>
        </span>
      </div>
    </form>
  );
}

/** What is real today — each claim with the state it is in, and nothing more. */
const HomeTraction = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].traction;
  const c = HOME[lang].contact;
  const [interest, setInterest] = useState<Interest>("sponsor");
  const choose = (id: Interest) => {
    setInterest(id);
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <section id="traction" className="section-padding">
        <div className="container mx-auto">
          <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
          <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-7">
            {t.items.map((item, i) => (
              <div key={item.title} className="flex flex-col">
                {/* Four rules, fading across: they are one list, in order of how
                    settled each item is, not four competing badges. */}
                <GradedRule index={i} />
                <p className="label-ui mt-4 text-foreground/90">{item.tag}</p>
                <h3 className="mt-3 font-heading text-[1.4rem] leading-tight">{item.title}</h3>
                <p className="mt-2.5 flex-1 leading-relaxed text-foreground/85">{item.desc}</p>
                {i === 0 && <StoreLinks />}
                {i === 1 && "link" in item && item.link && (
                  <Link to={`/app?lang=${lang}`} className="mt-3 inline-flex items-center gap-1.5 text-[1.0625rem] text-accent underline-offset-4 hover:underline">
                    {item.link} <ExternalLink size={15} aria-hidden />
                  </Link>
                )}
                {/* The tag above already names the support, so the marks stand alone. */}
                {i === 2 && <SupportLogo src={SEBRAE_LOGO_SRC} alt="Sebrae" />}
                {/* The seal carries a second line of type under the wordmark,
                    so it is rendered taller than the marks beside it. */}
                {i === 3 && <SupportLogo large src={UNICAMP_SEAL_SRC} alt={lang === "pt" ? "Selo Empresa-filha da Unicamp" : "Unicamp empresa-filha seal"} />}
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col gap-4 rounded-sm border border-dashed border-gold/60 px-6 py-5 sm:flex-row sm:gap-7">
            <span className="label-ui shrink-0 pt-1 text-accent">{t.pilotLabel}</span>
            <p className="leading-relaxed text-foreground/90">{t.pilot}</p>
          </div>
        </div>
      </section>

      <section id="contact" className="section-padding scroll-mt-24">
        {/* The form sits beside the choices only from xl: at lg the 28rem
            column plus a 5rem gutter left it 432px, and it needs more. */}
        <div className="container mx-auto grid gap-14 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] xl:gap-20">
          <div>
            <SectionHeading eyebrow={c.eyebrow} title={t.fit} />
            <p className="mt-7 leading-relaxed text-foreground/85">{t.fitBody}</p>

            {/* The six ways in, as rows rather than cards: choosing one sets the
                form's first line, so the founder reads who is writing. All six
                lead to the same form — this company is having discovery
                conversations, not routing anyone into a product. */}
            <ul className="mt-9 border-t border-foreground/15">
              {t.ctas.map((cta) => {
                const inner = (
                  <>
                    <span className="min-w-0">
                      <span className="block text-xl leading-snug">{cta.label}</span>
                      <span className="mt-1 block text-[0.95rem] leading-snug text-foreground/70">{cta.desc}</span>
                    </span>
                    <ArrowRight size={18} className="shrink-0 text-accent transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden />
                  </>
                );
                const row = "group flex min-h-[3.5rem] w-full items-center justify-between gap-5 border-b border-foreground/15 py-5 text-left transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";
                return (
                  <li key={cta.id}>
                    <button type="button" onClick={() => choose(cta.id as Interest)} className={row}>{inner}</button>
                  </li>
                );
              })}
            </ul>

            {lang === "pt" ? (
              <p className="mt-7 text-[1.0625rem] text-foreground/85">
                <Link to={PATHS.pt.entrepreneurs} className="text-accent underline-offset-4 hover:underline">{t.entrepreneur} →</Link>
              </p>
            ) : (
              /* No English page for her yet, so the sentence names both stores
                 and both are linked — one of them would be choosing her phone. */
              <div className="mt-7 text-[1.0625rem] text-foreground/85">
                <p>{t.entrepreneur}</p>
                <StoreLinks className="!mt-2" />
              </div>
            )}
          </div>

          <div className="xl:pt-2">
            <ContactForm lang={lang} interest={interest} setInterest={setInterest} />
          </div>
        </div>
      </section>
    </>
  );
};

export default HomeTraction;
