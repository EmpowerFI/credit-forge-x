# The WhatsApp entry layer — the pieces that can exist before the code

**Written for:** the founder, and whoever submits these to Meta. Companion to [STUDY-WHATSAPP.md](../STUDY-WHATSAPP.md), which carries the reasoning. This directory holds the artefacts: the check-in form, the message templates and the consent wording. None of it is wired to anything, and all of it moves to the private repo when that exists.

## Two findings that change the plan

**A Flow with no endpoint is enough, and that is a week back.** [STUDY-WHATSAPP §4.2](../STUDY-WHATSAPP.md) left this open and budgeted roughly a week for a data endpoint with an encryption key pair. Checked against Meta's own documentation: a Flow without an endpoint generates its routing automatically, ends on a terminal screen whose `Footer` carries a `complete` action, and delivers everything she typed in the webhook as `nfm_reply.response_json`. A check-in needs no live data from the server while she fills it, so none of the endpoint work is needed. Confirm in Flow Builder before relying on it — that is also the authoritative validator for the JSON here.

**Business verification is not required to start, and a test number needs no paperwork at all.** Getting started creates a test WhatsApp Business account and a test phone number with relaxed limits and no payment method, so the whole build can be exercised today. Verification is what the *pilot* waits on, not the build: unverified, a business is capped at about 250 unique customers in a rolling 24 hours for business-initiated conversations, and the display name needs verification to be approved. 250 is far above a first cohort, so even the pilot is not blocked by it — the cap binds on the fortnightly reminder, which is business-initiated, and not on the report link, which [STUDY-ACCESS §3](../STUDY-ACCESS.md) already makes something she asks for.

## What is built, as of 13 October 2026

The receiving half. Nothing sends yet, and nothing needs Meta to be exercised.

| | where | what proves it |
|---|---|---|
| the parser | `platform/supabase/functions/_shared/whatsapp.ts` | 10 Deno tests, in CI |
| the webhook | `platform/supabase/functions/whatsapp-webhook/` | type-checked in CI |
| the tables and the assembly | `platform/supabase/migrations/20261106000000_a_fortnight_is_half_a_month.sql` | a run from zero into a scratch database |

**A fortnight is not a month, and the schema says so.** `public.checkins` holds one row per entrepreneur per month and validates `active_days` 0–31. The Flow asks about a fortnight. So a half lands in `whatsapp_checkin_halves` and the month is assembled only when its second half arrives: revenue, costs and days add, `keeps_records` is the *and* of the two, and a lone half reaches neither `months_reported` nor the readiness engine. Half a month of revenue beside a whole month of costs is a worse number than no number.

**Recognising a retry, spending the token, writing the half and assembling the month are one database call**, `public.whatsapp_record_half`, because as four they are a race. Exercised against a database built from zero: a retried delivery answers `duplicate` and changes nothing; a spent token, an expired one and an unknown one are each refused by name; sixteen days in a fortnight is refused by a check constraint as well as by the parser; redoing a fortnight while the month is still open replaces it, and after the month is assembled it is refused, because a correction is a different act with its own record.

**A simulated woman's fortnight is simulated.** The assembled month inherits `is_simulated` from the entrepreneur, which the reset guard in `20261104000000` reads. Without that line a demo month looks real and the showroom stops being resettable — it was a real bug, found by running it rather than by reading it.

**No phone number is stored.** Identity travels in the flow token, which is 32 random bytes and says nothing about her to anyone who intercepts it. [PLAN.md](../PLAN.md) 2.2 puts phone numbers into the PII scan's search set before the first real one is kept, and that has not happened.

**The entry conversation, as a pure state machine.** `platform/supabase/functions/_shared/conversation.ts` decides every reply from the stored row alone -- no clock, no database, no network -- so AC-02, *resumes exactly at the last valid question*, is a property of the data rather than a hope about a session. The rule that produces it: **an answer that is not understood never advances the step**, so a reply three days later lands on the same question by construction. `SAIR` and `AJUDA` work at every point and are never read as answers; a withdrawn consent is not reinstated by saying hello, she starts again from the wording.

