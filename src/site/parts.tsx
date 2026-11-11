import { useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Smartphone, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CONTACT_EMAIL } from "@/config/links";
import { SITE_URL } from "@/config/company";
import QrCode from "@/app/components/QrCode";
import Seo from "@/components/Seo";
import SiteHeader, { type HeaderLink } from "@/components/site/SiteHeader";
import SiteFooter, { type FooterColumn } from "@/components/site/SiteFooter";
import { organizationSchema } from "@/config/structuredData";
import { DIARY_PATH, type Lang, MATURITY, type Maturity, MISSIONS_DEMO_PATH, PATHS, SITE } from "./content";

export type PageKey = keyof (typeof PATHS)["en"];

/** The other language's page for the same place: the toggle and hreflang. */
const twinOf = (lang: Lang, key?: PageKey) => (key ? PATHS[lang === "en" ? "pt" : "en"][key] : PATHS[lang === "en" ? "pt" : "en"].home);

/** The header every page shares: five places, one action, and the language. */
export function SiteNav({ lang, page, twin }: { lang: Lang; page?: PageKey; twin?: string }) {
  const t = SITE[lang];
  const p = PATHS[lang];
  const links: HeaderLink[] = t.nav.links.map((l) => ({ label: l.label, to: p[l.key as PageKey], top: "lg" }));
  const other = twin ?? twinOf(lang, page);
  return (
    <SiteHeader home={p.home} lang={lang} links={links}
      language={lang === "en"
        ? { current: "EN", other: "PT", otherName: "Português", to: other }
        : { current: "PT", other: "EN", otherName: "English", to: other }}
      primary={{ label: t.nav.primary, to: `${p.sponsors}#contact` }} appLabel={t.nav.app} menuLabel={t.nav.menu} />
  );
}

/** The footer every page shares, with the notices that say what is not live. */
export function SiteFoot({ lang, page, twin }: { lang: Lang; page?: PageKey; twin?: string }) {
  const t = SITE[lang];
  const p = PATHS[lang];
  const columns: FooterColumn[] = [
    {
      title: t.footer.product,
      links: [
        { label: t.nav.links[1].label, to: p.entrepreneurs },
        { label: t.nav.links[2].label, to: p.sponsors },
        { label: t.nav.links[3].label, to: p.protocol },
        { label: t.footer.missionsDemo, to: MISSIONS_DEMO_PATH },
      ],
    },
    {
      title: t.footer.company,
      links: [
        { label: t.nav.links[4].label, to: p.about },
        { label: t.footer.contact, to: `${p.sponsors}#contact` },
        { label: t.footer.sources, to: "/sources" },
        { label: "Email", href: `mailto:${CONTACT_EMAIL}` },
      ],
    },
    {
      title: t.footer.legal,
      links: [
        { label: lang === "en" ? "Terms" : "Termos", to: p.terms },
        { label: lang === "en" ? "Privacy" : "Privacidade", to: p.privacy },
        { label: t.footer.language, to: twin ?? twinOf(lang, page) },
      ],
    },
  ];
  return (
    <SiteFooter home={p.home} tagline={t.footer.tagline} positioning={t.footer.positioning} columns={columns}
      notices={t.footer.notices} rights={t.footer.rights} />
  );
}

/** Every page of the corporate site: its meta, with both languages declared, between the header and the footer. */
export function SitePage({ lang, page, seo, children }: {
  lang: Lang; page: PageKey; seo: { title: string; description: string }; children: ReactNode;
}) {
  const alternates = [
    { hreflang: "en", path: PATHS.en[page] },
    { hreflang: "pt-BR", path: PATHS.pt[page] },
    // The main page is the Portuguese one; elsewhere English is the default.
    { hreflang: "x-default", path: page === "home" ? PATHS.pt.home : PATHS.en[page] },
  ];
  return (
    <div className="min-h-screen bg-background">
      <Seo title={seo.title} description={seo.description} path={PATHS[lang][page]} lang={lang === "en" ? "en" : "pt-BR"}
        alternates={alternates} jsonLd={page === "home" ? [organizationSchema()] : undefined} />
      <SiteNav lang={lang} page={page} />
      <main>{children}</main>
      <SiteFoot lang={lang} page={page} />
    </div>
  );
}

