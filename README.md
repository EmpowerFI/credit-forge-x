# EmpowerFI

**P2P productive credit for women micro-entrepreneurs in Brazil, from readiness to capital, with every step proven on Solana.**

> Prototype of a future regulated P2P productive-credit architecture. Hackathon investments, returns, FX and Pix settlement are simulated; blockchain transactions use test assets on Devnet.

Small loans fail on unit economics: preparing, originating and serving a R$3,000 loan costs nearly as much as a large one, so lenders don't make them. EmpowerFI takes on the part lenders can't afford. Communities prepare their members, members report their months, and a readiness engine tells each of them what is missing, in words she can act on. When a participant who is ready *chooses* to ask for capital, EmpowerFI qualifies the request and a Capital Allocation Engine chooses which pool of P2P capital funds it: Brazilian investors in reais, or international investors in USDC on Solana. She receives and repays in reais, by Pix, either way. EmpowerFI's P2P desk formalises and services the loan. Every fact along the way is recorded in a database and committed to Solana: auditable by anyone, with no personal data on chain.

Being ready and not asking is a complete outcome. Nothing in the product pushes anyone into debt.

The marketplace app is live on Google Play; this repository is the Colosseum hackathon build of the credit platform and the public site.

## Try it

The platform is live at **[www.empowerfi.io/app](https://www.empowerfi.io/app)** (or `http://localhost:8080/app` locally). Sign in with one of the demo accounts. The login page lists them, and all share the password **`EmpowerFI-demo-2026`** (public on purpose; every demo record is simulated).

| Account | Role | What to look at |
|---|---|---|
| `maria@demo.empowerfi.io` | Entrepreneur | *My business*: readiness, what is missing, the monthly check-in. Her September check-in makes her ready; then she may ask, or not. |
| `leader@demo.empowerfi.io` | Community leader | Grajaú: the funnel from members to funded P2P opportunities, qualified capital demand, funding gap, cost to serve. Jaqueline Pereira is ready and hasn't asked, and nothing moves her. |
| `partner@demo.empowerfi.io` | EmpowerFI P2P desk | Funded opportunities to formalise at the allocation engine's rate, loans to disburse and service. |
| `investor@demo.empowerfi.io` | Capital provider | *P2P capital console*: qualified demand, domestic and global liquidity, funding coverage, opportunities by route, a wallet investment in test USDC or a simulated BRL allocation, and the Capital Allocation Engine. |
| `auditor@demo.empowerfi.io` | Auditor | Any record → *Verify*: the browser recomputes the proof and reads it from devnet. |
| `admin@demo.empowerfi.io` | EmpowerFI admin | Review queue: verify communities, clear opportunities held for manual review. |

### Check a proof yourself

Open any record's proof (`/app/audit/<kind>/<id>`). Your browser rebuilds the record's commitment, `SHA-256(domain ‖ 0x00 ‖ canonical JSON)`, and reads the account straight from Solana devnet. It then checks that the two match, that the program owns the account, and that its address is the one derived independently. For assessments it re-runs the engine on the stored inputs, and for outcomes it redoes the arithmetic. Change the record in the database and the verdict turns to MISMATCH. A background job re-checks every proof daily as well.

Program: [`4rqhxEwPiTd5CATztMfNmFfLaSntcmZPuzHKgmbESfRR`](https://explorer.solana.com/address/4rqhxEwPiTd5CATztMfNmFfLaSntcmZPuzHKgmbESfRR?cluster=devnet) (devnet).

## What is built

- **The funnel, end to end:** community → verification → enrollment → education → monthly check-ins → readiness → request → eligibility → qualified opportunity → P2P funding → formalisation → disbursement → instalments → productive outcome. Each step is a checked database function, and each fact is anchored on Solana in order.
- **Two engines**, readiness and eligibility. They are pure, versioned and integer-only, pinned by hand-reasoned scenario vectors, and run the same way on the server and in the auditor's browser.
- **The Anchor program** `empowerfi_audit`: 10 account types and 13 instructions. The rules live on chain too: eligibility needs the same borrower's CreditReady attestation, loans follow a state machine, and payments and outcomes are only possible after disbursement.
- **An anchoring pipeline** that uses the database as its queue, plus a reconciliation job that re-checks every proof against the chain and against the record as it stands.
- **Dashboards by role** with row-level security. The P2P desk sees pseudonyms and rounded indicators; investors see a decision snapshot, never identity; community leaders see capital totals, never investors.
- **Cost to serve**, counted from a community's first day at a pilot rate card, per participant, per ready participant, per opportunity, per loan and per R$ lent.
- **Productive outcomes:** what changed in a business after its loan, from the months it reported. EVC = extra profit − interest paid; EVM = EVC ÷ capital. These are observed, not caused, and labelled that way.
- **A Capital Allocation Engine** with two routes only: Domestic P2P (a simulated BRL pool, Pix) and Global P2P (test USDC on Solana, a simulated regulated off-ramp, Pix). Feasibility first — liquidity, risk appetite, ticket, mandate — then her all-in cost; deterministic reason codes, the pool persisted on each opportunity, and the same engine re-run in the browser. Global capital earns its place by the availability, mandate or economics it adds, not by being on a blockchain.

Read more: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/PRIVACY.md](docs/PRIVACY.md) · [platform/README.md](platform/README.md) (operations).

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
| `npm test` | Vitest: engines and their vectors, commitments and golden vectors, the on-chain privacy review of the IDL, capital routes, UI helpers |
| `npx supabase test db --workdir platform` | pgTAP: every role's access, the thesis, the anchoring and reconciliation queues, cost to serve, capital, outcomes, catalog-wide RBAC rules (add `--linked` to run against the remote, rolled back) |
| `cargo test -p empowerfi-audit` | the program's rules in LiteSVM |
| `deno test --allow-read platform/supabase/functions/_shared/` | the vendored engines and commitments, in the runtime that uses them |
| `npx tsx scripts/platform/scan-chain-pii.mts` | every account on devnet: reviewed types only, none of the database's personal data |

## Repository

```
src/app/                     the platform (/app): pages by role, audit screen
src/                         the public site (EN at /, PT-BR at /pt)
packages/                    readiness-engine · eligibility-engine · audit-commitments · audit-client · capital-route
programs/empowerfi-audit     the Anchor program and its tests
platform/supabase            migrations, pgTAP tests, Edge Functions
scripts/platform             demo accounts, demo scenario, zero-PII scan
docs/                        architecture and privacy
```

## The public site

Vite + React 18 + TypeScript, Tailwind and shadcn/ui, bilingual: English at `/` (with `/investors`, `/about`, `/sources`), Portuguese at `/pt`. A change to a page in one language is mirrored in the other. The investor contact form uses the `send-transactional-email` Edge Function of the website's Supabase project (root `supabase/`, kept separate from `platform/`).

Deployed on Vercel: [`vercel.json`](vercel.json) sets the Vite preset and a SPA rewrite so client-side routes (`/pt`, `/app/...`) resolve on direct load. Set the `VITE_*` variables above for Production and Preview.

| Command | |
|---|---|
| `npm run dev` | dev server, port 8080 |
| `npm run build` | production build to `dist/` |
| `npm run preview` | preview the build |
| `npm run lint` | ESLint |
