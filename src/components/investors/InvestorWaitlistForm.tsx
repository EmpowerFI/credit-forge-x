import { useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { InvestorLang } from "@/components/investors/copy";

type Labelled<V extends string> = { value: V; label: Record<InvestorLang, string> };

const INVESTOR_TYPES: Labelled<"individual" | "institutional">[] = [
  { value: "individual", label: { en: "Individual", pt: "Pessoa física" } },
  { value: "institutional", label: { en: "Institutional", pt: "Institucional" } },
];

// The two P2P pools, and both. The pool decides the ticket's currency: the
// domestic pool is in reais; the global pool, and "both", in US dollars.
const POOLS: Labelled<"domestic" | "global" | "both">[] = [
  { value: "domestic", label: { en: "Domestic P2P (in reais)", pt: "P2P doméstico (em reais)" } },
  { value: "global", label: { en: "Global P2P (in USDC)", pt: "P2P global (em USDC)" } },
  { value: "both", label: { en: "Both", pt: "Ambos" } },
];

type Pool = (typeof POOLS)[number]["value"];
type Currency = "USD" | "BRL";

const currencyFor = (pool: Pool): Currency => (pool === "domestic" ? "BRL" : "USD");

// Indicative tickets. The values are what investor_waitlist.ticket_range stores;
// the migration checks that a tier matches ticket_currency ('other' fits both).
// Deliberately small at the low end — the point is proving small-ticket
// productive credit works, not raising a fund.
const TICKETS: Record<Currency, Labelled<string>[]> = {
  USD: [
    { value: "50", label: { en: "$50", pt: "US$ 50" } },
    { value: "100", label: { en: "$100", pt: "US$ 100" } },
    { value: "200", label: { en: "$200", pt: "US$ 200" } },
    { value: "500_plus", label: { en: "$500+", pt: "US$ 500+" } },
    { value: "other", label: { en: "Other", pt: "Outro valor" } },
  ],
  BRL: [
    { value: "500_brl", label: { en: "R$ 500", pt: "R$ 500" } },
    { value: "1000_brl", label: { en: "R$ 1.000", pt: "R$ 1.000" } },
    { value: "5000_brl", label: { en: "R$ 5.000", pt: "R$ 5.000" } },
    { value: "10000_plus_brl", label: { en: "R$ 10.000+", pt: "R$ 10.000+" } },
    { value: "other", label: { en: "Other", pt: "Outro valor" } },
  ],
};

const MOTIVATIONS: Labelled<"financial_return" | "economic_impact" | "both">[] = [
  { value: "financial_return", label: { en: "Financial return", pt: "Retorno financeiro" } },
  { value: "economic_impact", label: { en: "Economic impact", pt: "Impacto econômico" } },
  { value: "both", label: { en: "Both", pt: "Ambos" } },
];

const LANGUAGE_NAMES: Record<InvestorLang, string> = { en: "English", pt: "Portuguese" };

const text = {
  en: {
    invalidEmail: "Enter a valid email address",
    enterCountry: "Enter your country",
    max80: "Max 80 characters",
    chooseType: "Choose an investor type",
    choosePool: "Choose a pool",
    chooseTicket: "Choose an amount",
    chooseMotivation: "Choose a motivation",
    acceptConsent: "Please accept to continue",
    checkForm: "Check the form",
    needsAttention: "Some fields need attention",
    failedTitle: "Could not join the waitlist",
    failedDesc: "Please try again in a moment.",
    joinedTitle: "You're on the list.",
    joinedDesc:
      "We'll keep you updated as the pilot runs and the P2P model takes shape. Nothing is being offered, and nothing is collected.",
    addAnother: "Add another entry",
    email: "Email",
    emailPlaceholder: "you@email.com",
    country: "Country",
    countryPlaceholder: "Where you're based",
    investorType: "Investor type",
    pool: "Which pool interests you?",
    ticket: "Potential investment amount",
    ticketPlaceholder: "Select an amount",
    ticketNeedsPool: "Choose a pool first",
    ticketHintBRL: "In reais, for the domestic pool.",
    ticketHintUSD: "In US dollars, for the global pool.",
    motivation: "Primary motivation",
    motivationPlaceholder: "Select a motivation",
    consent:
      "I agree to be contacted by EmpowerFI about its P2P productive credit, and I understand this is an expression of non-binding interest.",
    submit: "Join the Investor Waitlist",
    sending: "Joining...",
  },
  pt: {
    invalidEmail: "Informe um e-mail válido",
    enterCountry: "Informe seu país",
    max80: "Máximo de 80 caracteres",
    chooseType: "Escolha o tipo de investidor",
    choosePool: "Escolha um pool",
    chooseTicket: "Escolha um valor",
    chooseMotivation: "Escolha uma motivação",
    acceptConsent: "Aceite para continuar",
    checkForm: "Verifique os campos",
    needsAttention: "Alguns campos precisam de atenção",
    failedTitle: "Não foi possível entrar na lista",
    failedDesc: "Tente de novo em instantes.",
    joinedTitle: "Você está na lista.",
    joinedDesc:
      "Vamos manter você informado conforme o piloto avança e o modelo P2P ganha forma. Nada está sendo oferecido, e nenhum valor é recebido.",
    addAnother: "Adicionar outra inscrição",
    email: "E-mail",
    emailPlaceholder: "voce@email.com",
    country: "País",
    countryPlaceholder: "Onde você mora",
    investorType: "Tipo de investidor",
    pool: "Qual pool te interessa?",
    ticket: "Valor que você poderia investir",
    ticketPlaceholder: "Selecione um valor",
    ticketNeedsPool: "Escolha um pool primeiro",
    ticketHintBRL: "Em reais, para o pool doméstico.",
    ticketHintUSD: "Em dólares, para o pool global.",
    motivation: "Motivação principal",
    motivationPlaceholder: "Selecione uma motivação",
    consent:
      "Concordo em ser contatado(a) pela EmpowerFI sobre o crédito produtivo P2P e entendo que esta é uma manifestação de interesse, sem compromisso.",
    submit: "Entrar na lista de espera",
    sending: "Enviando...",
  },
} satisfies Record<InvestorLang, Record<string, string>>;

const values = <V extends string>(options: Labelled<V>[]) =>
  options.map((o) => o.value) as [V, ...V[]];

const makeSchema = (lang: InvestorLang) => {
  const t = text[lang];
  const pick = (message: string) => ({ errorMap: () => ({ message }) });
  const allTickets = [...new Set([...values(TICKETS.USD), ...values(TICKETS.BRL)])] as [
    string,
    ...string[],
  ];

  return z
    .object({
      email: z.string().trim().email(t.invalidEmail).max(255),
      country: z.string().trim().min(2, t.enterCountry).max(80, t.max80),
      investorType: z.enum(values(INVESTOR_TYPES), pick(t.chooseType)),
      pool: z.enum(values(POOLS), pick(t.choosePool)),
      ticketRange: z.enum(allTickets, pick(t.chooseTicket)),
      motivation: z.enum(values(MOTIVATIONS), pick(t.chooseMotivation)),
      consent: z.literal(true, pick(t.acceptConsent)),
    })
    .superRefine((data, ctx) => {
      // The tier must be in the pool's currency (the database checks it too).
      const allowed = values(TICKETS[currencyFor(data.pool)]) as string[];
      if (!allowed.includes(data.ticketRange)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ticketRange"], message: t.chooseTicket });
      }
    });
};

const labelFor = (options: Labelled<string>[], value: string, lang: InvestorLang) =>
  options.find((o) => o.value === value)?.label[lang] ?? value;

// The Portuguese page is for Brazilian investors: Brazil and the domestic pool
// come pre-selected, and both can still be changed.
const emptyForm = (lang: InvestorLang) => ({
  email: "",
  country: lang === "pt" ? "Brasil" : "",
  investorType: "",
  pool: lang === "pt" ? "domestic" : "",
  ticketRange: "",
  motivation: "",
  consent: false,
});

interface InvestorWaitlistFormProps {
  lang: InvestorLang;
}

/**
 * The investor waitlist, shared by /investors and /pt/investidores. Joining is a
 * non-binding expression of interest: nothing is offered and nothing is
 * collected, and the consent checkbox only records agreement to be contacted.
 */
const InvestorWaitlistForm = ({ lang }: InvestorWaitlistFormProps) => {
  const t = text[lang];
  const [form, setForm] = useState(() => emptyForm(lang));
  const [sending, setSending] = useState(false);
  const [joined, setJoined] = useState(false);

  const currency = form.pool ? currencyFor(form.pool as Pool) : null;
  const tickets = currency ? TICKETS[currency] : [];

  const choosePool = (pool: string) => {
    const nextTickets = values(TICKETS[currencyFor(pool as Pool)]) as string[];
    // Keep the chosen amount only if it still exists in the new currency.
    const ticketRange = nextTickets.includes(form.ticketRange) ? form.ticketRange : "";
    setForm({ ...form, pool, ticketRange });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = makeSchema(lang).safeParse(form);
    if (!parsed.success) {
      toast({
        title: t.checkForm,
        description: parsed.error.issues[0]?.message ?? t.needsAttention,
        variant: "destructive",
      });
      return;
    }

    const { email, country, investorType, pool, ticketRange, motivation } = parsed.data;
    const ticketCurrency = currencyFor(pool);

    setSending(true);
    try {
      const { error } = await supabase.from("investor_waitlist").insert({
        email,
        country,
        investor_type: investorType,
        pool_interest: pool,
        ticket_currency: ticketCurrency,
        ticket_range: ticketRange,
        motivation,
        language: lang,
        consent: true,
        source: lang === "pt" ? "investidores-page" : "investors-page",
      });

      // A repeat signup is not a failure — the person is already on the list.
      const alreadyOnList = error?.code === "23505";
      if (error && !alreadyOnList) throw error;

      if (!alreadyOnList) {
        // Notifications are best effort: the signup is already recorded, so an
        // email failure must not tell the person their submission was lost.
        const id = crypto.randomUUID();
        // The founder's email is in English whichever page the signup came from.
        void supabase.functions
          .invoke("send-transactional-email", {
            body: {
              templateName: "investor-waitlist-for-founder",
              idempotencyKey: `investor-waitlist-${id}`,
              templateData: {
                email,
                country,
                investorType: labelFor(INVESTOR_TYPES, investorType, "en"),
                pool: labelFor(POOLS, pool, "en"),
                currency: ticketCurrency,
                ticketRange: labelFor(TICKETS[ticketCurrency], ticketRange, "en"),
                motivation: labelFor(MOTIVATIONS, motivation, "en"),
                language: LANGUAGE_NAMES[lang],
              },
            },
          })
          .catch((err) => console.error("Waitlist founder notification failed", err));

        void supabase.functions
          .invoke("send-transactional-email", {
            body: {
              templateName:
                lang === "pt"
                  ? "investor-waitlist-confirmation-pt"
                  : "investor-waitlist-confirmation",
              recipientEmail: email,
              idempotencyKey: `investor-waitlist-confirm-${id}`,
              templateData: {},
            },
          })
          .catch((err) => console.error("Waitlist confirmation failed", err));
      }

      setJoined(true);
      setForm(emptyForm(lang));
    } catch (err) {
      console.error("Investor waitlist signup failed", err);
      toast({
        title: t.failedTitle,
        description: t.failedDesc,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (joined) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 rounded-2xl p-10 text-center glass glow-border shadow-glow md:p-14">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full gradient-primary">
          <Check className="text-primary-foreground" size={26} strokeWidth={3} />
        </div>
        <h3 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          {t.joinedTitle}
        </h3>
        <p className="leading-relaxed text-muted-foreground">{t.joinedDesc}</p>
        <button
          type="button"
          onClick={() => setJoined(false)}
          className="text-sm font-medium text-accent transition-colors hover:text-foreground"
        >
          {t.addAnother}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-2xl space-y-7 rounded-2xl p-8 glass glow-border shadow-glow md:p-12"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="waitlist-email">{t.email}</Label>
          <Input
            id="waitlist-email"
            type="email"
            required
            maxLength={255}
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder={t.emailPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="waitlist-country">{t.country}</Label>
          <Input
            id="waitlist-country"
            required
            maxLength={80}
            autoComplete="country-name"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            placeholder={t.countryPlaceholder}
          />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">{t.pool}</legend>
        <RadioGroup
          value={form.pool}
          onValueChange={choosePool}
          className="flex flex-wrap gap-x-6 gap-y-3"
        >
          {POOLS.map(({ value, label }) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} id={`pool-${value}`} />
              <Label htmlFor={`pool-${value}`} className="font-normal">
                {label[lang]}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">{t.investorType}</legend>
        <RadioGroup
          value={form.investorType}
          onValueChange={(v) => setForm({ ...form, investorType: v })}
          className="flex flex-wrap gap-x-6 gap-y-3"
        >
          {INVESTOR_TYPES.map(({ value, label }) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} id={`type-${value}`} />
              <Label htmlFor={`type-${value}`} className="font-normal">
                {label[lang]}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="waitlist-ticket">{t.ticket}</Label>
          <Select
            value={form.ticketRange}
            onValueChange={(v) => setForm({ ...form, ticketRange: v })}
            disabled={!currency}
          >
            <SelectTrigger id="waitlist-ticket" aria-describedby="waitlist-ticket-hint">
              <SelectValue placeholder={currency ? t.ticketPlaceholder : t.ticketNeedsPool} />
            </SelectTrigger>
            <SelectContent>
              {tickets.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label[lang]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currency && (
            <p id="waitlist-ticket-hint" className="text-xs text-muted-foreground">
              {currency === "BRL" ? t.ticketHintBRL : t.ticketHintUSD}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="waitlist-motivation">{t.motivation}</Label>
          <Select
            value={form.motivation}
            onValueChange={(v) => setForm({ ...form, motivation: v })}
          >
            <SelectTrigger id="waitlist-motivation">
              <SelectValue placeholder={t.motivationPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {MOTIVATIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label[lang]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="waitlist-consent"
          checked={form.consent}
          onCheckedChange={(checked) => setForm({ ...form, consent: checked === true })}
          className="mt-0.5"
        />
        <Label
          htmlFor="waitlist-consent"
          className="text-sm font-normal leading-relaxed text-muted-foreground"
        >
          {t.consent}
        </Label>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={sending}
        className="h-auto w-full gap-2 whitespace-normal py-3 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {sending ? (
          <>
            <Loader2 size={16} className="animate-spin" /> {t.sending}
          </>
        ) : (
          <>
            {t.submit} <Send size={16} />
          </>
        )}
      </Button>
    </form>
  );
};

export default InvestorWaitlistForm;
