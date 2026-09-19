# EmpowerFI

**Productive-credit and impact intelligence infrastructure: turn impact programs into investable businesses, with every step proven on Solana.**

> Prototype of a future regulated P2P productive-credit architecture. Hackathon investments, returns, FX and Pix settlement are simulated; blockchain transactions use test assets on Devnet.

Sponsors of ESG, impact and entrepreneurship programs pay for cohorts and struggle to prove what changed in the businesses they reached. Small loans fail on unit economics: preparing, originating and serving a R$3,000 loan costs nearly as much as a large one, so lenders don't make them. EmpowerFI takes on the part lenders can't afford. Communities prepare their members, members report their months, and a readiness engine tells each of them what is missing, in words she can act on. When a participant who is ready *chooses* to ask for capital, EmpowerFI qualifies the request and a Capital Allocation Engine chooses which pool of P2P capital funds it: Brazilian investors in reais, or international investors in USDC on Solana. She receives and repays in reais, by Pix, either way. EmpowerFI's P2P desk formalises and services the loan. Every fact along the way is recorded in a database and committed to Solana: auditable by anyone, with no personal data on chain. The same longitudinal evidence goes back to the sponsor as Impact Intelligence: what the program did, down to repayment and productive outcomes.

Being ready and not asking is a complete outcome. Nothing in the product pushes anyone into debt.

The marketplace app is live on Google Play; this repository is the Colosseum hackathon build of the credit platform and the public site.

## Try it

