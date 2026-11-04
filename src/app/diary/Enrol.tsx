import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { localized, tr } from "../i18n";
import LanguageSwitch from "../i18n/LanguageSwitch";
import { diary, diaryErrorText, type EnrolForm, type FromApp } from "./diary";
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

/** What she agrees to. Its version is CONSENT_TEXT_VERSION in diary.ts: change both together. */
function ConsentText() {
  return tr({
    en: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Your figures are yours. Nobody sees what you record unless you authorise it, not even whoever sponsors your place.</li>
        <li>If a sponsor backs your participation, it sees only group figures -- how many women take part and how many days they record -- in groups of at least 5. Never your name, never your figures alone.</li>
        <li>Reminders are optional: you choose the time and can turn them off at any moment.</li>
        <li>If you record by voice or in your own words, what you say is read by AI services (OpenAI and Anthropic, in the United States) only to prepare the record. The audio is not kept, the text is deleted within 24 hours, and nothing is recorded before you confirm.</li>
        <li>You can ask for your data to be deleted. Details in the <a className="underline" href="/privacidade" target="_blank" rel="noreferrer">privacy policy</a>.</li>
      </ul>
    ),
    pt: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Os seus números são seus. Ninguém vê o que você registra sem você autorizar, nem quem patrocina a sua vaga.</li>
        <li>Se um patrocinador apoia a sua participação, ele vê só números do grupo (quantas participam e quantos dias registram), em grupos de pelo menos 5. Nunca o seu nome, nunca os seus números sozinhos.</li>
        <li>Os lembretes são opcionais: você escolhe o horário e pode desligar quando quiser.</li>
        <li>Se você registrar por áudio ou escrevendo do seu jeito, o que você diz é lido por serviços de inteligência artificial (OpenAI e Anthropic, nos Estados Unidos) só para montar o registro. O áudio não fica guardado, o texto é apagado em até 24 horas, e nada é registrado antes de você confirmar.</li>
        <li>Você pode pedir a exclusão dos seus dados. Detalhes na <a className="underline" href="/privacidade" target="_blank" rel="noreferrer">política de privacidade</a>.</li>
      </ul>
    ),
  });
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
    if (!consented) return setError(tr({ en: "Your consent is needed to continue.", pt: "Precisamos do seu consentimento para continuar." }));
    const profile: EnrolForm = {
      name: name.trim(),
      adult_woman: adult,
      consented,
      share_impact: shareImpact,
      city: city.trim(),
      state_uf: uf,
      sector: sector.trim(),
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

  const agree = (
    <>
      <div className="space-y-3 rounded-md border border-border p-3 text-sm">
        <ConsentText />
      </div>
      {!fromApp?.declared && (
        <label htmlFor="enrol-adult" className="flex cursor-pointer items-start gap-3">
          <Checkbox id="enrol-adult" checked={adult} onCheckedChange={(v) => setAdult(v === true)} className="mt-0.5" />
          <span>{tr({ en: "I declare that I am a woman aged 18 or over.", pt: "Declaro que sou mulher e tenho 18 anos ou mais." })}</span>
        </label>
      )}
      <label htmlFor="enrol-consent" className="flex cursor-pointer items-start gap-3">
        <Checkbox id="enrol-consent" checked={consented} onCheckedChange={(v) => setConsented(v === true)} className="mt-0.5" />
        <span>{tr({ en: "I have read and agree.", pt: "Li e concordo." })}</span>
      </label>
      <label htmlFor="enrol-impact" className="flex cursor-pointer items-start gap-3">
        <Checkbox id="enrol-impact" checked={shareImpact} onCheckedChange={(v) => setShareImpact(v === true)} className="mt-0.5" />
        <span>
          <ImpactChoiceText />
          <span className="block text-muted-foreground">{tr({ en: "Optional. You can change it any time.", pt: "Opcional. Você pode mudar quando quiser." })}</span>
        </span>
      </label>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
        {tr({ en: "Start my diary", pt: "Começar meu diário" })}
      </Button>
    </>
  );

  if (short && fromApp) {
    const place = [fromApp.city, fromApp.state_uf].filter(Boolean).join(" / ");
    const business = fromApp.business_name ?? fromApp.sector;
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="flex justify-end"><LanguageSwitch /></div>
        <h1 className="mt-4 text-xl font-semibold">
          {fromApp.name
            ? tr({ en: `Hi, ${fromApp.name}!`, pt: `Oi, ${fromApp.name}!` })
            : tr({ en: "Hi!", pt: "Oi!" })}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {tr({
            en: "You already have an account in the EmpowerFI app, so there is no need to sign up again.",
            pt: "Você já tem conta no app EmpowerFI, então não precisa se cadastrar de novo.",
          })}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-6" noValidate>
          {fromApp.name ? (
            <dl className="space-y-2 rounded-md bg-muted p-4 text-sm">
              <div><dt className="text-muted-foreground">{tr({ en: "Name", pt: "Nome" })}</dt><dd className="font-medium">{fromApp.name}</dd></div>
              {business && <div><dt className="text-muted-foreground">{tr({ en: "Business", pt: "Negócio" })}</dt><dd className="font-medium">{business}</dd></div>}
              {place && <div><dt className="text-muted-foreground">{tr({ en: "City", pt: "Cidade" })}</dt><dd className="font-medium">{place}</dd></div>}
              <Button type="button" variant="link" className="h-10 px-0" onClick={() => { setShort(false); setError(null); }}>
                {tr({ en: "Correct my details", pt: "Corrigir meus dados" })}
              </Button>
            </dl>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="enrol-name">{tr({ en: "What should we call you?", pt: "Como você prefere ser chamada?" })}</Label>
              <Input id="enrol-name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-12 text-base" />
            </div>
          )}
          {agree}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="flex justify-end"><LanguageSwitch /></div>
      <h1 className="mt-4 text-xl font-semibold">{tr({ en: "Welcome! A few questions to start", pt: "Boas-vindas! Algumas perguntas para começar" })}</h1>
      <p className="mt-1 text-muted-foreground">{tr({ en: "It takes two minutes.", pt: "Leva dois minutos." })}</p>

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
