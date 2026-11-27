import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Mic, Pencil, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLocale, tr } from "../i18n";
import { diaryDb } from "../diary/db";
import {
  addDays, brl, CATEGORIES, type Category, categoryLabel, dayName, diary, type Line, methodLabel, newRequestId,
  parseReais, PAYMENT_METHODS, type PaymentMethod, PROFILE_KEY, spToday,
} from "../diary/diary";

// The Seeker's voice (PLAN_SEEKER.md §2.2): she says what she sold and spent,
// ElevenLabs hears it (diary-speak-seeker), the shared reading makes a draft,
// and nothing is written until she taps that it is right.

interface Draft {
  draft_id?: string;
  day: string;
  lines: Line[];
  notes: string[];
  heard: string | null;
  error?: string;
}

const MAX_SECONDS = 120;
const consentKey = (userId: string) => `empowerfi.seeker.voice-consent.${userId}`;

function readConsent(userId: string): boolean {
  try {
    return localStorage.getItem(consentKey(userId)) === "yes";
  } catch {
    return false;
  }
}

/** A recorder's type the WebView can make: Android makes webm. */
function recorderType(): string | undefined {
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

const ddmm = (day: string) => `${day.slice(8)}/${day.slice(5, 7)}`;

function lineText(l: Line): string {
  const later = l.due_on
    ? (l.installments ?? 1) > 1
      ? tr({ en: `, ${l.installments}x from ${ddmm(l.due_on)}`, pt: `, em ${l.installments}x a partir de ${ddmm(l.due_on)}` })
      : tr({ en: `, due ${ddmm(l.due_on)}`, pt: `, para ${ddmm(l.due_on)}` })
    : "";
  return l.kind === "sale"
    ? `💰 ${tr({ en: "Sale", pt: "Venda" })} · ${methodLabel(l.payment_method)}: ${brl(l.amount_cents)}${later}`
    : `💸 ${categoryLabel(l.category ?? null) || tr({ en: "Expense", pt: "Gasto" })}: ${brl(l.amount_cents)} · ${methodLabel(l.payment_method)}${later}`;
}

const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** What is wrong with a line she adjusted, or null: the same rules as the diary's form. */
function lineProblem(l: Line, day: string): string | null {
  if (l.kind === "expense" && !l.category) return tr({ en: "Say what the expense was for.", pt: "Diga com o que foi o gasto." });
  if (l.due_on !== undefined && !(l.due_on > day)) {
    return tr({ en: "Choose a date after the day for what is paid later.", pt: "Escolha uma data depois do dia para o que fica para depois." });
  }
  return null;
}

/** A card, sale or expense: whether it is paid at once or in instalments is hers to say (founder, 27/11/2026). */
const asksTerms = (l: Line) => l.payment_method === "credit_card";
/** What the draft opens for her: an expense's category, a card's terms. */
const needsHand = (l: Line) => l.kind === "expense" || asksTerms(l);

/**
 * What the voice does not decide, she sets by hand (founder, 27/11/2026): an
 * expense's category (she may say anything, and the list is ours), and for a
 * card whether it is at once or in instalments, how many and from when. How
 * it was paid can be changed too. The amount stays what she said.
 */
function LineEditor({ line, day, index, onChange }: { line: Line; day: string; index: number; onChange: (l: Line) => void }) {
  const later = line.due_on !== undefined;
  const id = (name: string) => `voice-${name}-${index}`;
  const setLater = (on: boolean) => {
    const { due_on: _due, installments: _n, ...rest } = line;
    onChange(on ? { ...rest, due_on: line.due_on ?? addDays(day, 30), installments: line.installments ?? 1 } : rest);
  };
  return (
    <div className="space-y-3 rounded-md bg-muted/60 p-3">
      {line.kind === "expense" && (
        <div className="space-y-1">
          <label htmlFor={id("cat")} className="text-sm font-medium">{tr({ en: "What was it for?", pt: "Com o que foi o gasto?" })}</label>
          <select id={id("cat")} className={selectClass} value={line.category ?? ""}
            onChange={(e) => onChange({ ...line, category: (e.target.value || undefined) as Category | undefined })}>
            <option value="">{tr({ en: "Choose", pt: "Escolha" })}</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      )}
      <div className="space-y-1">
        <label htmlFor={id("method")} className="text-sm font-medium">
          {line.kind === "sale" ? tr({ en: "Received by", pt: "Recebeu como" }) : tr({ en: "Paid by", pt: "Pagou como" })}
        </label>
        <select id={id("method")} className={selectClass} value={line.payment_method}
          onChange={(e) => onChange({ ...line, payment_method: e.target.value as PaymentMethod })}>
          {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>
      <div role="group" aria-label={tr({ en: "At once or in instalments", pt: "À vista ou parcelado" })} className="grid grid-cols-2 gap-2">
        <Button type="button" variant={later ? "outline" : "default"} className="h-11" aria-pressed={!later} onClick={() => setLater(false)}>
          {tr({ en: "At once", pt: "À vista" })}
        </Button>
        <Button type="button" variant={later ? "default" : "outline"} className="h-11" aria-pressed={later} onClick={() => setLater(true)}>
          {tr({ en: "In instalments", pt: "Parcelado" })}
        </Button>
      </div>
      {later && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor={id("inst")} className="text-sm font-medium">{tr({ en: "How many", pt: "Quantas vezes" })}</label>
            <select id={id("inst")} className={selectClass} value={line.installments ?? 1}
              onChange={(e) => onChange({ ...line, installments: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, n) => <option key={n + 1} value={n + 1}>{n + 1}x</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={id("due")} className="text-sm font-medium">
              {(line.installments ?? 1) > 1 ? tr({ en: "1st due date", pt: "1º vencimento" }) : tr({ en: "Due date", pt: "Vencimento" })}
            </label>
            <input id={id("due")} type="date" min={addDays(day, 1)} value={line.due_on ?? ""}
              onChange={(e) => onChange({ ...line, due_on: e.target.value })}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base" />
          </div>
        </div>
      )}
    </div>
  );
}

/** When the voice could not make a record: she writes it, one line, with the same fields. */
function ManualLine({ day, busy, onSave, onCancel }: { day: string; busy: boolean; onSave: (l: Line) => void; onCancel: () => void }) {
  const [amount, setAmount] = useState("");
  const [line, setLine] = useState<Line>({ kind: "sale", amount_cents: 0, payment_method: "pix" });
  const [problem, setProblem] = useState<string | null>(null);
  const save = () => {
    const cents = parseReais(amount);
    if (cents === null) {
      return setProblem(amount.trim()
        ? tr({ en: `"${amount}" is not an amount.`, pt: `"${amount}" não é um valor.` })
        : tr({ en: "Fill in the amount.", pt: "Preencha o valor." }));
    }
    const full = cleanLine({ ...line, amount_cents: cents });
    const wrong = lineProblem(full, day);
    if (wrong) return setProblem(wrong);
    onSave(full);
  };
  return (
    <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
      <p className="font-medium">{tr({ en: "Write it here:", pt: "Anote aqui:" })}</p>
      <div role="group" aria-label={tr({ en: "Sale or expense", pt: "Venda ou gasto" })} className="grid grid-cols-2 gap-2">
        {(["sale", "expense"] as const).map((k) => (
          <Button key={k} type="button" variant={line.kind === k ? "default" : "outline"} className="h-11" aria-pressed={line.kind === k}
            onClick={() => { setProblem(null); setLine(({ category: _c, ...rest }) => ({ ...rest, kind: k })); }}>
            {k === "sale" ? tr({ en: "💰 Sale", pt: "💰 Venda" }) : tr({ en: "💸 Expense", pt: "💸 Gasto" })}
          </Button>
        ))}
      </div>
      <div className="space-y-1">
        <label htmlFor="voice-manual-amount" className="text-sm font-medium">{tr({ en: "Amount (R$)", pt: "Valor (R$)" })}</label>
        <input id="voice-manual-amount" inputMode="decimal" autoComplete="off" placeholder="0,00" value={amount}
          onChange={(e) => { setProblem(null); setAmount(e.target.value); }}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-base" />
      </div>
      <LineEditor line={line} day={day} index={99} onChange={(l) => { setProblem(null); setLine(l); }} />
      {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button type="submit" className="h-12" disabled={busy}>{tr({ en: "Save", pt: "Salvar" })}</Button>
        <Button type="button" variant="outline" className="h-12" disabled={busy} onClick={onCancel}>{tr({ en: "Cancel", pt: "Cancelar" })}</Button>
      </div>
    </form>
  );
}

/** A line as journal_record takes it: one instalment is no instalment. */
function cleanLine(l: Line): Line {
  const { installments, ...rest } = l;
  return { ...rest, ...(l.due_on && (installments ?? 1) > 1 ? { installments } : {}) };
}

async function errorCode(error: unknown): Promise<string> {
  try {
    return ((await (error as { context?: Response }).context?.json()) as { error?: string })?.error ?? "";
  } catch {
    return "";
  }
}

export function SeekerSpeak({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [consented, setConsented] = useState(() => readConsent(userId));
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [editing, setEditing] = useState<Set<number>>(new Set());
  const [manual, setManual] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);
  const today = spToday();

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const agree = () => {
    try {
      localStorage.setItem(consentKey(userId), "yes");
    } catch {
      // private mode: she is asked again next time
    }
    setConsented(true);
  };

  const send = async (form: FormData) => {
    setBusy(true);
    setError(null);
    setNotes([]);
    const { data, error: invokeError } = await diaryDb.functions.invoke<Draft>("diary-speak-seeker", { body: form });
    setBusy(false);
    if (invokeError) {
      const code = await errorCode(invokeError);
      setError(
        code === "voice_not_allowed"
          ? tr({ en: "Voice is open to testers only for now.", pt: "Por enquanto, a voz está liberada só para quem está testando." })
          : code === "too_many_today"
            ? tr({ en: "That is the limit for today.", pt: "Esse é o limite de hoje." })
            : code === "too_long"
              ? tr({ en: "Too long. Try a shorter message.", pt: "Ficou longo demais. Tente uma mensagem mais curta." })
              : tr({ en: "I could not hear it now. Try again.", pt: "Não consegui ouvir agora. Tente de novo." }),
      );
      return;
    }
    if (!data) return;
    if (data.draft_id) {
      setDraft(data);
      setLines(data.lines);
      // An expense (its category) or a card (at once or in instalments): open for her.
      setEditing(new Set(data.lines.flatMap((l, i) => (needsHand(l) ? [i] : []))));
      return;
    }
    // Nothing it could make a record of: she writes it by hand.
    setManual(true);
    setNotes([
      ...(data.heard ? [`🎙️ «${data.heard}»`] : []),
      data.error === "not_heard"
        ? tr({ en: "I could not hear anything. Try again, closer to the phone.", pt: "Não ouvi nada. Tente de novo, mais perto do celular." })
        : tr({ en: "I could not make a record from that.", pt: "Não consegui montar um registro com isso." }),
      ...(data.notes ?? []),
    ]);
  };

  const start = async () => {
    setError(null);
    setSaved(null);
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
        form.append("day", today);
        form.append("request_id", newRequestId());
        form.append("lang", getLocale());
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
        en: "The microphone is not available. Allow it for the app and try again.",
        pt: "O microfone não está disponível. Libere para o app e tente de novo.",
      }));
    }
  };

  const decide = async (confirm: boolean) => {
    if (!draft?.draft_id) return;
    const adjusted = lines.map(cleanLine);
    const changed = JSON.stringify(adjusted) !== JSON.stringify(draft.lines.map(cleanLine));
    if (confirm) {
      const problem = adjusted.map((l) => lineProblem(l, draft.day)).find(Boolean);
      if (problem) return setError(problem);
    }
    setBusy(true);
    setError(null);
    try {
      // As she said it: the draft itself. Adjusted by hand: the draft is set
      // aside and the day is recorded with her lines, as the diary's form does.
      const { data, error: rpcError } = await diaryDb.rpc("diary_draft_decide" as never, {
        p_draft_id: draft.draft_id, p_confirm: confirm && !changed, p_seconds: null,
      } as never);
      if (rpcError) throw rpcError;
      const status = (data as { status?: string } | null)?.status;
      if (confirm && changed) {
        await diary.record({ requestId: newRequestId(), day: draft.day, lines: adjusted });
        setSaved(dayName(draft.day, today));
        void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      } else if (status === "confirmed") {
        setSaved(dayName(draft.day, today));
        void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      } else if (status === "stale") {
        setError(tr({ en: "That reading expired. Say it again.", pt: "Essa leitura expirou. Fale de novo." }));
      }
      setDraft(null);
    } catch {
      setError(tr({ en: "It was not saved. Try again.", pt: "Não foi salvo. Tente de novo." }));
    } finally {
      setBusy(false);
    }
  };

  const saveByHand = async (l: Line) => {
    setBusy(true);
    setError(null);
    try {
      await diary.record({ requestId: newRequestId(), day: today, lines: [l] });
      setManual(false);
      setNotes([]);
      setSaved(dayName(today, today));
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    } catch {
      setError(tr({ en: "It was not saved. Try again.", pt: "Não foi salvo. Tente de novo." }));
    } finally {
      setBusy(false);
    }
  };

  if (!consented) {
    return (
      <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-labelledby="seeker-voice-title">
        <h2 id="seeker-voice-title" className="font-semibold">{tr({ en: "Record by voice", pt: "Registrar falando" })}</h2>
        <p className="text-sm text-muted-foreground">
          {tr({
            en: "To turn your voice into text, the recording goes to ElevenLabs, a company outside Brazil, which may keep it in its records. We keep only the text and the draft, never the audio. Nothing is written in your diary until you confirm.",
            pt: "Para virar texto, sua gravação vai para a ElevenLabs, uma empresa fora do Brasil, que pode guardá-la nos registros dela. Nós guardamos só o texto e o rascunho, nunca o áudio. Nada entra no seu diário antes de você confirmar.",
          })}
        </p>
        <Button className="h-12 w-full" onClick={agree}>{tr({ en: "I agree, use my voice", pt: "Concordo, usar minha voz" })}</Button>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4" aria-labelledby="seeker-voice-title">
      <h2 id="seeker-voice-title" className="font-semibold">{tr({ en: "Record by voice", pt: "Registrar falando" })}</h2>

      {draft ? (
        <div className="space-y-3" aria-live="polite">
          {draft.heard && <p className="text-sm text-muted-foreground">🎙️ «{draft.heard}»</p>}
          <p className="font-medium">
            {tr({ en: `This is what I understood, for ${dayName(draft.day, today)}:`, pt: `Entendi assim, para ${dayName(draft.day, today)}:` })}
          </p>
          <ul className="space-y-3">
            {lines.map((l, i) => (
              <li key={i} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span>{lineText(cleanLine(l))}</span>
                  {!editing.has(i) && (
                    <Button variant="ghost" size="sm" className="h-10 shrink-0 gap-1"
                      onClick={() => setEditing((e) => new Set(e).add(i))}>
                      <Pencil size={14} aria-hidden="true" />{tr({ en: "Adjust", pt: "Ajustar" })}
                    </Button>
                  )}
                </div>
                {editing.has(i) && (
                  <LineEditor line={l} day={draft.day} index={i}
                    onChange={(next) => { setError(null); setLines((all) => all.map((x, j) => (j === i ? next : x))); }} />
                )}
              </li>
            ))}
          </ul>
          {draft.notes.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-muted-foreground">{draft.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button className="h-12" disabled={busy} onClick={() => void decide(true)}>{tr({ en: "It's right", pt: "Está certo" })}</Button>
            <Button variant="outline" className="h-12" disabled={busy} onClick={() => void decide(false)}>{tr({ en: "Discard", pt: "Descartar" })}</Button>
          </div>
        </div>
      ) : manual ? (
        <ManualLine day={today} busy={busy} onSave={(l) => void saveByHand(l)} onCancel={() => { setManual(false); setNotes([]); }} />
      ) : (
        <div className="space-y-2 text-center">
          {recording ? (
            <Button className="h-20 w-20 rounded-full" onClick={() => recorder.current?.stop()}
              aria-label={tr({ en: "Stop and send", pt: "Parar e enviar" })}>
              <Square aria-hidden="true" />
            </Button>
          ) : (
            <Button className="h-20 w-20 rounded-full" onClick={() => void start()} disabled={busy}
              aria-label={tr({ en: "Record", pt: "Gravar" })}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Mic aria-hidden="true" />}
            </Button>
          )}
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {recording
              ? tr({ en: `Recording… ${elapsed}s. Tap to send.`, pt: `Gravando… ${elapsed}s. Toque para enviar.` })
              : busy
                ? tr({ en: "Listening…", pt: "Ouvindo…" })
                : tr({ en: "Tap and say what you sold or spent.", pt: "Toque e diga o que vendeu ou gastou." })}
          </p>
          {!recording && !busy && (
            <Button variant="ghost" className="h-10" onClick={() => { setSaved(null); setManual(true); }}>
              {tr({ en: "Write it instead", pt: "Prefiro anotar" })}
            </Button>
          )}
        </div>
      )}

      {saved && (
        <p className="flex items-center justify-center gap-2 text-sm font-medium" role="status">
          <Check size={16} className="text-primary" aria-hidden="true" />
          {tr({ en: `Saved in your diary, for ${saved}.`, pt: `Salvo no seu diário, para ${saved}.` })}
        </p>
      )}
      {notes.length > 0 && <ul className="space-y-1 rounded-md bg-muted p-3 text-sm">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
