import type { ReactNode } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import type { RiskBand } from "@empowerfi/capital-allocation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import Panel from "../../../components/product/Panel";
import StatusPill from "../../../components/product/StatusPill";
import { localized, tr } from "../../../i18n";
import { POOL, type PoolId } from "../../../lib/capital";
import type { PoolForm } from "./pools";
import { PURPOSE_LABEL } from "../../../lib/readiness";

// Engine assumptions: each pool's liquidity and policy, as the database holds
// them, editable here for the next run and replay. Simulated; nothing is saved.

const BANDS: RiskBand[] = ["LOW", "MEDIUM", "HIGH"];
const BAND_LABEL: Record<RiskBand, string> = localized({
  LOW: { en: "A · lower", pt: "A · menor" },
  MEDIUM: { en: "B · moderate", pt: "B · moderada" },
  HIGH: { en: "C · higher", pt: "C · maior" },
});

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function PoolInputs({ id, form, onChange }: { id: PoolId; form: PoolForm; onChange: (f: PoolForm) => void }) {
  const set = <K extends keyof PoolForm>(k: K) => (v: PoolForm[K]) => onChange({ ...form, [k]: v });
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const global = id === "global";
  return (
    <Panel title={POOL[id].name}
      description={`${POOL[id].investors} · ${POOL[id].asset}.`}
      actions={<StatusPill tone="caution" dot={false}>{tr({ en: "Simulated", pt: "Simulado" })}</StatusPill>}>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${id}-available`} label={global ? tr({ en: "Available, USDC", pt: "Disponível, USDC" }) : tr({ en: "Available, R$", pt: "Disponível, R$" })}>
          <Input id={`${id}-available`} type="number" min={0} value={form.available} onChange={(e) => set("available")(e.target.value)} />
        </Field>
        <Field id={`${id}-return`} label={tr({ en: "Required return, % a year", pt: "Retorno exigido, % ao ano" })}>
          <Input id={`${id}-return`} type="number" min={0} step="0.5" value={form.requiredReturn} onChange={(e) => set("requiredReturn")(e.target.value)} />
        </Field>
        <Field id={`${id}-min`} label={tr({ en: "Ticket from, R$", pt: "Ticket mínimo, R$" })}>
          <Input id={`${id}-min`} type="number" min={0} value={form.minTicket} onChange={(e) => set("minTicket")(e.target.value)} />
        </Field>
        <Field id={`${id}-max`} label={tr({ en: "Ticket up to, R$", pt: "Ticket máximo, R$" })}>
          <Input id={`${id}-max`} type="number" min={0} value={form.maxTicket} onChange={(e) => set("maxTicket")(e.target.value)} />
        </Field>
        {global && (
          <>
            <Field id={`${id}-hedge`} label={tr({ en: "FX hedge, % a year", pt: "Hedge cambial, % ao ano" })}>
              <Input id={`${id}-hedge`} type="number" min={0} step="0.25" value={form.fxHedge} onChange={(e) => set("fxHedge")(e.target.value)} />
            </Field>
            <Field id={`${id}-ramp`} label={tr({ en: "Ramp, % each way", pt: "Rampa, % em cada sentido" })}>
              <Input id={`${id}-ramp`} type="number" min={0} step="0.25" value={form.ramp} onChange={(e) => set("ramp")(e.target.value)} />
            </Field>
          </>
        )}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-foreground">{tr({ en: "Risk appetite", pt: "Apetite a risco" })}</legend>
        <div className="flex flex-wrap gap-4">
          {BANDS.map((b) => (
            <label key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={form.bands.includes(b)} onCheckedChange={() => set("bands")(toggle(form.bands, b))} /> {BAND_LABEL[b]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-foreground">{tr({ en: "Mandate: productive purposes", pt: "Mandato: finalidades produtivas" })} {form.purposes.length === 0 && <span className="font-normal text-muted-foreground">{tr({ en: "(any)", pt: "(qualquer uma)" })}</span>}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {Object.entries(PURPOSE_LABEL).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={form.purposes.includes(k)} onCheckedChange={() => set("purposes")(toggle(form.purposes, k))} /> {label}
            </label>
          ))}
        </div>
      </fieldset>
      {global && (
        <label className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          {tr({ en: "Impact mandate: women-led businesses in verified communities", pt: "Mandato de impacto: negócios liderados por mulheres em comunidades verificadas" })}
          <Switch checked={form.impact} onCheckedChange={set("impact")} />
        </label>
      )}
    </Panel>
  );
}

/** The drawer that holds both pools' assumptions, out of the main workflow. */
export default function Assumptions({ domestic, global, onDomestic, onGlobal, onReset, changed }: {
  domestic: PoolForm; global: PoolForm; onDomestic: (f: PoolForm) => void; onGlobal: (f: PoolForm) => void; onReset: () => void; changed: boolean;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <SlidersHorizontal size={16} /> {tr({ en: "Engine assumptions", pt: "Premissas do motor" })}
          {changed && <span className="h-2 w-2 rounded-full bg-accent" aria-label={tr({ en: "changed", pt: "alteradas" })} />}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto border-border bg-background sm:max-w-xl">
        <SheetHeader className="space-y-2 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="font-heading">{tr({ en: "Engine assumptions", pt: "Premissas do motor" })}</SheetTitle>
            <StatusPill tone="caution" dot={false}>{tr({ en: "Simulated assumptions", pt: "Premissas simuladas" })}</StatusPill>
          </div>
          <SheetDescription>
            {tr({
              en: "Each pool's liquidity and policy, as the database holds them. Change them to see the next run and the replay answer differently. Nothing here is saved.",
              pt: "A liquidez e a política de cada pool, como estão no banco de dados. Mude para ver a próxima execução e o replay responderem diferente. Nada aqui é salvo.",
            })}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-5">
          <PoolInputs id="domestic" form={domestic} onChange={onDomestic} />
          <PoolInputs id="global" form={global} onChange={onGlobal} />
          <Button variant="ghost" className="gap-2" onClick={onReset} disabled={!changed}>
            <RotateCcw size={14} /> {tr({ en: "Back to the database's values", pt: "Voltar aos valores do banco de dados" })}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
