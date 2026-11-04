import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { tr } from "../i18n";
import { ddmm } from "./impacto";

interface Week { week_start: string; days_recorded: number; women: number }

/**
 * Days recorded, week by week: one series, so one hue and no legend (the
 * title names it). Women active that week is the second measure; on its own
 * scale it would need a second axis, so it lives in the tooltip and the table.
 */
export default function WeeklyChart({ weeks }: { weeks: Week[] }) {
  const data = weeks.map((w) => ({ ...w, label: ddmm(w.week_start).slice(0, 5) }));
  return (
    <div className="h-56 w-full" role="img" aria-label={tr({ en: "Days recorded per week", pt: "Dias registrados por semana" })}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            content={({ active, payload }) => {
              const w = active ? (payload?.[0]?.payload as (Week & { label: string }) | undefined) : undefined;
              if (!w) return null;
              return (
                <div className="rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm">
                  <p className="font-medium">{tr({ en: "Week of ", pt: "Semana de " })}{ddmm(w.week_start)}</p>
                  <p>{w.days_recorded} {tr({ en: "days recorded", pt: "dias registrados" })}</p>
                  <p className="text-muted-foreground">{w.women} {tr({ en: "women recorded", pt: "empreendedoras registraram" })}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="days_recorded" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
