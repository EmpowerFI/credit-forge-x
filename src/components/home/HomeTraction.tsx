import { useState } from "react";
import { ArrowRight, Award, Blocks, Building2, ExternalLink, HandCoins, Mail, Send, Smartphone, Sprout, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CONTACT_EMAIL, SEBRAE_LOGO_SRC } from "@/config/links";
import SectionHeading from "@/components/SectionHeading";
import SupportLogo from "@/components/SupportLogo";
import StoreLinks from "@/components/StoreLinks";
import { HOME, type Lang, PATHS } from "./copy";

type Interest = "sponsor" | "capital" | "community" | "other";

const TRACTION_ICONS = [Smartphone, Blocks, Award, Building2];
const CTA_ICONS = { sponsor: Sprout, capital: HandCoins, community: Users } as const;

/** Contact, with who is writing: the founder reads it in the message's first line. */
function Contact({ lang, interest, setInterest }: { lang: Lang; interest: Interest; setInterest: (i: Interest) => void }) {
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
    <div id="contact" className="mx-auto max-w-3xl scroll-mt-24 space-y-8 rounded-2xl p-8 glass glow-border shadow-glow md:p-12">
      <div className="space-y-3 text-center">
        <h3 className="section-title !text-2xl md:!text-3xl">{t.title} <span className="text-gradient">{t.accent}</span></h3>
        <p className="mx-auto max-w-xl text-muted-foreground">{t.subtitle}</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">{t.interest}</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(t.interests) as Interest[]).map((k) => (
              <button key={k} type="button" onClick={() => setInterest(k)} aria-pressed={interest === k}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${interest === k ? "border-accent bg-accent/15 font-medium text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {t.interests[k]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact-name">{t.name}</Label>
            <Input id="contact-name" required maxLength={100} value={form.name} placeholder={t.namePlaceholder}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">{t.email}</Label>
            <Input id="contact-email" type="email" required maxLength={255} value={form.email} placeholder={t.emailPlaceholder}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-message">{t.message}</Label>
          <Textarea id="contact-message" required rows={5} maxLength={1900} value={form.message} placeholder={t.messagePlaceholder}
            onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </div>
        <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
          <Button type="submit" size="lg" disabled={sending} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            {sending ? t.sending : <>{t.send} <Send size={16} /></>}
          </Button>
          <a href={`mailto:${CONTACT_EMAIL}?subject=EmpowerFI`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <Mail size={16} /> {t.orWrite} {CONTACT_EMAIL}
          </a>
        </div>
      </form>
    </div>
  );
}

const HomeTraction = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].traction;
  const [interest, setInterest] = useState<Interest>("sponsor");
  const choose = (id: Interest) => {
    setInterest(id);
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // The app card carries both stores; the rest carry one link each.
  const links = [null, `/app?lang=${lang}`];

  return (
    <section id="traction" className="section-padding gradient-subtle">
      <div className="container mx-auto space-y-12">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {t.items.map((item, i) => {
            const Icon = TRACTION_ICONS[i];
            const href = links[i];
            return (
              <div key={item.title} className="flex flex-col rounded-2xl p-6 glass glow-border">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg gradient-primary"><Icon size={20} className="text-primary-foreground" aria-hidden /></span>
                <h3 className="mb-2 font-heading text-base font-bold text-foreground">{item.title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                {i === 0 && <StoreLinks />}
                {href && "link" in item && item.link && (
                  <Link to={href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-foreground">{item.link} <ArrowRight size={14} /></Link>
                )}
                {i === 2 && <SupportLogo src={SEBRAE_LOGO_SRC} alt="Sebrae" label={lang === "pt" ? "Apoio institucional" : "Institutional support"} />}
              </div>
            );
          })}
        </div>
        <p className="mx-auto max-w-3xl rounded-xl border border-accent/30 bg-background/60 px-5 py-3 text-center text-sm text-foreground">{t.pilot}</p>

        <div className="space-y-5">
          <h3 className="text-center font-heading text-2xl font-bold text-foreground">{t.fit}</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {t.ctas.map((c) => {
              const Icon = CTA_ICONS[c.id as keyof typeof CTA_ICONS];
              const body = (
                <>
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-3 font-heading text-lg font-bold text-foreground">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary"><Icon size={20} className="text-primary-foreground" aria-hidden /></span>
                      {c.label}
                    </span>
                    <ArrowRight size={18} className="shrink-0 text-accent transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                  <span className="block text-sm text-muted-foreground">{c.desc}</span>
                </>
              );
              const style = "group flex flex-col gap-3 rounded-2xl p-6 text-left glass glow-border transition-shadow hover:shadow-glow";
              return c.id === "capital"
                ? <Link key={c.id} to={`${PATHS[lang].investors}#waitlist`} className={style}>{body}</Link>
                : <button key={c.id} type="button" onClick={() => choose(c.id as Interest)} className={style}>{body}</button>;
            })}
          </div>
          {lang === "pt" ? (
            <p className="text-center text-sm text-muted-foreground">
              <Link to={PATHS.pt.entrepreneurs} className="font-medium text-accent hover:text-foreground">{t.entrepreneur} →</Link>
            </p>
          ) : (
            /* No English page for her yet, so the sentence names both stores and
               both are linked — one of them would be choosing her phone for her. */
            <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
              <p className="text-center">{t.entrepreneur}</p>
              <StoreLinks className="!mt-0 justify-center" />
            </div>
          )}
        </div>

        <Contact lang={lang} interest={interest} setInterest={setInterest} />
      </div>
    </section>
  );
};

export default HomeTraction;
