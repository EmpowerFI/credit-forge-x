import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2, Lock, Pencil, Sparkles, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { localized, tr } from "../i18n";
import LanguageSwitch from "../i18n/LanguageSwitch";
import { DiaryLogo } from "./Brand";
import { AGE_RANGES, type AgeRange, diary, diaryErrorText, type EnrolForm, type FromApp } from "./diary";
import { ImpactChoiceText } from "./ImpactChoice";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

const SINCE = localized([
  { value: "1", label: { en: "Less than 6 months", pt: "Menos de 6 meses" } },
  { value: "6", label: { en: "6 months to 1 year", pt: "De 6 meses a 1 ano" } },
  { value: "12", label: { en: "1 to 3 years", pt: "De 1 a 3 anos" } },
  { value: "36", label: { en: "3 to 5 years", pt: "De 3 a 5 anos" } },
  { value: "60", label: { en: "More than 5 years", pt: "Mais de 5 anos" } },
  { value: "", label: { en: "I don't know", pt: "Não sei" } },
]);

const FORMALIZATION = localized([
  { value: "mei", label: { en: "Yes, I am a MEI", pt: "Sim, sou MEI" } },
  { value: "cnpj", label: { en: "Yes, another CNPJ", pt: "Sim, outro CNPJ" } },
  { value: "none", label: { en: "Not yet", pt: "Ainda não tenho" } },
]);

const FINANCE = localized([
  { value: "notebook", label: { en: "I write it in a notebook", pt: "Anoto num caderno" } },
  { value: "spreadsheet", label: { en: "I use a spreadsheet", pt: "Uso uma planilha" } },
  { value: "app", label: { en: "I use an app", pt: "Uso um aplicativo" } },
  { value: "memory", label: { en: "I keep it in my head", pt: "Controlo de cabeça" } },
  { value: "none", label: { en: "I don't track it yet", pt: "Ainda não controlo" } },
]);

/**
 * What she agrees to, item by item, each with a short title. Its version is
 * CONSENT_TEXT_VERSION in diary.ts: change both together.
 */