She becomes an entrepreneur on the last answer, **in one transaction with her consent record** -- a woman who exists without a consent record is worse than one who does not exist, because the record is what says she was asked. The scopes are **assessment only**: the wording promises a reading of her own month and says nobody sees her figures without her say-so, so partner, investor and impact are false. Widening is a new consent, never a default.

Three things the tests pin that are easy to get wrong: *"não sei"* is an answer and stores null months, while an answer nobody could read is refused and asks again -- merging the two would record "she does not know" for something nobody read; a retried delivery is recognised **before** the machine sees it, because run twice an answer advances two questions and the sector lands under the wrong one; and `+1 415 555 0132` is eleven digits, exactly like a Brazilian mobile written locally.

**The monthly reading.** When a month is assembled she receives a short reading of it. The figures come from `packages/checkin-insights` -- pure, versioned, integer-only, computed before any model is involved; a cost she did not know leaves the result *absent*, never zero. The prose is written by Claude Haiku over those figures and accepted only if it passes every check in `_shared/report.ts`: **no number that was not handed over**, in the form it was handed over; never *lucro*, *crédito*, *empréstimo*, *financiamento*, *score* or *inadimplência*; at most two observations, one action. A refused answer is replaced, not repaired, by a reading built from fixed sentences -- and the tests prove that fallback passes the same checks in every kind of month. The model never sees her name, phone or city; her first name is added to the message by code afterwards.

`ai_analyses` holds one reading per month: a retried delivery returns the stored reading without calling the model (AC-03), a model failure becomes the fallback and the month is never sent to the model again (AC-09), and retries stop after three. Prompt version, model, formula version, tokens, cost and -- when the model was refused -- the reasons, which are the sample a human reviews.

Still to build: issuing the fortnightly invitation (business-initiated, billed, waits on Meta's queue), the baseline, and the report link.

**The daily journal replaces the fortnight** (specification: [`diario.pt-BR.md`](diario.pt-BR.md)). Its foundation is in the database: `journal_entries` (one line per sale or expense, with payment method, à vista or a prazo, and a classification that maps to a simple income statement), `journal_days` (a day is kept when it has a line or she said nothing happened), `journal_dre` for any range of days, `journal_month_status` (a month counts when no calendar week in it misses more than one day), and a daily job that assembles each finished, well-kept month into `checkins` for the readiness engine, unchanged. The daily form is built: [`diario-flow.pt-BR.json`](diario-flow.pt-BR.json) is generated from `_shared/journal.ts` (`npx tsx scripts/whatsapp/build-diario-flow.mts`), and a test fails if the two disagree. "Ontem" is the default because the reminder goes out at 9 in the morning about the day before. Sales go in as the day's total per payment method; up to three expenses per form, and another form the same day adds to it. A quiet day is one tap on the reminder's quick reply (`journal_quiet_yesterday`) or the words SEM MOVIMENTO. Every form is answered at once with fixed text from `journal_day_summary`. Streaks and rewards are built: a streak is a run of kept days in which no calendar week misses more than one, its length is the days kept, and each milestone of the latest published programme is earned once, ever (`journal_progress`). The programme is published, frozen and versioned, through `reward_programme_publish` -- callable by the credit platform's admins or an owner of the dashboard's admin layer -- and read with `reward_programme_current`. Version 1 is seeded with the founder's programme (7, 14 and 28 days; the partner's credit card at 60) and placeholder titles. A partner benefit is recorded as `awaiting_consent` until she answers AUTORIZO, which adds a partner-sharing consent and releases it. The rewards screen is in the dashboard (EmpowerFI/empowerfi-dashboard, `/rewards`). The weekly reading is built: `checkin-report` reads a month (`{ checkin_id }`) or a week (`{ entrepreneur_id, week_start }`) with the same figures engine (`insights-v0.2.0`, a week named by its Monday), the same checks and fallback, and `journal_readings` keeps it once per week. It follows the confirmation when she records Sunday -- usually Monday morning -- or, if Sunday never comes, the next day she records; a week is read only if she kept at least three of its days, and compared with the week before only if both were kept on at least six. Still to build: the 9 o'clock reminder (a template, so it waits on Meta). The fortnight tables stay until that form replaces theirs.

