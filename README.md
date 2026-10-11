# EmpowerFI

**An intelligence layer for underserved real-world economies: everyday business activity turned into verifiable intelligence, with every step proven on Solana.**

> Prototype of a future regulated P2P productive-credit architecture. Hackathon investments, returns, FX and Pix settlement are simulated; blockchain transactions use test assets on Devnet.

Capital is becoming programmable and small businesses remain invisible to it. In Brazil, **2.6% of women-owned micro and small enterprises reach a formal loan against 4.6% of men-owned ones**, across roughly **ten million** women-led businesses and an estimated **US$15.8 billion** financing gap (IFC and Sicredi 2025; MEMP 2026 — [sources, with their caveats](https://www.empowerfi.io/sources)). Not for want of economic activity: she has sales, clients and cash flow, and all of it is informal, while capital asks for history, revenue and collateral.

So the missing piece is not another lender. It is the data a lender, a sponsor or a protocol would need before any of them can act, and for these businesses that data does not exist anywhere to be fetched. **EmpowerFI collects it at the source and makes it verifiable** — normalised, aggregated into privacy-preserving indicators, and committed to Solana so a stranger can check it without asking us. Two markets pay for that layer: **ESG sponsors** for impact intelligence about the cohorts they fund, and **Web3 protocols and financial networks** for market intelligence about businesses no existing dataset covers. Financial infrastructure — product matching, regulated lending — is an extension of the layer rather than a prerequisite for either stream, and waits on regulatory structure.

This repository demonstrates the layer by running the whole credit loop on it, end to end. Sponsors of ESG, impact and entrepreneurship programs pay for cohorts and struggle to prove what changed in the businesses they reached. Small loans fail on unit economics: preparing, originating and serving a R$3,000 loan costs nearly as much as a large one, so lenders don't make them. EmpowerFI takes on the part lenders can't afford. Communities prepare their members, members report their months, and a readiness engine tells each of them what is missing, in words she can act on. When a participant who is ready *chooses* to ask for capital, EmpowerFI qualifies the request and a Capital Allocation Engine chooses which pool of P2P capital funds it: Brazilian investors in reais, or international investors in USDC on Solana. She receives and repays in reais, by Pix, either way. EmpowerFI's P2P desk formalises and services the loan. Every fact along the way is recorded in a database and committed to Solana: auditable by anyone, with no personal data on chain. The same longitudinal evidence goes back to the sponsor as Impact Intelligence: what the program did, down to repayment and productive outcomes.

Being ready and not asking is a complete outcome. Nothing in the product pushes anyone into debt.

The marketplace app is live on Google Play; this repository is the Colosseum hackathon build of the credit platform and the public site.

## Try it

The platform is live at **[www.empowerfi.io/app](https://www.empowerfi.io/app)** (or `http://localhost:8080/app` locally), and the site's **App - Devnet** button opens it. It reads in English or Portuguese: the Portuguese pages open it in Portuguese, and the EN | PT switch changes it. Sign in with one of the demo accounts: the login page lists them and enters each with one click. They share the password **`EmpowerFI-demo-2026`** (public on purpose; every demo record is simulated), which the page carries for you — the scripts in `scripts/platform` need it, people do not.

The app tells one loop in two stories: **1 Impact Intelligence** and **2 Investor Console**. The **Credit & Capital Engine** is not a third. It runs inside the database when an opportunity opens for funding, so the page that shows its work is reached from the money it decided — a position, an opportunity, or a sponsor drilling into a code — rather than from a menu, because an explanation offered before the thing it explains is a rehearsal of a decision already taken. The **P2P desk** is not a third either, and for the same reason: its six screens are the back office of a decision already taken, so they are reached from the stage of the Capital Journey that says *the desk pays her* rather than from a menu. Community operations, the entrepreneur's own journey, admin and the audit console sit under **Operations**. A demo account moves between them in one click, as the right demo persona. **View platform as** picks one of four views (program sponsor, investor or impact fund, community operator, entrepreneur) and says what each is for, without widening anyone's permissions. It lists no tools: every dashboard carries its own in its sidebar, and offering the same doors twice made the landing read as a second menu.

| Account | Role | What to look at |
|---|---|---|
| `sponsor@demo.empowerfi.io` | Program sponsor | *Impact Intelligence*: a sponsored cohort, run by four communities, from funding deployed to outcomes; the funnel from sponsored to performing; segments with small groups hidden; the reach its sponsorship bought; evidence on Solana; drill into an opportunity and run the engine; an auditable report. |
| `maria@demo.empowerfi.io` | Entrepreneur | *My business*: readiness, what is missing, the monthly check-in, and who sponsors the programme she is in. Her September check-in makes her ready; then she may ask, or not. |
| `leader@demo.empowerfi.io` | Community leader | Grajaú: the funnel from members to funded P2P opportunities, qualified capital demand, funding gap, cost to serve. Jaqueline Pereira is ready and hasn't asked, and nothing moves her. |
| `partner@demo.empowerfi.io` | EmpowerFI P2P desk | Funded opportunities to formalise at the allocation engine's rate, loans to disburse and service. |
| `investor@demo.empowerfi.io` | Capital provider (impact fund) | *Investor Console*: the fund's mandate, opportunities that fit it with affordability and proof status, domestic and global liquidity, and three ways to commit — test USDC from a Solana wallet, shielded ZEC on Zcash testnet with the crossing priced live both ways, or a simulated BRL allocation — then positions with what is outstanding. |
| `auditor@demo.empowerfi.io` | Auditor | Any record → *Verify*: the browser recomputes the proof and reads it from devnet. |
| `admin@demo.empowerfi.io` | EmpowerFI admin | Review queue: verify communities, clear opportunities held for manual review. |

### Check a proof yourself

Click **Verify** beside any proven event: a drawer shows the proof (event, model version, commitment, devnet transaction) and checks it on Solana. With access to the record, or at `/app/audit/<kind>/<id>`, Your browser rebuilds the record's commitment, `SHA-256(domain ‖ 0x00 ‖ canonical JSON)`, and reads the account straight from Solana devnet. It then checks that the two match, that the program owns the account, and that its address is the one derived independently. For assessments it re-runs the engine on the stored inputs, and for outcomes it redoes the arithmetic. Change the record in the database and the verdict turns to MISMATCH. A background job re-checks every proof daily as well.

Program: [`4rqhxEwPiTd5CATztMfNmFfLaSntcmZPuzHKgmbESfRR`](https://explorer.solana.com/address/4rqhxEwPiTd5CATztMfNmFfLaSntcmZPuzHKgmbESfRR?cluster=devnet) (devnet).

## What is built

- **Operating economics** (`operating_economics()`, `/app/capital/economics`): what it costs to operate productive credit, and what may not be sacrificed to make it cheaper. Cost to serve beside eligibility discipline, time to decision beside affordability checks, scalability beside follow-up, capital access beside portfolio quality — each measured from the platform's own rows at a stated rate card rather than estimated. The pilot puts field numbers on the same four pairs.
- **Impact Intelligence** for program sponsors (`impact_intelligence()`): funding deployed, reach, reporting, readiness, capital requested and mobilised, repayment and productive outcomes over the communities that run a program. Aggregates only, groups under five hidden, outcomes only with the impact consent, the evidence behind every figure on Solana, and a report to download or print.
- **A sponsored cohort.** A company pays for a cohort and gets two things: the measured impact above, and its name in front of the women it funds — once, on a card in her journey, below her next step and never above it, with nothing to click. The sponsor's side reports what that name reached — entrepreneurs, communities, months, placements — as arithmetic on the program's own configuration, with nothing tracked about her to produce it. There is no third thing: **brand lift is not measured, because measuring it means surveying her**, and a woman part-way through a credit assessment does not experience an optional question as optional. The sponsor is told so on its own screen. A sponsor is owed its name in front of the cohort it funds; it is not owed the cohort's attention or the cohort's opinion. This product measures impact, not marketing.
- **Investor mandates:** an impact fund sets target population, geography, purpose, sector, ticket, risk appetite and route; every opportunity is matched against it from what investors already see.
- **The funnel, end to end:** community → verification → enrollment → education → monthly check-ins → readiness → request → eligibility → qualified opportunity → P2P funding → formalisation → disbursement → instalments → productive outcome. Each step is a checked database function, and each fact is anchored on Solana in order.
- **Two engines**, readiness and eligibility. They are pure, versioned and integer-only, pinned by hand-reasoned scenario vectors, and run the same way on the server and in the auditor's browser.
- **The Anchor program** `empowerfi_audit`: 13 account types and 17 instructions, with 28 LiteSVM tests. The rules live on chain too: eligibility needs the same borrower's CreditReady attestation, loans follow a state machine, and payments and outcomes are only possible after disbursement. Those refusals are why this is a program and not an attestation on the [Solana Attestation Service](https://solana.com/news/solana-attestation-service), which validates a schema's layout but never reads another attestation — [the comparison, in full](docs/ARCHITECTURE.md#why-not-the-solana-attestation-service).
- **An anchoring pipeline** that uses the database as its queue, plus a reconciliation job that re-checks every proof against the chain and against the record as it stands.
- **Dashboards by role** with row-level security. The P2P desk sees pseudonyms and rounded indicators; investors see a decision snapshot, never identity; community leaders see capital totals, never investors.
- **Cost to serve**, counted from a community's first day at a pilot rate card, per participant, per ready participant, per opportunity, per loan and per R$ lent. The card has a version and a source, assumed or observed, and each cost keeps the card that priced it; a second reader models what a larger ticket would do, over the card rather than over the facts.
- **Productive outcomes:** what changed in a business after its loan, from the months it reported. EVC = extra profit − interest paid; EVM = EVC ÷ capital. These are observed, not caused, and labelled that way.
- **Investing, for real on devnet.** A global investor signs in with a Solana wallet and sends test USDC to the program's vault; the allocation is proven on chain. Shielded ZEC on Zcash testnet is a second way to pay, read by a viewing-key watcher and credited to the vault. A domestic investor makes a simulated allocation in reais.
- **The vault sees a batch, not a person.** A shielded payment is unreadable on Zcash, and then the operator credited the vault with that investor's exact amount a minute later: the envelope was sealed and its shadow gave away the contents, because a distinctive amount identifies someone even with no name attached. Credits are now carried in **one transfer per batch, rounded down to whole units**, with the remainder waiting for the next one — so the number on Solana is the sum of nobody. Rounding down is the direction that matters: the operator never moves money it has not received, and the shortfall it creates can never exceed one unit, because the remainder is carried forward. Rounding up would commit money that has not arrived and, applied per batch, accumulate without bound. The three rules of that arithmetic are database constraints rather than care in code, so a batch that breaks one cannot be written at all. Between batches the vault holds less than the book, by less than one unit, and `zcash_batch_queue` publishes that float openly — a privacy mechanism that hides its own float is bookkeeping with the lights off. Each batch reports how many positions **and** how many investors it carried, because the first blends the amounts and only the second blends the totals; a batch of one is told on screen that it hides nothing, since overstating an anonymity set is the first thing a reader who knows privacy checks.
- **Privacy without a Zcash wallet.** An investor who pays with her Solana wallet can ask to be repaid in shielded ZEC. The deposit stays public — a devnet transfer is public by construction, and no later choice undoes it — but each instalment's share and any refund then leave EmpowerFI's shielded treasury instead of the vault, so no public ledger shows the size of her position or how it performs. It hides her returns from the public, not from EmpowerFI, and the screen says so instead of saying "private".
- **The Zcash leg is a priced route, not a wallet we accept.** Both ways across are quoted live by [NEAR Intents' 1Click API](https://docs.near-intents.org/) — what a solver network will pay, the floor it commits to, and how long it takes — so the shielded leg has the two things a leg of a capital route needs: a price someone stands behind, and a clock. Three facts measured against that API on 30 September 2026 shaped the screens rather than being worked around. It has **no testnet** ("use small amounts for test swaps"), so the quote is mainnet and live while the movement beside it is ours on Zcash testnet and Solana devnet, and every panel says which is which; nothing is executed here, because every call is a dry quote, which returns no deposit address and needs no API key — a judge with no account sees the same prices we do. A **shielded recipient is refused**, only transparent `t1…` is accepted, so a swap lands ZEC in the open and the shielding is EmpowerFI's step rather than the market's. And **Solana is the one origin that market does not route into ZEC**: Ethereum, Base and Arbitrum USDC quote, Solana answers *"Quoting for this pair is not available"* unless the funds already sit inside NEAR Intents — so the way in is from those three chains, and the page says so instead of implying a round trip that does not exist. Which chains ZEC crosses *out* to is weather rather than fact: on one day ZEC → USDC on Solana quoted all morning and answered `NO_QUOTE` by evening while Base still priced, so the panel asks the destinations in order and names whichever answered.
- **Settlement.** The vault releases global capital to the off-ramp when the desk disburses, and pays investors their share of each instalment, as real devnet transfers. The conversion to reais is simulated, priced at the live market rate — USDC/BRL from Mercado Bitcoin every ten minutes, with the Banco Central's PTAX beside it as the reference — and with a live MoneyGram Ramps sandbox quote next to it, which in Brazil is cash pickup from $2 to $500, not Pix. Pix both ways is a labelled mock. When the rate feed stops, prices fall back to a stated assumption and the screen says so. A declined opportunity refunds its investors from the vault.
- **Consent by use.** She chooses what her data may be used for: assessment, the P2P desk, investors, impact totals. Every screen and function checks it, and each consent record is proven on Solana.
- **Shared audit reports.** An auditor freezes the console's view into a public page that anyone can open and re-check against Solana from their own browser.
- **A Capital Allocation Engine** with two routes only: Domestic P2P (a simulated BRL pool, Pix) and Global P2P (test USDC on Solana, a simulated regulated off-ramp, Pix). Feasibility first — liquidity, risk appetite, ticket, mandate — then her all-in cost; deterministic reason codes, the pool persisted on each opportunity, and the same engine re-run in the browser. Global capital earns its place by the availability, mandate or economics it adds, not by being on a blockchain.

Read more: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/PRIVACY.md](docs/PRIVACY.md) · [docs/DEMO.md](docs/DEMO.md) (two numbered stories, the second in twenty steps) · [docs/I18N.md](docs/I18N.md) (English and Portuguese) · [platform/README.md](platform/README.md) (operations).

After the hackathon, three studies on what changes for real use: [STUDY-WHATSAPP.md](docs/STUDY-WHATSAPP.md) (WhatsApp as the entry interface), [STUDY-SPLIT.md](docs/STUDY-SPLIT.md) (what stays public when real data arrives) and [STUDY-CONTRACTS.md](docs/STUDY-CONTRACTS.md) (the proof layer reviewed, and how much of it needs to be on a chain).

## What it earns, and from whom

One layer, two paying markets. Both are hypotheses with a price attached rather than contracted revenue, and the README says so because the product's own screens do.

| | Who pays | What they get | How |
|---|---|---|---|
| **Impact intelligence** · core | ESG sponsors, foundations, institutions | monitored cohorts, impact measurement, longitudinal evidence | recurring sponsored programs, target **~US$4 per business per month** — pricing to be validated |
| **Market intelligence** · core | Web3 protocols, financial networks, capital providers | aggregated indicators, opportunity discovery, verifiable intelligence, integrations | subscriptions, APIs, protocol-sponsored programs |
| **Financial infrastructure** · optional, later | product providers, regulated lenders | product matching, distribution, regulated lending integrations | an extension, not a prerequisite for viability — subject to regulatory structure |

**No personal data is sold.** Aggregates go out through controlled APIs with groups under five suppressed, and anything specific to one business requires her consent, which is itself a record proven on Solana.

The first market is the one the repo demonstrates in full: *Impact Intelligence* is a working dashboard over real engine output, not a mock of a future product.

## Traction

- **200+ app installs** on Android and iOS, and **18 women entrepreneurs registered** on the marketplace app that is live on Google Play. The low conversion between those two numbers is the reason the entry interface is being moved to WhatsApp after the hackathon — the analysis is in [docs/STUDY-WHATSAPP.md](docs/STUDY-WHATSAPP.md).
- **Zero PII on chain, measured rather than asserted.** Last run on 22 Sep 2026: 10,486 accounts across all thirteen types and 21 position mints, searched against 341 names, e-mails and places and 1,067 amounts from the database — no findings. `npx tsx scripts/platform/scan-chain-pii.mts` runs it again.
- **Next:** first paid pilots, one ESG sponsor and one Web3 protocol.

## Who built it

| | | |
|---|---|---|
| **Daniele Santos** | Founder & CEO | Computer engineer, 20+ years |
| **Roberta Stock** | Advisor | Community and financial education |
| **Fernando Blanco** | Advisor | Banking and credit |
| **Daniel Branco** | Business partner | Payments infrastructure |

EmpowerFI is a Unicamp *empresa-filha*.

## Run it locally

Requires Node.js 20+.

```bash
npm install
npm run dev          # http://localhost:8080 — the site, and the platform at /app
```

The platform reads `VITE_PLATFORM_SUPABASE_URL` and `VITE_PLATFORM_SUPABASE_PUBLISHABLE_KEY` (the hackathon Supabase project; a publishable key is safe in a bundle), and optionally `VITE_SOLANA_RPC_URL` (defaults to public devnet). The public site's contact form uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` of the website project.

The backend (migrations, tests, Edge Functions, secrets, demo data) is documented in [platform/README.md](platform/README.md). The program builds with Anchor 1.0:

```bash
anchor build && cargo test -p empowerfi-audit      # LiteSVM tests
npm run audit-client:generate                       # after changing the program: IDL → TypeScript client
```

## Tests

| Command | What |
|---|---|
| `npm test` | Vitest: engines and their vectors, the Capital Allocation Engine's and the settlement route comparator's vectors, commitments and golden vectors, the on-chain privacy review of the IDL, settlement and ramp helpers, the cross-chain crossing's quote vectors, languages |
| `npx supabase test db --workdir platform` | pgTAP: every role's access, the thesis, the anchoring and reconciliation queues, cost to serve, capital, outcomes, catalog-wide RBAC rules (add `--linked` to run against the remote, rolled back) |
| `cargo test -p empowerfi-audit` | the program's rules in LiteSVM |
| `deno test --allow-read platform/supabase/functions/_shared/` | the vendored engines and commitments, in the runtime that uses them |
| `npm run test:deno-check` | every Edge Function type-checks in Deno — the tests above cover `_shared/` only, and the functions are where a new anchor kind is easiest to half-add |
| `UX_BASE=http://localhost:5173 npm run test:ux-paths` | in a browser, as each of the five demo personas: entering from a deep link, every tool its view lists, and every `/app` link it is shown — nothing refuses them, bounces them, or scrolls to an anchor that is not there. Needs `npm run dev` and a seeded database |
| `npx tsx scripts/verify-<name>.mts` | one screen each, in a browser, in both languages: what it says, whether every fold opens from the keyboard, whether anything overflows at 1440 / 1280 / 1024 / 768 / 390, and whether the console stayed quiet. Each reports `ok` or `MISS` per claim. `verify-crossing` asks NEAR Intents for all four directions before it reads a screen, because that claim is a fact about their network rather than about this code |
| `npx tsx scripts/platform/scan-chain-pii.mts` | every account on devnet: reviewed types only, none of the database's personal data |

## Repository

```
src/app/                     the platform (/app): pages by role, audit screen
src/                         the public site (EN at /, PT-BR at /pt)
packages/                    readiness-engine · eligibility-engine · capital-allocation · settlement-route · audit-commitments · audit-client
programs/empowerfi-audit     the Anchor program and its tests
platform/supabase            migrations, pgTAP tests, Edge Functions
services/zcash-watcher       Zcash viewing-key scanner (Rust → WebAssembly) for the zcash-watch function
scripts/                     browser checks (verify-*): each reads a screen and reports MISS
scripts/platform             demo accounts, demo scenario, zero-PII scan
docs/                        architecture, privacy, demo script, languages
```

## The public site

Vite + React 18 + TypeScript, Tailwind and shadcn/ui, bilingual: English at `/` (with `/investors`, `/about`, `/sources`), Portuguese at `/pt` (with `/pt/investidores`, `/pt/sobre` and `/pt/empreendedoras`, the page for the entrepreneur). The home page tells the same loop in fifteen sections in both languages: hero, the four capital engines, the problem, how it works, the capital network, local capital first, local economic rails, global capital, the north star, who it is for, the business model, how it operates, the technology, auditability and traction. The pilot roadmap and readiness in depth live on `/investors`; market evidence and its caveats on `/sources`. A change to a page in one language is mirrored in the other. The header's **App - Devnet** button opens the platform in the page's language. The investor contact form uses the `send-transactional-email` Edge Function of the website's Supabase project (root `supabase/`, kept separate from `platform/`).

Deployed on Vercel: [`vercel.json`](vercel.json) sets the Vite preset and a SPA rewrite so client-side routes (`/pt`, `/app/...`) resolve on direct load. Set the `VITE_*` variables above for Production and Preview.

| Command | |
|---|---|
| `npm run dev` | dev server, port 8080 |
| `npm run build` | production build to `dist/` |
| `npm run preview` | preview the build |
| `npm run lint` | ESLint |

## License

MIT, in [`LICENSE`](LICENSE). The frontend, the Anchor program and the product schema are open: a reader can run the platform, deploy the proof program to a cluster of their own, and recompute any commitment without asking us.

The **v1 allocation model is public on purpose**, not by oversight. `capital_fit_weights()`, `allocation_expected_loss_bps()`, `rate_card_at()` and the rest of the decision functions are in the migrations under `platform/supabase`, with their weights and thresholds, because a model that decides who gets capital should be auditable by the people it decides about — which is the same argument this product makes about impact reporting. A model nobody can read is the thing we are replacing.

What is not here is the calibration. v1 is an informed prior, set before the product had a single real repayment; the value is in what changes it, and that comes from data EmpowerFI will hold rather than from the formula. Later versions are calibrated in a separate private repository and reach this one as a `model_version` on an attestation, so a commitment made under one version stays checkable after the next one ships.
