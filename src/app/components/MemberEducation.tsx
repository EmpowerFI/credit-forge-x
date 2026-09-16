import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Programme } from "../lib/education";
import { tr } from "../i18n";

interface Props {
  programmes: Programme[];
  completed: Set<string> | undefined;
  /** Shown to the people who may record progress for this member. */
  onCompleteNext?: (moduleId: string) => void;
  busy?: boolean;
}

/** One member's progress through each programme open to her community. */
export default function MemberEducation({ programmes, completed, onCompleteNext, busy }: Props) {
  return (
    <div className="space-y-2">
      {programmes.map((p) => {
        const done = p.modules.filter((m) => completed?.has(m.id)).length;
        const next = p.modules.find((m) => !completed?.has(m.id));
        const pct = p.modules.length ? Math.round((done / p.modules.length) * 100) : 0;
        return (
          <div key={p.id} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{p.title}</span>
              <span className="flex items-center gap-2">
                <span className={done === p.modules.length ? "font-medium text-positive" : "text-foreground"}>
                  {done}/{p.modules.length}
                </span>
                {onCompleteNext && next && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onCompleteNext(next.id)}
                    title={tr({ en: `Mark "${next.title}" as completed`, pt: `Marcar "${next.title}" como concluído` })}
                    className="h-6 gap-1 px-2 text-[11px]"
                  >
                    {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} {tr({ en: "Next module", pt: "Próximo módulo" })}
                  </Button>
                )}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-label={tr({ en: `${p.title}: ${done} of ${p.modules.length} modules`, pt: `${p.title}: ${done} de ${p.modules.length} módulos` })}
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
