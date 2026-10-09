# Two repos and a reserved area — an analysis

**Written for:** the founder, and whoever builds this. Companion to [STUDY-WHATSAPP.md](STUDY-WHATSAPP.md).

The plan: a new private repo for the engines used in real life and the WhatsApp implementation; this repo stays public as the showroom, holding the frontend and the smart contracts; and a corporate entrance where approved credentials open a dashboard for ESG sponsor, community partner and entrepreneur, with investor deferred until regulation allows it.

The plan is right. Three things in it are not where they look, and one of them would quietly break the product's best claim if it were done the obvious way.

---

## 1. The dividing line is not "engines"

The instinct is to split by *what is valuable*: engines private, interface public. But the interface is not the thing that needs to be public — **the verifier is**.

What makes this product defensible is that someone outside can take a record, recompute its commitment, and check it against Solana without asking EmpowerFI for anything. That rests on exactly two packages:

- `packages/audit-commitments` — `commitment = SHA-256(domain ‖ 0x00 ‖ canonicalJson(payload))`, depending on nothing but WebCrypto, with golden vectors pinning it on both sides.
- `packages/audit-client` — the generated client for the on-chain program.

**A private verifier is not a verifier.** Those two, and `programs/empowerfi-audit`, are the hard floor of what stays public. Everything else is negotiable.

So the line is not *engines vs interface*. It is:

| Public | Private |
|---|---|
| the thing that lets a stranger check a claim | the thing that holds a real woman's data |

Which, applied, gives: the Anchor program, the verifier, the frontend, and the published model versions on one side; the schema, the edge functions, the keys, the WhatsApp layer and the calibration work in progress on the other.

---

## 2. What actually breaks if the engines move, measured

Three facts from the current tree, because the obvious version of this move breaks the build on the first commit.

**The engines are not packages. They are path aliases.** `vite.config.ts` maps `@empowerfi/readiness-engine` and the rest straight to `./packages/*/src/index.ts`, mirrored in `tsconfig.app.json`. Move the directory out and the frontend stops compiling — not because of a published-package version mismatch, but because the file is gone. Making them real published packages is a prerequisite of the split, not a consequence of it.

**The readiness engine already exists twice, kept identical by discipline alone.** `packages/readiness-engine/src/index.ts` and `platform/supabase/functions/_shared/readiness-engine/index.ts` are byte-identical today — same md5. Nothing enforces that. A split puts the two copies in two repos, and the discipline that has held so far is one distracted afternoon from failing. When it fails, the browser explains a score the server did not compute.

**The audit console does not recompute the engine — and that is good news.** `readiness-evaluate` says it outright: the engine runs in the Edge Function, *never in the browser*. What the browser recomputes is the commitment hash. So moving an engine private does **not** break the proof.

What it does break is smaller and still real: `src/app/pages/audit/Models.tsx` imports `RULES` and `MODEL_VERSION` from both engines and publishes the thresholds on screen. That page is a transparency feature, not a proof. If the engines go private, it goes dark.

---

## 3. The rule that keeps the audit claim honest

You already decided the shape of this: model v1 stays public, calibration happens privately. That is the right split, and it needs one rule to stay true.

> **A model version that produced an anchored record must be publicly readable.**

Calibrate in private for as long as you like. The moment a version starts producing assessments that get committed to a chain, publish it. Otherwise the Models page shows v1's thresholds beside records that v2 produced, and a visitor who checks the arithmetic finds it does not reproduce — which is worse than having no Models page at all, because the page is an invitation to check.

This costs nothing you wanted to keep. The moat is the *next* calibration and the data behind it, not the one already deciding people's assessments. And the records carry `model_version` already, so the mapping from record to published model is a lookup rather than a promise.

---

## 4. The dependency points one way

The instinct is for the private repo to be the trunk and the public repo a published slice of it. Invert that.

```
   public repo  ──────────────┐   (the Anchor program, the verifier,
   the published artefacts    │    the published engine versions,
                              │    the frontend)
                              ▼
   private repo  ────── depends on the public packages
   (schema, edge functions, WhatsApp, calibration, keys)
```

Private depends on public; public depends on nothing private. Two things follow, and both are worth the inversion on their own:

- **The public repo never has a hole in it.** It builds, its tests run, and a visitor can read it end to end — which is the whole point of a showroom.
- **The duplicate engine problem resolves itself.** The edge functions stop carrying a copy of the readiness engine and import the published package, the way the frontend does. Two copies become one source, and the drift risk in §2 disappears rather than doubling.

Publish through a private npm registry or GitHub Packages; for the public ones, publishing them properly is also what lets anyone else verify a record.

---

## 5. The corporate area mostly exists

This is the good news in the plan, and it is bigger than it looks. The reserved area is not a thing to build. It is this:

| What the plan asks for | What exists today |
|---|---|
| credentialed entry | Supabase auth, `RequireAuth`, per-route role gates |
| a dashboard per role | sponsor, community leader, entrepreneur, partner, admin, auditor — all built |
| each role sees only its own | row-level security, with `rbac.test.sql` holding every security-definer function to pinning `search_path` and refusing `anon` |
| ESG sponsor dashboard | Impact Intelligence, including the sponsorship layer |
| community partner dashboard | Community operations, six views |
| no investor | one line: drop the `capital_provider` role from the entry points |

What is actually left is **account approval and real authentication** — turning "a demo persona anyone can enter as" into "an organisation we approved". That is an admin queue and a sign-up flow, not a product.

Call it a week, plus the item in §6, which is the one that matters.

---

## 6. The demo doors must not exist in production

This is the single biggest risk in the plan, and it comes from the thing that makes the showroom good.

The demo is deliberately open: `DEMO_PASSWORD = "EmpowerFI-demo-2026"` is in the source on purpose, `isDemoAccount()` switches a visitor to any persona in one click, the login page lists persona chips, and the Oversight line opens admin and the audit console. That is correct for a showroom and it appears in 43 places across `src` and `scripts`.

One codebase will now serve two deployments: one that is a public showroom with a published password, and one that holds real women's revenue and household figures.

**A runtime check is not enough.** `if (isDemo)` is a line someone can get wrong, a flag someone can flip, and an env var someone can forget in a new environment. The demo entrances should be excluded at build time — a Vite define that compiles them out, so the production bundle does not contain the password, the persona switcher, or the one-click admin door at all. Then "is the demo door open in production?" is answerable by grepping the built asset, which is a test you can run, rather than by reasoning about state.

The second control is the database, and it already exists: the demo personas should simply not be rows in the production instance. Two Supabase projects, not one with a flag.

---

## 7. The entrepreneur does not belong behind a corporate login

The three dashboards in the plan are ESG sponsor, community partner and entrepreneur. The first two are organisations with staff, and credentials are the natural shape for them.

The third contradicts the decision in the WhatsApp study. The whole reason for moving the entry point is that asking her to learn an app is what produced 10% conversion. Putting her behind a corporate login with approved credentials asks for the same thing again, in a heavier wrapper.

Her surface should stay what the other study describes: **WhatsApp, plus a report at a signed link that opens without a login.** That is not a lesser version of a dashboard; it is the correct one for someone whose business is on her phone between customers. If she later wants more — her history, her readiness over time — that page can grow behind the same signed link, and still no password.

This also shrinks §5: two dashboards to credential, not three.

---

## 8. Deferring investor leaves a gap the showroom does not have

Deferring the investor console until regulation allows it is right, and it is the only part of the plan with a consequence that is easy to miss.

The showroom tells one complete economic loop: a sponsor funds a cohort, evidence qualifies credit, investors fund it, she repays, the outcome returns to the sponsor. The live product, without investors, has no funding counterparty — so the loop stops at a qualified opportunity that nothing fills.

That is fine, and the repo already carries the sentence that makes it fine: *"Prototype of a future regulated P2P productive-credit architecture."* The point is that the sentence now has to do more work than it did during the hackathon, because the gap between what the showroom demonstrates and what the live service does has gone from "simulated data" to "a stage that does not exist yet". Say which parts are live when you point a real sponsor or a real community at it.

---

## 9. CI stops being optional

There is no CI in this repo — no `.github/workflows` at all. During a hackathon that is a defensible trade. With two repos, real data and a published package boundary between them, it is the thing that will cost you a bad afternoon.

Three gates, in this order:

1. **Public repo:** typecheck, unit tests, the engines' golden vectors, and a build. The vectors matter most — they are what stops a calibration change from silently altering published behaviour.
2. **Private repo:** pgTAP, including `rbac.test.sql`. It is catalogue-driven, so it automatically holds any *new* security-definer function to pinning `search_path` and refusing `anon`. That property is worth more with real data than it ever was with simulated data, and it only pays if it runs on every change.
3. **Both:** a check that the private repo's installed version of each public package matches a published one, so the two sides cannot drift unnoticed.

---

## 10. Sequence

Roughly, and in dependency order rather than importance:

1. **Publish the packages** — `audit-commitments`, `audit-client`, and the engine versions currently in production. Replace the vite aliases with real dependencies, and delete the duplicated engine under `_shared`. *(~3 days, and nothing else can start cleanly before it.)*
2. **Create the private repo** and move `platform/` into it with history, using `git filter-repo` rather than copying files. A credit model's history is the record of how it evolved, and it is worth more than the hour it costs to keep. *(~1 day.)*
3. **CI on both**, as §9. *(~2 days.)*
4. **Compile the demo doors out**, and split the Supabase projects so the production instance has no demo personas. *(~3 days.)*
5. **Account approval and real auth** for the two organisational dashboards. *(~1 week.)*
6. **The WhatsApp layer**, in the private repo, per the other study. *(8–9 weeks.)*

Steps 1 to 5 are roughly two to three weeks, and they are the ones that have to happen before real data arrives rather than after.
