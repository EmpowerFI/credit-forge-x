import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLocale, tr } from "../i18n";
import { diaryDb } from "../diary/db";
import { brl, categoryLabel, dayName, type Line, methodLabel, newRequestId, PROFILE_KEY, spToday } from "../diary/diary";

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

function lineText(l: Line): string {
  return l.kind === "sale"
    ? `💰 ${tr({ en: "Sale", pt: "Venda" })} · ${methodLabel(l.payment_method)}: ${brl(l.amount_cents)}`
    : `💸 ${categoryLabel(l.category ?? null)}: ${brl(l.amount_cents)} · ${methodLabel(l.payment_method)}`;
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
      return;
    }
    setNotes([
      ...(data.heard ? [`🎙️ «${data.heard}»`] : []),
      data.error === "not_heard"
        ? tr({ en: "I could not hear anything. Try again, closer to the phone.", pt: "Não ouvi nada. Tente de novo, mais perto do celular." })
        : tr({ en: "I could not make a record from that.", pt: "Não consegui montar um registro com isso." }),
      ...(data.notes ?? []),
      tr({
        en: "Say the amount and how it was paid, e.g. «sold 30 of cake by Pix».",
        pt: "Diga o valor e como recebeu ou pagou, por exemplo: «vendi 30 reais de bolo no Pix».",
      }),
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
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await diaryDb.rpc("diary_draft_decide" as never, {
      p_draft_id: draft.draft_id, p_confirm: confirm, p_seconds: null,
    } as never);
    setBusy(false);
    if (rpcError) {
      setError(tr({ en: "It was not saved. Try again.", pt: "Não foi salvo. Tente de novo." }));
      return;
    }
    const status = (data as { status?: string } | null)?.status;
    if (status === "confirmed") {
      setSaved(dayName(draft.day, today));
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    } else if (status === "stale") {
      setError(tr({ en: "That reading expired. Say it again.", pt: "Essa leitura expirou. Fale de novo." }));
    }
    setDraft(null);
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
          <ul className="space-y-1">{draft.lines.map((l, i) => <li key={i}>{lineText(l)}</li>)}</ul>
          {draft.notes.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-muted-foreground">{draft.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button className="h-12" disabled={busy} onClick={() => void decide(true)}>{tr({ en: "It's right", pt: "Está certo" })}</Button>
            <Button variant="outline" className="h-12" disabled={busy} onClick={() => void decide(false)}>{tr({ en: "Discard", pt: "Descartar" })}</Button>
          </div>
        </div>
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
