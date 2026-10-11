# Getting in without a login, and letting data out without leaking — an analysis

**Written for:** the founder, and whoever builds this. Fourth in the series, after [STUDY-WHATSAPP.md](STUDY-WHATSAPP.md), [STUDY-SPLIT.md](STUDY-SPLIT.md) and [STUDY-CONTRACTS.md](STUDY-CONTRACTS.md).

Six things to design: registration tied to a phone instead of a login, a one-time code for each visit to the report page, account recovery, a WhatsApp bot that answers questions, a monetised community partner whose terms are different, the entrepreneurs already registered in the app, and an API and MCP server for Web3 protocols.

Most of it fits what exists better than expected. One of the six does not fit at all, and it is the one with a partner waiting on the other end — so it goes first.

---

## 1. The partnership is blocked by a line in the readiness engine

The monetised community wants one thing from EmpowerFI: **connection to capital.** She will share her entrepreneurs' financial data to build their history. She will not use EmpowerFI's educational planning, because she has her own.

That last sentence, today, means her entrepreneurs can never borrow.

`packages/readiness-engine/src/index.ts`:

```ts
if (f.core_modules_completed < f.core_modules_total) {
  need("CORE_EDUCATION_INCOMPLETE", f.core_modules_completed, f.core_modules_total);
}
```

`CORE_EDUCATION_INCOMPLETE` is in the `PREPARATION` list, and any requirement in that list sets the status to `NEEDS_PREPARATION` regardless of everything else. And `core_modules_total` is not per-community — the database computes it as *"the core programme is EmpowerFI's own: programmes with no community"*:

```sql
'core_modules_total', (
  select count(*) from public.education_modules em
  join public.education_programs ep on ep.id = em.program_id
  where ep.community_id is null
),
```

So it is a global count, it is greater than zero as soon as a core programme exists, and her members complete none of it. Follow it through:

> `CORE_EDUCATION_INCOMPLETE` → `NEEDS_PREPARATION`, permanently → never `CREDIT_READY` → `attest_eligibility` refuses on chain, because it requires a `CreditReady` attestation for the same borrower → no opportunity, no loan.

**The one thing she is asking for is the one thing the product structurally refuses her**, and it refuses silently: nothing on any screen says "this community does not run our modules, so nobody in it can qualify". It reads as a readiness result about each woman.

This is not an argument to drop the requirement. Preparation before credit is the product's position and it should stay. It is an argument that **the requirement is written against the wrong thing**: it asks whether she completed *EmpowerFI's* modules, when what it means to ask is whether she has been prepared.

Three ways to fix it, in increasing order of what they cost:

- **Per-community core programme.** Let a verified community declare its own programme as the core one for its members, so `core_modules_total` resolves per membership rather than globally. Her system stays hers; she reports completion through a small endpoint, or marks it in the partner console. This is the smallest change — the `education_programs.community_id` column already exists and is already used for the cooperative's own programme, so the data model is there and only the lookup is global.
- **An equivalence, recorded.** A community whose programme EmpowerFI has reviewed is marked as teaching the core competencies, and its members' completion is attested by the community rather than by our module tracker. This is the honest version if her curriculum is genuinely different rather than a renamed equivalent, and the review is a real step, not a formality.
- **A waiver with its own reason code.** Status `CREDIT_READY` with `PREPARATION_WAIVED_COMMUNITY` in the reasons, and the waiver anchored. Worst of the three: it hides a policy decision inside an assessment, and the first lender who reads the reason codes will ask what it means.

**Take the first, with the second as the gate for granting it.** A community declares its programme; EmpowerFI reviews it once before marking it core-equivalent; completion flows from her system. And whichever is chosen, the **model version changes**, because the meaning of a `CREDIT_READY` attestation changes — which is exactly what `model_version` on the attestation is for.

One thing to decide alongside it: a waived or substituted programme is not the same evidence as a completed EmpowerFI one, and a lender is entitled to know which it was. The feature set already travels in the attestation payload; add the provenance of the preparation to it rather than flattening both into one boolean.

---

## 2. Identity is a phone number, and the schema has never held one

Measured: **`phone` does not appear in any table** in `platform/supabase/migrations`. The only occurrence in the whole schema is a comment, in the opportunity view, promising the opposite — *"never a name, a document or a phone"*. So this is new surface, not a column to repurpose, and it lands in the one place the product has been careful to keep empty.

