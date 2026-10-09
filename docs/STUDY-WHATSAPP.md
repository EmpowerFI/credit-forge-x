# WhatsApp as the way in — a technical study

**Written for:** the founder, and whoever builds this. Post-hackathon, October 2026.

The problem this answers is not technical. The product asks a woman running a bakery to open a browser, create an account, remember a password and fill a form — and she already has an app open all day where she organises her business and her community.

**The premise is settled, and this study does not re-open it.** Three months of the app at about 10% conversion is not a hypothesis about the channel; it is a measurement of it. And the founder is inside the entrepreneur groups where WhatsApp is already how the community organises itself — first-hand observation of the behaviour, which is the strongest evidence available for a question of this kind. The remaining question is not *whether* to move the entry point. It is what the move costs, what it changes, and which decisions get expensive if they are taken late.

The headline: **the code is the small part.** Roughly six to nine weeks of build at the pace this repo already demonstrated, and the two things most likely to slip are Meta's business verification and template review, neither of which is engineering time. The decisions in §4 matter more than any of it, and §8 is what the build has to carry because there is no manual stage in front of it.

---

## 1. What actually changes

Everything built so far runs on simulated data. One hundred demo entrepreneurs, invented figures, a database labelled *Dados simulados* on every screen.

The moment a real woman sends a real revenue figure over WhatsApp, four things become true that are not true today:

1. **The data is personal data under the LGPD**, and EmpowerFI is the controller. See §5.
2. **Meta sees her numbers.** Today the product's privacy claim is that her figures never leave the database except as a hash. A check-in conducted in a WhatsApp chat passes her revenue, costs and household spending through Meta's infrastructure and leaves them in her own chat history. That is not a blocker. It is a trade — reach for confidentiality — and it has to be written into the consent text rather than discovered later. See §4.4.
3. **A wrong number has a consequence.** A simulated assessment that misreads a business is a bug. A real one is a woman told she is not ready.
4. **Devnet stops being free of consequence.** See §6.

None of these stop the pilot. All of them change what has to exist before it starts.

---

## 2. What already exists

This is the reason the estimate is weeks and not months. Measured against the current tree:

| Piece | State | Reuse |
|---|---|---|
| `submit_checkin(period, revenue, cogs, opex, household, keeps_records, active_days)` | built, RLS-guarded | **direct** — the WhatsApp flow calls the same RPC the web form calls |
| Readiness engine (deterministic, versioned, `model_version`) | built, tested | **direct** |
| Consent model — scopes with a dependency chain (`assessment` → `partner` → `investors`) | built | **extend** with one scope |
| Anchoring (`anchor-submit`, commitment queue, devnet) | built | **direct** |
| Edge functions (14, Deno, shared libs, a webhook-shaped one in `zcash-watch`) | built | **pattern** |
| Transactional email with a queue, retries and suppression (`process-email-queue`, 413 lines) | built for the marketing site | **pattern** — an outbound channel with retries already exists and was already solved once |
| Entrepreneur, community, education, assessment tables + RLS | built | **direct** |

The thing being added is a **channel and a form**, not a product. The engine, the record, the proof and the consent model stay exactly as they are.

---

## 3. The architecture

```
   Landing page                    WhatsApp (Cloud API)              EmpowerFI
   ─────────────                   ────────────────────              ─────────
   she fills a short form  ──────▶ wa_contacts (opt-in proof:
   name, phone, community,          timestamp, channel, exact
   consent checkboxes               text she agreed to)
                                            │
                                            ▼
                            ◀───── utility template, day 1 and
                                   then every 14 days
                                   ("Oi Maria, 2 minutos pra
                                    fechar a quinzena?")
                                            │
                        she replies ────────┤  ← 24h window opens, everything
                                            │    from here is free
                                            ▼
                                   WhatsApp Flow: 6 fields in
                                   one form inside WhatsApp
                                            │
                                            ▼
                                   flow endpoint (edge function,
                                   encrypted payload)
                                            │
                                            ▼
                                   submit_checkin() ──▶ readiness
                                                        assessment
                                                            │
                                                            ├──▶ anchor queue
                                                            │    (devnet)
                                                            └──▶ report job
                                            │
                            ◀───── "Seu relatório está pronto:
                                    empowerfi.io/r/<token>"
                                            │
                                            ▼
                                   public report page, signed
                                   token, no login
```

Five new pieces, and that is the whole list:

1. **A public sign-up page** that creates an entrepreneur and a consent record without an account. The platform currently assumes an authenticated profile; this is the one place the data model has to bend.
2. **`wa_contacts`** — phone, opt-in proof, window state, last message, status.
3. **A webhook edge function** — receives Meta's callbacks (messages, delivery, Flow submissions), verifies the signature, writes to a message log.
4. **A Flow endpoint edge function** — Meta encrypts Flow payloads with a key pair you register; this decrypts, validates, calls `submit_checkin`.
5. **The report** — a generator and a public page behind a signed token.

Plus a scheduled job for the fortnightly nudge, which the email queue already shows how to build.

---

## 4. Four decisions that get expensive late

### 4.1 Fortnightly contact, monthly record — do not change the grain

The check-in is **monthly** everywhere: `period` is a month, `recentPeriods()` returns months, every assessment and every anchored commitment is keyed to a month. And the readiness engine counts months directly:

```ts
regularity = floor(15 × min(months_reported, 6) / 6)
           + floor(10 × min(consecutive_months, 6) / 6)
           - (months_since_last > MAX ? 10 : 0)
```

That is the part that makes the decision for you. **If a fortnight became the period, every count doubles and every score silently inflates.** Three months of history would read as six periods and max out the 15-point term; a woman who had reported twice would look as regular as one who had reported for a quarter. Nothing would error. The engine would just start being wrong, including about the assessments already recorded and already anchored.

You want fortnightly contact. There are two ways and they are not close in cost:

- **Change the grain to a fortnight.** The schema, the engine's three regularity inputs and their thresholds, the staleness rule, every existing assessment, the migrations and the proofs. Weeks of work, a recalibration with no real data to calibrate against, and an invalidated history. 
- **Keep the month as the unit of record and make the fortnight a collection cadence.** The first contact opens a draft for the month; the second closes it. The engine never knows. Two touchpoints, one record, no migration to the assessment path.

**Take the second.** You get the engagement you are actually after — being in her week rather than her month — without paying for it in the one part of the product that is already proven and anchored. If the half-month figures later turn out to be worth keeping on their own, they are already stored and the grain can change with real data to justify it.

**How the two halves become one month.** A `checkin_parts` table — entrepreneur, period, half, the six figures, submitted_at — holds each fortnight as it arrives. When the second half lands, the month is consolidated and `submit_checkin` is called once with the sums: revenue, cogs, opex, household and active days add; `keeps_records` takes the later answer, since it is a statement about a habit now rather than a quantity. One monthly record, one assessment, **one commitment over the consolidated month**, which is the right unit to anchor — a fortnight is a collection artefact, not a fact about the business.

**And a half month is never a month.** This is the trap in the design and it is worth naming before it is built. If only the first fortnight arrives and the month is recorded anyway, the engine sees roughly half the usual revenue — and it will not report missing data, it will report a business in decline. `revenue_trend_bps` turns negative, `DECLINING_REVENUE` appears in her eligibility reasons, and `revenue_cv_bps` rises enough to cost her points in `data_quality`. Every one of those is the engine working correctly on a number that is a reporting artefact.

So an incomplete month is **not reported at all**. The half that did arrive is operational signal — the community leader can see she started and stopped, and follow up — and it is not engine input. The engine's existing staleness rule then does the right thing on its own: the month simply never counts, `consecutive_months` breaks, and that is true.

### 4.2 WhatsApp Flows, not conversational parsing

The temptation is a chatbot that asks six questions and parses the replies. Resist it. "Uns 2 mil e pouco" is a real answer to "quanto você vendeu?", and every hour spent teaching a parser to handle it is an hour not spent on the product.

**WhatsApp Flows** is Meta's in-app form: screens defined in JSON, rendered natively inside WhatsApp, submitted as structured data. Six numeric fields and two toggles is exactly its case. It costs an endpoint with an encryption key pair (Meta signs and encrypts Flow payloads) — real work, roughly a week, but bounded and done once.

The conversational path is unbounded and never finishes.

A no-endpoint Flow is simpler still and worth checking first: if the form needs no live data from the server while she fills it — and a check-in does not — the screens can be fully declared in Flow JSON and arrive as one submission. Confirm against Meta's current Flows reference before committing to the endpoint work.

### 4.3 The AI report sits beside the engine, never inside it

This is the one where the product's own stance is at risk.

The readiness engine is deterministic, versioned, reproducible and anchored. Its header says it is not a credit score and that approval belongs to the financial partner. The audit console lets anyone recompute it in their browser. That discipline is most of what makes the product defensible.

