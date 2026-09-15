import { useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ACTION, type OutreachAction } from "../../lib/community";
import { useRecordOutreach } from "./queries";

/**
 * Logs outreach the community did on its own channels. Nothing is sent from
 * here: the leader reaches people by WhatsApp or in person, then records it,
 * so the work counts in cost to serve and the queue moves on.
 */
export default function OutreachDialog({ communityId, action, people, open, onOpenChange }: {
  communityId: string;
  action: OutreachAction;
  people: { entrepreneur_id: string; display_name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const record = useRecordOutreach(communityId);
  const a = ACTION[action];

  useEffect(() => {
    if (open) {
      setSelected(new Set(people.map((p) => p.entrepreneur_id)));
      setNote("");
    }
  }, [open, people]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () =>
    record.mutate({ action, ids: [...selected], note }, { onSuccess: () => onOpenChange(false) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{a.label}</DialogTitle>
          <DialogDescription>
            Reach them on your usual channel, then log it here. Nothing is sent from EmpowerFI. Each contact counts about{" "}
            {a.minutes} minutes of the community's time in cost to serve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {people.length > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{selected.size} of {people.length} selected</span>
              <button type="button" className="text-info hover:underline"
                onClick={() => setSelected(selected.size === people.length ? new Set() : new Set(people.map((p) => p.entrepreneur_id)))}>
                {selected.size === people.length ? "Clear" : "Select all"}
              </button>
            </div>
          )}
          <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {people.map((p) => (
              <li key={p.entrepreneur_id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-secondary/40">
                  <Checkbox checked={selected.has(p.entrepreneur_id)} onCheckedChange={() => toggle(p.entrepreneur_id)} />
                  {p.display_name}
                </label>
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <Label htmlFor="outreach-note">Note <span className="font-normal text-muted-foreground">— optional</span></Label>
            <Textarea id="outreach-note" maxLength={500} rows={2} value={note} placeholder="e.g. WhatsApp, will report on Friday"
              onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={selected.size === 0 || record.isPending} className="gap-2">
            {record.isPending ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}
            Log for {selected.size}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