That is the right instinct to keep. The phone belongs in the private repo's identity table, keyed to the entrepreneur, and it must never reach a commitment payload or an opportunity view. The existing `scan-chain-pii.mts` already searches account bytes for every name, e-mail and place in the database — **add phone numbers to its search set before the first real one is stored**, so the guarantee is measured rather than remembered.

Three properties of a phone number that a user id does not have, and each needs an answer:

**Numbers get recycled.** A disconnected Brazilian number returns to the pool and is reassigned. An account that resumes on nothing but a matching number hands a stranger another woman's revenue history. The answer is not a longer code — it is a clock: **after a long silence, the next contact re-verifies rather than resumes.** Six months is a reasonable threshold and it costs nothing when she is active.

**SIM swap is the real attack**, and with no password there is no second thing to know. Two mitigations, and the first matters more: **keep the blast radius read-only.** She holds no funds, so the worst case is disclosure of her figures rather than loss of her money — which is bad, and bounded, and should stay bounded. Nothing reachable from a one-time code should change a bank detail, a payout destination or a consent. Consent changes in particular should take the same path as recovery (§3), not the same path as reading a report. Second: a first access from a new device can ask a step-up only she would know — the figure she reported last month — rather than another code to the same number that was just stolen.

**The number is the index into everything.** Which means logs, support tooling and the bot's own transcripts all carry it. Hash it for anything that does not need to dial it.

---

## 3. The code should be pulled, not pushed — and that is also what makes it free

The design asked for is right: a fresh single-use code for every visit, so there is no password to lose and no standing credential for a bot to guess. Two refinements, one security and one money.

**Make it a link, not a code, when she is on her phone.** She is already in WhatsApp, on the device the code would be sent to; asking her to read six digits out of one message and type them into a browser is transcription work that buys nothing, because the message and the browser are on the same phone. A signed, single-use, short-lived URL is the same credential with one tap instead. Keep the typed code for the case it actually solves — she wants the report on a computer.

**Make her ask for it.** This is the part with a number attached. WhatsApp bills per message, but a free-form message inside an open 24-hour customer service window is free, and the window opens when *she* writes. An unsolicited one-time code is an authentication template, which is **always billed**. So:

| | what it is | cost |
|---|---|---|
| she messages the bot "relatório", the bot replies with a link | free-form inside the service window | **free** |
| EmpowerFI sends a code she did not ask for | authentication template | billed, every time |

At 5,000 women opening a report twice a month, that is 120,000 messages a year on one side of the line or the other. It is not a large sum either way, and it is free for no work at all, so there is no reason to design the expensive one. **The access flow starts with her message.** The only push that should ever carry a code is recovery, which is rare by definition.

Shape of it, for the build:

- Single use, short expiry (ten minutes is generous), bound to the entrepreneur and invalidated when the next one is issued.
- Rate-limited per number, because the free direction is also the direction an attacker uses: unlimited "send me a link" is a way to flood someone's WhatsApp.
- The link lands on a page with **no navigation to anything but her own report**. A signed link that drops the holder into an app shell is a login with extra steps.
- Log every issue and every use. The access log is the only way she, or we, can answer "did someone else open this".

---

## 4. Recovery belongs to the community, and the community is already the trust anchor

If the phone is the identity and the code proves control of the phone, then losing the phone and the number leaves nothing to prove with. An e-mail fallback re-introduces the account she was never asked to make.

The product already has the answer and uses it on chain. `register_borrower_ref` refuses unless the community is `Verified`: **a community vouching for a member is the existing root of trust.** Recovery is the same move, later. The community leader confirms in her own console that this person, now on this number, is this member; the old number is retired; the new one is bound; and the re-binding is itself a record with a commitment, so a dispute later has something to read.

That keeps recovery human where it should be human, and it keeps it inside a relationship that already exists rather than inventing a support channel. Two guards to put on it:

- A leader can re-bind a member, never grant herself access to the member's report. Those are different permissions and the second one should not exist.
- A re-binding has a cooling-off — the old number is notified, if it still works, and the change takes effect after a short delay. That is the whole defence against a leader's own account being compromised.

For the monetised community in §1 and for anyone unaffiliated later, the fallback is EmpowerFI's own review, which is the slow path and should be.