An LLM report is none of those things. Same input, different words, no reproducibility, and a confident tone whatever the data says.

So:

- **The report never produces a number.** No score, no grade, no "sua nota". The assessment already produces the only number in the product, and a second one beside it would be the easiest thing in the whole product to doubt — this was already decided once, when the illustrative 72/100 came out of the Financial Opportunities screen.
- **The report reads only her own data.** Her months, her assessment, her missing requirements. Never a comparison to other women, which would turn her cohort into a benchmark she did not consent to.
- **Store what produced it:** the exact input, the model id, the prompt version, the output. The readiness engine already carries `model_version` for this reason; the report should carry the same, and for the same reason — so a sentence she disputes can be traced.
- **Anchor the deterministic part only.** The commitment is over the check-in and the assessment, as today. The report is presentation. Hashing an LLM's prose onto a chain would dress an opinion as a proof.
- **It must degrade.** If the model is slow or down, she still gets the assessment and her missing requirements in plain text. The report is an improvement on a page that works without it.

What the report *is* good for is the thing the engine cannot do: turning `INSUFFICIENT_HISTORY` and four component scores into two paragraphs a person acts on. That is genuinely valuable and worth building. It is a translator, not a judge.

### 4.4 Her numbers now pass through Meta

The consent screen currently tells her that her figures never go on chain, only a hash. True, and it will stay true. But a check-in conducted over WhatsApp means her revenue and household spending sit in Meta's systems and in her own phone's chat history, which EmpowerFI cannot delete on request.

This needs a new consent scope with its own plain sentence — something closer to *"Falar comigo pelo WhatsApp. Para isso, o que eu enviar no WhatsApp passa pelos servidores do WhatsApp (Meta) e fica no meu celular, fora do controle da EmpowerFI."* — and the existing scope model already supports exactly this shape, including the dependency chain and the "what happens if I say no" text.

Saying it plainly costs nothing and is the difference between a trade and a surprise.

---

## 5. LGPD

Not legal advice; the points a build has to account for.

- **Financial data is not "sensitive data"** under art. 5º, II (that category is race, religion, health, biometrics and the like), so no special regime is triggered by the numbers themselves. Minimisation still applies: collect the six figures the engine uses and nothing else.
- **Legal basis.** Consent is the cleanest for the messaging, and the product already has a consent model with proof. Service replies inside a conversation she started can also rest on execution of contract or legitimate interest, but with this user group consent is both cleaner and more honest.
- **Opt-in must be provable.** Store timestamp, channel, and the exact text she agreed to — not a boolean. Meta also requires opt-in for template messages independently of the LGPD.
- **Opt-out must be one word.** "PARAR" in the chat, honoured immediately, recorded.
- **Resolução CD/ANPD nº 2/2022** creates a simplified regime for small businesses, MEIs and small startups — reduced obligations on records and on appointing an encarregado. Worth checking whether EmpowerFI qualifies before building the heavier version.
- **Deletion.** She can ask for her data to be erased. Two caveats to write down now: an anchored hash cannot be removed from a chain, and messages on her own phone are not yours to delete. The commitment is over a hash, not the figures, which is the right answer — but it has to be *said*, not assumed.

---

## 6. Devnet, with real people

Devnet is the right choice for a pilot: free, fast, and nothing of value moves. One caveat to design around.

Devnet is wiped periodically, and third-party guidance says resets can come with little notice and clear all accounts. If the pilot's proofs exist only as devnet accounts, a reset deletes the evidence of a real community's real months.

**This is already mitigated, and worth knowing rather than rebuilding.** `public.chain_anchors` already stores `commitment` (the 32-byte hash), `payload` (the jsonb it was computed over) and `signature` (the transaction). A devnet reset destroys the accounts; it does not touch any of that. The evidence of what was committed, and when, survives in the database and can be re-anchored anywhere later.

What is left to do is small:

- Keep program IDs and deploy scripts in version control so redeployment after a reset is a command, not an afternoon.
- Decide now whether a reset triggers re-anchoring of the pilot's history or whether the old signatures simply stand as a record of a chain that no longer holds them. Either is defensible; discovering the question during a reset is not.
- **Do not describe devnet anchors as durable proof to a third party** — a sponsor, a partner, a participant. For the pilot they prove the pipeline works end to end, which is what the pilot is for. Any claim of auditability to someone outside waits for mainnet, which was measured at about 2.62 SOL for the program plus roughly 1.2 SOL for a thousand anchors.