The platform is live at **[www.empowerfi.io/app](https://www.empowerfi.io/app)** (or `http://localhost:8080/app` locally), and the site's **App - Devnet** button opens it. It reads in English or Portuguese: the Portuguese pages open it in Portuguese, and the EN | PT switch changes it. Sign in with one of the demo accounts. The login page lists them, and all share the password **`EmpowerFI-demo-2026`** (public on purpose; every demo record is simulated).

The app tells one loop in three stories: **1 Impact Intelligence**, **2 Credit & Capital Engine**, **3 Investor Console**. Community operations, the P2P desk, the entrepreneur's own journey, admin and the audit console sit under **Operations**. A demo account moves between them in one click, as the right demo persona. **View platform as** picks one of five views (program sponsor, investor or impact fund, credit and capital operator, community operator, entrepreneur), each with its value and its own tools, without widening anyone's permissions.

| Account | Role | What to look at |
|---|---|---|
| `sponsor@demo.empowerfi.io` | Program sponsor | *Impact Intelligence*: a foundation's program run by four communities, from funding deployed to outcomes; the funnel from sponsored to performing; segments with small groups hidden; evidence on Solana; drill into an opportunity and run the engine; an auditable report. |
| `maria@demo.empowerfi.io` | Entrepreneur | *My business*: readiness, what is missing, the monthly check-in. Her September check-in makes her ready; then she may ask, or not. |
| `leader@demo.empowerfi.io` | Community leader | Grajaú: the funnel from members to funded P2P opportunities, qualified capital demand, funding gap, cost to serve. Jaqueline Pereira is ready and hasn't asked, and nothing moves her. |
| `partner@demo.empowerfi.io` | EmpowerFI P2P desk | Funded opportunities to formalise at the allocation engine's rate, loans to disburse and service. |
| `investor@demo.empowerfi.io` | Capital provider (impact fund) | *Investor Console*: the fund's mandate, opportunities that fit it with affordability and proof status, domestic and global liquidity, a wallet investment in test USDC or a simulated BRL allocation, positions with what is outstanding. |
| `auditor@demo.empowerfi.io` | Auditor | Any record → *Verify*: the browser recomputes the proof and reads it from devnet. |
| `admin@demo.empowerfi.io` | EmpowerFI admin | Review queue: verify communities, clear opportunities held for manual review. |

### Check a proof yourself

Click **Verify** beside any proven event: a drawer shows the proof (event, model version, commitment, devnet transaction) and checks it on Solana. With access to the record, or at `/app/audit/<kind>/<id>`, Your browser rebuilds the record's commitment, `SHA-256(domain ‖ 0x00 ‖ canonical JSON)`, and reads the account straight from Solana devnet. It then checks that the two match, that the program owns the account, and that its address is the one derived independently. For assessments it re-runs the engine on the stored inputs, and for outcomes it redoes the arithmetic. Change the record in the database and the verdict turns to MISMATCH. A background job re-checks every proof daily as well.

Program: [`4rqhxEwPiTd5CATztMfNmFfLaSntcmZPuzHKgmbESfRR`](https://explorer.solana.com/address/4rqhxEwPiTd5CATztMfNmFfLaSntcmZPuzHKgmbESfRR?cluster=devnet) (devnet).

## What is built

- **Operating economics** (`operating_economics()`, `/app/capital/economics`): can productive credit become cheaper to operate without becoming weaker credit? Cost to serve beside eligibility discipline, time to decision beside affordability checks, scalability beside follow-up, capital access beside portfolio quality. A hypothesis the prototype measures and the pilot must test, priced by an assumed rate card.
- **Impact Intelligence** for program sponsors (`impact_intelligence()`): funding deployed, reach, reporting, readiness, capital requested and mobilised, repayment and productive outcomes over the communities that run a program. Aggregates only, groups under five hidden, outcomes only with the impact consent, the evidence behind every figure on Solana, and a report to download or print.
- **Investor mandates:** an impact fund sets target population, geography, purpose, sector, ticket, risk appetite and route; every opportunity is matched against it from what investors already see.
- **The funnel, end to end:** community → verification → enrollment → education → monthly check-ins → readiness → request → eligibility → qualified opportunity → P2P funding → formalisation → disbursement → instalments → productive outcome. Each step is a checked database function, and each fact is anchored on Solana in order.
- **Two engines**, readiness and eligibility. They are pure, versioned and integer-only, pinned by hand-reasoned scenario vectors, and run the same way on the server and in the auditor's browser.
- **The Anchor program** `empowerfi_audit`: 10 account types and 13 instructions. The rules live on chain too: eligibility needs the same borrower's CreditReady attestation, loans follow a state machine, and payments and outcomes are only possible after disbursement.
- **An anchoring pipeline** that uses the database as its queue, plus a reconciliation job that re-checks every proof against the chain and against the record as it stands.
- **Dashboards by role** with row-level security. The P2P desk sees pseudonyms and rounded indicators; investors see a decision snapshot, never identity; community leaders see capital totals, never investors.
- **Cost to serve**, counted from a community's first day at a pilot rate card, per participant, per ready participant, per opportunity, per loan and per R$ lent.
- **Productive outcomes:** what changed in a business after its loan, from the months it reported. EVC = extra profit − interest paid; EVM = EVC ÷ capital. These are observed, not caused, and labelled that way.
- **Investing, for real on devnet.** A global investor signs in with a Solana wallet and sends test USDC to the program's vault; the allocation is proven on chain. Shielded ZEC on Zcash testnet is a second way to pay, read by a viewing-key watcher and credited to the vault. A domestic investor makes a simulated allocation in reais.
- **Settlement.** The vault releases global capital to the off-ramp when the desk disburses, and pays investors their share of each instalment, as real devnet transfers. The conversion to reais is simulated, with a live quote from MoneyGram Ramps' sandbox beside it, and Pix both ways is a labelled mock. A declined opportunity refunds its investors from the vault.
- **Consent by use.** She chooses what her data may be used for: assessment, the P2P desk, investors, impact totals. Every screen and function checks it, and each consent record is proven on Solana.
- **Shared audit reports.** An auditor freezes the console's view into a public page that anyone can open and re-check against Solana from their own browser.
- **A Capital Allocation Engine** with two routes only: Domestic P2P (a simulated BRL pool, Pix) and Global P2P (test USDC on Solana, a simulated regulated off-ramp, Pix). Feasibility first — liquidity, risk appetite, ticket, mandate — then her all-in cost; deterministic reason codes, the pool persisted on each opportunity, and the same engine re-run in the browser. Global capital earns its place by the availability, mandate or economics it adds, not by being on a blockchain.

Read more: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/PRIVACY.md](docs/PRIVACY.md) · [docs/DEMO.md](docs/DEMO.md) (the loop, in fourteen steps) · [docs/I18N.md](docs/I18N.md) (English and Portuguese) · [platform/README.md](platform/README.md) (operations).

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
| `npm test` | Vitest: engines and their vectors, the Capital Allocation Engine's and the settlement route comparator's vectors, commitments and golden vectors, the on-chain privacy review of the IDL, settlement and ramp helpers, languages |
| `npx supabase test db --workdir platform` | pgTAP: every role's access, the thesis, the anchoring and reconciliation queues, cost to serve, capital, outcomes, catalog-wide RBAC rules (add `--linked` to run against the remote, rolled back) |
| `cargo test -p empowerfi-audit` | the program's rules in LiteSVM |
| `deno test --allow-read platform/supabase/functions/_shared/` | the vendored engines and commitments, in the runtime that uses them |
| `npm run test:deno-check` | every Edge Function type-checks in Deno — the tests above cover `_shared/` only, and the functions are where a new anchor kind is easiest to half-add |
| `npx tsx scripts/platform/scan-chain-pii.mts` | every account on devnet: reviewed types only, none of the database's personal data |

## Repository

```
src/app/                     the platform (/app): pages by role, audit screen
src/                         the public site (EN at /, PT-BR at /pt)
packages/                    readiness-engine · eligibility-engine · capital-allocation · settlement-route · audit-commitments · audit-client
programs/empowerfi-audit     the Anchor program and its tests
platform/supabase            migrations, pgTAP tests, Edge Functions
services/zcash-watcher       Zcash viewing-key scanner (Rust → WebAssembly) for the zcash-watch function
scripts/platform             demo accounts, demo scenario, zero-PII scan
docs/                        architecture, privacy, demo script, languages
```

## The public site

Vite + React 18 + TypeScript, Tailwind and shadcn/ui, bilingual: English at `/` (with `/investors`, `/about`, `/sources`), Portuguese at `/pt` (with `/pt/investidores`, `/pt/sobre` and `/pt/empreendedoras`, the page for the entrepreneur). The home page tells the same loop in seven sections in both languages: hero, problem, how it works, two revenue engines, capital, auditability, traction and where you fit. The pilot roadmap and readiness in depth live on `/investors`; market evidence and its caveats on `/sources`. A change to a page in one language is mirrored in the other. The header's **App - Devnet** button opens the platform in the page's language. The investor contact form uses the `send-transactional-email` Edge Function of the website's Supabase project (root `supabase/`, kept separate from `platform/`).

Deployed on Vercel: [`vercel.json`](vercel.json) sets the Vite preset and a SPA rewrite so client-side routes (`/pt`, `/app/...`) resolve on direct load. Set the `VITE_*` variables above for Production and Preview.

| Command | |
|---|---|
| `npm run dev` | dev server, port 8080 |
| `npm run build` | production build to `dist/` |
| `npm run preview` | preview the build |
| `npm run lint` | ESLint |
