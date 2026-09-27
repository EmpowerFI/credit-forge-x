import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleSlash, Lock, Pencil, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import Panel from "../../../components/product/Panel";
import StatusPill from "../../../components/product/StatusPill";
import { tr } from "../../../i18n";
import {
  costLine, documentLabel, documentsAsked, INSTRUMENT_TYPE, saveInstrumentPolicy,
  type Instrument, type InstrumentPolicy, type Provider,
} from "../../../lib/capitalNetwork";
import { describeError } from "../../../lib/errors";
import { money, PURPOSE_LABEL } from "../../../lib/readiness";

// Every route the engine can take, and the policy it is offered under.
//
// An operator changes commercial terms here: a ticket range, a capacity, a cost,
// a mandate, the states and purposes served, the papers asked for, the share of
// her instalment a route may take, and whether the route is open. What kind of
// thing a route *is* — credit or not, domestic or global, whose approval it
// needs, what it is called — is owned by a migration, and the database refuses
// this screen if it tries. That line is addendum §12's guardrail, and it is
// checked where it cannot be lost in a translation.

type Purpose = keyof typeof PURPOSE_LABEL;
const PURPOSES = Object.keys(PURPOSE_LABEL) as Purpose[];

const reais = (cents: number | null) => (cents === null ? "" : String(cents / 100));
const centsOf = (value: string): number | null => {
  const n = Number(value.replace(",", "."));
  return value.trim() === "" || !Number.isFinite(n) ? null : Math.round(n * 100);
};
const bpsOf = (value: string): number | null => {
  const n = Number(value.replace(",", "."));
  return value.trim() === "" || !Number.isFinite(n) ? null : Math.round(n * 100);
};

const PERCENT = (bps: number | null) => (bps === null ? "" : String(bps / 100));

interface Form {
  active: boolean;
  ticketMin: string;
  ticketMax: string;
  capacity: string;
  cost: string;
  share: string;
  repays: boolean;
  minMonths: string;
  mandate: boolean;
  uf: string;
  purposes: Purpose[];
  documents: string[];
}

const formOf = (i: Instrument): Form => ({
  active: i.active,
  ticketMin: reais(i.ticket_min_cents),
  ticketMax: reais(i.ticket_max_cents),
  capacity: reais(i.capacity_cents),
  cost: PERCENT(i.estimated_cost_bps),
  share: PERCENT(i.max_instalment_share_bps),
  repays: i.max_instalment_share_bps !== null,
  minMonths: String(i.business_age_min_months),
  mandate: i.impact_mandate,
  uf: i.eligible_uf.join(", "),
  purposes: i.purposes as Purpose[],
  documents: [...i.required_documents],
});

