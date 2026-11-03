import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, Plus, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { diaryDb } from "./db";
import { InstallInvite } from "./Install";
import { tr } from "../i18n";
import {
  addDays, type AfterRecord, brl, CATEGORIES, type Category, categoryLabel, dayName, diary, diaryErrorText,
  type Draft, type GoalAfter, type Line, methodLabel, newRequestId, parseReais, PAYMENT_METHODS, type PaymentMethod, PROFILE_KEY,
} from "./diary";

interface LineDraft {
  key: string;
  kind: "sale" | "expense";
  amount: string;
  method: PaymentMethod;
  category: Category | "";
  later: boolean;
  due: string;
  installments: number;
}

const blank = (kind: "sale" | "expense"): LineDraft => ({
  key: crypto.randomUUID(), kind, amount: "", method: "pix", category: "", later: false, due: "", installments: 1,
});

const selectClass =
  "h-12 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** The day: what happened, by form, by voice or in her words; then what it adds up to. */
export default function Today() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const profile = queryClient.getQueriesData<{ today: string }>({ queryKey: PROFILE_KEY })[0]?.[1];
  const today = profile?.today ?? new Date().toISOString().slice(0, 10);
  const [day, setDay] = useState(today);
  const [mode, setMode] = useState<"ask" | "lines" | "words" | "draft" | "done">("ask");
  const [lines, setLines] = useState<LineDraft[]>([blank("sale")]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
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

  const kept = useQuery({ queryKey: ["diary", "history", 2], queryFn: () => diary.history(2) });
  const keptDay = kept.data?.find((d) => d.day === day);

  const restart = () => {
    setMode("ask");
    setLines([blank("sale")]);
    setDraft(null);
    setResult(null);
    setError(null);
    started.current = Date.now();
  };

  const finish = async (out: AfterRecord) => {
    setResult(out);
    setMode("done");
    await queryClient.invalidateQueries({ queryKey: ["diary", "history"] });
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

  const recordLines = async () => {
    const out: Line[] = [];
    for (const l of lines) {
      if (l.amount.trim() === "") continue;
      const cents = parseReais(l.amount);
      if (cents === null) return setError(tr({ en: `"${l.amount}" is not an amount.`, pt: `"${l.amount}" não é um valor.` }));
      if (l.kind === "expense" && !l.category) return setError(tr({ en: "Say what each expense was for.", pt: "Diga com o que foi cada gasto." }));
      if (l.later && !(l.due > day)) {
        return setError(tr({ en: "Choose a date after the day for what is paid later.", pt: "Escolha uma data depois do dia para o que fica para depois." }));
      }
      out.push({
        kind: l.kind,
        amount_cents: cents,
        payment_method: l.method,
        ...(l.kind === "expense" ? { category: l.category as Category } : {}),
        ...(l.later ? { due_on: l.due } : {}),
        ...(l.later && l.kind === "expense" && l.installments > 1 ? { installments: l.installments } : {}),
      });
    }
    if (out.length === 0) return setError(tr({ en: "Fill in at least one amount.", pt: "Preencha pelo menos um valor." }));
    setBusy(true);
    setError(null);
    try {
      await finish(await diary.record({ requestId: newRequestId(), day, lines: out, seconds: seconds() }));
    } catch (e) {
      setError(diaryErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (confirm: boolean) => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const out = await diary.decideDraft(draft.draft_id, confirm, seconds());
      if (out.status === "confirmed" && out.summary) await finish(out as AfterRecord);
      else if (out.status === "stale") {
        setError(tr({ en: "That reading expired. Tell it again.", pt: "Essa leitura expirou. Conte de novo." }));
        setMode("words");
      } else setMode("words");
      setDraft(null);
    } catch (e) {
      setError(diaryErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (mode === "done" && result) return <Done result={result} today={today} onMore={restart} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">
          {day === today ? tr({ en: "How did today go?", pt: "Como foi hoje?" }) : tr({ en: "How did yesterday go?", pt: "Como foi ontem?" })}
        </h1>
        <div role="group" aria-label={tr({ en: "Which day", pt: "Qual dia" })} className="mt-3 flex gap-2">
          {[today, addDays(today, -1)].map((d) => (
            <Button key={d} variant={d === day ? "default" : "outline"} className="h-10 flex-1" aria-pressed={d === day}
              onClick={() => { setDay(d); setError(null); }}>
              {d === today ? tr({ en: "Today", pt: "Hoje" }) : tr({ en: "Yesterday", pt: "Ontem" })}
            </Button>
          ))}
        </div>
        {keptDay && (
          <p className="mt-3 rounded-md bg-muted p-3 text-sm">
            {keptDay.no_activity
              ? tr({ en: `Already recorded ${dayName(day, today)}: no activity.`, pt: `Já registrado ${dayName(day, today)}: sem movimento.` })
              : tr({
                en: `Already recorded ${dayName(day, today)}. Anything you add now adds up.`,
                pt: `Já tem registro ${dayName(day, today)}. O que você incluir agora soma.`,
              })}
          </p>
        )}
      </div>

      {mode === "ask" && (
        <div className="grid gap-3">
          <Button className="h-14 text-base" onClick={() => setMode("lines")}>{tr({ en: "I sold or spent", pt: "Vendi ou gastei" })}</Button>
          <Button variant="outline" className="h-14 text-base" onClick={() => setMode("words")}>
            <Mic aria-hidden="true" />{tr({ en: "Tell it by voice or in my words", pt: "Contar por áudio ou escrevendo" })}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-14" disabled={busy} onClick={() => void recordQuiet("no_sales")}>
              {tr({ en: "Open, no sales", pt: "Abri e não vendi" })}
            </Button>
            <Button variant="outline" className="h-14" disabled={busy} onClick={() => void recordQuiet("closed")}>
              {tr({ en: "Did not open", pt: "Não abri" })}
            </Button>
          </div>
        </div>
      )}

      {mode === "lines" && (
        <LinesForm lines={lines} setLines={setLines} day={day} busy={busy} onSubmit={() => void recordLines()} onBack={restart} />
      )}

      {mode === "words" && (
        <Words day={day} busy={busy} setBusy={setBusy} setError={setError}
          onDraft={(d) => { setDraft(d); setMode("draft"); }} onBack={restart} />
      )}

      {mode === "draft" && draft && (
        <section className="space-y-3 rounded-md border border-border p-4" aria-live="polite">
          {draft.heard && <p className="text-sm text-muted-foreground">🎙️ «{draft.heard}»</p>}
          <h2 className="font-semibold">
            {tr({ en: `This is what I understood, for ${dayName(draft.day, today)}:`, pt: `Entendi assim, para ${dayName(draft.day, today)}:` })}
          </h2>
          <ul className="space-y-1">
            {draft.lines.map((l, i) => <li key={i}>{lineText(l)}</li>)}
          </ul>
          {draft.notes.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-muted-foreground">{draft.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button className="h-12" disabled={busy} onClick={() => void decide(true)}>{tr({ en: "It's right", pt: "Está certo" })}</Button>
            <Button variant="outline" className="h-12" disabled={busy} onClick={() => void decide(false)}>{tr({ en: "Fix it", pt: "Corrigir" })}</Button>
          </div>
        </section>
      )}

      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      {busy && mode !== "lines" && <Loader2 className="mx-auto animate-spin text-muted-foreground" aria-label={tr({ en: "Working", pt: "Processando" })} />}
    </div>
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

function LinesForm({ lines, setLines, day, busy, onSubmit, onBack }: {
  lines: LineDraft[];
  setLines: (l: LineDraft[]) => void;
  day: string;
  busy: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const set = (key: string, patch: Partial<LineDraft>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate>
      {lines.map((l, i) => (
        <fieldset key={l.key} className="space-y-3 rounded-md border border-border p-3">
          <legend className="px-1 text-sm font-semibold">
            {l.kind === "sale" ? tr({ en: "💰 Sale", pt: "💰 Venda" }) : tr({ en: "💸 Expense", pt: "💸 Gasto" })}
          </legend>
          <div className="space-y-1">
            <Label htmlFor={`amount-${l.key}`}>{tr({ en: "Amount (R$)", pt: "Valor (R$)" })}</Label>
            <Input id={`amount-${l.key}`} inputMode="decimal" autoComplete="off" placeholder="0,00" value={l.amount}
              onChange={(e) => set(l.key, { amount: e.target.value })} className="h-12 text-lg" autoFocus={i === lines.length - 1} />
          </div>
          {l.kind === "expense" && (
            <div className="space-y-1">
              <Label htmlFor={`cat-${l.key}`}>{tr({ en: "What for", pt: "Com o quê" })}</Label>
              <select id={`cat-${l.key}`} className={selectClass} value={l.category}
                onChange={(e) => set(l.key, { category: e.target.value as Category })}>
                <option value="">{tr({ en: "Choose", pt: "Escolha" })}</option>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor={`method-${l.key}`}>{l.kind === "sale" ? tr({ en: "Received by", pt: "Recebeu como" }) : tr({ en: "Paid by", pt: "Pagou como" })}</Label>
            <select id={`method-${l.key}`} className={selectClass} value={l.method}
              onChange={(e) => set(l.key, { method: e.target.value as PaymentMethod })}>
              {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={l.later} onChange={(e) => set(l.key, { later: e.target.checked })} />
            {l.kind === "sale" ? tr({ en: "I will receive it later", pt: "Vou receber depois" }) : tr({ en: "I will pay it later", pt: "Vou pagar depois" })}
          </label>
          {l.later && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`due-${l.key}`}>{l.kind === "sale" ? tr({ en: "Receive on", pt: "Recebe em" }) : tr({ en: "First payment", pt: "1º pagamento" })}</Label>
                <Input id={`due-${l.key}`} type="date" min={addDays(day, 1)} value={l.due}
                  onChange={(e) => set(l.key, { due: e.target.value })} className="h-12" />
              </div>
              {l.kind === "expense" && (
                <div className="space-y-1">
                  <Label htmlFor={`inst-${l.key}`}>{tr({ en: "Instalments", pt: "Parcelas" })}</Label>
                  <select id={`inst-${l.key}`} className={selectClass} value={l.installments}
                    onChange={(e) => set(l.key, { installments: Number(e.target.value) })}>
                    {Array.from({ length: 12 }, (_, n) => <option key={n + 1} value={n + 1}>{n + 1}x</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
          {lines.length > 1 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>
              <Trash2 aria-hidden="true" />{tr({ en: "Remove", pt: "Remover" })}
            </Button>
          )}
        </fieldset>
      ))}
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" className="h-12" onClick={() => setLines([...lines, blank("sale")])} disabled={lines.length >= 20}>
          <Plus aria-hidden="true" />{tr({ en: "Sale", pt: "Venda" })}
        </Button>
        <Button type="button" variant="outline" className="h-12" onClick={() => setLines([...lines, blank("expense")])} disabled={lines.length >= 20}>
          <Plus aria-hidden="true" />{tr({ en: "Expense", pt: "Gasto" })}
        </Button>
      </div>
      <Button type="submit" className="h-14 w-full text-base" disabled={busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
        {tr({ en: "Save the day", pt: "Registrar o dia" })}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>{tr({ en: "Back", pt: "Voltar" })}</Button>
    </form>
  );
}

/** A recorder's type the browser can make: Chrome and Android make webm, Safari mp4. */
function recorderType(): string | undefined {
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

const MAX_SECONDS = 120;

function Words({ day, busy, setBusy, setError, onDraft, onBack }: {
  day: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
  onDraft: (d: Draft) => void;
  onBack: () => void;
}) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const send = async (body: FormData | { text: string; day: string; request_id: string }) => {
    setBusy(true);
    setError(null);
    setNotes([]);
    const { data, error } = await diaryDb.functions.invoke<Draft & { error?: string }>("diary-speak", { body });
    setBusy(false);
    if (error) {
      let key = "";
      try {
        key = ((await (error as { context?: Response }).context?.json()) as { error?: string })?.error ?? "";
      } catch { /* not json */ }
      setError(key === "too_many_today"
        ? tr({ en: "That is the limit for today. Use the form instead.", pt: "Esse é o limite de hoje. Use o formulário." })
        : key === "too_long"
          ? tr({ en: "Too long. Try a shorter message.", pt: "Ficou longo demais. Tente uma mensagem mais curta." })
          : tr({ en: "I could not read it now. Try again, or use the form.", pt: "Não consegui ler agora. Tente de novo, ou use o formulário." }));
      return;
    }
    if (!data) return;
    if (data.draft_id) onDraft(data);
    else {
      setNotes([
        ...(data.heard ? [`🎙️ «${data.heard}»`] : []),
        tr({ en: "I could not make a record from that.", pt: "Não consegui montar um registro com isso." }),
        ...(data.notes ?? []),
        tr({
          en: "Say the amount and how it was paid, e.g. «sold 250 by Pix and spent 80 on packaging in cash».",
          pt: "Diga o valor e como recebeu ou pagou, por exemplo: «vendi 250 no Pix e gastei 80 de embalagem no dinheiro».",
        }),
      ]);
    }
  };

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = recorderType();
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) window.clearInterval(timer.current);
        setRecording(false);
        const blob = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" });
        if (blob.size === 0) return;
        const form = new FormData();
        form.append("audio", new File([blob], "voice", { type: blob.type }));
        form.append("day", day);
        form.append("request_id", newRequestId());
        void send(form);
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
      setElapsed(0);
      const began = Date.now();
      timer.current = window.setInterval(() => {
        const s = Math.round((Date.now() - began) / 1000);
        setElapsed(s);
        if (s >= MAX_SECONDS) rec.stop();
      }, 500);
    } catch {
      setError(tr({
        en: "The microphone is not available. Allow it in the browser, or write instead.",
        pt: "O microfone não está disponível. Libere no navegador, ou escreva.",
      }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-center">
        {recording ? (
          <Button className="h-20 w-20 rounded-full" onClick={() => recorder.current?.stop()}
            aria-label={tr({ en: "Stop and send", pt: "Parar e enviar" })}>
            <Square aria-hidden="true" />
          </Button>
        ) : (
          <Button className="h-20 w-20 rounded-full" onClick={() => void start()} disabled={busy}
            aria-label={tr({ en: "Record a voice note", pt: "Gravar áudio" })}>
            <Mic aria-hidden="true" />
          </Button>
        )}
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {recording
            ? tr({ en: `Recording… ${elapsed}s — tap to send`, pt: `Gravando… ${elapsed}s — toque para enviar` })
            : tr({ en: "Tap and tell what you sold and spent", pt: "Toque e conte o que vendeu e gastou" })}
        </p>
      </div>
      <form className="space-y-2" onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) void send({ text: text.trim(), day, request_id: newRequestId() });
      }}>
        <Label htmlFor="diary-words">{tr({ en: "Or write it", pt: "Ou escreva" })}</Label>
        <Textarea id="diary-words" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={tr({ en: "sold 250 by Pix, spent 80 on packaging in cash", pt: "vendi 250 no Pix, gastei 80 de embalagem no dinheiro" })}
          className="text-base" />
        <Button type="submit" className="h-12 w-full" disabled={busy || recording || !text.trim()}>
          {tr({ en: "Read it", pt: "Ler" })}
        </Button>
      </form>
      {notes.length > 0 && <ul className="space-y-1 rounded-md bg-muted p-3 text-sm">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
      <Button variant="ghost" className="w-full" onClick={onBack}>{tr({ en: "Back", pt: "Voltar" })}</Button>
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

      {p?.earned.map((m) => (
        <section key={m.code} className="rounded-md border border-primary/40 bg-primary/5 p-4">
          <p className="font-semibold">🎁 {m.title}</p>
          {m.how_to_redeem && <p className="text-sm">{m.how_to_redeem}</p>}
        </section>
      ))}

      {g && <GoalNews goal={g} />}

      <InstallInvite />

      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-12" onClick={onMore}>{tr({ en: "Add more", pt: "Registrar mais" })}</Button>
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
