# EmpowerFI on Seeker — hackathon plan

Status: **planned, not started.** Build window **Thu 19/11 → Fri 27/11/2026**: seven working days, plus the weekend if needed (founder, 18/11/2026). The hackathon asks for a **public repository** (credit-forge-x already is) and a **demo video**; a dApp Store listing is not required. Last revised 18/11/2026.

## 0a · An MVP on the dev database (founder, 18/11/2026)

For the hackathon this is an **MVP, not a production release**. It runs entirely on the app's **dev** Supabase project, **`boivrcjvsnrmzbregavl`**, never on production (`efylyaroluqatqmtuuml`):

- **Migrations.** The Seeker migrations are applied to dev only. Production gets them only if the founder decides to launch after the hackathon.
- **Functions and secrets.** `diary-speak-seeker` and `seeker-wallet` are deployed to dev; the changed `reward-payout`, `campaign-attest` and any other function the MVP needs are deployed to dev only. Secrets are set on dev, by name: `ELEVENLABS_API_KEY`, and a **dev operator wallet** for devnet, separate from production's. Production keeps its functions and secrets untouched.
- **Bringing dev up to date.** Dev was behind while everything went straight to production (04/11/2026). Day one starts by applying main's migrations to dev and deploying the existing diary functions there.
- **The app.** `/app/seeker` reads its own variables, `VITE_SEEKER_SUPABASE_URL` and `VITE_SEEKER_SUPABASE_PUBLISHABLE_KEY`, pointing at dev. A separate Vercel deployment sets them; the production site does not, so `/app/seeker` there shows "not available". The webshell wraps that separate deployment's URL.
- **Accounts.** Sign-ups, test accounts and the demo campaign all live in dev. Nothing of the demo can reach a real woman's diary, a real sponsor or an impact figure.

## 0 · The rule: Seeker only

Every change for the hackathon lives in the Seeker app. **The web diary (`/app/diario`) that the women use today does not change**: no new button, no new wording, no new behaviour, no new dependency in its bundle. That rule shapes everything below:

- **A route of its own.** The Seeker app is the dApp Store shell (`npx solana-mobile webshell`) around a route of its own, **`/app/seeker`**. It reuses the diary's screens and adds the Seeker-only modules: wallet connection (MWA) and ElevenLabs voice. Those modules are lazy-loaded from that route only, so the `/app/diario` bundle does not grow. A route-level check fails the build if the `/app/diario` chunk imports anything under `src/app/seeker/`.
- **New server code, not changed server code.** Only new Edge Functions: `diary-speak-seeker` and `seeker-wallet`. `diary-speak`, `reward-payout` and the rest keep their behaviour. If `reward-payout` needs a hook (§3), it is additive and does nothing for a woman who never used the Seeker app.
- **Additive migrations.** New tables, columns with defaults and new RPCs only. No existing function changes what it returns to the web diary.
- **Same account, same data.** She signs in with the same e-mail OTP. Her days, drafts and rewards are the same rows. A sale she records by voice on the Seeker shows on the web diary as any sale would; that is data, not a change to the web app.
- **Proof.** The web diary's tests and a screenshot pass of `/app/diario` run before and after. Both must be unchanged.

## 1 · The Seeker app (from the 14/11 evaluation)

- **Packaging.** The shell is `npx solana-mobile@latest webshell init/build`, a WebView, not a TWA, which breaks MWA. Package id `io.empowerfi.diario`; it cannot change later. The keystore is hers, made and kept outside the repo.
- **Store policy.** The Seeker dApp is the only store app: no Play Store, no App Store. Every other phone keeps the web diary (PWA).
- **Reviewers.** The diary stays open to sign-ups inside the app, so reviewers can get in. The waitlist is the site's only.
- **Testing.** There is no Seeker to test on: everything is tested on her Android phone, with the APK installed by hand and Phantom or Solflare as the wallet. Seed Vault Wallet exists only on Seeker, so it is not tested; MWA is the same standard, which is the bet. The listing and the demo say it was tested on Android.
- **Publishing:**
  - publisher KYC/KYB;
  - a fresh publisher wallet with a little mainnet SOL;
  - store assets: banner 1200×600, 4–8 screenshots at 9:16 and ≥1080 px, short description ≤ 50 characters;
  - developer agreement read;
  - review takes 3–4 business days;
  - the listing says plainly that the on-chain reward is a devnet test.
- **Open risk.** Web Push reminders are not documented in the shell. It may need native notifications, or it ships without reminders.

## 2 · Sales and expenses by voice, with ElevenLabs

### 2.1 What exists

The web diary already takes a voice note (`diary-speak`):
- OpenAI `gpt-4o-mini-transcribe` transcribes it, holding the audio in memory only.
- Claude (`_shared/spoken.ts`) proposes the lines, quoting her words, and code checks every figure against what she said.
- She confirms or discards the draft (`diary_draft_decide`). Nothing reaches her journal until she confirms.
- Limits: 2 MB of audio, 20 drafts a day.

