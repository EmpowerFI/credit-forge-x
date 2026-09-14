import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { describeError } from "../lib/errors";
import { BR_STATES, KIND_LABEL, platform, type CommunityKind } from "../lib/platform";

export default function NewCommunityPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", kind: "" as CommunityKind | "", city: "", state: "", description: "" });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await platform.rpc("create_community", {
        p_name: form.name,
        p_kind: form.kind as CommunityKind,
        p_city: form.city,
        p_state: form.state,
        p_description: form.description || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["platform", "communities"] });
      toast.success("Community created. Its registration is being anchored on devnet.");
      navigate(`/app/community/${id}`);
    },
    onError: (error) => toast.error(describeError(error)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.kind || !form.state) return toast.error("Choose a type and a state.");
    create.mutate();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl font-bold text-foreground">New community</h1>
        <p className="text-muted-foreground">
          It starts pending. Once EmpowerFI verifies it, you can enroll entrepreneurs.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-2xl p-6 glass glow-border md:p-8">
        <div className="space-y-2">
          <Label htmlFor="c-name">Name</Label>
          <Input id="c-name" required minLength={3} maxLength={120} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mulheres Empreendedoras do Grajaú" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-kind">Type</Label>
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as CommunityKind })}>
            <SelectTrigger id="c-kind"><SelectValue placeholder="Choose a type" /></SelectTrigger>
            <SelectContent>
              {Object.entries(KIND_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div className="space-y-2">
            <Label htmlFor="c-city">City</Label>
            <Input id="c-city" required minLength={2} maxLength={80} value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-state">State</Label>
            <Select value={form.state} onValueChange={(v) => setForm({ ...form, state: v })}>
              <SelectTrigger id="c-state"><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                {BR_STATES.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-desc">Description <span className="font-normal text-muted-foreground">— optional</span></Label>
          <Textarea id="c-desc" maxLength={1000} rows={3} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <Button type="submit" disabled={create.isPending} className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          {create.isPending && <Loader2 size={16} className="animate-spin" />} Create community
        </Button>
      </form>
    </div>
  );
}