/** One section: the site's vertical rhythm and container. */
export function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`section-padding scroll-mt-24 ${className}`}>
      <div className="container mx-auto">{children}</div>
    </section>
  );
}

const TONE: Record<Maturity, string> = {
  available: "border-positive/50 text-positive",
  devnet: "border-gold text-accent",
  development: "border-dashed border-foreground/40 text-foreground/75",
  planned: "border-dashed border-foreground/25 text-foreground/60",
};

/** Where a feature stands: said beside every claim, in words, never by colour alone. */
export function MaturityTag({ lang, m }: { lang: Lang; m: Maturity }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${TONE[m]}`}>
      {MATURITY[lang][m]}
    </span>
  );
}

/** A real screen of the product, framed, with its caption. */
export function Shot({ src, alt, note, className = "" }: { src: string; alt: string; note?: string; className?: string }) {
  return (
    <figure className={className}>
      <img src={src} alt={alt} width={390} loading="lazy"
        className="w-full max-w-[24rem] rounded-2xl border border-foreground/15 bg-card shadow-sm" />
      {note && <figcaption className="mt-3 text-sm text-foreground/65">{note}</figcaption>}
    </figure>
  );
}

const FLOW: Record<Lang, { title: string; sub: string }[]> = {
  en: [
    { title: "Sponsor", sub: "Funds a campaign, per entrepreneur" },
    { title: "Campaign vault", sub: "Holds it under written rules" },
    { title: "30-day engagement", sub: "She keeps her diary" },
    { title: "Conditional reward", sub: "If every condition is met" },
  ],
  pt: [
    { title: "Patrocinador", sub: "Financia a campanha, por empreendedora" },
    { title: "Cofre da campanha", sub: "Guarda o valor com regras escritas" },
    { title: "30 dias de engajamento", sub: "Ela registra o seu dia" },
    { title: "Recompensa condicional", sub: "Se todas as condições forem cumpridas" },
  ],
};

/** Sponsor -> vault -> 30 days -> reward, as four steps on a gold rule. */
export function CampaignFlow({ lang }: { lang: Lang }) {
  return (
    <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
      {FLOW[lang].map((s, i) => (
        <li key={s.title} className="relative lg:pr-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-gold font-heading text-lg text-accent">
              {i + 1}
            </span>
            {i < 3 && <span className="hidden h-px flex-1 bg-gold/60 lg:block" aria-hidden />}
          </div>
          <p className="mt-4 font-heading text-xl leading-snug">{s.title}</p>
          <p className="mt-1 text-[0.95rem] leading-snug text-foreground/75">{s.sub}</p>
        </li>
      ))}
    </ol>
  );
}

export type Objective = keyof (typeof SITE)["en"]["form"]["objectives"];

/**
 * A short contact form: organization, name, email, objective, and an optional
 * message. It goes to the founder through the site's existing e-mail
 * function and template, so no backend changes; the first lines say who is
 * writing and why.
 */
export function ContactForm({ lang, initial }: { lang: Lang; initial: Objective }) {
  const t = SITE[lang].form;
  const [form, setForm] = useState({ org: "", name: "", email: "", message: "" });
  const [objective, setObjective] = useState<Objective>(initial);
  const [sending, setSending] = useState(false);
  const schema = z.object({
    org: z.string().trim().min(1, t.errors.org).max(120),
    name: z.string().trim().min(1, t.errors.name).max(100),
    email: z.string().trim().email(t.errors.email).max(255),
    message: z.string().trim().max(1500, t.errors.long),
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
      const d = parsed.data;
      const message = [
        `[${SITE.en.form.objectives[objective]} · ${lang.toUpperCase()}]`,
        `Organization: ${d.org}`,
        "",
        d.message || "(no message)",
      ].join("\n");
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "contact-question-for-founder",
          idempotencyKey: `contact-question-${id}`,
          templateData: { name: d.name, email: d.email, message },
        },
      });
      if (error) throw error;
      toast({ title: t.sent.title, description: t.sent.desc });
      setForm({ org: "", name: "", email: "", message: "" });
    } catch (err) {
      console.error("Error sending contact message", err);
      toast({ title: t.failed.title, description: t.failed.desc, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const field = "h-[3.25rem] rounded-sm border-foreground/25 bg-transparent px-4 text-lg";
  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2.5 sm:col-span-2">
          <Label htmlFor="cf-org" className="label-ui text-foreground/90">{t.org}</Label>
          <Input id="cf-org" required maxLength={120} autoComplete="organization" value={form.org} placeholder={t.orgPlaceholder}
            className={field} onChange={(e) => setForm({ ...form, org: e.target.value })} />
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="cf-name" className="label-ui text-foreground/90">{t.name}</Label>
          <Input id="cf-name" required maxLength={100} autoComplete="name" value={form.name} placeholder={t.namePlaceholder}
            className={field} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="cf-email" className="label-ui text-foreground/90">{t.email}</Label>
          <Input id="cf-email" type="email" required maxLength={255} autoComplete="email" value={form.email} placeholder={t.emailPlaceholder}
            className={field} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>

      <fieldset className="border-0 p-0">
        <legend className="label-ui p-0 text-foreground/90">{t.objective}</legend>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {(Object.keys(t.objectives) as Objective[]).map((k) => (
            <button key={k} type="button" onClick={() => setObjective(k)} aria-pressed={objective === k}
              className={`min-h-[2.75rem] rounded-sm px-4 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                objective === k ? "border-[1.5px] border-gold bg-gold/14 text-foreground" : "border border-foreground/25 text-foreground/90 hover:bg-foreground/[0.04]"}`}>
              {t.objectives[k]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2.5">
        <Label htmlFor="cf-message" className="label-ui text-foreground/90">{t.message}</Label>
        <Textarea id="cf-message" rows={4} maxLength={1500} value={form.message} placeholder={t.messagePlaceholder}
          className="rounded-sm border-foreground/25 bg-transparent p-4 text-lg" onChange={(e) => setForm({ ...form, message: e.target.value })} />
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

/**
 * The way into the diary from a computer: a QR code her phone's camera opens,
 * the address written out, and the reminder that the diary is made for the
 * phone. On a phone the code is no use, so the link and the note stand alone.
 */
export function DiaryAccess({ lang, stack = false, className = "" }: { lang: Lang; stack?: boolean; className?: string }) {
  const t = SITE[lang].diaryAccess;
  const url = `${SITE_URL}${DIARY_PATH}`;
  return (
    <div className={`flex gap-4 ${stack ? "flex-col items-start gap-3" : "items-center"} ${className}`}>
      <QrCode value={url} label={t.qr} className="hidden h-28 w-28 shrink-0 border border-foreground/15 sm:block" />
      <div className="min-w-0 space-y-1">
        <p className="hidden text-sm text-foreground/70 sm:block">{t.scan}</p>
        <a href={DIARY_PATH} className="inline-flex items-center gap-1.5 break-all text-[1.0625rem] text-accent underline-offset-4 hover:underline">
          {url.replace(/^https:\/\//, "")} <ArrowUpRight size={15} aria-hidden className="shrink-0" />
        </a>
        <p className="flex items-start gap-1.5 text-[0.95rem] leading-snug text-foreground/80">
          <Smartphone size={16} aria-hidden className="mt-0.5 shrink-0 text-accent" />{t.note}
        </p>
      </div>
    </div>
  );
}

/** An inline "go on" link in the site's gold. */
export function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-[1.0625rem] text-accent underline-offset-4 hover:underline">
      {children} <ArrowRight size={15} aria-hidden />
    </Link>
  );
}
