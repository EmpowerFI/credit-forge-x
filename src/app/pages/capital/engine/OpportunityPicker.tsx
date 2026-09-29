import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import StatusPill from "../../../components/product/StatusPill";
import { localized, tr } from "../../../i18n";
import { REACHED } from "../../../lib/capitalJourney";
import type { EngineOpportunity } from "../../../lib/engine";
import { money, PURPOSE_LABEL } from "../../../lib/readiness";
import { bandLetter } from "./labels";
import { QUEUE_STATUS, queueStatus, statusTone } from "./status";

const line = (o: EngineOpportunity) =>
  tr({
    en: `${PURPOSE_LABEL[o.purpose as keyof typeof PURPOSE_LABEL] ?? o.purpose} · ${money(o.amount_cents)} · Risk ${bandLetter(o.risk_band)} · ${o.term_months} months`,
    pt: `${PURPOSE_LABEL[o.purpose as keyof typeof PURPOSE_LABEL] ?? o.purpose} · ${money(o.amount_cents)} · Risco ${bandLetter(o.risk_band)} · ${o.term_months} meses`,
  });

const GROUPS = localized([
  { settled: false, heading: { en: "Awaiting a decision", pt: "Aguardando decisão" } },
  { settled: true, heading: { en: "Already lent · the capital can be followed", pt: "Já emprestadas · dá para seguir o capital" } },
]);

/** "Select a qualified opportunity": searchable, from the queue the database keeps,
 * plus the requests that already became loans. */
export default function OpportunityPicker({ options, value, onChange, disabled }: {
  options: EngineOpportunity[];
  value: EngineOpportunity | null;
  onChange: (o: EngineOpportunity) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} disabled={disabled}
          className="h-auto w-full justify-between gap-3 rounded-xl border-border bg-background/40 px-4 py-3 text-left hover:bg-secondary/60">
          {value ? (
            <span className="min-w-0">
              <span className="block font-mono text-sm font-semibold text-foreground">{value.code}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">{line(value)}</span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">{tr({ en: "Select a qualified opportunity", pt: "Selecione uma oportunidade qualificada" })}</span>
          )}
          <ChevronsUpDown size={16} className="shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] border-border p-0" align="start">
        <Command filter={(v, search) => (v.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={tr({ en: "Search code, purpose, amount…", pt: "Buscar código, finalidade, valor…" })} />
          <CommandList className="max-h-80">
            <CommandEmpty>{tr({ en: "No qualified opportunity matches.", pt: "Nenhuma oportunidade qualificada encontrada." })}</CommandEmpty>
            {/* Two groups, because they answer two different questions. The
                queue is what still needs a decision; the settled ones are the
                only requests whose capital went anywhere, and the page's third
                act has nothing to follow without them. Mixing them would let
                someone pick a request that cannot show a loop without knowing
                that is what they picked. */}
            {GROUPS.map(({ settled, heading }) => {
              const group = options.filter((o) => o.settled === settled);
              if (group.length === 0) return null;
              return (
                <CommandGroup key={String(settled)} heading={`${heading} · ${group.length}`}>
                  {group.map((o) => {
                    const s = queueStatus(o);
                    return (
                      <CommandItem key={o.opportunity_id} value={`${o.code} ${line(o)} ${QUEUE_STATUS[s]} ${settled ? REACHED[o.reached] : ""}`}
                        onSelect={() => { onChange(o); setOpen(false); }} className="flex items-start gap-3 py-2.5">
                        <Check size={14} className={cn("mt-1 shrink-0", value?.opportunity_id === o.opportunity_id ? "opacity-100" : "opacity-0")} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-semibold">{o.code}</span>
                            <StatusPill tone={statusTone(s)} dot={false}>{QUEUE_STATUS[s]}</StatusPill>
                            {/* How far the capital got. Only for the settled
                                group, where it decides whether the third act
                                has a whole loop to show or two hops. */}
                            {settled && <span className="text-xs text-muted-foreground">· {REACHED[o.reached]}</span>}
                          </span>
                          <span className="block text-xs text-muted-foreground">{line(o)}</span>
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
