import { formatDate, tr } from "../../i18n";
import { sponsorshipFor, type SponsorshipRow } from "../../lib/sponsorship";
import SponsorWordmark from "./SponsorWordmark";

/**
 * Who is paying for the programme she is in, said once.
 *
 * This is the whole of the sponsor's presence in her experience, and the
 * restraint is the point: she is told who made the programme possible, and the
 * relationship stays EmpowerFI's. So there is no offer, no product, no call to
 * action and nowhere to click — a sponsor that could send her somewhere would
 * be advertising, and a programme she is in for her business should not spend
 * her attention on someone else's funnel.
 *
 * It also sits below the next step she has to take, never above it. What she
 * needs to do with her business outranks who paid for the programme.
 */
export default function SponsoredBy({ row }: { row: SponsorshipRow }) {
  const dressing = sponsorshipFor(row.sponsor_name);
  return (
    <section aria-labelledby="sponsored-by"
      className="rounded-2xl border border-border bg-secondary/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {tr({ en: "Your program", pt: "Seu programa" })}
          </p>
          <h2 id="sponsored-by" className="font-heading text-base font-bold text-foreground">{row.program_name}</h2>
          <p className="text-sm text-muted-foreground">
            {dressing?.enables ?? tr({
              en: `This journey is offered with the support of ${row.sponsor_name}.`,
              pt: `Esta jornada é oferecida com o apoio da ${row.sponsor_name}.`,
            })}
          </p>
        </div>
        <div className="space-y-1.5 text-right">
          {/* A drawn mark only for an invented sponsor: see SponsorWordmark. A
              real name is set in the page's own type, with the hypothesis
              beside it rather than a manufactured logo above it. */}
          {dressing && !dressing.hypothetical
            ? <SponsorWordmark name={row.sponsor_name} className="ml-auto h-5 w-auto text-foreground" />
            : <p className="font-semibold text-foreground">{row.sponsor_name}</p>}
          {dressing?.hypothetical && (
            <p className="text-[11px] font-medium text-caution">{dressing.hypothetical}</p>
          )}
          <p className="text-[11px] text-muted-foreground">{tr({ en: "Powered by EmpowerFI", pt: "Com tecnologia EmpowerFI" })}</p>
        </div>
      </div>
      {dressing && <p className="mt-3 border-t border-border/60 pt-3 text-sm text-muted-foreground">{dressing.because}</p>}
      {/* In the same box as the name, so a screenshot of this card cannot carry
          the sponsorship without carrying the correction. */}
      {dressing?.disclosure && (
        <p className="mt-3 rounded-lg border tone-caution px-3 py-2 text-xs">{dressing.disclosure}</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {tr({
          en: `${row.sponsor_name} sees how the program is going as a whole. It never sees your name, your business, your numbers or your answers. · ${formatDate(`${row.period_start}T12:00:00`)} – ${formatDate(`${row.period_end}T12:00:00`)}`,
          pt: `A ${row.sponsor_name} acompanha como o programa vai no conjunto. Ela nunca vê o seu nome, o seu negócio, os seus números nem as suas respostas. · ${formatDate(`${row.period_start}T12:00:00`)} – ${formatDate(`${row.period_end}T12:00:00`)}`,
        })}
      </p>
    </section>
  );
}
