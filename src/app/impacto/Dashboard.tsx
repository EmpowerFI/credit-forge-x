import { lazy, Suspense, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { brl } from "../diary/diary";
import { tr } from "../i18n";
import {
  type BusinessMonth, ddmm, FUNNEL, type ImpactLive, keyLabel, monthName, pct, ratio, SEGMENT_TITLE, type Segment,
} from "./impacto";

const WeeklyChart = lazy(() => import("./WeeklyChart"));

function Card({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 break-inside-avoid sm:p-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {note && <p className="mt-0.5 text-sm text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A horizontal bar per row, one hue, the value written beside it: the number never depends on the bar. */
function Bars({ rows, max }: { rows: { key: string; label: string; value: number; text: string; hint?: string }[]; max: number }) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(7rem,10rem)_1fr_auto] items-center gap-3 text-sm">
          <span>
            {r.label}
            {r.hint && <span className="block text-xs text-muted-foreground">{r.hint}</span>}
          </span>
          <span className="h-3 rounded-sm bg-muted" aria-hidden="true">
            <span className="block h-3 rounded-sm bg-primary" style={{ width: `${max > 0 && r.value > 0 ? Math.max(2, (r.value / max) * 100) : 0}%` }} />
          </span>
          <span className="tabular-nums">{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

function SegmentTable({ title, rows }: { title: string; rows: Segment[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr({ en: "No group of 5 or more yet.", pt: "Ainda nenhum grupo com 5 ou mais." })}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-normal">{tr({ en: "Group", pt: "Grupo" })}</th>
              <th className="py-1 text-right font-normal">{tr({ en: "Women", pt: "Empreendedoras" })}</th>
              <th className="py-1 text-right font-normal">{tr({ en: "Recorded", pt: "Registraram" })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border">
                <td className="py-1.5">{keyLabel(r.key)}</td>
                <td className="py-1.5 text-right tabular-nums">{r.women}</td>
                <td className="py-1.5 text-right tabular-nums">{ratio(r.started, r.women)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MonthRow({ m }: { m: BusinessMonth }) {
  if (m.suppressed) {
    return (
      <tr className="border-t border-border">
        <td className="py-2">{monthName(m.month)}</td>
        <td colSpan={5} className="py-2 text-muted-foreground">
          {tr({ en: "Fewer than 5 well-recorded businesses: hidden.", pt: "Menos de 5 negócios bem registrados: oculto." })}
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-t border-border">
      <td className="py-2">{monthName(m.month)}</td>
      <td className="py-2 text-right tabular-nums">{m.women}</td>
      <td className="py-2 text-right tabular-nums">{brl(m.median_sales_cents ?? 0)}</td>
      <td className="py-2 text-right tabular-nums">{brl(m.median_expenses_cents ?? 0)}</td>
      <td className="py-2 text-right tabular-nums">{pct(m.positive_share_bps)}</td>
      <td className="py-2 text-right tabular-nums">
        {m.median_growth_bps == null ? "—" : `${m.median_growth_bps > 0 ? "+" : ""}${pct(m.median_growth_bps)}`}
      </td>
    </tr>
  );
}

export default function Dashboard({ data }: { data: ImpactLive }) {
  const c = data.campaign;
  const p = data.participation;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{c.sponsor_name}</p>
        <h1 className="text-2xl font-semibold sm:text-3xl">{c.name}</h1>
        <p className="text-sm text-muted-foreground">
          {tr({ en: "Campaign ", pt: "Campanha " })}{ddmm(c.period_start)} – {c.period_end ? ddmm(c.period_end) : tr({ en: "ongoing", pt: "contínua" })}
          {" · "}
          {tr({ en: "showing ", pt: "mostrando " })}{ddmm(data.from)} – {ddmm(data.to)}
          {" · "}
          {tr({ en: "updated ", pt: "atualizado " })}{new Date(data.as_of).toLocaleString(tr({ en: "en-GB", pt: "pt-BR" }), { dateStyle: "short", timeStyle: "short" })}
        </p>
        <p className="text-sm">
          {tr({
            en: "Real data from the EmpowerFI diary, kept day by day by the entrepreneurs themselves.",
            pt: "Dados reais do diário EmpowerFI, registrados dia a dia pelas próprias empreendedoras.",
          })}
        </p>
      </header>

      {data.status === "not_started" || !p ? (
        <Card title={tr({ en: "Not started yet", pt: "Ainda não começou" })}>
          <p className="text-sm">{tr({ en: "The figures appear from the campaign's first day.", pt: "Os números aparecem a partir do primeiro dia da campanha." })}</p>
        </Card>
      ) : (
        <>
          <Card title={tr({ en: "Participation", pt: "Participação" })}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {p.authorised != null && <Tile label={tr({ en: "Authorised", pt: "Autorizadas" })} value={p.authorised} />}
              <Tile label={tr({ en: "Signed up", pt: "Cadastradas" })} value={p.enrolled} />
              <Tile label={tr({ en: "Recorded in the period", pt: "Registraram no período" })} value={p.started} hint={ratio(p.started, p.enrolled)} />
              <Tile label={tr({ en: "Active, last 7 days", pt: "Ativas nos últimos 7 dias" })} value={p.active_7d} hint={ratio(p.active_7d, p.enrolled)} />
              <Tile label={tr({ en: "Days recorded", pt: "Dias registrados" })} value={p.days_recorded.toLocaleString("pt-BR")}
                hint={tr({ en: `${p.quiet_days} without sales or closed`, pt: `${p.quiet_days} sem venda ou fechado` })} />
              <Tile label={tr({ en: "Days per week, each", pt: "Dias por semana, cada uma" })}
                value={p.days_per_week == null ? "—" : p.days_per_week.toLocaleString("pt-BR")} />
              <Tile label={tr({ en: "Median streak", pt: "Sequência mediana" })}
                value={p.median_streak == null ? "—" : `${p.median_streak.toLocaleString("pt-BR")} ${tr({ en: "days", pt: "dias" })}`} />
              <Tile label={tr({ en: "Weekly goals met", pt: "Metas semanais cumpridas" })} value={`${p.goals_met}/${p.goals_set}`} />
            </div>
          </Card>

          {data.funnel && (
            <Card title={tr({ en: "From invitation to a credit history", pt: "Do convite ao histórico de crédito" })}
              note={tr({ en: "Each step counts the women who reached it.", pt: "Cada etapa conta as empreendedoras que chegaram nela." })}>
              <Bars
                max={Math.max(...data.funnel.map((f) => f.n ?? 0), 1)}
                rows={data.funnel.filter((f) => f.n != null).map((f) => ({
                  key: f.key, label: FUNNEL[f.key].label, hint: FUNNEL[f.key].hint, value: f.n ?? 0, text: String(f.n),
                }))}
              />
            </Card>
          )}

          {data.weekly && data.weekly.length > 0 && (
            <Card title={tr({ en: "Days recorded per week", pt: "Dias registrados por semana" })}>
              <Suspense fallback={<div className="h-56" />}>
                <WeeklyChart weeks={data.weekly} />
              </Suspense>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">{tr({ en: "See as a table", pt: "Ver em tabela" })}</summary>
                <table className="mt-2 w-full">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 font-normal">{tr({ en: "Week of", pt: "Semana de" })}</th>
                      <th className="py-1 text-right font-normal">{tr({ en: "Days", pt: "Dias" })}</th>
                      <th className="py-1 text-right font-normal">{tr({ en: "Women", pt: "Empreendedoras" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.weekly.map((w) => (
                      <tr key={w.week_start} className="border-t border-border">
                        <td className="py-1">{ddmm(w.week_start)}</td>
                        <td className="py-1 text-right tabular-nums">{w.days_recorded}</td>
                        <td className="py-1 text-right tabular-nums">{w.women}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </Card>
          )}

          {data.business && (
            <Card
              title={tr({ en: "The businesses", pt: "Os negócios" })}
              note={tr({
                en: `${data.business.consenting} of ${data.business.of} chose to have their business counted. Only months with at least ${data.business.well_recorded_days} days recorded; medians, never one business.`,
                pt: `${data.business.consenting} de ${data.business.of} escolheram incluir o negócio nos números. Só meses com pelo menos ${data.business.well_recorded_days} dias registrados; medianas, nunca um negócio sozinho.`,
              })}
            >
              {data.business.months.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tr({ en: "No well-recorded month yet.", pt: "Ainda nenhum mês bem registrado." })}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 font-normal">{tr({ en: "Month", pt: "Mês" })}</th>
                        <th className="py-1 text-right font-normal">{tr({ en: "Businesses", pt: "Negócios" })}</th>
                        <th className="py-1 text-right font-normal">{tr({ en: "Median sales", pt: "Vendas (mediana)" })}</th>
                        <th className="py-1 text-right font-normal">{tr({ en: "Median expenses", pt: "Gastos (mediana)" })}</th>
                        <th className="py-1 text-right font-normal">{tr({ en: "Sold more than spent", pt: "Venderam mais que gastaram" })}</th>
                        <th className="py-1 text-right font-normal">{tr({ en: "Sales vs. last month", pt: "Vendas vs. mês anterior" })}</th>
                      </tr>
                    </thead>
                    <tbody>{data.business.months.map((m) => <MonthRow key={m.month} m={m} />)}</tbody>
                  </table>
                </div>
              )}
              {data.business.payment_mix && Object.keys(data.business.payment_mix).length > 0 && (
                <div className="pt-2">
                  <h3 className="mb-2 text-sm font-semibold">{tr({ en: "How they are paid", pt: "Como recebem" })}</h3>
                  <Bars
                    max={10000}
                    rows={Object.entries(data.business.payment_mix).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({
                      key: k, label: keyLabel(k), value: v, text: pct(v),
                    }))}
                  />
                </div>
              )}
            </Card>
          )}

          <Card title={tr({ en: "How they record", pt: "Como registram" })}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {data.channels && (
                <>
                  <Tile label={tr({ en: "By form", pt: "Pelo formulário" })} value={data.channels.form} />
                  <Tile label={tr({ en: "By voice", pt: "Por áudio" })} value={data.channels.voice} />
                  <Tile label={tr({ en: "In their words", pt: "Escrevendo" })} value={data.channels.text} />
                  <Tile label={tr({ en: "Median time to record", pt: "Tempo mediano para registrar" })}
                    value={data.channels.median_seconds == null ? "—" : `${data.channels.median_seconds}s`} />
                </>
              )}
              {data.reminders && (
                <>
                  <Tile label={tr({ en: "Reminders sent", pt: "Lembretes enviados" })} value={data.reminders.sent} />
                  <Tile label={tr({ en: "Accepted by the phone's service", pt: "Aceitos pelo serviço do celular" })}
                    value={data.reminders.accepted} hint={ratio(data.reminders.accepted, data.reminders.sent)} />
                  <Tile label={tr({ en: "Opened", pt: "Abertos" })} value={data.reminders.opened}
                    hint={ratio(data.reminders.opened, data.reminders.accepted)} />
                </>
              )}
            </div>
          </Card>

          {data.segments && (
            <Card title={tr({ en: "Who takes part", pt: "Quem participa" })}
              note={tr({ en: "Groups under 5 are folded into \"Others\", or left out.", pt: "Grupos com menos de 5 entram em \"Outros\", ou ficam de fora." })}>
              <div className="grid gap-5 md:grid-cols-2">
                {(["sector", "state", "formalization", "finance_control"] as const).map((k) => (
                  <SegmentTable key={k} title={SEGMENT_TITLE[k]} rows={data.segments![k]} />
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <section className="flex gap-3 rounded-lg bg-muted p-4 text-sm break-inside-avoid">
        <ShieldCheck className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
        <p>
          {tr({
            en: "What a sponsor never receives: a name, an e-mail, or any one woman's figures. Averages, medians and breakdowns need at least 5 people behind them, and business figures count only women who chose to be counted.",
            pt: "O que o patrocinador nunca recebe: um nome, um e-mail, ou os números de uma empreendedora sozinha. Médias, medianas e recortes precisam de pelo menos 5 pessoas, e os números de negócio só incluem quem escolheu ser incluída.",
          })}
        </p>
      </section>
    </div>
  );
}