An unknown cost is an answer. In the Flow both cost fields may be left blank, and blank arrives as null -- never as zero, which would invent a better month than she had. A month is assembled with an unknown cost if either fortnight did not know it, the reading says the result cannot be calculated, and the readiness engine does not receive that month at all: it does not count as a complete month for credit. Sales and household stay required.

## `checkin-flow.pt-BR.json`

One fortnight of one business, in two screens. Not one screen of six fields, which reads as a wall, and not six screens, which is six chances to abandon it.

| screen | asks | why together |
|---|---|---|
| `VENDAS` | what she sold, days worked, whether she recorded every sale | what happened |
| `CUSTOS` | goods, other business costs, what she drew for the household | what it cost — and the subheading is where the separation between the business and the house gets taught, because that is the number most often wrong |

Carried forward from the first screen through the second's `data` block, because a no-endpoint Flow has nowhere else to keep it, and returned whole in the completion payload.

**Before it is submitted:**

- **Validate in Flow Builder**, which is authoritative. `version` is set to `3.1` from Meta's own example; if the account supports 5.1 or above, raise it and set `"sensitive": true` on the four money inputs so the figures are masked.
- **The amounts come back as reais, as strings.** The engine takes cents. That conversion is the single most dangerous line in the whole layer — [STUDY-WHATSAPP §8.1](../STUDY-WHATSAPP.md) is about a check-in not being final until it is anchored, and a comma read as a decimal point anchors a commitment to a number she never said. Parse strictly, reject rather than guess, and show her the parsed figures to confirm.
- **`active_days` is 0–15 here, not 0–31.** The engine validates 0–31 for a month, and the two halves add. A half that arrives alone is not reported at all (§4.1).
- **The `flow_token` carries which entrepreneur, which month and which half**, because nothing else in a no-endpoint Flow can. It must be opaque, single-use, and verified server-side — it is the only thing standing between a replayed payload and a false check-in.

## Message templates

Three, and their category is a cost decision rather than a label. A reply inside the open 24-hour service window is free; a template that opens a conversation is billed, and `marketing` is billed at the highest rate and needs opt-in it is easy to lose.

| what | category | when |
|---|---|---|
| the fortnightly check-in invitation, carrying the Flow | `utility` | business-initiated, twice a month, the only recurring cost |
| the consent and welcome message, after she signs up on the web page | `utility` | once per entrepreneur |
| the report link | **none — never a template** | she asks, the window is already open, and it is free. [STUDY-ACCESS §3](../STUDY-ACCESS.md) is why |

**Nothing about credit is ever a template.** Not an offer, not a reminder that she became eligible, not a nudge. That is `marketing` by Meta's classification and it is also the thing the product refuses to do: *being ready and not asking is a complete outcome.* The ethics and the billing agree for once.

## Consent

A new `consent_channel` value — the enum is `('app', 'community')` today — and a new `text_version`, because WhatsApp is not a channel anyone already agreed to. Two things it has to say that the app's wording never had to:

- **Meta sees the conversation.** Not her figures, which travel inside the Flow, but that she is in this programme and when she replies. [STUDY-WHATSAPP §4.4](../STUDY-WHATSAPP.md).
- **What arrives, and how often.** Two messages a month, and she can stop them without leaving the programme.

The eighteen already registered in the app re-consent once rather than carrying the old record forward: a migrated consent is the kind of thing that reads fine until someone asks to see what she actually agreed to. [STUDY-ACCESS §7](../STUDY-ACCESS.md).

## What has to exist before any of this collects a single real figure

> **A place for the data has to exist before the data does.**

The production database is [PLAN.md](../PLAN.md) item 1.5 and it is not optional ceremony. Real revenue and household figures cannot land in the hackathon project: its password is published on purpose, one click switches a visitor to any persona, and `seed-demo.mts` opens with `reset_demo_data()`. That is correct for a showroom and disqualifying for a woman's figures.

So the order is: production project → the migrations run from zero into it → then collection. Everything in this directory, and all of the Meta onboarding, runs in parallel with that and none of it touches a real figure.
