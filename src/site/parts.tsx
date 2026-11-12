import { useState, type ReactNode } from "react";
import { ArrowRight, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CONTACT_EMAIL } from "@/config/links";
import Seo from "@/components/Seo";
import SiteHeader, { type HeaderLink } from "@/components/site/SiteHeader";
import SiteFooter, { type FooterColumn } from "@/components/site/SiteFooter";
import { organizationSchema } from "@/config/structuredData";
import { IMPACT_AREA_PATH, type Lang, MATURITY, type Maturity, MISSIONS_DEMO_PATH, PATHS, SITE } from "./content";

export type PageKey = keyof (typeof PATHS)["en"];

/** The other language's page for the same place: the toggle and hreflang. */
const twinOf = (lang: Lang, key?: PageKey) => (key ? PATHS[lang === "en" ? "pt" : "en"][key] : PATHS[lang === "en" ? "pt" : "en"].home);

/** The header every page shares: five places, one action, and the language. */
export function SiteNav({ lang, page, twin }: { lang: Lang; page?: PageKey; twin?: string }) {
  const t = SITE[lang];
  const p = PATHS[lang];
  const links: HeaderLink[] = [
    ...t.nav.links.map((l) => ({ label: l.label, to: p[l.key as PageKey], top: "lg" as const })),
    // Panel only: the bar keeps one action; on a wide screen the footer carries it.
    { label: t.nav.sponsorArea, to: `${IMPACT_AREA_PATH}?lang=${lang}` },
  ];
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
        { label: t.nav.sponsorArea, to: `${IMPACT_AREA_PATH}?lang=${lang}` },
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

/**
 * The diary, shown in motion (founder, 12/11/2026): a short silent film per
 * language. It plays muted and in a loop, with the controls to pause it; with
 * reduced motion it waits for a tap.
 */
export function DiaryVideo({ lang, label, className = "" }: { lang: Lang; label: string; className?: string }) {
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <video className={`aspect-video w-full rounded-2xl border border-foreground/15 bg-card shadow-sm ${className}`}
      src={`/site/diario-${lang}.mp4`} poster={`/site/diario-${lang}.jpg`} aria-label={label}
      autoPlay={!still} muted loop playsInline controls preload="metadata" width={1920} height={1080} />
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

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

/**
 * The diary's waitlist (founder, 12/11/2026: access opens a group at a time).
 * She leaves her name, e-mail, what she sells and where; the row goes to the
 * site's database (diary_waitlist, insert-only), and the founder gets an
 * e-mail through the existing contact template. Signing up twice is fine.
 */
export function WaitlistForm({ lang, source }: { lang: Lang; source: string }) {
  const t = SITE[lang].waitlist;
  const [form, setForm] = useState({ name: "", email: "", sells: "", city: "", state: "" });
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const schema = z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(255),
    sells: z.string().trim().min(1).max(120),
    city: z.string().trim().min(1).max(80),
    state: z.string().regex(/^[A-Z]{2}$/),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success || !consent) {
      toast({ title: t.invalid, variant: "destructive" });
      return;
    }
    const d = parsed.data;
    setSending(true);
    try {
      const { error } = await supabase.from("diary_waitlist").insert({
        name: d.name, email: d.email.toLowerCase(), sells: d.sells, city: d.city, state: d.state, language: lang, consent: true, source,
      });
      if (error && error.code !== "23505") throw error;
      if (!error) {
        // The founder hears of it; a failure here does not undo the signup.
        void supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "contact-question-for-founder",
            idempotencyKey: `diary-waitlist-${d.email.toLowerCase()}`,
            templateData: { name: d.name, email: d.email, message: `[Diary waitlist · ${lang.toUpperCase()}]\nSells: ${d.sells}\nWhere: ${d.city}/${d.state}` },
          },
        }).catch(() => undefined);
      }
      const done = error ? t.already : t.sent;
      toast({ title: done.title, description: done.desc });
      setForm({ name: "", email: "", sells: "", city: "", state: "" });
      setConsent(false);
    } catch (err) {
      console.error("Error joining the diary waitlist", err);
      toast({ title: t.failed.title, description: t.failed.desc, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const field = "h-[3.25rem] rounded-sm border-foreground/25 bg-transparent px-4 text-lg";
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2.5">
          <Label htmlFor="wl-name" className="label-ui text-foreground/90">{t.name}</Label>
          <Input id="wl-name" required maxLength={100} autoComplete="name" value={form.name} className={field} onChange={set("name")} />
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="wl-email" className="label-ui text-foreground/90">{t.email}</Label>
          <Input id="wl-email" type="email" required maxLength={255} autoComplete="email" inputMode="email" value={form.email} className={field} onChange={set("email")} />
        </div>
        <div className="space-y-2.5 sm:col-span-2">
          <Label htmlFor="wl-sells" className="label-ui text-foreground/90">{t.sells}</Label>
          <Input id="wl-sells" required maxLength={120} value={form.sells} placeholder={t.sellsPlaceholder} className={field} onChange={set("sells")} />
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="wl-city" className="label-ui text-foreground/90">{t.city}</Label>
          <Input id="wl-city" required maxLength={80} autoComplete="address-level2" value={form.city} className={field} onChange={set("city")} />
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="wl-state" className="label-ui text-foreground/90">{t.state}</Label>
          <select id="wl-state" required autoComplete="address-level1" value={form.state} onChange={set("state")}
            className={`${field} w-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}>
            <option value="">{t.statePlaceholder}</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-[1.0625rem] leading-snug text-foreground/85">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required
          className="mt-1 h-5 w-5 shrink-0 accent-[hsl(var(--accent))]" />
        {t.consent}
      </label>
      <button type="submit" disabled={sending} className="btn-site btn-site-primary disabled:opacity-60">
        {sending ? t.sending : <>{t.submit} <ArrowRight size={16} className="text-accent" aria-hidden /></>}
      </button>
    </form>
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
