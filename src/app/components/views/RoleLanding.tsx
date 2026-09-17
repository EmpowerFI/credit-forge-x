import type { ReactNode } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "../../i18n";
import { type Tool, type View, VIEWS } from "../../lib/views";

/** "View platform as": the five views as one choice. */
export function ViewChoice({ value, onChange, className }: { value: View["id"]; onChange: (id: View["id"]) => void; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <p id="view-choice-label" className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {tr({ en: "View platform as", pt: "Ver plataforma como" })}
      </p>
      <div role="radiogroup" aria-labelledby="view-choice-label" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = v.id === value;
          return (
            <button key={v.id} type="button" role="radio" aria-checked={active} onClick={() => onChange(v.id)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors",
                active ? "border-accent bg-accent text-accent-foreground font-semibold" : "border-border text-muted-foreground hover:border-accent/50 hover:text-foreground",
              )}>
              <Icon size={15} aria-hidden /> {v.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A view's landing: its value, its call to action and the tools it surfaces.
 * Choosing a tool goes through `onTool`, which decides how the account gets
 * there (a demo sign-in, a persona switch or plain navigation).
 */
export default function RoleLanding({ view, cta, onTool, busy, locked }: {
  view: View;
  cta: ReactNode;
  onTool: (tool: Tool) => void;
  /** The tool being opened, while it opens. */
  busy?: Tool | null;
  /** Why this account cannot open the view's tools, if it cannot. */
  locked?: string;
}) {
  const Icon = view.icon;
  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-3">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-accent"><Icon size={14} aria-hidden /> {view.label}</p>
        <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">{view.headline}</h1>
        <p className="text-lg text-muted-foreground">{view.lead}</p>
        <div className="flex flex-wrap items-center gap-2 pt-2">{cta}</div>
        {locked && <p className="rounded-lg border tone-caution px-3 py-2 text-sm">{locked}</p>}
      </div>

      <section className="space-y-3" aria-labelledby={`tools-${view.id}`}>
        <h2 id={`tools-${view.id}`} className="font-heading text-lg font-bold text-foreground">{tr({ en: "Your tools", pt: "Suas ferramentas" })}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {view.primary.map((tool) => {
            const ToolIcon = tool.icon;
            return (
              <li key={tool.label}>
                <button type="button" onClick={() => onTool(tool)} disabled={Boolean(locked) || Boolean(busy)}
                  className="panel group flex h-full w-full items-start gap-3 p-4 text-left transition-colors hover:border-accent/50 disabled:opacity-60">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-accent"><ToolIcon size={18} aria-hidden /></span>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
                      {tool.label}
                      {busy === tool ? <Loader2 size={14} className="animate-spin" aria-hidden />
                        : <ArrowRight size={14} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />}
                    </span>
                    <span className="block text-xs text-muted-foreground">{tool.what}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {view.secondary.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-sm text-muted-foreground">
            <span>{tr({ en: "Also here:", pt: "Também aqui:" })}</span>
            {view.secondary.map((tool) => (
              <button key={tool.label} type="button" onClick={() => onTool(tool)} disabled={Boolean(locked) || Boolean(busy)} title={tool.what}
                className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-60">
                <tool.icon size={14} className="text-accent" aria-hidden /> {tool.label}
              </button>
            ))}
          </p>
        )}
      </section>
    </div>
  );
}
