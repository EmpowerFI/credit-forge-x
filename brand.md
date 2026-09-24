# Brand — EmpowerFI

The corporate site (`/`, `/pt` and everything under them) and the product
(`/app`) share a palette and a mark, and nothing else. The site is an editorial
document set in a serif on a cream field; the product is a dark financial
workspace set in a sans. Both are deliberate.

_Source: the founder's HTML reference of 24 Sep 2026, plus the brand asset
itself — the mark's gold and the favicon's field are sampled, not approximated._

## Palette

| Token | Site (`:root:not(.dark)`) | Product (`.dark`) | Use |
| --- | --- | --- | --- |
| `--background` | `43 28% 95%` · `#f6f4ef` | `226 49% 8%` | the field |
| `--foreground` | `222 47% 11%` · `#0f172a` | `40 30% 94%` | ink |
| `--muted-foreground` | `222 20% 34%` | `220 16% 67%` | secondary ink, 7.0:1 |
| `--accent` | `39 100% 28%` · `#8f5c00` | `39 86% 62%` | **gold that carries text**, 5.2:1 |
| `--gold` | `40 91% 44%` · `#d4920a` | `39 86% 62%` | **the mark's gold — rules and fills only** |
| `--border` | `43 12% 82%` | `222 32% 21%` | hairlines |

The two golds are the one rule that matters. `#d4920a` is the mark's own
colour and reaches only **2.4:1** on the cream field, so it never carries text —
it draws rules, outlines and tints. Text that wants to be gold uses `--accent`.
Every `text-accent` already written across the site became compliant the moment
these were split.

Ink is navy, not neutral grey: it ties the body copy to the primary and keeps
the cream from reading as beige newsprint.

## Typography

- **Site** — `Source Serif 4` for headings *and* body. Headlines run at weight
  400–500; the phrase a sentence turns on is set in **gold italic**
  (`<em className="italic text-accent">`), which replaces the old gradient text.
- **Labels** — `Inter` via `--font-ui`, in the `.eyebrow` (gold) and `.label-ui`
  (ink) utilities: uppercase, `0.22–0.24em` tracking. Wide-tracked capitals and
  tabular figures smear in a serif.
- **Product** — unchanged: `Space Grotesk` headings, `Inter` body.

## Shape and structure

- **3px corners.** `--radius: 0.3125rem` on the site, so `rounded-md` lands on
  3px. `rounded-xl` and `rounded-2xl` are squared off to 4px site-wide, which
  brings the pages that were not rewritten by hand along with the rest.
- **Hairlines, not cards.** `.glass` and `.glow-border` are re-pointed to a
  plain 1px rule; `.shadow-glow` and the decorative `blur-3xl` blobs are off.
  Sections are separated by a rule on `.section-padding`, not by tinted bands.
- **Graded gold rules.** A row of columns gets `rule-gold` → `rule-gold-2` →
  `rule-gold-3`, so three columns read as a sequence rather than three equals.
- **Status beside every claim.** `<StatusNote>` — a hairline, a `STATUS` label
  and one sentence saying what is live, what is a prototype and what is a plan.
  This is the site's central discipline, not decoration.
- **Dashed means future.** Anything not yet permitted or built is outlined in a
  dashed gold rule and says so in words.

## Components

`src/components/site/` holds the whole vocabulary:

- `editorial.tsx` — `Mark`, `Eyebrow`, `GradedRule`, `StatusNote`, `PullQuote`,
  `RingList`, `SiteLinkButton`, `SiteAnchorButton`
- `SiteHeader.tsx` — both languages' header; `top: true` puts a link in the
  desktop row, everything else lives in the panel
- `SiteFooter.tsx` — both languages' footer; only the words differ

Buttons are `.btn-site` (hairline) and `.btn-site` + `.btn-site-primary`
(1.5px gold rule, 14% gold fill). There is no third button.

## Voice

Concise, active, and specific about status. Never claim a licence, a pilot
result or a return. Name what is simulated. The legal notices in the footer are
load-bearing copy, not boilerplate.

## Checks that must keep passing

- Every text/background pair clears WCAG AA. `--accent` and `--gold` exist so
  this stays true without anyone having to remember it.
- `prefers-reduced-motion: reduce` kills every entrance fade and pulse *and*
  restores opacity — the fades start at 0, so stopping them alone would leave
  the page blank.
- `/app` must keep `--radius: 0.75rem`, Inter, and the dark field. The site's
  tokens are scoped to `:root:not(.dark)` precisely so this cannot drift.
