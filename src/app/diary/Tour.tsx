import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "../i18n";
import type { TourStep } from "./tour-steps";

const SWIPE = 40;

/**
 * The tutorial, as a carousel: one picture of the real screen per slide, a
 * title and one sentence. Next and Back, a swipe, or the arrow keys move it;
 * the dots say where she is and take her to any slide; Escape or the cross
 * closes it.
 */
export function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const from = useRef<number | null>(null);
  const step = steps[i];
  const last = i === steps.length - 1;
  const go = (n: number) => setI(Math.max(0, Math.min(steps.length - 1, n)));

  // The next picture, fetched ahead so it is there when she swipes.
  useEffect(() => {
    const next = steps[i + 1];
    if (next) new Image().src = tr(next.image);
  }, [i, steps]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
  };
  const down = (e: PointerEvent) => { from.current = e.clientX; };
  const up = (e: PointerEvent) => {
    if (from.current === null) return;
    const dx = e.clientX - from.current;
    from.current = null;
    if (dx <= -SWIPE) go(i + 1);
    else if (dx >= SWIPE) go(i - 1);
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[rgb(10_15_30/0.62)]" />
        <DialogPrimitive.Content
          onKeyDown={onKey}
          // The slide is read first; the cross is not where she starts.
          onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement | null)?.focus(); }}
          aria-describedby="tour-body"
          className="diary fixed left-1/2 top-1/2 z-[60] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl border border-border bg-card p-4 text-foreground shadow-xl focus-visible:outline-none">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {tr({ en: `${i + 1} of ${steps.length}`, pt: `${i + 1} de ${steps.length}` })}
            </p>
            <DialogPrimitive.Close aria-label={tr({ en: "Close the tutorial", pt: "Fechar o tutorial" })}
              className="-m-2 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X size={18} aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 touch-pan-y select-none" onPointerDown={down} onPointerUp={up} onPointerCancel={() => { from.current = null; }}>
            <div className="flex h-[min(52dvh,26rem)] items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
              <img key={i} src={tr(step.image)} alt={tr(step.alt)} draggable={false}
                className="h-full w-full object-contain motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200" />
            </div>
          </div>

          <div className="space-y-1">
            <DialogPrimitive.Title className="font-heading text-lg font-semibold leading-snug">{tr(step.title)}</DialogPrimitive.Title>
            <p id="tour-body" className="min-h-10 text-sm leading-relaxed">{tr(step.body)}</p>
          </div>

          <div className="flex justify-center gap-1" role="group" aria-label={tr({ en: "Slides", pt: "Telas" })}>
            {steps.map((s, n) => (
              <button key={n} type="button" onClick={() => go(n)} aria-current={n === i ? "step" : undefined}
                aria-label={tr({ en: `Slide ${n + 1}: ${s.title.en}`, pt: `Tela ${n + 1}: ${s.title.pt}` })}
                className="flex h-6 w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span aria-hidden="true" className={`h-2 rounded-full transition-all ${n === i ? "w-4 bg-primary" : "w-2 bg-border"}`} />
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {i === 0 ? (
              <Button variant="ghost" className="h-10" onClick={onClose}>{tr({ en: "Skip", pt: "Pular" })}</Button>
            ) : (
              <Button variant="outline" className="h-10" onClick={() => go(i - 1)}>{tr({ en: "Back", pt: "Voltar" })}</Button>
            )}
            <Button className="h-10" onClick={() => (last ? onClose() : go(i + 1))}>
              {last ? tr({ en: "Start", pt: "Começar" }) : tr({ en: "Next", pt: "Próximo" })}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
