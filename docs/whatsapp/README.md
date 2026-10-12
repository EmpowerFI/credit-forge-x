# The WhatsApp entry layer — the pieces that can exist before the code

**Written for:** the founder, and whoever submits these to Meta. Companion to [STUDY-WHATSAPP.md](../STUDY-WHATSAPP.md), which carries the reasoning. This directory holds the artefacts: the check-in form, the message templates and the consent wording. None of it is wired to anything, and all of it moves to the private repo when that exists.

## Two findings that change the plan

**A Flow with no endpoint is enough, and that is a week back.** [STUDY-WHATSAPP §4.2](../STUDY-WHATSAPP.md) left this open and budgeted roughly a week for a data endpoint with an encryption key pair. Checked against Meta's own documentation: a Flow without an endpoint generates its routing automatically, ends on a terminal screen whose `Footer` carries a `complete` action, and delivers everything she typed in the webhook as `nfm_reply.response_json`. A check-in needs no live data from the server while she fills it, so none of the endpoint work is needed. Confirm in Flow Builder before relying on it — that is also the authoritative validator for the JSON here.

**Business verification is not required to start, and a test number needs no paperwork at all.** Getting started creates a test WhatsApp Business account and a test phone number with relaxed limits and no payment method, so the whole build can be exercised today. Verification is what the *pilot* waits on, not the build: unverified, a business is capped at about 250 unique customers in a rolling 24 hours for business-initiated conversations, and the display name needs verification to be approved. 250 is far above a first cohort, so even the pilot is not blocked by it — the cap binds on the fortnightly reminder, which is business-initiated, and not on the report link, which [STUDY-ACCESS §3](../STUDY-ACCESS.md) already makes something she asks for.

## What is built, as of 12 October 2026

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

Still to build: issuing the fortnightly invitation (business-initiated, billed, waits on Meta's queue), sign-up, the consent channel, and the report link.

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