### 2.2 What ElevenLabs adds, on the Seeker only

1. **Hearing her: ElevenLabs Speech to Text (Scribe).**
   - `diary-speak-seeker` is a copy of `diary-speak` whose transcription step calls ElevenLabs instead of OpenAI. Language is fixed to Portuguese, which removes language-detection errors on short notes.
   - The reading, the figure checks, the draft and the confirmation are the same shared code (`_shared/spoken.ts`), so a sale is read the same way on both.
   - Model: **the cheapest** (founder, 18/11/2026). That is batch Scribe for a voice note, never realtime, which costs more; about $0.20 per audio hour on ElevenLabs' price page. On 23/11, pick the cheapest batch id on elevenlabs.io/pricing/api (`scribe_v2` or `scribe_v3`, listed at the same price) and keep it in an env var, as `OPENAI_TRANSCRIBE_MODEL` is.
2. **Answering her aloud: ElevenLabs Text to Speech.**
   - After the draft, the app reads it back: "Entendi: venda de R$ 30,00 de bolo, no dinheiro. Está certo?"
   - She still confirms by tapping Confirm / Discard: the voice informs and the tap decides.
   - This is the part that matters for women who read with difficulty, and the hackathon demo moment.
   - Model: **the cheapest, Flash** (`eleven_flash_v2_5` unless a cheaper one is listed on 23/11). It is about half the price per character of Multilingual, and also the fastest. Use a Brazilian Portuguese voice from the voice library.
   - The function returns the audio with the draft, or streams it. The API key never reaches the phone.
3. **Talking it through (P2, only if P0/P1 are done): an ElevenLabs conversational agent.**
   - The end-of-day check-in asks: "Quanto você vendeu hoje? E gastou com o quê?"
   - Its output must still become a draft she confirms. The agent never writes to her journal.

### 2.3 Privacy and consent

- **Who can use it (founder, 18/11/2026).** During the hackathon the ElevenLabs voice is **for the founder and testers only**: an allow-list of accounts on the server (`diary-speak-seeker` refuses anyone else). Real entrepreneurs do not use it until the plan is chosen. Zero retention needs Enterprise.
- **Voice (founder).** A female Brazilian Portuguese voice: three candidates from the library to hear on day one, and she picks one.
- **Consent.** Her audio goes to ElevenLabs, a processor outside Brazil, for transcription. The Seeker app says so before the first recording, in plain words, and she agrees once. The web diary's consent text does not change, since the web keeps OpenAI.
- **Retention.** ElevenLabs' **zero-retention mode is Enterprise-only** (`enable_logging=false`). On a lower plan, they log requests. Decide before launch: Enterprise or a hackathon arrangement, or accept logging with it written in the consent and in docs/PRIVACY.md.
- **What we keep.** We store the transcript and draft as today; the audio is never stored. Logs keep counts and status codes only.
- **Secrets.** A new secret on the diary project, `ELEVENLABS_API_KEY` (by name only), plus an optional `ELEVENLABS_VOICE_ID` and model ids.

### 2.4 Cost and limits

- The same 20 drafts a day and 2 MB per note.
- Read-back audio is short, two sentences.
- A per-account daily cap on TTS characters.
- If ElevenLabs fails, the Seeker app falls back to the text draft without voice. Transcription failure shows the same "não consegui ouvir" as today.

## 3 · The reward goes straight to the wallet on her phone

### 3.1 Today

- The program pays her share into **her reward wallet**, an address of the program keyed by an opaque reference, with no private key (`pay_reward`).
- From there it goes to one destination only. A new destination waits **24 hours** (`set_payout`, `PAYOUT_DELAY`).
- She asks to move it out (`withdraw_reward`).
- On the web she pastes a devnet address, and that stays as it is.

### 3.2 On the Seeker

1. **Connect.** She connects the wallet on her phone with Mobile Wallet Adapter (`@solana-mobile/wallet-standard-mobile`, `registerMwa`, chain `solana:devnet`). She proves the wallet is hers by signing a short message (Sign In With Solana); no transaction.
2. **Record.** `seeker-wallet` checks the signature and records that wallet as her payout destination (`set_payout`) and her choice of **automatic transfer**.
3. **Pay through.** After each `pay_reward` for her, `reward-payout` queues `withdraw_reward` at once. The money lands in the wallet on her phone with no step of hers. The 24-hour wait applies once, when the wallet is first connected, and is the program's own safety rule.

**No program change.** Paying her public key directly from `pay_reward` would need a redeploy and a new program id. It would also put her own key in the attested payment instead of the opaque reference. The two-step path keeps the audit model, and the automatic transfer gives the same experience.

### 3.3 Decisions before building

