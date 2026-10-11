# Getting in without a login, and letting data out without leaking — an analysis

**Written for:** the founder, and whoever builds this. Fourth in the series, after [STUDY-WHATSAPP.md](STUDY-WHATSAPP.md), [STUDY-SPLIT.md](STUDY-SPLIT.md) and [STUDY-CONTRACTS.md](STUDY-CONTRACTS.md).

Six things to design: registration tied to a phone instead of a login, a one-time code for each visit to the report page, account recovery, a WhatsApp bot that answers questions, a monetised community partner whose terms are different, the entrepreneurs already registered in the app, and an API and MCP server for Web3 protocols.

Most of it fits what exists better than expected. Two do not. One is an engine rule that silently refuses the partner who is waiting, so it goes first; the other is a conflict between the two revenue streams that has to be settled in the first sponsorship contract rather than at the first API customer.

---

## 1. Revising the engine: preparation is a competency, not an attendance record

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

A global count, greater than zero as soon as a core programme exists, and her members complete none of it. Follow it through:

> `CORE_EDUCATION_INCOMPLETE` → `NEEDS_PREPARATION`, permanently → never `CREDIT_READY` → `attest_eligibility` refuses on chain, because it requires a `CreditReady` attestation for the same borrower → no opportunity, no loan.

**The one thing she is asking for is the one thing the product structurally refuses her**, and it refuses silently: nothing on any screen says "this community does not run our modules, so nobody in it can qualify". It reads as a readiness result about each woman.

### 1.1 The small fix is not the right fix

The obvious repair is to resolve `core_modules_total` per community instead of globally. `education_programs.community_id` already exists and the cooperative already uses it, so this is a change to one lookup.

It unblocks her, and it introduces a worse problem quietly. **If each community defines its own core programme, the score stops being comparable across communities** — three easy modules and twelve hard ones both read as "complete". The score drives the band, the band travels into eligibility as `risk_band` and `confidence`, and a lender comparing two `HIGH` attestations would be comparing two different measurements with the same name. That is a harder defect to find than the current one, because it produces plausible numbers.

So the per-community lookup is necessary and not sufficient. It needs something that holds the meaning steady.

### 1.2 What the requirement is actually trying to measure

`education_modules` carries `title`, `position` and `estimated_minutes`. **There is no competency model** — nothing records what a module teaches. So "completed twelve modules" is already a weak proxy, and the engine is gating credit on attendance while believing it gates on preparation.

Meanwhile the engine already measures, from her own reporting, most of what the modules exist to install:

| what preparation is meant to produce | what the engine already observes |
|---|---|
| she keeps records of her sales | `records_kept_bps` |
| her numbers are coherent | `inconsistencies`, `MANUAL_REVIEW_INCONSISTENCIES` |
| she sustains the discipline | `consecutive_months` |
| she knows her own variance | `revenue_cv_bps` |
| she separates the business from the household | `avg_household_cents`, `HIGH_HOUSEHOLD_DRAW` |

Six months of consistent, internally coherent records is stronger evidence of preparation than a completion flag, because it is behaviour rather than attendance, and because it is the behaviour credit actually depends on.

### 1.3 The revision

Replace the attendance gate with an evidence gate:

- `CORE_EDUCATION_INCOMPLETE` becomes **`PREPARATION_NOT_EVIDENCED`**, satisfied by any one of three sources:
  1. EmpowerFI's core programme completed;
  2. a community programme completed, where that programme has been **reviewed once by EmpowerFI and marked core-equivalent** — the review is what holds comparability, and it is a real step rather than a formality;
  3. **demonstrated competency** from her own reporting: records kept above the threshold across a sustained run of consecutive months with no inconsistencies.
- The attestation records **which source** satisfied it. The features already travel in the payload; preparation provenance joins them, so a lender can weight it rather than discover it.
- The three sources score the same in v1. Differentiating them invites gaming and guesswork, and v1 is an informed prior anyway — what should change the weights is repayment data, not an opinion formed now.
- `model_version` bumps, because the meaning of `CREDIT_READY` changes. Attestations made under the old version stay valid and stay checkable, which is what the field is for.

Two things this buys beyond unblocking the partnership. It fixes a quieter exclusion — a competent woman who will not sit through modules is blocked today for a reason that has nothing to do with her business. And it is a **better answer to a lender**, because demonstrated behaviour is more defensible than a completion flag.

One thing it costs, and it needs an explicit decision rather than a quiet slide: **this moves the product's position from "preparation before credit" to "evidence of preparation before credit".** The intent is unchanged and the second is arguably the honest version of the first — but it is a position change, it should be stated on the screens that explain readiness, and it is the founder's call, not an implementation detail.