---

## 5. The bot: what it should answer, and the one thing it must not originate

The questions named — *where is my report, where is a community near me, what events and opportunities fit my profile* — are all retrieval, which is the easy and safe shape. Three rules make it stay that way.

**Answer from tools, not from a context.** The temptation with an LLM is to put her record in the prompt and let the model answer freely. Then every answer is a disclosure risk and no rule is enforceable. Instead the model chooses between a small set of functions — her report link, communities by region, events, matching products — each of which applies the same row-level security the web app applies. The model phrases; it does not fetch what it likes.

**Opportunities are answered, never offered.** The product's position is in its own README: *being ready and not asking is a complete outcome; nothing pushes anyone into debt.* A bot that notices she became `CREDIT_READY` and messages her about credit breaks that, and it breaks it in the most effective possible channel. It is also, separately, a marketing message in WhatsApp's classification — always billed, requiring opt-in, and a drag on the number's quality rating. The ethics and the billing point the same way for once. **She asks; the bot answers.**

**A check-in is not a conversation.** [STUDY-WHATSAPP.md §4](STUDY-WHATSAPP.md) already settles this: figures come through a structured flow, not free text parsed by a model, because a misread revenue figure becomes an anchored commitment to a wrong number. The bot can *start* the check-in and confirm it finished. It should not be the thing that reads the numbers.

Worth naming once, in the terms and on screen: inside this design Meta sees the conversation, so it sees that she asked about credit even though it never sees her figures, which travel in a form.

---

## 6. The monetised community: the consent ladder already has the shape

Her terms sound like an exception to the model. They are not. `public.consents` already carries four independent scopes with a nesting rule:

```sql
assessment boolean, partner boolean, investors boolean, impact boolean,
constraint scopes_build_on_each_other check ((assessment or not partner) and (partner or not investors))
```

Map her requirements onto it:

| what she wants | scope |
|---|---|
| build her members' financial history | `assessment` ✓ |
| connect them to capital | `partner` ✓, `investors` ✓ |
| nothing publicised; only she sees her community's numbers | `impact` ✗ |

**It already works.** `impact` is the scope that feeds the sponsor dashboards and the aggregate products, it is independent of the credit ladder by design, and withholding it removes her members from every published figure while leaving the path to capital fully open. Nothing needs to be built except a community-level default so each woman is not asked to make the same choice individually — and one rule about what that default is allowed to do:

> **A community may narrow what is done with its members' data. It may never widen it.**

That is not a nicety. Under the LGPD the consent is the entrepreneur's and a community cannot give it on her behalf; it can only decline on her behalf, which is always safe. Implement the community setting as a **ceiling applied over** each woman's own consent, never as a source of permission. The existing per-entrepreneur records stay the authority and the screens keep showing her what she chose.

Two consequences worth stating to her rather than discovering later:

- **Her cohort contributes nothing to the market-intelligence product.** She is a capital-connection customer, not a data supplier, and the commercial arrangement should say so. If the expectation on our side was that volume of data comes with volume of borrowers, it does not here.
- **Excluding monetised communities biases the aggregate.** A community that charges its members selects for a different entrepreneur than one that does not. An indicator sold as *"women-led micro-businesses in Brazil"* computed from a sample that systematically excludes paid communities has a measurement error in it, and the buyer in §8 is entitled to know the sample's shape. Publish what the aggregate is drawn from.

And the smaller item: `consent_channel` is `enum ('app', 'community')`. WhatsApp is a third channel and consent given there has to be as provable as the other two — the wording version, the timestamp, and what she replied to. Add the value, and keep the anchored consent record, which is already the strongest part of this story.

---

## 7. The entrepreneurs already in the app keep their history and re-consent once

Two halves, and they separate cleanly.

**The history carries over, and it is the valuable half.** What makes re-onboarding painful is not the profile — it is the months. `months_reported` and `consecutive_months` are the engine's most expensive inputs: six months of check-ins cannot be recreated by asking. Those rows exist, they already produce assessments, and nothing about moving the *interface* to WhatsApp touches them. Her readiness does not restart. Say so to her in the first message, because "start again" is what she will assume.

