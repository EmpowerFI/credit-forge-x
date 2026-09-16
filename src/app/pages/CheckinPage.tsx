import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "../auth/useAuth";
import { requestAssessment } from "../lib/assessments";
import { describeError } from "../lib/errors";
import { platform } from "../lib/platform";
import { money, monthLabel, STATUS_LABEL } from "../lib/readiness";
import LoadError from "../components/LoadError";
import { tr } from "../i18n";

// The monthly check-in: a few numbers about the month, two to four minutes on
// a phone. Sending it records the month, then asks for a fresh assessment.

/** This month and the two before it, in São Paulo. */
function recentPeriods(): string[] {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return [0, 1, 2].map((back) => {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

const cents = (reais: string) => Math.round(Number(reais || 0) * 100);

export default function CheckinPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ["platform", "checkin-me", profile?.id],
    enabled: Boolean(profile),
    queryFn: async () => {
      const { data, error } = await platform
        .from("entrepreneurs")
        .select("id, checkins(period)")
        .eq("profile_id", profile!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const open = useMemo(() => {
    const done = new Set(me.data?.checkins?.map((c) => c.period) ?? []);
    return recentPeriods().filter((p) => !done.has(p));
  }, [me.data]);

  const [form, setForm] = useState({
    period: "", revenue: "", cogs: "", opex: "", household: "", keepsRecords: true, activeDays: "",
  });
  const period = form.period || open[0] || "";
  const net = cents(form.revenue) - cents(form.cogs) - cents(form.opex);

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await platform.rpc("submit_checkin", {
        p_period: period,
        p_revenue_cents: cents(form.revenue),
        p_cogs_cents: cents(form.cogs),
        p_opex_cents: cents(form.opex),
        p_household_cents: cents(form.household),
        p_keeps_records: form.keepsRecords,
        p_active_days: Number(form.activeDays || 0),
      });
      if (error) throw error;
      // The month is in; now let the engine look at the whole history.
      return requestAssessment(me.data!.id);
    },
    onSuccess: (assessment) => {
      queryClient.invalidateQueries({ queryKey: ["platform"] });
      const status = STATUS_LABEL[assessment.result.status].title;
      toast.success(tr({ en: `Month recorded. Readiness: ${status}.`, pt: `Mês registrado. Prontidão: ${status}.` }));
      navigate("/app/me");
    },
    onError: (e) => toast.error(describeError(e)),
  });

  if (me.isLoading) return <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Loading", pt: "Carregando" })} />;
  if (me.isError) return <LoadError error={me.error} onRetry={() => me.refetch()} />;
  if (!me.data) return <p className="text-muted-foreground">{tr({ en: "Check-ins are for entrepreneurs.", pt: "Os check-ins são para empreendedoras." })}</p>;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!period) return toast.error(tr({ en: "All recent months are already reported.", pt: "Todos os meses recentes já foram informados." }));
    submit.mutate();
  };

  const field = (id: keyof typeof form, label: string, hint: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`ci-${id}`}>{label}</Label>
      <Input id={`ci-${id}`} type="number" inputMode="decimal" min={0} step="0.01" required placeholder={tr({ en: "0.00", pt: "0,00" })}
        value={form[id] as string} onChange={(e) => setForm({ ...form, [id]: e.target.value })} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link to="/app/me" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> {tr({ en: "My business", pt: "Meu negócio" })}
      </Link>
      <div className="space-y-1">
        <h1 className="font-heading text-3xl font-bold text-foreground">{tr({ en: "Monthly check-in", pt: "Check-in mensal" })}</h1>
        <p className="text-muted-foreground">
          {tr({
            en: "A few numbers about the month, in reais. Your best estimate is fine.",
            pt: "Alguns números do mês, em reais. Uma boa estimativa já basta.",
          })}
        </p>
      </div>

      {open.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {tr({
            en: "This month and the two before it are already reported. See you next month.",
            pt: "Este mês e os dois anteriores já foram informados. Até o mês que vem.",
          })}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5 rounded-2xl p-5 glass glow-border sm:p-6">
          <div className="space-y-1.5">
            <Label htmlFor="ci-period">{tr({ en: "Month", pt: "Mês" })}</Label>
            <Select value={period} onValueChange={(v) => setForm({ ...form, period: v })}>
              <SelectTrigger id="ci-period"><SelectValue /></SelectTrigger>
              <SelectContent>
                {open.map((p) => <SelectItem key={p} value={p}>{monthLabel(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {field(
            "revenue",
            tr({ en: "Sales", pt: "Vendas" }),
            tr({ en: "Everything the business sold this month.", pt: "Tudo o que o negócio vendeu neste mês." }),
          )}
          {field(
            "cogs",
            tr({ en: "Materials and stock", pt: "Materiais e estoque" }),
            tr({ en: "What you bought to make or resell.", pt: "O que você comprou para produzir ou revender." }),
          )}
          {field(
            "opex",
            tr({ en: "Other business costs", pt: "Outros custos do negócio" }),
            tr({ en: "Rent, transport, fees, packaging.", pt: "Aluguel, transporte, taxas, embalagens." }),
          )}
          {field(
            "household",
            tr({ en: "Taken out for the household", pt: "Retirado para a casa" }),
            tr({ en: "Money from the business that went to home expenses.", pt: "Dinheiro do negócio que foi para as despesas de casa." }),
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ci-activeDays">{tr({ en: "Days the business worked", pt: "Dias em que o negócio funcionou" })}</Label>
            <Input id="ci-activeDays" type="number" inputMode="numeric" min={0} max={31} required
              value={form.activeDays} onChange={(e) => setForm({ ...form, activeDays: e.target.value })} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/60 p-3">
            <Label htmlFor="ci-records" className="font-normal">
              {tr({ en: "I recorded every sale this month", pt: "Registrei todas as vendas deste mês" })}
            </Label>
            <Switch id="ci-records" checked={form.keepsRecords} onCheckedChange={(v) => setForm({ ...form, keepsRecords: v })} />
          </div>

          <div className="rounded-xl bg-accent/10 p-3 text-sm">
            <span className="text-muted-foreground">{tr({ en: "Business result this month: ", pt: "Resultado do negócio neste mês: " })}</span>
            <strong className={net > 0 ? "text-positive" : net < 0 ? "text-alert" : "text-foreground"}>{money(net)}</strong>
          </div>

          <Button type="submit" disabled={submit.isPending} className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            {submit.isPending && <Loader2 size={16} className="animate-spin" />} {tr({ en: "Send check-in", pt: "Enviar check-in" })}
          </Button>
          <p className="text-xs text-muted-foreground">
            {tr({
              en: "The figures stay private in EmpowerFI's database. Only a fingerprint of them (a hash) is recorded on Solana, as proof they were not changed later.",
              pt: "Os números ficam privados no banco de dados da EmpowerFI. Só uma impressão digital deles (um hash) é registrada na Solana, como prova de que não foram alterados depois.",
            })}
          </p>
        </form>
      )}
    </div>
  );
}