Route three is also the one to watch for gaming once there is real money behind it: it is satisfied by reporting cleanly for long enough, and reporting is self-declared. The protections that exist — `inconsistencies`, the coefficient of variation, `MANUAL_REVIEW` — were built against honest error rather than against someone optimising. Worth revisiting at the first sign that anyone is.

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

## 8. What may be sold, by whom, and to whom

The API sells **normalised aggregates, never personal data**, it does not open before there is enough of it to be worth buying, and **a cohort a sponsor paid to monitor does not become an API product.** Those are the right three rules. The third has a conflict inside it that has to be resolved at the first sponsorship contract rather than at the first API customer, because by then it is a renegotiation with everyone.

### 8.1 The conflict, stated plainly

The business model is that sponsors pay about US$4 per business per month to monitor a cohort. If that succeeds, **most monitored businesses are in a sponsored cohort.** And if a sponsored cohort cannot become an API product, then stream 2 has almost no inputs — permanently, and more so the better stream 1 does.

It gets tighter: API access is also meant to come *with* sponsoring a cohort. If the sponsor's entitlement is access to the pool, and the pool excludes sponsored cohorts, the entitlement is access to nothing.

This is not an argument against the rule. It is an argument that the rule is about the wrong noun.

### 8.2 What a sponsor actually buys

> **A sponsor buys exclusivity over the identification, not over the observation.**

Three tiers, and the rule lands differently on each:

| tier | what it is | who may have it |
|---|---|---|
| **1 · cohort intelligence** | "your 500 women in Grajaú: reach, readiness, repayment, outcomes" — identified to the programme | **the sponsor who paid, exclusively. Never an API product.** This is the rule as stated, and it is right. |
| **2 · pooled indicators** | sector × region × period across all consenting businesses, no cohort or sponsor distinguishable | the market-intelligence product — **if the sponsorship contract said so when it was signed** |
| **3 · opportunity discovery** | a specific business, matched to a capital provider | only with her `investors` consent. Already built, already gated. |

The 500 women existing in a national figure as *"bakeries in the south-east, median revenue X, n = 1,400"* takes nothing from the sponsor, because what the sponsor paid for is knowing they are **theirs** — the attribution, the longitudinal story, the report with their name on it. What would take something is a buyer being able to reconstruct that cohort from the pool, which is §8.4.

So the contract decides one thing, up front: **does this cohort contribute to tier 2?** A sponsor who wants it to not contribute is buying exclusivity, and that is a priced option, not a default. A sponsor who does not care gets a lower price. Either way it is written before the first check-in exists.

### 8.3 Provenance is already derivable — no new column

Pleasant surprise in the schema. The link is `programs` → `program_communities` → `communities` → members, and `programs` carries `period_start` and `period_end`:

```sql
create table public.program_communities (
  program_id uuid not null references public.programs (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  primary key (program_id, community_id)
);
```

So a check-in is **sponsored** when its period falls inside a programme whose communities include hers, and **organic** otherwise. The primary key allows a community in several programmes at once, so a record may have zero, one or several funders, and that is computable rather than something to record by hand.

Two consequences that fall out for free:

- **The exclusivity window is the contract's own dates.** A sponsor who funded January to June has no claim on the September check-in. Nothing has to expire anything; the period already does it.
- **There is an organic base**, and its size is the thing to watch, because it is the part of tier 2 that no contract can take away. Measure it before promising anything to a protocol.

What does need recording is the one thing that is not derivable: the tier-2 permission from §8.2. One boolean on `programs`, decided at signature, and a view that resolves each record to *may contribute / may not*.

### 8.4 The dominance rule: a pool that reconstructs a cohort is still the cohort

This is the failure that would actually breach a sponsor contract, and the cell-count rule does not catch it.

> If one sponsor funds the only programme in a region, then *"bakeries in Grajaú, n = 60"* **is** that sponsor's cohort, whatever the cell count says. A buyer who knows who funds what — and a protocol buying market intelligence does know — reads the pool and gets tier 1 for the tier 2 price.

The same thing happens to a *business*: a cell of forty bakeries where one has most of the revenue publishes that one bakery's revenue inside a total.

Statistical agencies have solved this for business microdata and the rules have names. Adopt both:

- **A dominance rule for provenance:** suppress a cell when any single programme accounts for more than a set share of it. This is the one that protects the sponsor contract.
- **The p% rule for values:** suppress a reported total when one or two businesses dominate it closely enough that the rest of the cell could estimate them. This is the one that protects her.

Both are evaluated on the **intersection** being asked for, not on each dimension separately — which is also the fix for the differencing attack below.

### 8.5 Suppression does not survive becoming a query

Today `impact_intelligence()` hides any breakdown group under five, in SQL. That works because the dashboard offers fixed cuts and a human reads them one at a time. A query API with free filters dissolves it:

> Ask for *bakers in Grajaú, cohort A* — suppressed, n < 5. Ask for *cohort A* and *cohort A excluding bakers in Grajaú*, both comfortably above five, and subtract. The suppressed cell comes back exact, from two allowed answers.