**The consent does not carry over, and should not.** Her existing record was given under `channel = 'app'` against a specific `text_version`. WhatsApp adds a processor who did not exist when she agreed — Meta — and a channel she did not choose. That is a new purpose, not a continuation, and a migrated consent would be the kind of thing that reads fine until someone asks to see what she actually agreed to. **One fresh consent, recorded with the WhatsApp channel and the new wording version**, anchored like the others. It is one message and it is the thing that makes the rest defensible.

**And the invitation cannot start in WhatsApp.** This is the operational trap. Messaging a number that has not opted in requires an approved template, is billed, and — if people report it — damages the number's quality rating, which throttles everything else. These eighteen opted into an app, not into WhatsApp. So the first contact goes where they already are: a notice in the app they installed, or e-mail if there is a lawful basis for it, asking *them* to message the bot. Her first message opens the service window, and everything after that is free and consented in the same motion.

Eighteen people is small enough to do by hand and large enough to get the pattern right, which is the useful property of this particular migration.

---

## 8. The API and the MCP server: suppression does not survive becoming a query

This is the part of the plan with a real hazard in it, and it is not the obvious one. The obvious risk is leaking a row; the product already refuses that everywhere. The actual risk is that **the rule protecting the aggregates is not composable, and an API composes.**

Today, `impact_intelligence()` hides any breakdown group under five, in SQL. That works because the dashboard offers a fixed set of cuts and a human reads them one at a time. Hand the same data to a query API with free filters and the protection evaporates:

> Ask for *bakers in Grajaú, cohort A* — suppressed, n < 5. Ask for *cohort A* and *cohort A excluding bakers in Grajaú*, both comfortably above five, and subtract. The suppressed cell is recovered exactly, from two allowed answers.

Nothing in the current rule prevents this, because the rule is evaluated per response and the attack lives between responses.

**MCP makes it worse, not better.** An MCP server is a thin protocol over the same API, but its consumer is an agent, which will enumerate slices automatically, at machine speed, without intending anything. The informal protection the dashboard has — that nobody runs four hundred queries — is exactly what an agent removes. If one surface is built first, build the API with this solved, and let MCP be the wrapper it should be.

Four things that actually hold:

- **Fixed cuts, not free composition.** Publish a defined set of aggregates and let callers choose among them, rather than accepting arbitrary filter combinations. Boring, effective, and it is how statistical agencies release microdata summaries.
- **A minimum cell over the intersection**, not over each dimension, so the threshold is evaluated on what is actually being asked for.
- **Per-consumer query logs and a budget.** Differencing requires a sequence of queries; a sequence is visible if it is recorded. This is also what lets you answer, later, what a given protocol saw.
- **Not noise.** Differential privacy is the textbook answer and it is the wrong one *here*, because it breaks the thing that makes this data worth buying: an aggregate that can be recomputed from the commitments on chain. **Verifiability and perturbation pull against each other**, and verifiability is the product. Suppression and fixed cuts keep both.

The positive half is cheap and is the differentiator: **each response carries the commitment set it was computed over**, so a protocol can re-derive the number from records it verified independently against Solana, instead of trusting the API. Nobody else selling this kind of indicator can offer that, and it costs an array of hashes in the payload.

Two more for the terms rather than the code: an MCP response lands inside a model's context and may be retained by whoever runs it, which should be written down before the first integration; and the consent scope that permits any of this is `impact` — so §6's exclusions apply here too, and the sample description travels with the data.

---

## 9. Sequence

In dependency order. The first is not the biggest; it is the one with a partner waiting.

1. **The education gate** (§1) — per-community core programme, a review step before a programme counts as core, and a new `model_version`. *Nothing involving that community can start before this.* (~1 week)
2. **Phone identity and the pull-a-link access flow** (§2, §3), including phone numbers in the PII scan's search set. (~1.5 weeks)
3. **Community-vouched recovery** (§4), as a ceiling-not-grant permission on the leader's console. (~1 week)
4. **Community consent defaults and the WhatsApp consent channel** (§6). Small, and it unblocks talking to the partner about terms. (~3 days)
5. **The migration of the eighteen** (§7) — in-app invitation, history preserved, one fresh consent. (~3 days, mostly copy)
6. **The bot** (§5), on top of the WhatsApp layer from the other study rather than before it.
7. **The API, then MCP as its wrapper** (§8). Last, because what it can safely publish depends on §6 being settled.

Items 1 and 4 are the two that a partner conversation is waiting on, and together they are under two weeks.