---

## 7. Effort

Estimated against **this repo's own measured pace**, which is a better anchor than any industry average: between 14 Sep and 8 Oct, one founder with Claude Code produced 260 commits, 760 files and about 140,000 lines — the platform, the Anchor program, the Zcash integration and 115 migrations. The numbers below assume that same arrangement continues.

| Phase | Work | Estimate |
|---|---|---|
| **0** | Contract review and hardening: the audit program's 17 instructions, a cap/timelock/multisig decision on `vault_transfer`, Squads on the upgrade authority | **1–2 weeks** |
| **1** | Public sign-up page, account-less entrepreneur creation, the WhatsApp consent scope with opt-in proof | **1 week** |
| **2** | Meta Cloud API: number, webhook edge function, message log, template drafting | **1–1.5 weeks** *(see calendar risk)* |
| **3** | The check-in as a WhatsApp Flow, the Flow endpoint with payload encryption, wiring to `submit_checkin`, the fortnightly scheduler | **1.5–2 weeks** |
| **4** | Report generator (versioned, stored with its input), public report page behind a signed token | **1–1.5 weeks** |
| **5** | Pilot operations: retries, failure alerts, a human in the loop, LGPD artefacts, deletion flow | **1 week** |
| | **Build total** | **6.5–9 weeks** |

With no manual stage in front of the build, the correction window and the failure log in §8 are not optional, and they are what the top of that range is for. Read it as **8–9 weeks** unless something in §8.1 is deliberately deferred.

**What actually slips, and it is not the code.** Two items run on Meta's clock, not yours, and both should start on day one of phase 1 so they run in parallel:

- **Business verification** — Meta verifies the legal entity. Days to several weeks depending on documents.
- **Template approval** — each utility template is reviewed. Usually fast, but a rejected template costs a round trip, and the fortnightly nudge is the one message the whole cadence depends on.

Start both before writing the webhook.

**Running cost is not a constraint.** The only paid message is the fortnightly nudge outside the 24-hour window: everything she sends, and everything you send in the 24 hours after, is free. At roughly R$0.04–0.05 per utility message, 26 nudges a year is about **R$1 per woman per year** — around R$100/year for a hundred-woman pilot. Confirm the exact BRL figure in Meta's Billing Hub rate card; Brazil moved to BRL billing from 1 July 2026 and third-party figures disagree. The LLM report, at one per woman per month, is cents. The constraint on this pilot is attention and trust, not infrastructure.

---

## 8. What the build must carry, because there is no manual stage

An earlier draft of this study proposed running the check-in by hand with five women first. That was advice for a team that does not know whether the channel works, and it was the wrong advice here: the conversion figure already answers that, and a manual stage would have delayed the thing the evidence says to build while teaching almost nothing new. It is dropped.

But it was buying something, and three of those things still have to be bought — inside the build rather than in front of it.

### 8.1 A check-in is not final until it is anchored

Without a manual stage, **the first real data is production data**, typed on a phone, by someone who may be serving a customer at the same time. She will type `2000` when she meant `20000`. The web form has the same exposure, but a form shows all six fields at once and she can look before sending; a message feels sent the moment it leaves.

Anchoring a wrong figure is worse than not anchoring, because the product's whole claim is that the record is the evidence. So:

- **A correction window.** The check-in is recorded and the assessment runs, but the commitment is not queued for some hours. "Errei um número" inside that window amends the record before anything is committed. After it, a correction becomes a new record that supersedes the old one, with both kept — which is the honest shape anyway.
- **A plausibility check, not a validation.** Revenue ten times last month's, or costs above revenue, is not an error; it is a bakery that got a catering order, or a month she bought an oven. Do not reject it. Echo it back — *"Confirma: R$ 20.000 de vendas e R$ 3.000 de custos?"* — and let her say yes. One extra message inside the free window, and it catches the decimal point without calling her wrong.
- **The engine already notices.** `inconsistencies` and `revenue_cv_bps` feed `MANUAL_REVIEW`, so an implausible history routes to a person instead of producing a verdict. That behaviour is right and should not be softened for volume.

### 8.2 The wording is the experiment, and it is an afternoon

The channel question is answered. The *wording* question is not, and it is the one that silently corrupts data: whether "custo das mercadorias vendidas" is a question a baker can answer, and whether what she subtracts is what the engine thinks she subtracted.