The rule is evaluated per response; the attack lives between responses.

**MCP amplifies this rather than inheriting it.** An MCP server is a thin protocol over the same API, but its consumer is an agent, which enumerates slices automatically, at machine speed, without intending anything by it. The informal protection the dashboard has is that nobody runs four hundred queries. That is exactly what an agent removes. Build the API with this solved and let MCP be the wrapper it should be.

Four things that hold:

- **Fixed cuts, not free composition.** Publish a defined set of aggregates and let callers choose among them. Boring, effective, and how statistical agencies release summaries.
- **Minimum cell, dominance and p% all evaluated on the intersection** actually requested.
- **Per-consumer query logs and a budget.** Differencing needs a sequence, and a sequence is visible if it is recorded. It is also how you answer, later, what a given protocol saw.
- **Not noise.** Differential privacy is the textbook answer and the wrong one *here*: it breaks recomputation of the aggregate from the commitments on chain, which is the thing that makes this data worth more than someone else's. **Verifiability and perturbation pull against each other**, and verifiability is the product.

### 8.6 Critical mass is a property of each cut, and the commercial floor is the higher one

Not opening without critical mass is right, and the useful version of it is that **critical mass is per published indicator, not per product.** The API can go live with three cuts that qualify and grow as others do; a cut that stops qualifying stops being served. That is a rule the code can enforce, rather than a launch decision somebody has to remember.

The reassuring part: **the commercial floor is above the privacy floor.** An indicator computed over thirty businesses is not market intelligence, it is an anecdote, and no protocol should pay for it. So by the time a cut is worth selling it is well past the point where disclosure control binds — which means the thing that protects her and the thing that makes the product credible are the same thing, and the API's honest constraint is "is this worth buying", not "is this safe to publish".

Set the numbers with the first buyer rather than now. What matters at this stage is that there are four of them and they are checked together: minimum cell count, programme dominance, business dominance, and the sample description in §8.7.

### 8.7 What travels with every response

Two things, neither expensive:

- **The commitment set the figure was computed over**, so a protocol can re-derive the number from records it verified independently against Solana instead of trusting the API. Nobody else selling this kind of indicator can offer it, and it costs an array of hashes.
- **The sample's shape.** [§6](#6-the-monetised-community-the-consent-ladder-already-has-the-shape) excludes communities that withhold the `impact` scope, and §8.2 excludes cohorts whose sponsor bought exclusivity. Both exclusions are systematic rather than random — a community that charges its members selects for a different entrepreneur — so an indicator sold as *"women-led micro-businesses in Brazil"* has a known bias in it and the buyer is entitled to the description. Publishing what the aggregate is drawn from is also what stops a buyer discovering it later and concluding the rest was oversold.

And one for the terms rather than the code: an MCP response lands inside a model's context and may be retained by whoever runs it. Write that down before the first integration, not after.

---

## 9. Sequence

In dependency order. The first two are not the biggest; they are the ones that get more expensive the longer they wait.

0. **Decide the tier-2 clause and put it in the sponsorship template** ([§8.2](#82-what-a-sponsor-actually-buys)). Costs nothing today and is a renegotiation with every sponsor once contracts exist. **Do this before the next one is signed**, not when the API is built. *(an afternoon)*
1. **The engine revision** ([§1.3](#13-the-revision)) — `PREPARATION_NOT_EVIDENCED` with three admissible sources, provenance in the attestation payload, the community-programme review step, and a new `model_version`. Nothing involving that community can start before it, and the position change needs stating on the screens that explain readiness. *(~2 weeks, including the vectors, the SQL mirror and the copy)*
2. **Phone identity and the pull-a-link access flow** (§2, §3), with phone numbers added to the PII scan's search set before the first real one is stored. *(~1.5 weeks)*
3. **Community consent defaults and the WhatsApp consent channel** (§6). Small, and it unblocks talking to the partner about terms. *(~3 days)*
4. **Community-vouched recovery** (§4), as a ceiling-not-grant permission on the leader's console. *(~1 week)*
5. **The migration of the eighteen** (§7) — in-app invitation, history preserved, one fresh consent. *(~3 days, mostly copy)*
6. **The bot** (§5), on top of the WhatsApp layer from the other study rather than before it.
7. **Measure the organic base** ([§8.3](#83-provenance-is-already-derivable--no-new-column)) and the provenance view, which is what says whether tier 2 has inputs at all. Cheap, and it should happen early enough to change the answer if it is small.
8. **The API, then MCP as its wrapper** (§8.4–8.7). Last, because what it may publish depends on 0, 3 and 7 being settled.

Items 0, 1 and 3 are what a partner conversation is waiting on. Item 0 is the one that is free now and costly later.