function ConsentText() {
  const items: { icon: typeof Lock; title: { en: string; pt: string }; body: ReactNode }[] = [
    {
      icon: Lock,
      title: { en: "Your figures are yours.", pt: "Seus números são seus." },
      body: tr({
        en: "Nobody sees what you record unless you authorise it, not even whoever sponsors your place.",
        pt: "Ninguém vê o que você registra sem você autorizar, nem quem patrocina a sua vaga.",
      }),
    },
    {
      icon: Users,
      title: { en: "A sponsor sees only the group.", pt: "O patrocinador vê só o grupo." },
      body: tr({
        en: "How many women take part and how many days they record, in groups of at least 5. Never your name, never your figures alone.",
        pt: "Quantas participam e quantos dias registram, em grupos de pelo menos 5. Nunca o seu nome, nunca os seus números sozinhos.",
      }),
    },
    {
      icon: Sparkles,
      title: { en: "AI writes your weekly reading.", pt: "A leitura da semana é escrita por IA." },
      body: tr({
        en: "Anthropic's AI receives your week's figures and your business sector, never your name, e-mail or city, and every number it writes is checked against yours. Prefer without AI? Turn it off under Reminders.",
        pt: "A IA da Anthropic recebe os valores da sua semana e o ramo do seu negócio, nunca seu nome, e-mail ou cidade, e cada número que ela escreve é conferido com os seus. Prefere sem IA? Desligue em Lembretes.",
      }),
    },
    {
      icon: Bell,
      title: { en: "Reminders, only if you want them.", pt: "Lembretes, só se quiser." },
      body: tr({ en: "You choose the time and turn them off whenever you like.", pt: "Você escolhe o horário e desliga quando quiser." }),
    },
    {
      icon: Trash2,
      title: { en: "You can delete everything.", pt: "Pode apagar tudo." },
      body: (
        <>
          {tr({ en: "Delete your account whenever you like, under Reminders. ", pt: "Exclua a sua conta quando quiser, em Lembretes. " })}
          <a className="underline" href="/privacidade" target="_blank" rel="noreferrer">{tr({ en: "Privacy policy", pt: "Política de privacidade" })}</a>
        </>
      ),
    },
  ];
  return (
    <ul className="space-y-4">
      {items.map(({ icon: Icon, title, body }) => (
        <li key={title.en} className="flex gap-3">
          <Icon size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="block font-semibold">{tr(title)}</span>
            <span className="block text-muted-foreground">{body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The sign-up. When her e-mail already has an account in the EmpowerFI app,
 * nothing it knows is asked again: she sees it, agrees, and starts. The
 * consent is still hers to give, because the diary keeps something the app
 * never did: her sales and expenses. "Correct my details" opens the whole
 * form, filled in.
 */
export default function Enrol({ fromApp }: { fromApp: FromApp | null }) {
  const queryClient = useQueryClient();
  const [short, setShort] = useState(fromApp !== null);
  const [name, setName] = useState(fromApp?.name ?? "");
  const [city, setCity] = useState(fromApp?.city ?? "");
  const [uf, setUf] = useState(fromApp?.state_uf ?? "");
  // The app's category, when her app account has one: the same list this form offers.
  const [sector, setSector] = useState(fromApp?.sector ?? "");
  const categories = useQuery({ queryKey: ["diary", "categories"], queryFn: diary.categories, staleTime: 60 * 60_000 });
  const listed = categories.data ?? [];
  const [age, setAge] = useState<string>(fromApp?.age_range ?? "");
  const [since, setSince] = useState<string | null>(null);
  const [formalization, setFormalization] = useState<string | null>(null);
  const [finance, setFinance] = useState<string | null>(null);
  const [adult, setAdult] = useState(false);
  const [consented, setConsented] = useState(false);
  const [shareImpact, setShareImpact] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(tr({ en: "Tell us your name.", pt: "Conte como prefere ser chamada." }));
    const declared = adult || fromApp?.declared === true;
    if (!declared) {
      return setError(tr({
        en: "This diary is for women entrepreneurs aged 18 or over.",
        pt: "Este diário é para mulheres empreendedoras com 18 anos ou mais.",
      }));
    }
    if (!age) return setError(tr({ en: "Choose your age range.", pt: "Escolha a sua faixa etária." }));
    if (!consented) return setError(tr({ en: "Your consent is needed to continue.", pt: "Precisamos do seu consentimento para continuar." }));
    const profile: EnrolForm = {
      name: name.trim(),
      adult_woman: adult,
      consented,
      share_impact: shareImpact,
      city: city.trim(),
      state_uf: uf,
      sector: sector.trim(),
      age_range: age as AgeRange,
      months_operating: since ? Number(since) : null,
      formalization: (formalization as EnrolForm["formalization"]) ?? null,
      finance_control: (finance as EnrolForm["finance_control"]) ?? null,
    };
    setBusy(true);
    setError(null);
    try {
      await diary.enrol(profile);
      await queryClient.invalidateQueries({ queryKey: ["diary"] });
    } catch (err) {
      setError(diaryErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  const choice = (id: string, label: string, items: { value: string; label: string }[], value: string | null, set: (v: string) => void) => (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <RadioGroup value={value ?? undefined} onValueChange={set} className="gap-1">
        {items.map((item) => (
          <label key={item.value || "none"} htmlFor={`${id}-${item.value || "none"}`}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3">
            <RadioGroupItem id={`${id}-${item.value || "none"}`} value={item.value} />
            {item.label}
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );

  const ageField = (
    <div className="space-y-2">
      <Label htmlFor="enrol-age">{tr({ en: "Age range", pt: "Faixa etária" })}</Label>
      <select id="enrol-age" value={age} onChange={(e) => setAge(e.target.value)} required
        className="h-12 w-full rounded-md border border-input bg-background px-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <option value="">{tr({ en: "Choose", pt: "Escolha" })}</option>
        {AGE_RANGES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
      </select>
    </div>
  );

  const box = "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 border-input bg-card p-4";
  const agree = (
    <>
      <section className="space-y-4" aria-labelledby="enrol-care">
        <h2 id="enrol-care" className="font-heading text-xl font-semibold">
          {tr({ en: "How we look after what you record", pt: "Como cuidamos do que você registra" })}
        </h2>
        <ConsentText />
      </section>
      {!fromApp?.declared && (
        <label htmlFor="enrol-adult" className={box}>
          <Checkbox id="enrol-adult" checked={adult} onCheckedChange={(v) => setAdult(v === true)} className="mt-0.5 h-6 w-6" />
          <span>{tr({ en: "I declare that I am a woman aged 18 or over.", pt: "Declaro que sou mulher e tenho 18 anos ou mais." })}</span>
        </label>
      )}
      <label htmlFor="enrol-consent" className={box}>
        <Checkbox id="enrol-consent" checked={consented} onCheckedChange={(v) => setConsented(v === true)} className="mt-0.5 h-6 w-6" />
        <span className="text-lg">{tr({ en: "I have read and agree.", pt: "Li e concordo." })}</span>
      </label>
      <label htmlFor="enrol-impact" className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 text-sm">
        <Checkbox id="enrol-impact" checked={shareImpact} onCheckedChange={(v) => setShareImpact(v === true)} className="mt-0.5 h-5 w-5" />
        <span>
          <ImpactChoiceText />
          <span className="block text-muted-foreground">{tr({ en: "Optional. You can change it any time.", pt: "Opcional. Você pode mudar quando quiser." })}</span>
        </span>
      </label>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="submit" className="h-14 w-full rounded-xl text-lg" disabled={busy || !consented}>
        {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
        {tr({ en: "Start my diary", pt: "Começar meu diário" })}
      </Button>
    </>
  );

  if (short && fromApp) {
    const place = [fromApp.city, fromApp.state_uf].filter(Boolean).join(" / ");
    const business = fromApp.business_name ?? fromApp.sector;
    const row = (label: string, value: string) => (
      <div className="flex items-center justify-between gap-4 border-b border-border py-4 first:pt-0">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="text-right font-semibold">{value}</dd>
      </div>
    );
    return (
      <main className="mx-auto max-w-md px-5 pb-8 pt-6">
        <div className="flex items-center justify-between gap-3">
          <DiaryLogo />
          <span className="text-muted-foreground">{tr({ en: "Last step", pt: "Último passo" })}</span>
        </div>
        <h1 className="mt-8 font-heading text-[2.25rem] font-semibold leading-tight">{tr({ en: "Before you start.", pt: "Antes de começar." })}</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {tr({
            en: "Your EmpowerFI app account brings you in. Check your details and how we look after them.",
            pt: "A sua conta do app EmpowerFI já traz você. Confira seus dados e como cuidamos deles.",
          })}
        </p>

        <form onSubmit={submit} className="mt-8 space-y-7" noValidate>
          {fromApp.name ? (
            <div className="rounded-xl border border-border bg-card p-5">
              <dl>
                {row(tr({ en: "Name", pt: "Nome" }), fromApp.name)}
                {business && row(tr({ en: "Business", pt: "Negócio" }), business)}
                {place && row(tr({ en: "City", pt: "Cidade" }), place)}
              </dl>
              <button type="button" onClick={() => { setShort(false); setError(null); }}
                className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Pencil size={18} aria-hidden="true" />{tr({ en: "Correct my details", pt: "Corrigir meus dados" })}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="enrol-name">{tr({ en: "What should we call you?", pt: "Como você prefere ser chamada?" })}</Label>
              <Input id="enrol-name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-12 text-base" />
            </div>
          )}
          {!fromApp.age_range && ageField}
          {agree}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 pb-8 pt-6">
      <div className="flex items-center justify-between gap-3">
        <DiaryLogo />
        <LanguageSwitch variant="pill" />
      </div>
      <h1 className="mt-8 font-heading text-[2.25rem] font-semibold leading-tight">{tr({ en: "Welcome!", pt: "Boas-vindas!" })}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{tr({ en: "A few questions to start. It takes two minutes.", pt: "Algumas perguntas para começar. Leva dois minutos." })}</p>

      <form onSubmit={submit} className="mt-6 space-y-6" noValidate>
        <div className="space-y-2">
          <Label htmlFor="enrol-name">{tr({ en: "What should we call you?", pt: "Como você prefere ser chamada?" })}</Label>
          <Input id="enrol-name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-12 text-base" />
        </div>

        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div className="space-y-2">
            <Label htmlFor="enrol-city">{tr({ en: "City of your business", pt: "Cidade do seu negócio" })}</Label>
            <Input id="enrol-city" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} className="h-12 text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="enrol-uf">{tr({ en: "State", pt: "Estado" })}</Label>
            <select id="enrol-uf" value={uf} onChange={(e) => setUf(e.target.value)}
              className="h-12 w-full rounded-md border border-input bg-background px-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">—</option>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {ageField}

        <div className="space-y-2">
          <Label htmlFor="enrol-sector">{tr({ en: "What do you sell or do?", pt: "O que você vende ou faz?" })}</Label>
          {listed.length > 0 ? (
            // The app's own categories: one name for one kind of business.
            <select id="enrol-sector" value={listed.some((c) => c.label === sector) ? sector : ""} onChange={(e) => setSector(e.target.value)}
              className="h-12 w-full rounded-md border border-input bg-background px-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">{tr({ en: "Choose a category", pt: "Escolha uma categoria" })}</option>
              {listed.map((c) => <option key={c.slug} value={c.label}>{c.icon ? `${c.icon} ` : ""}{c.label}</option>)}
            </select>
          ) : (
            <Input id="enrol-sector" value={sector} onChange={(e) => setSector(e.target.value)} maxLength={80} className="h-12 text-base"
              disabled={categories.isLoading}
              placeholder={tr({ en: "e.g. cakes to order, hair salon", pt: "ex.: bolo por encomenda, salão de beleza" })} />
          )}
        </div>

        {choice("since", tr({ en: "How long have you been doing it?", pt: "Há quanto tempo você trabalha com isso?" }), SINCE, since, setSince)}
        {choice("cnpj", tr({ en: "Does your business have a CNPJ?", pt: "O seu negócio tem CNPJ?" }), FORMALIZATION, formalization, setFormalization)}
        {choice("finance", tr({ en: "How do you track money in and out today?", pt: "Hoje, como você controla o dinheiro que entra e sai?" }), FINANCE, finance, setFinance)}

        {agree}
      </form>
    </main>
  );
}