const policyOf = (f: Form): InstrumentPolicy => ({
  active: f.active,
  ticket_min_cents: centsOf(f.ticketMin),
  ticket_max_cents: centsOf(f.ticketMax),
  capacity_cents: centsOf(f.capacity),
  estimated_cost_bps: bpsOf(f.cost),
  max_instalment_share_bps: f.repays ? bpsOf(f.share) : null,
  business_age_min_months: Math.max(0, Math.round(Number(f.minMonths) || 0)),
  impact_mandate: f.mandate,
  eligible_uf: f.uf.split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s)),
  purposes: f.purposes,
  required_documents: f.documents,
});

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Editor({ instrument, onClose }: { instrument: Instrument; onClose: () => void }) {
  // Money is centavos underneath and a rate is basis points, so every one of
  // these fields steps by a hundredth. A coarser step makes a perfectly good
  // edit — a ticket of R$ 1.005,50 — fail the browser's own validity check, and
  // the form then refuses to submit without saying why.
  const [form, setForm] = useState<Form>(() => formOf(instrument));
  const queryClient = useQueryClient();
  const asked = documentsAsked([instrument]);
  const choices = [...new Set([...asked, "cnpj_or_mei", "bank_statement_3m", "cpf", "proof_of_activity", "network_membership"])];
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = useMutation({
    mutationFn: () => saveInstrumentPolicy(instrument.id, policyOf(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform"] });
      toast.success(tr({
        en: "Policy saved. Its version moved, so a decision already recorded can still be read against the policy that made it.",
        pt: "Política salva. A versão dela avançou, então uma decisão já registrada continua legível contra a política que a produziu.",
      }));
      onClose();
    },
    onError: (error) => toast.error(describeError(error)),
  });

  return (
    <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
      <SheetHeader>
        <SheetTitle>{instrument.name}</SheetTitle>
        <SheetDescription>{INSTRUMENT_TYPE[instrument.instrument_type].what}</SheetDescription>
      </SheetHeader>

      <form
        className="space-y-5 py-5"
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      >
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
          <span className="min-w-0 text-sm text-foreground">
            {tr({ en: "Open to routing", pt: "Aberta para encaminhamento" })}
            <span className="block text-xs text-muted-foreground">
              {tr({ en: "A closed route is kept, with its policy, and stops being recommended.", pt: "Uma rota fechada é mantida, com sua política, e deixa de ser recomendada." })}
            </span>
          </span>
          <Switch checked={form.active} onCheckedChange={set("active")} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Field id="ticket-min" label={tr({ en: "Ticket from, R$", pt: "Ticket mínimo, R$" })}>
            <Input id="ticket-min" type="number" min={0} step="0.01" value={form.ticketMin} onChange={(e) => set("ticketMin")(e.target.value)} />
          </Field>
          <Field id="ticket-max" label={tr({ en: "Ticket up to, R$", pt: "Ticket máximo, R$" })}>
            <Input id="ticket-max" type="number" min={0} step="0.01" value={form.ticketMax} onChange={(e) => set("ticketMax")(e.target.value)} />
          </Field>
          <Field id="capacity" label={tr({ en: "Capacity left, R$", pt: "Capacidade restante, R$" })}
            hint={tr({ en: "What this provider still has stated for this route.", pt: "O que este provedor ainda tem declarado para esta rota." })}>
            <Input id="capacity" type="number" min={0} step="0.01" value={form.capacity} onChange={(e) => set("capacity")(e.target.value)} />
          </Field>
          <Field id="cost" label={tr({ en: "Her all-in cost, % a year", pt: "Custo total para ela, % ao ano" })}
            hint={tr({ en: "Leave empty where the route has no cost of capital.", pt: "Deixe vazio onde a rota não tem custo de capital." })}>
            <Input id="cost" type="number" min={0} step="0.01" value={form.cost} onChange={(e) => set("cost")(e.target.value)} />
          </Field>
          <Field id="min-months" label={tr({ en: "Months of reported history", pt: "Meses de histórico reportado" })}
            hint={tr({ en: "Counted from her check-ins: this product records no incorporation date.", pt: "Contados pelos check-ins dela: este produto não registra data de constituição." })}>
            <Input id="min-months" type="number" min={0} max={240} value={form.minMonths} onChange={(e) => set("minMonths")(e.target.value)} />
          </Field>
          <Field id="uf" label={tr({ en: "States served", pt: "Estados atendidos" })}
            hint={tr({ en: "Two letters each, comma separated. Empty means no restriction stated.", pt: "Duas letras cada, separados por vírgula. Vazio significa nenhuma restrição declarada." })}>
            <Input id="uf" value={form.uf} onChange={(e) => set("uf")(e.target.value)} placeholder="SP, MG" autoComplete="off" />
          </Field>
        </div>

        {instrument.is_credit ? (
          <div className="space-y-1.5">
            <Field id="share" label={tr({ en: "Share of her instalment this route may take, %", pt: "Parcela da prestação dela que esta rota pode tomar, %" })}
              hint={tr({ en: "A credit route must always state one — leaving it out is how the affordability gate gets skipped.", pt: "Uma rota de crédito precisa sempre declarar uma — deixá-la de fora é como o portão de capacidade de pagamento é ignorado." })}>
              <Input id="share" type="number" min={0.01} max={100} step="0.01" required value={form.share} onChange={(e) => set("share")(e.target.value)} />
            </Field>
          </div>
        ) : (
          <div className="rounded-xl border tone-caution p-3 text-xs">
            {tr({
              en: "This route has no repayment, so it states no share of her instalment. It is not credit, not a currency, and its unit of account is not money.",
              pt: "Esta rota não tem pagamento de volta, então não declara parcela nenhuma. Não é crédito, não é moeda, e sua unidade de conta não é dinheiro.",
            })}
          </div>
        )}

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-foreground">
            {tr({ en: "Purposes funded", pt: "Finalidades financiadas" })}{" "}
            {form.purposes.length === 0 && (
              <span className="font-normal text-muted-foreground">{tr({ en: "(any productive purpose)", pt: "(qualquer finalidade produtiva)" })}</span>
            )}
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {PURPOSES.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={form.purposes.includes(p)} onCheckedChange={() => set("purposes")(toggle(form.purposes, p))} />
                {PURPOSE_LABEL[p]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-foreground">{tr({ en: "Documents asked for", pt: "Documentos exigidos" })}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {choices.map((d) => (
              <label key={d} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={form.documents.includes(d)} onCheckedChange={() => set("documents")(toggle(form.documents, d))} />
                {documentLabel(d)}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
          <span className="min-w-0 text-sm text-foreground">
            {tr({ en: "Holds an impact mandate", pt: "Tem mandato de impacto" })}
            <span className="block text-xs text-muted-foreground">
              {tr({ en: "Weighs in the fit score for a woman-led business in a verified community.", pt: "Pesa na pontuação de encaixe para um negócio liderado por mulher em comunidade verificada." })}
            </span>
          </span>
          <Switch checked={form.mandate} onCheckedChange={set("mandate")} />
        </label>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />{" "}
          {tr({
            en: "Owned by a migration: what kind of route this is, whose approval it needs, and what it is called.",
            pt: "Definido por migração: que tipo de rota é, de quem depende a aprovação e como ela se chama.",
          })}
        </p>

        <SheetFooter className="gap-2 sm:justify-start">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? tr({ en: "Saving…", pt: "Salvando…" }) : tr({ en: "Save policy", pt: "Salvar política" })}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>{tr({ en: "Cancel", pt: "Cancelar" })}</Button>
        </SheetFooter>
      </form>
    </SheetContent>
  );
}

function Row({ instrument, provider, canEdit, onEdit }: {
  instrument: Instrument;
  provider: Provider | undefined;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const i = instrument;
  const kind = INSTRUMENT_TYPE[i.instrument_type];
  const pooled = i.pool !== null;
  return (
    <li className="panel min-w-0 space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-heading text-sm font-bold text-foreground">{i.name}</p>
          <p className="text-xs text-muted-foreground">
            {provider?.display_name ?? i.provider_id} · <span className="font-mono">{i.code}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusPill tone={kind.tone} dot={false}>{kind.label}</StatusPill>
          {/* The §12 guardrail, shown where it is read from: the column, not a label. */}
          {!i.is_credit && (
            <StatusPill tone="caution">{tr({ en: "Not credit", pt: "Não é crédito" })}</StatusPill>
          )}
          {i.requires_partner_approval && (
            <StatusPill tone="info" dot={false}>{tr({ en: "Partner approval required", pt: "Requer aprovação do parceiro" })}</StatusPill>
          )}
          {!i.active && <StatusPill tone="neutral">{tr({ en: "Closed", pt: "Fechada" })}</StatusPill>}
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{tr({ en: "Ticket", pt: "Ticket" })}</dt>
          <dd className="num text-foreground">
            {pooled
              ? tr({ en: "From funding_pools", pt: "De funding_pools" })
              : `${money(i.ticket_min_cents)} – ${money(i.ticket_max_cents)}`}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{tr({ en: "Her cost", pt: "Custo para ela" })}</dt>
          <dd className="num text-foreground">
            {pooled ? tr({ en: "Priced by the pool engine at run time", pt: "Precificado pelo motor de pool na execução" }) : costLine(i.estimated_cost_bps)}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{tr({ en: "Capacity", pt: "Capacidade" })}</dt>
          <dd className="num text-foreground">
            {pooled ? tr({ en: "What the pool has left", pt: "O que resta no pool" }) : money(i.capacity_cents)}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{tr({ en: "Instalment share", pt: "Parcela tomada" })}</dt>
          <dd className="num text-foreground">
            {i.max_instalment_share_bps === null
              ? tr({ en: "No repayment", pt: "Sem pagamento de volta" })
              : `${i.max_instalment_share_bps / 100}%`}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{tr({ en: "States", pt: "Estados" })}</dt>
          <dd className="text-foreground">{i.eligible_uf.length > 0 ? i.eligible_uf.join(", ") : tr({ en: "No restriction stated", pt: "Nenhuma restrição declarada" })}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{tr({ en: "Purposes", pt: "Finalidades" })}</dt>
          <dd className="text-foreground">
            {i.purposes.length > 0
              ? i.purposes.map((p) => PURPOSE_LABEL[p as Purpose] ?? p).join(", ")
              : tr({ en: "Any productive purpose", pt: "Qualquer finalidade produtiva" })}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{tr({ en: "Reported history", pt: "Histórico reportado" })}</dt>
          <dd className="num text-foreground">
            {i.business_age_min_months === 0
              ? tr({ en: "None required", pt: "Nenhum exigido" })
              : tr({ en: `${i.business_age_min_months} months or more`, pt: `${i.business_age_min_months} meses ou mais` })}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{tr({ en: "Papers", pt: "Documentos" })}</dt>
          <dd className="text-foreground">
            {i.required_documents.length > 0
              ? i.required_documents.map(documentLabel).join(", ")
              : tr({ en: "None", pt: "Nenhum" })}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        <p className="text-xs text-muted-foreground">
          {tr({ en: "Policy version", pt: "Versão da política" })} <span className="num text-foreground">{i.policy_version}</span>
          {i.impact_mandate && <> · <ShieldCheck size={12} className="inline text-info" aria-hidden /> {tr({ en: "Impact mandate", pt: "Mandato de impacto" })}</>}
          {i.is_simulated && <> · {tr({ en: "Simulated", pt: "Simulada" })}</>}
        </p>
        {pooled ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock size={12} aria-hidden /> {tr({ en: "Policy lives in funding_pools", pt: "A política fica em funding_pools" })}
          </p>
        ) : canEdit ? (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
            <Pencil size={13} aria-hidden /> {tr({ en: "Edit policy", pt: "Editar política" })}
          </Button>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleSlash size={12} aria-hidden /> {tr({ en: "Read only for your role", pt: "Somente leitura para o seu perfil" })}
          </p>
        )}
      </div>
    </li>
  );
}

export default function Instruments({ instruments, providers, canEdit }: {
  instruments: Instrument[];
  providers: Provider[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<Instrument | null>(null);
  const byId = new Map(providers.map((p) => [p.id, p]));
  return (
    <Panel
      id="instruments"
      title={tr({ en: "Instruments", pt: "Instrumentos" })}
      description={tr({
        en: "Every route the engine can take, and the policy it is offered under. A new route arrives by migration, because creating one declares what kind of thing it is.",
        pt: "Toda rota que o motor pode tomar, e a política sob a qual é oferecida. Uma rota nova entra por migração, porque criá-la declara que tipo de coisa ela é.",
      })}
    >
      {instruments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tr({ en: "No instrument is registered yet.", pt: "Nenhum instrumento cadastrado ainda." })}
        </p>
      ) : (
        <ul className="space-y-3">
          {instruments.map((i) => (
            <Row key={i.id} instrument={i} provider={byId.get(i.provider_id)} canEdit={canEdit} onEdit={() => setEditing(i)} />
          ))}
        </ul>
      )}
      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && <Editor instrument={editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </Panel>
  );
}
