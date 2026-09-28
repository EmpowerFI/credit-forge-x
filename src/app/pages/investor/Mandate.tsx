import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import Panel from "../../components/product/Panel";
import StatusPill from "../../components/product/StatusPill";
import { tr } from "../../i18n";
import { describeError } from "../../lib/errors";
import { type Grade, RISK } from "../../lib/investor";
import { type Mandate, matchesMandate } from "../../lib/mandate";
import { platform } from "../../lib/platform";
import { money, PURPOSE_LABEL, sectorLabel, type CreditPurpose } from "../../lib/readiness";
import { useMandate, useMarket } from "./queries";

const SECTORS = ["food", "beauty", "crafts", "fashion", "retail", "services"];
const PURPOSES = Object.keys(PURPOSE_LABEL) as CreditPurpose[];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

const any = () => tr({ en: "Any", pt: "Qualquer" });

function Toggles<T extends string>({ values, options, label, onChange }: {
  values: T[]; options: [T, string][]; label: string; onChange: (v: T[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{label} <span className="text-xs font-normal text-muted-foreground">{tr({ en: "· none ticked means any", pt: "· nenhum marcado significa qualquer" })}</span></legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map(([v, l]) => (
          <label key={v} className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox checked={values.includes(v)} onCheckedChange={(c) => onChange(c ? [...values, v] : values.filter((x) => x !== v))} /> {l}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function EditMandate({ mandate, open, onOpenChange }: { mandate: Mandate | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState(mandate?.kind ?? "individual");
  const [label, setLabel] = useState(mandate?.label ?? "");
  const [impact, setImpact] = useState(mandate?.impact_mandate ?? false);
  const [purposes, setPurposes] = useState<CreditPurpose[]>((mandate?.purposes ?? []) as CreditPurpose[]);
  const [sectors, setSectors] = useState<string[]>(mandate?.sectors ?? []);
  const [risk, setRisk] = useState<Grade[]>((mandate?.risk_bands ?? []) as Grade[]);
  const [states, setStates] = useState((mandate?.states ?? []).join(", "));
  const [min, setMin] = useState(mandate?.min_ticket_cents != null ? String(mandate.min_ticket_cents / 100) : "");
  const [max, setMax] = useState(mandate?.max_ticket_cents != null ? String(mandate.max_ticket_cents / 100) : "");

  const save = useMutation({
    mutationFn: async () => {
      const cents = (v: string) => (v.trim() ? Math.round(Number(v.replace(",", ".")) * 100) : null);
      const { error } = await platform.rpc("set_mandate", {
        p_kind: kind, p_label: label, p_impact_mandate: impact, p_purposes: purposes, p_sectors: sectors, p_risk_bands: risk, p_pools: [],
        p_states: states.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean),
        p_min_ticket_cents: cents(min) ?? undefined, p_max_ticket_cents: cents(max) ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "investor-mandate"] });
      toast.success(tr({ en: "Mandate saved", pt: "Mandato salvo" }));
      onOpenChange(false);
    },
    onError: (e) => toast.error(describeError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{tr({ en: "Your mandate", pt: "Seu mandato" })}</DialogTitle>
          <DialogDescription>{tr({
            en: "What you fund. The console matches every opportunity against it, using only what investors already see.",
            pt: "O que você financia. O console compara cada oportunidade com ele, usando só o que investidores já veem.",
          })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">{tr({ en: "Investor type", pt: "Tipo de investidor" })}</legend>
              <div className="flex gap-4">
                {(["individual", "impact_fund"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm text-foreground">
                    <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} className="accent-[hsl(var(--accent))]" />
                    {k === "impact_fund" ? tr({ en: "Impact fund", pt: "Fundo de impacto" }) : tr({ en: "Individual", pt: "Pessoa física" })}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="mandate-label">{tr({ en: "Name shown", pt: "Nome exibido" })}</Label>
              <Input id="mandate-label" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} />
            </div>
          </div>
          <label className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
            <span className="space-y-0.5">
              <span className="block text-sm font-medium text-foreground">{tr({ en: "Impact mandate", pt: "Mandato de impacto" })}</span>
              <span className="block text-xs text-muted-foreground">{tr({ en: "Only women-led businesses in verified communities.", pt: "Só negócios liderados por mulheres em comunidades verificadas." })}</span>
            </span>
            <Switch checked={impact} onCheckedChange={setImpact} />
          </label>
          <Toggles label={tr({ en: "Productive purpose", pt: "Finalidade produtiva" })} values={purposes} onChange={setPurposes}
            options={PURPOSES.map((p) => [p, PURPOSE_LABEL[p]])} />
          <Toggles label={tr({ en: "Sector", pt: "Setor" })} values={sectors} onChange={setSectors} options={SECTORS.map((s) => [s, sectorLabel(s)])} />
          <Toggles label={tr({ en: "Risk appetite", pt: "Apetite a risco" })} values={risk} onChange={setRisk}
            options={(["LOW", "MEDIUM", "HIGH"] as Grade[]).map((g) => [g, RISK[g].label])} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="mandate-states">{tr({ en: "States (UF)", pt: "Estados (UF)" })}</Label>
              <Input id="mandate-states" placeholder="PE, BA" value={states} onChange={(e) => setStates(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mandate-min">{tr({ en: "Ticket from (R$)", pt: "Ticket a partir de (R$)" })}</Label>
              <Input id="mandate-min" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mandate-max">{tr({ en: "Ticket up to (R$)", pt: "Ticket até (R$)" })}</Label>
              <Input id="mandate-max" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{tr({ en: "Cancel", pt: "Cancelar" })}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
            {save.isPending && <Loader2 size={15} className="animate-spin" />} {tr({ en: "Save mandate", pt: "Salvar mandato" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The investor's mandate, and how many open opportunities fit it. */
export default function MandatePanel() {
  const mandate = useMandate();
  const market = useMarket();
  const [editing, setEditing] = useState(false);
  const m = mandate.data ?? null;
  const open = (market.data ?? []).filter((o) => o.funding_status === "open" || o.funding_status === "partially_funded");
  const fit = open.filter((o) => matchesMandate(m, o)).length;
  const list = (xs: string[], f: (x: string) => string) => (xs.length ? xs.map(f).join(", ") : any());

  return (
    <Panel
      title={<span className="flex items-center gap-2"><Target size={16} className="text-accent" aria-hidden />{m?.label ?? tr({ en: "Your mandate", pt: "Seu mandato" })}</span>}
      description={m
        ? tr({ en: `${fit} of ${open.length} opportunities raising now fit this mandate.`, pt: `${fit} de ${open.length} oportunidades captando agora cabem neste mandato.` })
        : tr({ en: "No mandate yet: every opportunity is shown. Set one to see what fits.", pt: "Ainda sem mandato: todas as oportunidades aparecem. Defina um para ver o que cabe." })}
      actions={
        <>
          {m?.kind === "impact_fund" && <StatusPill tone="info" dot={false}>{tr({ en: "Impact fund", pt: "Fundo de impacto" })}</StatusPill>}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)} disabled={mandate.isPending}>
            <Pencil size={13} /> {m ? tr({ en: "Edit", pt: "Editar" }) : tr({ en: "Set a mandate", pt: "Definir mandato" })}
          </Button>
        </>
      }>
      {m && (
        <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Row label={tr({ en: "Target population", pt: "Público-alvo" })}>
            {m.impact_mandate ? tr({ en: "Women-led, verified communities", pt: "Lideradas por mulheres, comunidades verificadas" }) : any()}
          </Row>
          <Row label={tr({ en: "Geography", pt: "Território" })}>{list(m.states, (s) => s)}</Row>
          <Row label={tr({ en: "Purpose", pt: "Finalidade" })}>{list(m.purposes, (p) => PURPOSE_LABEL[p as CreditPurpose])}</Row>
          <Row label={tr({ en: "Ticket", pt: "Ticket" })}>
            {m.min_ticket_cents === null && m.max_ticket_cents === null ? any() : `${money(m.min_ticket_cents ?? 0)} – ${m.max_ticket_cents === null ? "…" : money(m.max_ticket_cents)}`}
          </Row>
          <Row label={tr({ en: "Risk appetite", pt: "Apetite a risco" })}>{list(m.risk_bands, (g) => RISK[g as Grade].grade)}</Row>
        </dl>
      )}
      {editing && <EditMandate mandate={m} open={editing} onOpenChange={setEditing} />}
    </Panel>
  );
}
