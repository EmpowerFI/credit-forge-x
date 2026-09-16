import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConsentScopes } from "../../components/consent/ConsentScopes";
import { type Choices, choicesOf, consequences, type ConsentRecord, NONE, sameChoices } from "../../lib/consent";
import { describeError } from "../../lib/errors";
import { platform } from "../../lib/platform";
import { tr } from "../../i18n";

/**
 * A leader records a participant's consent from the form she signed: how most
 * participants give it. The record says it came from the community, and is
 * proven on Solana like one she gives herself in the app.
 */
export default function ConsentDialog({ communityId, entrepreneur, current, open, onOpenChange }: {
  communityId: string;
  entrepreneur: { entrepreneur_id: string; display_name: string };
  current: ConsentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Choices>(NONE);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(choicesOf(current));
      setSigned(false);
    }
  }, [open, current]);

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await platform.rpc("record_consent", {
        p_assessment: draft.assessment, p_partner: draft.partner, p_investors: draft.investors, p_impact: draft.impact,
        p_entrepreneur_id: entrepreneur.entrepreneur_id,
      });
      if (error) throw error;
      return data as { consent_no: number; reused: boolean };
    },
    onSuccess: (r) => {
      for (const key of ["ci-journey", "ci-participants"]) queryClient.invalidateQueries({ queryKey: ["platform", key, communityId] });
      toast.success(r.reused
        ? tr({ en: "Nothing changed.", pt: "Nada mudou." })
        : tr({ en: `Recorded as #${r.consent_no}. Its proof is on its way to Solana.`, pt: `Registrado como #${r.consent_no}. A prova está a caminho da Solana.` }));
      onOpenChange(false);
    },
    onError: (e) => toast.error(describeError(e)),
  });

  const changed = !current || !sameChoices(draft, choicesOf(current));
  const effects = changed ? consequences(current ? choicesOf(current) : null, draft) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tr({ en: `${entrepreneur.display_name}'s consent`, pt: `Consentimento de ${entrepreneur.display_name}` })}</DialogTitle>
          <DialogDescription>
            {tr({
              en: "Record exactly what she chose on the signed form. She can change it herself in the app at any time; each change is a new record.",
              pt: "Registre exatamente o que ela escolheu no formulário assinado. Ela pode mudar isso sozinha no app a qualquer momento; cada mudança gera um novo registro.",
            })}
          </DialogDescription>
        </DialogHeader>

        <ConsentScopes value={draft} onChange={setDraft} disabled={save.isPending} />

        {effects.length > 0 && (
          <ul className="list-disc space-y-1 rounded-xl border border-info/40 bg-info/5 p-4 pl-8 text-sm text-muted-foreground">
            {effects.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}

        <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
          <Checkbox checked={signed} onCheckedChange={(v) => setSigned(v === true)} className="mt-0.5" />
          {tr({ en: "I have her signed form, and these are her choices.", pt: "Tenho o formulário assinado por ela, e estas são as escolhas dela." })}
        </label>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{tr({ en: "Cancel", pt: "Cancelar" })}</Button>
          <Button onClick={() => save.mutate()} disabled={!signed || !changed || save.isPending} className="gap-2">
            {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} {tr({ en: "Record consent", pt: "Registrar consentimento" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
