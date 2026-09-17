import { useSearchParams } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import { DataTag } from "../../components/product/DataLegend";
import ExplorerLink from "../../components/product/ExplorerLink";
import Panel from "../../components/product/Panel";
import { formatDateTime, tr } from "../../i18n";
import { ACTOR_LABEL, EVENT_LABEL } from "../../lib/audit";
import { useEvents } from "./queries";
import VerifyButton from "../../components/proof/VerifyButton";
import type { AnchorKind } from "../../lib/platform";

const ALL = "all";
// Enum values read as words; codes and versions stay as they are.
const pretty = (label: string) =>
  label.split(" · ").map((part) => (/^[A-Za-z_]+$/.test(part) ? part.toLowerCase().replace(/_/g, " ") : part)).join(" · ");
const when = (iso: string) => formatDateTime(iso, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** What happened on the platform, newest first: who caused it, by role, and the proof it left. */
export default function Events() {
  const [params, setParams] = useSearchParams();
  const kind = params.get("kind");
  const events = useEvents(kind);

  const setKind = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === ALL) next.delete("kind");
    else next.set("kind", v);
    setParams(next, { replace: true });
  };

  if (events.isError) return <LoadError error={events.error} onRetry={() => events.refetch()} />;

  return (
    <Panel title={tr({ en: "Event log", pt: "Registro de eventos" })}
      description={tr({
        en: "The latest 200 facts, from every table that records one. Actors appear by role; participants by code. What a fact contains stays behind its proof.",
        pt: "Os 200 fatos mais recentes, de todas as tabelas que registram algum. Quem agiu aparece pelo papel; as participantes, pelo código. O conteúdo de cada fato fica protegido por trás da sua prova.",
      })}
      actions={
        <Select value={kind ?? ALL} onValueChange={setKind}>
          <SelectTrigger className="w-[14rem]" aria-label={tr({ en: "Kind of event", pt: "Tipo de evento" })}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{tr({ en: "Every event", pt: "Todos os eventos" })}</SelectItem>
            {Object.entries(EVENT_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      }>
      {!events.data ? <Skeleton className="h-96 w-full" /> : (
        <div className="relative -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">{tr({ en: "When", pt: "Quando" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Event", pt: "Evento" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Who", pt: "Quem" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Subject", pt: "Sobre" })}</th>
                <th className="py-2 font-medium">{tr({ en: "Proof", pt: "Prova" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.data.map((e, i) => (
                <tr key={`${e.kind}-${e.at}-${i}`}>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-muted-foreground">{when(e.at)}</td>
                  <td className="py-2.5 pr-4">
                    <span className="block text-foreground">{EVENT_LABEL[e.kind] ?? e.kind}</span>
                    {e.label && <span className="text-xs text-muted-foreground">{pretty(e.label)}</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{ACTOR_LABEL[e.actor] ?? e.actor}</td>
                  <td className="py-2.5 pr-4 text-xs">
                    {e.participant && <span className="font-mono text-foreground">{e.participant}</span>}
                    {e.community && <span className="block text-muted-foreground">{e.community}</span>}
                    {!e.participant && !e.community && <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-2.5 text-xs">
                    {!e.proof ? <span className="text-muted-foreground">{tr({ en: "Not a proven fact", pt: "Fato sem prova" })}</span>
                      : e.proof.status !== "confirmed" ? <span className="text-caution">{tr({
                        en: `Proof ${e.proof.status}`,
                        pt: `Prova ${({ pending: "pendente", submitted: "enviada", failed: "com falha" } as Record<string, string>)[e.proof.status] ?? e.proof.status}`,
                      })}</span>
                      : (
                        <span className="flex flex-wrap items-center gap-2">
                          <DataTag kind="proven" />
                          {e.proof.signature && <ExplorerLink tx={e.proof.signature} />}
                          <VerifyButton proof={{ kind: e.proof.kind as AnchorKind, entity_id: e.proof.entity_id, status: e.proof.status, signature: e.proof.signature }} />
                        </span>
                      )}
                  </td>
                </tr>
              ))}
              {events.data.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">{tr({ en: "Nothing recorded yet.", pt: "Nada registrado ainda." })}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
