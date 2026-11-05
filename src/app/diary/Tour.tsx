import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "../i18n";
import type { TourStep } from "./tour-steps";

const PAD = 8;
const GAP = 14;
const FIND_FOR_MS = 4000;

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const find = (target: string) => document.querySelector<HTMLElement>(`[data-tour="${target}"]`);

interface Hole { top: number; left: number; width: number; height: number }

/**
 * The guided tour: the screen dims, the real element is lit, and a card
 * beside it says what it is for. Steps move across Hoje and Lembretes; a
 * step whose element is not on the screen (the quiet buttons, on a day
 * already recorded) is skipped. Nothing behind the dim can be tapped,
 * except the lit element of an interactive step.
 */
export function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [hole, setHole] = useState<Hole | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const step = steps[i];

  const finish = useCallback(() => {
    onClose();
    navigate("/app/diario");
  }, [onClose, navigate]);

  const go = useCallback((d: 1 | -1) => {
    setDir(d);
    setHole(null);
    setI((n) => n + d);
  }, []);

  // Past either end: done (forwards) or back on the first step.
  useEffect(() => {
    if (i >= steps.length) finish();
    else if (i < 0) setI(0);
  }, [i, steps.length, finish]);

  // The step's page.
  useEffect(() => {
    if (step && pathname !== step.route) navigate(step.route);
  }, [step, pathname, navigate]);

  // The step's element: wait for it (pages load lazily), bring it into view,
  // and follow it as the page scrolls or turns.
  useLayoutEffect(() => {
    if (!step || pathname !== step.route) return;
    let timer = 0;
    let stopped = false;
    const started = Date.now();
    const measure = () => {
      const el = find(step.target);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setHole({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    };
    const look = () => {
      if (stopped) return;
      const el = find(step.target);
      if (el) {
        // A tall element shows from its top, under the header, leaving the
        // card room below; a short one sits in the middle.
        const r = el.getBoundingClientRect();
        const behavior = reduceMotion() ? "auto" : "smooth";
        if (r.height > window.innerHeight * 0.4) window.scrollTo({ top: window.scrollY + r.top - 80, behavior });
        else el.scrollIntoView({ block: "center", behavior });
        timer = window.setTimeout(measure, reduceMotion() ? 0 : 380);
      } else if (Date.now() - started < FIND_FOR_MS) {
        timer = window.setTimeout(look, 80);
      } else {
        go(dir);
      }
    };
    look();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, pathname, dir, go]);

  // The card takes the focus at each step, so a screen reader reads it.
  useEffect(() => {
    if (hole) card.current?.focus();
  }, [hole, i]);

  if (!step) return null;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      finish();
      return;
    }
    if (e.key !== "Tab" || !card.current) return;
    // Focus stays in the card; an interactive step hands it to the lit element too.
    const inCard = [...card.current.querySelectorAll<HTMLElement>("button")];
    const lit = step.interactive ? [...(find(step.target)?.querySelectorAll<HTMLElement>("button, [role=switch], select") ?? [])] : [];
    const ring = [...inCard, ...lit].filter((el) => !el.hasAttribute("disabled"));
    const at = ring.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    ring[(at + (e.shiftKey ? -1 : 1) + ring.length) % ring.length]?.focus();
  };

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(360, vw - 32);
  // Below when there is room, above when there is room there; otherwise at
  // the foot of the screen, over the end of a tall element.
  const roomBelow = hole ? vh - (hole.top + hole.height) > 230 : true;
  const roomAbove = hole ? hole.top > 230 : false;
  const below = roomBelow || !roomAbove;
  const left = hole ? Math.min(Math.max(16, hole.left + hole.width / 2 - width / 2), vw - width - 16) : 16;
  const last = i === steps.length - 1;
  const moving = reduceMotion() ? "" : "transition-all duration-300 ease-out";

  // The dim, with a window cut where the element is. On an interactive step
  // four panes surround the window, so the element itself takes taps.
  const panes = hole && step.interactive
    ? [
      { top: 0, left: 0, width: vw, height: Math.max(0, hole.top) },
      { top: hole.top + hole.height, left: 0, width: vw, height: Math.max(0, vh - hole.top - hole.height) },
      { top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height },
      { top: hole.top, left: hole.left + hole.width, width: Math.max(0, vw - hole.left - hole.width), height: hole.height },
    ]
    : [{ top: 0, left: 0, width: vw, height: vh }];

  return (
    <div className="diary pointer-events-none fixed inset-0 z-[60]" onKeyDown={onKey}>
      {panes.map((p, n) => <div key={n} className="pointer-events-auto fixed" style={p} aria-hidden="true" />)}
      <div aria-hidden="true"
        className={`pointer-events-none fixed rounded-2xl ring-2 ring-gold ${moving}`}
        style={hole
          ? { ...hole, boxShadow: "0 0 0 9999px rgb(10 15 30 / 0.62)" }
          : { top: vh / 2, left: vw / 2, width: 0, height: 0, boxShadow: "0 0 0 9999px rgb(10 15 30 / 0.62)" }} />

      {hole && (
        <div ref={card} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body" tabIndex={-1}
          className={`pointer-events-auto fixed space-y-3 rounded-2xl border border-border bg-card p-5 text-foreground shadow-xl focus-visible:outline-none ${moving}`}
          style={below
            ? roomBelow ? { top: hole.top + hole.height + GAP, left, width } : { bottom: 16, left, width }
            : { bottom: Math.max(16, vh - hole.top + GAP), left, width }}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {tr({ en: `${i + 1} of ${steps.length}`, pt: `${i + 1} de ${steps.length}` })}
            </p>
            <button type="button" onClick={finish} aria-label={tr({ en: "Close the tour", pt: "Fechar o tutorial" })}
              className="-m-2 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <h2 id="tour-title" className="font-heading text-xl font-semibold leading-snug">{tr(step.title)}</h2>
          <p id="tour-body" className="leading-relaxed">{tr(step.body)}</p>
          <div className="flex items-center justify-between gap-3 pt-1">
            {i === 0 ? (
              <Button variant="ghost" className="h-11" onClick={finish}>{tr({ en: "Skip", pt: "Pular" })}</Button>
            ) : (
              <Button variant="outline" className="h-11" onClick={() => go(-1)}>{tr({ en: "Back", pt: "Voltar" })}</Button>
            )}
            <Button className="h-11 min-w-28" onClick={() => (last ? finish() : go(1))}>
              {last ? tr({ en: "Start", pt: "Começar" }) : tr({ en: "Next", pt: "Próximo" })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