That does not need a pilot. It needs the six questions posted in one of the groups the founder is already in, and an afternoon reading the replies. If three people ask what a term means, the term is wrong — and the fix is a label in the Flow JSON, which is a minute of work before launch and a migration-shaped problem after it.

Do this during phase 2, while Meta's verification is running and there is nothing to code.

### 8.3 Failures have to be visible

With no human in the loop by design, a silent failure is a woman who answered and was never recorded. The product already has one of these — `operator_needs_usdc` is returned in an HTTP response and written nowhere, so a dry operator looks exactly like a queue still processing.

Do not repeat it here. Every inbound message gets a row before anything else happens; a Flow submission that fails to reach `submit_checkin` leaves a failed row with its reason, not a gap; and someone sees a count of those each morning. The email queue in `supabase/functions/process-email-queue` already has the retry-and-record shape to copy.

This is roughly three to five days of work, folded into the estimate in §7 rather than added to it.

---

## 9. What a financial product should tell the engines

The proposal is that acquiring a financial product should feed the score, because it says something about the business's financial capacity. It does — but not in the engine it looks like, and not with the sign it looks like. Three distinctions make the idea work.

### 9.1 Acquiring is not performing, and debt is not capacity

Taking a loan does not increase capacity. It **consumes** it: a new instalment is a claim on the same monthly net the engine measures. A rule that added points for holding a product would have the sign backwards on the single most common case.

What is evidence of capacity is **performance** — instalments paid, on time, over months. The platform already holds that for its own loans (`loans` and their instalments), and it is the strongest credit signal there is. It is also the only one of these that belongs anywhere near a score.

### 9.2 Capacity is the eligibility engine's job, and it has a hole

"Capacidade financeira do negócio" is not what readiness measures. Readiness asks whether the business is *prepared*; eligibility asks what it can *carry*. The product already draws that line and its headers defend it.

And eligibility is where the real gap is. `EligibilityInput` today is:

```
readiness_status, readiness_band, requested_amount_cents, purpose,
months_reported, records_kept_bps, inconsistencies,
avg_revenue_cents, avg_net_business_cents, avg_household_cents,
revenue_cv_bps, revenue_trend_bps, household_share_bps
```

**There is no field for what she already owes.** `max_instalment_cents` is derived from net business income and household draw, as if every applicant arrived with no obligations. A woman already paying R$300 a month elsewhere is sized as though that R$300 were free. On simulated data nobody notices; with real women and real products in front of them, it is the difference between an instalment she can carry and one she cannot.

So the highest-value change is one input, not a new rule:

```
existing_obligations_cents   // known monthly instalments, from any source
```

subtracted before `maxInstalment` is computed, with a reason code — `OBLIGATIONS_REDUCE_CAPACITY` — so the arithmetic is visible rather than silent. That is her point implemented in the place where it is true, and it makes the engine more conservative rather than more generous, which is the correct direction for a first real cohort.

### 9.3 A connected provider changes provenance, which is a different thing again

The one honest readiness-side effect is not a bonus; it is **where the numbers come from**.

Today every figure is self-reported, and `data_quality` and the engine's `Confidence` already exist to express doubt about that. If she connects a payments provider, her revenue stops being a number she typed and becomes one a third party observed. That is a genuine improvement in the evidence, and it belongs in confidence and data quality — not as points for having a product, but as a change in how much the same figure can be trusted.

Note the asymmetry: a payments provider makes revenue verifiable. A rental guarantee says nothing about capacity at all. The rule has to key on what the product actually observes, not on the fact that one was acquired — which is also why `products.ts` carries a category per product rather than treating them as one kind of thing.

### 9.4 The loop to design against

EmpowerFI's own P2P loan is in that catalogue.

If acquiring a product raised the score, the platform would be recommending a product, scoring her higher for taking it, and then recommending more on the strength of the score it granted her. Our own loan would be the most score-improving thing on the page. That is not a hypothetical to guard against later; it is the straight-line consequence of the rule as proposed, and it is the reason the three distinctions above are worth the extra care.

The version that survives contact: **obligations reduce capacity, repayment proves it, and a connected provider improves the evidence.** Acquisition on its own changes nothing, and the page already says that nothing there is an approval.

### 9.5 Cost

Small, and separable from the WhatsApp work. The obligations input and its reason code are a day or two in `packages/eligibility-engine` plus its vectors and the pgTAP that covers them. Repayment history as an input is larger, because it needs a definition of "on time" that survives a real cohort, and it should wait until the first loans have run. Provenance is the biggest of the three and is gated on a real integration existing, which today none does.
