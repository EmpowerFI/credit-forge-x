import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OpenCampaigns, RewardCard } from "./Campaigns";
import { ImpactAsk } from "./ImpactChoice";
import { InstallInvite } from "./Install";
import { WeekProgress } from "./Week";
import { tr } from "../i18n";
import {
  addDays, type AfterRecord, brl, cachedToday, progressIcon, shortDay, CATEGORIES, type Category, categoryLabel, dayName, diary, diaryErrorText,
  type GoalAfter, type HistoryEntry, type Line, methodLabel, newRequestId, parseReais, PAYMENT_METHODS, type PaymentMethod, PROFILE_KEY,
} from "./diary";

interface LineDraft {
  kind: "sale" | "expense";
  amount: string;
  method: PaymentMethod;
  category: Category | "";
  later: boolean;
  due: string;
  installments: number;
}

/** One line she has noted, waiting for "Registrar o dia". */
interface Noted extends Line {
  key: string;
}

const blank = (kind: "sale" | "expense"): LineDraft => ({
  kind, amount: "", method: "pix", category: "", later: false, due: "", installments: 1,
});

const selectClass =
  "h-12 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const MAX_LINES = 20;

// What she noted and has not recorded yet, kept on this phone per day, so a
// reload or a call in the middle does not lose it. Storage may be refused
// (private mode); then it simply lives in memory.
const pendingKey = (day: string) => `empowerfi-diary-pending:${day}`;
function loadPending(day: string): Noted[] {
  try {
    const raw = localStorage.getItem(pendingKey(day));
    const list = raw ? (JSON.parse(raw) as Noted[]) : [];
    return Array.isArray(list) ? list.filter((l) => l && typeof l.amount_cents === "number").slice(0, MAX_LINES) : [];
  } catch {
    return [];
  }
}
function savePending(day: string, list: Noted[]) {
  try {
    if (list.length) localStorage.setItem(pendingKey(day), JSON.stringify(list));
    else localStorage.removeItem(pendingKey(day));
  } catch {
    // Memory only.
  }
}

/** A recorded line as the form and the list read it. */
const fromEntry = (e: HistoryEntry): Line => ({
  kind: e.kind,
  amount_cents: e.amount_cents,
  payment_method: e.payment_method,
  ...(e.category ? { category: e.category } : {}),
  ...(e.due_on ? { due_on: e.due_on } : {}),
  ...(e.installments > 1 ? { installments: e.installments } : {}),
});

/** A noted line back into the form, to be changed. */
const toDraft = (l: Line): LineDraft => ({
  kind: l.kind,
  amount: (l.amount_cents / 100).toFixed(2).replace(".", ","),
  method: l.payment_method,
  category: l.category ?? "",
  later: Boolean(l.due_on),
  due: l.due_on ?? "",
  installments: l.installments ?? 1,
});

/**
 * The day: she notes each sale or expense one at a time -- the form empties
 * after each, so the screen never fills with cards -- and they wait on this
 * phone. "Registrar o dia" shows the list; she changes or removes what she
 * needs and confirms, and only then is the day recorded.
 */