- **Which campaigns pay through to the phone? Decided (founder, 18/11/2026): devnet campaigns only** (Missions and the demo campaign). Mirrored real campaigns (20270109) keep their test payouts hidden and never pay through to the phone.
- **Devnet in the wallet.** Phones' wallets default to mainnet, so she sees devnet USDC only with the wallet set to devnet. Check how Seed Vault Wallet, Phantom and Solflare show devnet tokens. This is the main demo risk.
- **The token account at her wallet.** The operator pays the rent for her destination's USDC account, as today.

## 4 · Backlog

### P0 — the hackathon demo does not exist without these

1. `/app/seeker` route that reuses the diary screens; Seeker-only modules lazy-loaded; the build check that keeps them out of `/app/diario`.
2. The webshell app built and installed on her Android: sign-in by e-mail code, recording a day.
3. `diary-speak-seeker` with ElevenLabs Scribe, plus consent text.
4. Spoken read-back of the draft (ElevenLabs TTS), with confirmation by tap.
5. Wallet connection (MWA + signed message), `seeker-wallet`, automatic transfer after `pay_reward`, all on devnet.
6. End to end on devnet: a campaign whose vault is filled, her days attested, the reward paid, landing in the wallet on the phone.

### P1 — ships if the schedule holds

- Store listing and submission to the dApp Store (not required by the hackathon).
- Native reminders in the shell, if Web Push does not work there.

### P2 — not for the hackathon

- The conversational agent (§2.2.3).
- Realtime transcription: it costs more than batch.
- Any of this on the web diary.

## 4a · The demo campaign (founder, 18/11/2026)

A reward unlocks after 30 days kept, and nothing is attested below five women, so a payout cannot happen live inside one week. The demo uses **a devnet demonstration campaign that started 30+ days before the demo**: the program accepts a past start, as long as the end is still ahead. It has the founder and at least four test accounts, with their days filled in backwards. The video says plainly that it is a devnet demonstration campaign.

Everything is seeded in **dev** (§0a), so the demo accounts never touch production. Check on day one, before seeding:
- whether `private.vault_cohort` and the attestation admit accounts flagged `is_simulated`. In dev, the demo accounts can simply be ordinary accounts, which is the simplest path;
- the founder's demo account in dev is separate from her real diary in production.

## 4b · Schedule: Thu 19 → Fri 27 November

| Day | Work | Gate at the end of the day |
|---|---|---|
| **Thu 19** | Dev brought up to date (§0a: migrations by her, diary functions deployed to dev); the separate Vercel deployment for `/app/seeker` pointing at dev; `/app/seeker` route and the build check that keeps it out of `/app/diario`; webshell app built and installed on her Android; sign-in by e-mail code; check Web Push in the shell. | The APK on her phone signs in and records a day; the web diary is unchanged. |
| **Fri 20** | `diary-speak-seeker` with batch Scribe, allow-list, consent text; three voices to hear; secret `ELEVENLABS_API_KEY` set by her **on dev**. | She says a sale aloud and it becomes a draft. |
| **Sat 21 – Sun 22** | Optional buffer. | — |
| **Mon 23** | Read-back with Flash in the chosen voice; confirm by tap. The dev operator wallet funded with devnet SOL and USDC; the demo campaign created on devnet (past start), its accounts and their days seeded in dev. | She hears the draft back and confirms it. |
| **Tue 24** | Wallet connection (MWA + signed message), `seeker-wallet`, the additive migration, the automatic transfer in `reward-payout`. **Connect the demo wallet on Tuesday:** the program's 24-hour wait is then over by Wednesday. | Her Phantom/Solflare (devnet) is recorded as destination. |
| **Wed 25** | End to end on devnet: attestation of the demo campaign, the reward paid, arriving in the wallet on her phone. Fixes. | The test USDC shows in the wallet on the phone. |
| **Thu 26** | Demo video recorded (voice, read-back, the payout landing), README section for judges, repository clean (no secret, no personal data). | The video is cut. |
| **Fri 27** | Submission. Optional: the dApp Store submission, not required by the hackathon. | Submitted. |

Cut line: if Tuesday slips, the read-back (TTS) moves after the wallet; if Wednesday slips, Thursday morning finishes the payout and the video is recorded in the afternoon. The store listing is the first thing dropped.

## 5 · Tests

- **Voice:**
  - `_shared/spoken.ts` tests unchanged and passing;
  - new tests for the ElevenLabs request builders, with fetch mocked;
  - five real Portuguese notes (sale, expense, two lines, a figure said in words, noise) through both providers, compared.
- **Wallet:**
  - signature verification: wrong signer, old message, another account;
  - the automatic transfer queued once per payment, never for someone who did not opt in;
  - on a local validator, `pay_reward` then `withdraw_reward` to a phone-held key.
- **Web unchanged:** the web diary's test suite and the `/app/diario` bundle check before and after; a screenshot pass of Today, Reports and Rewards.

## 6 · Open questions for the founder

- The ElevenLabs plan before real entrepreneurs use the voice (zero retention needs Enterprise).