export default function Today() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const me = useQuery({ queryKey: [...PROFILE_KEY, "reminders"], queryFn: diary.profile });
  const today = me.data?.today ?? cachedToday(queryClient.getQueriesData({ queryKey: PROFILE_KEY }));
  const [day, setDay] = useState(today);
  const [mode, setMode] = useState<"ask" | "entry" | "review" | "done">("ask");
  const [noted, setNoted] = useState<Noted[]>(() => loadPending(today));
  // The server's date arrives, or a new day comes in with the screen open: the
  // day she is on moves with it, unless she chose yesterday on purpose.
  useEffect(() => {
    if (day !== today && day !== addDays(today, -1)) {
      setDay(today);
      setNoted(loadPending(today));
    }
  }, [today, day]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AfterRecord | null>(null);
  const started = useRef(Date.now());
  const seconds = () => Math.min(3600, Math.round((Date.now() - started.current) / 1000));

  // Opened from a reminder: say so, once, and clean the address.
  useEffect(() => {
    const id = params.get("lembrete");
    if (id && /^[0-9a-f-]{36}$/i.test(id)) void diary.reminderOpened(id).catch(() => undefined);
    if (id) {
      params.delete("lembrete");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const week = useQuery({ queryKey: ["diary", "history", 7], queryFn: () => diary.history(7) });
  const keptDay = week.data?.find((d) => d.day === day);

  const keep = (list: Noted[]) => {
    setNoted(list);
    savePending(day, list);
  };
  const pickDay = (d: string) => {
    setDay(d);
    setNoted(loadPending(d));
    setMode("ask");
    setError(null);
  };

  const restart = () => {
    setMode("ask");
    setResult(null);
    setError(null);
    started.current = Date.now();
  };

  const finish = async (out: AfterRecord) => {
    setResult(out);
    setMode("done");
    await queryClient.invalidateQueries({ queryKey: ["diary", "history"] });
    await queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
  };

  const recordQuiet = async (reason: "closed" | "no_sales") => {
    setBusy(true);
    setError(null);
    try {
      await finish(await diary.record({ requestId: newRequestId(), day, lines: [], noActivity: true, quietReason: reason, seconds: seconds() }));
    } catch (e) {
      setError(diaryErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const recordNoted = async () => {
    if (!noted.length) return setMode("entry");
    setBusy(true);
    setError(null);
    try {
      const lines: Line[] = noted.map(({ key: _key, ...l }) => l);
      const out = await diary.record({ requestId: newRequestId(), day, lines, seconds: seconds() });
      keep([]);
      await finish(out);
    } catch (e) {
      setError(diaryErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (mode === "done" && result) return <Done result={result} today={today} onMore={restart} />;

  const daySales = keptDay?.entries.filter((e) => !e.voided && e.kind === "sale").reduce((t, e) => t + e.amount_cents, 0) ?? 0;
  const dayExpenses = keptDay?.entries.filter((e) => !e.voided && e.kind === "expense").reduce((t, e) => t + e.amount_cents, 0) ?? 0;
  const isToday = day === today;
  const liveEntries = keptDay?.entries.filter((e) => !e.voided) ?? [];
  const recorded = liveEntries.length > 0;

  return (
    <div className="space-y-6">
      <div role="group" aria-label={tr({ en: "Which day", pt: "Qual dia" })} className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
        {[today, addDays(today, -1)].map((d) => (
          <button key={d} type="button" aria-pressed={d === day} disabled={busy} onClick={() => pickDay(d)}
            className={`min-h-12 rounded-lg px-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              d === day ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"}`}>
            {d === today ? `${tr({ en: "Today", pt: "Hoje" })} · ${shortDay(d)}` : tr({ en: "Yesterday", pt: "Ontem" })}
          </button>
        ))}
      </div>

      <h1 className="font-heading text-[2.25rem] font-semibold leading-tight">
        {isToday ? tr({ en: "How did today go?", pt: "Como foi hoje?" }) : tr({ en: "How did yesterday go?", pt: "Como foi ontem?" })}
      </h1>

      {mode === "ask" && me.data && <ImpactAsk profile={me.data} />}
      {mode === "ask" && (
        <div className="space-y-3">
          {noted.length > 0 ? (
            <>
              <BigAction primary icon={ClipboardCheck} onClick={() => setMode("review")}
                title={tr({ en: "Review and save the day", pt: "Revisar e registrar o dia" })}
                hint={noted.length === 1 ? tr({ en: "1 item noted", pt: "1 item anotado" }) : tr({ en: `${noted.length} items noted`, pt: `${noted.length} itens anotados` })} />
              <BigAction icon={Plus} onClick={() => setMode("entry")}
                title={tr({ en: "Note another one", pt: "Anotar mais um" })}
                hint={tr({ en: "A sale or an expense", pt: "Uma venda ou um gasto" })} />
            </>
          ) : recorded ? (
            <BigAction primary icon={Plus} onClick={() => setMode("entry")}
              title={tr({ en: "Add more", pt: "Incluir mais" })}
              hint={tr({ en: "Remembered something? Note a sale or an expense", pt: "Lembrou de algo? Anote uma venda ou um gasto" })} />
          ) : (
            <BigAction primary icon={Plus} onClick={() => setMode("entry")}
              title={tr({ en: "I sold or spent", pt: "Vendi ou gastei" })}
              hint={tr({ en: "Note the amount and what it was", pt: "Anotar valor e o que foi" })} />
          )}
        </div>
      )}
      {mode === "ask" && !recorded && (
        <div className="space-y-3">
          <p className="pt-3 text-muted-foreground">{tr({ en: "No activity?", pt: "Não teve movimento?" })}</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-14 rounded-xl text-base" disabled={busy} onClick={() => void recordQuiet("no_sales")}>
              {tr({ en: "Open, no sales", pt: "Abri e não vendi" })}
            </Button>
            <Button variant="outline" className="h-14 rounded-xl text-base" disabled={busy} onClick={() => void recordQuiet("closed")}>
              {tr({ en: "Did not open", pt: "Não abri" })}
            </Button>
          </div>
        </div>
      )}

      {mode === "ask" && (
        <section className="space-y-3 border-t border-border pt-6" aria-labelledby="day-summary">
          <h2 id="day-summary" className="font-heading text-xl font-semibold">
            {isToday ? tr({ en: "Today so far", pt: "Resumo de hoje" }) : tr({ en: "Yesterday", pt: "Resumo de ontem" })}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-muted-foreground">{tr({ en: "Sales", pt: "Vendas" })}</p>
              <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">{brl(daySales)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-muted-foreground">{tr({ en: "Expenses", pt: "Gastos" })}</p>
              <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">{brl(dayExpenses)}</p>
            </div>
          </div>
          <p className="text-muted-foreground">
            {!keptDay
              ? isToday ? tr({ en: "Nothing recorded yet today.", pt: "Nada anotado ainda hoje." }) : tr({ en: "Nothing recorded for yesterday.", pt: "Nada anotado para ontem." })
              : keptDay.no_activity
                ? tr({ en: "Recorded: no activity.", pt: "Registrado: sem movimento." })
                : tr({ en: "Recorded. Anything you add now adds up, and you can change or remove what is below.", pt: "Registrado. O que você incluir agora soma, e dá para corrigir ou remover o que está abaixo." })}
          </p>
          {recorded && <Recorded key={day} day={day} entries={liveEntries} />}
        </section>
      )}
      {mode === "ask" && me.data && <WeekProgress icon={progressIcon(me.data.progress_emoji)} today={today} days={week.data ?? []} />}
      {mode === "ask" && me.data && <OpenCampaigns profile={me.data} />}

      {mode === "entry" && (
        <Entry day={day} count={noted.length}
          onAdd={(l) => keep([...noted, { ...l, key: crypto.randomUUID() }])}
          onReview={() => { setError(null); setMode("review"); }}
          onBack={() => { setError(null); setMode("ask"); }} />
      )}

      {mode === "review" && (
        <Review day={day} today={today} noted={noted} busy={busy} onChange={keep}
          onMore={() => { setError(null); setMode("entry"); }}
          onConfirm={() => void recordNoted()} />
      )}

      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      {busy && mode === "ask" && <Loader2 className="mx-auto animate-spin text-muted-foreground" aria-label={tr({ en: "Working", pt: "Processando" })} />}
    </div>
  );
}

/** The screen's big choices: an icon in a circle, a title and what it does. */
function BigAction({ icon: Icon, title, hint, onClick, primary = false }: {
  icon: typeof Plus;
  title: string;
  hint: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex min-h-[5.5rem] w-full items-center gap-4 rounded-2xl px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-2 border-primary bg-card hover:bg-secondary"}`}>
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${primary ? "bg-primary-foreground/15" : "bg-secondary"}`}>
        <Icon size={24} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-heading text-xl font-semibold">{title}</span>
        <span className={`block ${primary ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{hint}</span>
      </span>
    </button>
  );
}

function lineText(l: Line): string {
  const later = l.due_on
    ? (l.installments ?? 1) > 1
      ? tr({ en: `, ${l.installments}x from ${l.due_on.slice(8)}/${l.due_on.slice(5, 7)}`, pt: `, em ${l.installments}x a partir de ${l.due_on.slice(8)}/${l.due_on.slice(5, 7)}` })
      : tr({ en: `, due ${l.due_on.slice(8)}/${l.due_on.slice(5, 7)}`, pt: `, para ${l.due_on.slice(8)}/${l.due_on.slice(5, 7)}` })
    : "";
  return l.kind === "sale"
    ? `💰 ${tr({ en: "Sale", pt: "Venda" })} · ${methodLabel(l.payment_method)}: ${brl(l.amount_cents)}${later}`
    : `💸 ${categoryLabel(l.category ?? null)}: ${brl(l.amount_cents)} · ${methodLabel(l.payment_method)}${later}`;
}

/** The form, read into a line, or the reason it cannot be one. */
function readLine(d: LineDraft, day: string): Line | string {
  const cents = parseReais(d.amount);
  if (cents === null) {
    return d.amount.trim()
      ? tr({ en: `"${d.amount}" is not an amount.`, pt: `"${d.amount}" não é um valor.` })
      : tr({ en: "Fill in the amount.", pt: "Preencha o valor." });
  }
  if (d.kind === "expense" && !d.category) return tr({ en: "Say what the expense was for.", pt: "Diga com o que foi o gasto." });
  if (d.later && !(d.due > day)) {
    return tr({ en: "Choose a date after the day for what is paid later.", pt: "Escolha uma data depois do dia para o que fica para depois." });
  }
  return {
    kind: d.kind,
    amount_cents: cents,
    payment_method: d.method,
    ...(d.kind === "expense" ? { category: d.category as Category } : {}),
    ...(d.later ? { due_on: d.due } : {}),
    ...(d.later && d.installments > 1 ? { installments: d.installments } : {}),
  };
}

/** One sale or expense at a time. The same form adds a new line or, with `editing`, changes one. */
function LineFields({ draft, set, day }: { draft: LineDraft; set: (patch: Partial<LineDraft>) => void; day: string }) {
  return (
    <>
      <div role="group" aria-label={tr({ en: "Sale or expense", pt: "Venda ou gasto" })} className="grid grid-cols-2 gap-2">
        {(["sale", "expense"] as const).map((k) => (
          <Button key={k} type="button" variant={draft.kind === k ? "default" : "outline"} className="h-12 text-base" aria-pressed={draft.kind === k}
            onClick={() => set({ kind: k, category: k === "sale" ? "" : draft.category, installments: 1 })}>
            {k === "sale" ? tr({ en: "💰 Sale", pt: "💰 Venda" }) : tr({ en: "💸 Expense", pt: "💸 Gasto" })}
          </Button>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor="line-amount">{tr({ en: "Amount (R$)", pt: "Valor (R$)" })}</Label>
        <Input id="line-amount" inputMode="decimal" autoComplete="off" placeholder="0,00" value={draft.amount}
          onChange={(e) => set({ amount: e.target.value })} className="h-12 text-lg" autoFocus />
      </div>
      {draft.kind === "expense" && (
        <div className="space-y-1">
          <Label htmlFor="line-cat">{tr({ en: "What for", pt: "Com o quê" })}</Label>
          <select id="line-cat" className={selectClass} value={draft.category}
            onChange={(e) => set({ category: e.target.value as Category })}>
            <option value="">{tr({ en: "Choose", pt: "Escolha" })}</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="line-method">{draft.kind === "sale" ? tr({ en: "Received by", pt: "Recebeu como" }) : tr({ en: "Paid by", pt: "Pagou como" })}</Label>
        <select id="line-method" className={selectClass} value={draft.method}
          onChange={(e) => set({ method: e.target.value as PaymentMethod })}>
          {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={draft.later} onChange={(e) => set({ later: e.target.checked })} />
        {draft.kind === "sale" ? tr({ en: "I will receive it later", pt: "Vou receber depois" }) : tr({ en: "I will pay it later", pt: "Vou pagar depois" })}
      </label>
      {draft.later && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="line-due">{draft.kind === "sale"
                ? draft.installments > 1 ? tr({ en: "First receipt", pt: "1º recebimento" }) : tr({ en: "Receive on", pt: "Recebe em" })
                : tr({ en: "First payment", pt: "1º pagamento" })}</Label>
            <Input id="line-due" type="date" min={addDays(day, 1)} value={draft.due}
              onChange={(e) => set({ due: e.target.value })} className="h-12" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="line-inst">{tr({ en: "Instalments", pt: "Parcelas" })}</Label>
            <select id="line-inst" className={selectClass} value={draft.installments}
              onChange={(e) => set({ installments: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, n) => <option key={n + 1} value={n + 1}>{n + 1}x</option>)}
            </select>
          </div>
        </div>
      )}
    </>
  );
}

/** Noting: the form empties after each line; only a count says how many are waiting. */
function Entry({ day, count, onAdd, onReview, onBack }: {
  day: string;
  count: number;
  onAdd: (l: Line) => void;
  onReview: () => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<LineDraft>(blank("sale"));
  const [problem, setProblem] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const full = count >= MAX_LINES;

  const add = () => {
    const line = readLine(draft, day);
    if (typeof line === "string") return setProblem(line);
    onAdd(line);
    setProblem(null);
    setAdded(line.kind === "sale"
      ? tr({ en: `Sale of ${brl(line.amount_cents)} noted ✅`, pt: `Venda de ${brl(line.amount_cents)} anotada ✅` })
      : tr({ en: `Expense of ${brl(line.amount_cents)} noted ✅`, pt: `Gasto de ${brl(line.amount_cents)} anotado ✅` }));
    // Ready for the next one, of the same kind and paid the same way.
    setDraft({ ...blank(draft.kind), method: draft.method });
  };

  return (
    <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); add(); }}>
      <LineFields draft={draft} day={day} set={(patch) => { setAdded(null); setDraft((d) => ({ ...d, ...patch })); }} />
      {problem && <p role="alert" className="text-sm font-medium text-destructive">{problem}</p>}
      <Button type="submit" variant="outline" className="h-12 w-full text-base" disabled={full}>
        {tr({ en: "Add", pt: "Adicionar" })}
      </Button>
      <p role="status" aria-live="polite" className="min-h-5 text-center text-sm">
        {added && <span className="block">{added}</span>}
        {count > 0 && (
          <span className="text-muted-foreground">
            {count === 1 ? tr({ en: "1 item noted", pt: "1 item anotado" }) : tr({ en: `${count} items noted`, pt: `${count} itens anotados` })}
          </span>
        )}
        {full && <span className="block text-muted-foreground">{tr({ en: "That is the most for one day.", pt: "Esse é o máximo para um dia." })}</span>}
      </p>
      <Button type="button" className="h-14 w-full text-base" disabled={count === 0} onClick={onReview}>
        {tr({ en: "Save the day", pt: "Registrar o dia" })}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>{tr({ en: "Back", pt: "Voltar" })}</Button>
    </form>
  );
}

/** The list, before anything is saved: change or remove each line, then confirm. */
function Review({ day, today, noted, busy, onChange, onMore, onConfirm }: {
  day: string;
  today: string;
  noted: Noted[];
  busy: boolean;
  onChange: (list: Noted[]) => void;
  onMore: () => void;
  onConfirm: () => void;
}) {
  const [editing, setEditing] = useState<{ key: string; draft: LineDraft } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const sales = noted.filter((l) => l.kind === "sale").reduce((s, l) => s + l.amount_cents, 0);
  const expenses = noted.filter((l) => l.kind === "expense").reduce((s, l) => s + l.amount_cents, 0);

  if (editing) {
    const save = () => {
      const line = readLine(editing.draft, day);
      if (typeof line === "string") return setProblem(line);
      onChange(noted.map((l) => (l.key === editing.key ? { ...line, key: l.key } : l)));
      setEditing(null);
      setProblem(null);
    };
    return (
      <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
        <h2 className="text-lg font-semibold">{tr({ en: "Change this item", pt: "Alterar este item" })}</h2>
        <LineFields draft={editing.draft} day={day} set={(patch) => setEditing({ ...editing, draft: { ...editing.draft, ...patch } })} />
        {problem && <p role="alert" className="text-sm font-medium text-destructive">{problem}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Button type="submit" className="h-12">{tr({ en: "Save change", pt: "Salvar alteração" })}</Button>
          <Button type="button" variant="outline" className="h-12" onClick={() => { setEditing(null); setProblem(null); }}>
            {tr({ en: "Cancel", pt: "Cancelar" })}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="review-title">
      <h2 id="review-title" className="text-lg font-semibold">
        {tr({ en: `Check ${dayName(day, today)} before saving`, pt: `Confira ${dayName(day, today)} antes de registrar` })}
      </h2>
      {noted.length === 0 ? (
        <p className="rounded-md bg-muted p-3 text-sm">{tr({ en: "Nothing noted yet.", pt: "Nada anotado ainda." })}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {noted.map((l) => (
            <li key={l.key} className="flex items-center gap-2 p-3">
              <span className="min-w-0 flex-1 text-sm">{lineText(l)}</span>
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" disabled={busy}
                aria-label={tr({ en: "Change", pt: "Alterar" })} onClick={() => setEditing({ key: l.key, draft: toDraft(l) })}>
                <Pencil aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" disabled={busy}
                aria-label={tr({ en: "Remove", pt: "Remover" })} onClick={() => onChange(noted.filter((x) => x.key !== l.key))}>
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {noted.length > 0 && (
        <p className="text-sm">
          {tr({ en: "Sales", pt: "Vendas" })}: <strong>{brl(sales)}</strong>{" · "}{tr({ en: "Expenses", pt: "Gastos" })}: <strong>{brl(expenses)}</strong>
        </p>
      )}
      <Button className="h-14 w-full text-base" disabled={busy || noted.length === 0} onClick={onConfirm}>
        {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
        {tr({ en: "Confirm and save", pt: "Confirmar e registrar" })}
      </Button>
      <Button variant="outline" className="h-12 w-full" disabled={busy || noted.length >= MAX_LINES} onClick={onMore}>
        {tr({ en: "Note more", pt: "Anotar mais" })}
      </Button>
    </section>
  );
}

/**
 * What the day already has, each line open to her: changed (the old one is
 * struck through and the new one recorded, at once) or removed (struck
 * through, as in the history). Only today's and yesterday's, as the server
 * allows.
 */
function Recorded({ day, entries }: { day: string; entries: HistoryEntry[] }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{ id: string; draft: LineDraft; requestId: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (what: () => Promise<unknown>) => {
    setBusy(true);
    setProblem(null);
    try {
      await what();
      await queryClient.invalidateQueries({ queryKey: ["diary", "history"] });
      await queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      setEditing(null);
      setRemoving(null);
    } catch (e) {
      setProblem(diaryErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    const save = () => {
      const line = readLine(editing.draft, day);
      if (typeof line === "string") return setProblem(line);
      void run(() => diary.correctEntry(editing.id, line, editing.requestId));
    };
    return (
      <form className="space-y-4 rounded-2xl border border-border bg-card p-4" noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
        <h3 className="font-heading text-lg font-semibold">{tr({ en: "Correct this line", pt: "Corrigir este lançamento" })}</h3>
        <LineFields draft={editing.draft} day={day} set={(patch) => setEditing({ ...editing, draft: { ...editing.draft, ...patch } })} />
        {problem && <p role="alert" className="text-sm font-medium text-destructive">{problem}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Button type="submit" className="h-12" disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {tr({ en: "Save", pt: "Salvar" })}
          </Button>
          <Button type="button" variant="outline" className="h-12" disabled={busy} onClick={() => { setEditing(null); setProblem(null); }}>
            {tr({ en: "Cancel", pt: "Cancelar" })}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card" aria-label={tr({ en: "Recorded lines", pt: "Lançamentos registrados" })}>
        {entries.map((e) => (
          <li key={e.id} className="p-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-sm">{lineText(fromEntry(e))}</span>
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" disabled={busy}
                aria-label={tr({ en: "Correct", pt: "Corrigir" })}
                onClick={() => { setProblem(null); setRemoving(null); setEditing({ id: e.id, draft: toDraft(fromEntry(e)), requestId: newRequestId() }); }}>
                <Pencil aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" disabled={busy}
                aria-label={tr({ en: "Remove", pt: "Remover" })} onClick={() => { setProblem(null); setRemoving(e.id); }}>
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            {removing === e.id && (
              <div className="mt-2 space-y-2 rounded-md bg-muted p-3 text-sm" role="group" aria-label={tr({ en: "Remove this line?", pt: "Remover este lançamento?" })}>
                <p>{tr({ en: "Remove this line? It stays struck through in your history.", pt: "Remover este lançamento? Ele fica riscado no seu histórico." })}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="destructive" className="h-11" disabled={busy} onClick={() => void run(() => diary.voidEntry(e.id))}>
                    {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                    {tr({ en: "Yes, remove", pt: "Sim, remover" })}
                  </Button>
                  <Button variant="outline" className="h-11" disabled={busy} onClick={() => setRemoving(null)}>
                    {tr({ en: "Keep", pt: "Manter" })}
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {problem && <p role="alert" className="text-sm font-medium text-destructive">{problem}</p>}
    </div>
  );
}

function Done({ result, today, onMore }: { result: AfterRecord; today: string; onMore: () => void }) {
  const s = result.summary;
  const p = result.progress;
  const g = result.goal;
  const which = dayName(s.day, today);
  return (
    <div className="space-y-4" aria-live="polite">
      <section className="space-y-2 rounded-md border border-border p-4">
        <h1 className="text-xl font-semibold">
          {result.recorded.status === "duplicate"
            ? tr({ en: "This was already recorded ✅", pt: "Isso já estava registrado ✅" })
            : s.quiet
              ? tr({ en: `Noted ✅ ${which}: no activity.`, pt: `Anotado ✅ ${which}: sem movimento.` })
              : tr({ en: `Recorded ✅ ${which}`, pt: `Registrado ✅ ${which}` })}
        </h1>
        {!s.quiet && (
          <p>
            {tr({ en: "Sales", pt: "Vendas" })}: <strong>{brl(s.sales_cents)}</strong>
            {" · "}
            {tr({ en: "Expenses", pt: "Gastos" })}: <strong>{brl(s.expenses_cents)}</strong>
          </p>
        )}
        {p && p.streak_days > 0 && (
          <p>
            {p.streak_days === 1
              ? tr({ en: "🔥 Day 1 of your streak.", pt: "🔥 1º dia de sequência registrando." })
              : tr({ en: `🔥 ${p.streak_days} days in a row.`, pt: `🔥 ${p.streak_days} dias seguidos registrando.` })}
            {p.next && p.next.days_left > 0 && (
              <span className="block text-sm text-muted-foreground">
                {p.next.days_left === 1
                  ? tr({ en: `1 day to go for: ${p.next.title}.`, pt: `Falta 1 dia para: ${p.next.title}.` })
                  : tr({ en: `${p.next.days_left} days to go for: ${p.next.title}.`, pt: `Faltam ${p.next.days_left} dias para: ${p.next.title}.` })}
              </span>
            )}
          </p>
        )}
        {!p && (
          <p className="text-sm text-muted-foreground">
            {tr({ en: `This week: ${s.week_kept} of ${s.week_days} days recorded.`, pt: `Nesta semana: ${s.week_kept} de ${s.week_days} dias registrados.` })}
          </p>
        )}
      </section>

      {p?.earned.map((m) => <RewardCard key={m.code} reward={m} />)}

      {g && <GoalNews goal={g} />}

      <InstallInvite />

      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-12" onClick={onMore}>{tr({ en: "Add or correct", pt: "Incluir ou corrigir" })}</Button>
        <Button asChild variant="outline" className="h-12">
          <Link to="/app/diario/historico">{tr({ en: "See history", pt: "Ver histórico" })}</Link>
        </Button>
      </div>
    </div>
  );
}

const daysText = (n: number) => (n === 1 ? tr({ en: "1 day", pt: "1 dia" }) : tr({ en: `${n} days`, pt: `${n} dias` }));

function goalLine(g: { kind: "days" | "sales"; target: number; met: boolean; days_kept: number; sales_cents: number }) {
  if (g.kind === "days") {
    return g.met
      ? tr({ en: `🎯 Goal met ✅ ${daysText(g.days_kept)} recorded.`, pt: `🎯 Meta da semana batida ✅ ${daysText(g.days_kept)} registrados.` })
      : tr({ en: `🎯 Week goal: ${g.days_kept} of ${g.target} days recorded.`, pt: `🎯 Meta da semana: ${g.days_kept} de ${g.target} dias registrados.` });
  }
  return g.met
    ? tr({ en: `🎯 Goal met ✅ ${brl(g.sales_cents)} in sales.`, pt: `🎯 Meta da semana batida ✅ ${brl(g.sales_cents)} em vendas.` })
    : tr({ en: `🎯 Week goal: ${brl(g.sales_cents)} of ${brl(g.target)} in sales.`, pt: `🎯 Meta da semana: ${brl(g.sales_cents)} de ${brl(g.target)} em vendas.` });
}

function GoalNews({ goal }: { goal: GoalAfter }) {
  return (
    <>
      {goal.last_week && (
        <section className="rounded-md border border-border p-4 text-sm">
          {goal.last_week.met
            ? tr({ en: "Last week's goal: met! ✅", pt: "A meta da semana passada: batida! ✅" })
            : tr({
              en: "Last week's goal was not reached. Every week is a new chance, and a smaller goal counts too. 💜",
              pt: "A meta da semana passada não foi alcançada. Cada semana é uma nova chance, e uma meta um pouco menor também vale. 💜",
            })}
        </section>
      )}
      {goal.just_met && goal.goal && (
        <section className="rounded-md border border-primary/40 bg-primary/5 p-4">
          <p className="font-semibold">{tr({ en: "🏆 You met your goal for the week!", pt: "🏆 Você bateu a sua meta da semana!" })}</p>
          <p className="text-sm">{tr({ en: "What you planned, you did. 💜", pt: "O que você planejou, você fez. 💜" })}</p>
        </section>
      )}
      {goal.goal && !goal.just_met && <p className="text-sm">{goalLine(goal.goal)}</p>}
      {goal.ask && <GoalAsk />}
    </>
  );
}

function GoalAsk() {
  const now = useQuery({ queryKey: ["diary", "goal"], queryFn: diary.goalNow });
  const [step, setStep] = useState<"ask" | "days" | "sales" | "done" | "skipped">("ask");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [set, setSet] = useState<string | null>(null);

  const answer = async (choice: "days" | "sales" | "skip", target?: number) => {
    setError(null);
    try {
      await diary.goalAnswer(choice, target);
      if (choice === "skip") setStep("skipped");
      else {
        setSet(choice === "days"
          ? tr({ en: `Deal! 🎯 Your goal this week: record ${daysText(target!)}.`, pt: `Combinado! 🎯 Sua meta da semana: registrar ${daysText(target!)}.` })
          : tr({ en: `Deal! 🎯 Your goal this week: sell ${brl(target!)}.`, pt: `Combinado! 🎯 Sua meta da semana: vender ${brl(target!)}.` }));
        setStep("done");
      }
    } catch (e) {
      setError(diaryErrorText(e));
    }
  };

  const ref = now.data?.reference;
  const maxDays = Math.min(7, now.data?.max_days ?? 7);
  return (
    <section className="space-y-3 rounded-md border border-border p-4">
      {step === "ask" && (
        <>
          <p className="font-semibold">{tr({ en: "Shall we set a goal for this week? 🎯", pt: "Vamos combinar uma meta para esta semana? 🎯" })}</p>
          {ref && (ref.days_kept > 0 || ref.sales_cents > 0) && (
            <p className="text-sm text-muted-foreground">
              {tr({ en: `Last week you recorded ${daysText(ref.days_kept)}`, pt: `Na semana passada você registrou ${daysText(ref.days_kept)}` })}
              {ref.sales_cents > 0 && tr({ en: ` and sold ${brl(ref.sales_cents)}`, pt: ` e vendeu ${brl(ref.sales_cents)}` })}.
            </p>
          )}
          <div className="grid gap-2">
            <Button variant="outline" className="h-12" disabled={maxDays < 3} onClick={() => setStep("days")}>{tr({ en: "Days recorded", pt: "Dias de registro" })}</Button>
            <Button variant="outline" className="h-12" onClick={() => setStep("sales")}>{tr({ en: "Sales goal", pt: "Meta de vendas" })}</Button>
            <Button variant="ghost" onClick={() => void answer("skip")}>{tr({ en: "Not now", pt: "Agora não" })}</Button>
          </div>
        </>
      )}
      {step === "days" && (
        <>
          <p className="font-semibold">{tr({ en: "How many days will you record this week?", pt: "Quantos dias desta semana você vai registrar?" })}</p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: Math.max(0, maxDays - 2) }, (_, i) => i + 3).map((n) => (
              <Button key={n} variant="outline" className="h-12 min-w-14" onClick={() => void answer("days", n)}>{n}</Button>
            ))}
          </div>
        </>
      )}
      {step === "sales" && (
        <form className="space-y-2" onSubmit={(e) => {
          e.preventDefault();
          const cents = parseReais(amount);
          if (cents === null || cents < 100) return setError(tr({ en: "Write the amount, e.g. 1500.", pt: "Escreva o valor, por exemplo: 1500." }));
          void answer("sales", cents);
        }}>
          <Label htmlFor="goal-amount">{tr({ en: "How much do you want to sell this week? (R$)", pt: "Quanto você quer vender nesta semana? (R$)" })}</Label>
          <Input id="goal-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 text-lg" />
          <Button type="submit" className="h-12 w-full">{tr({ en: "Set goal", pt: "Combinar meta" })}</Button>
        </form>
      )}
      {step === "done" && set && <p>{set}</p>}
      {step === "skipped" && <p className="text-sm text-muted-foreground">{tr({ en: "All right! Next week I will ask again.", pt: "Tudo bem! Na semana que vem eu pergunto de novo." })}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
