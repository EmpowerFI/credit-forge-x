# EmpowerFI on Seeker — hackathon plan

Status (27/11/2026, night): **built, in test.** PRs #190 to #198 are merged: the route, the Android shell, the wallet, voice with ElevenLabs (by hand where a voice note is unreliable), the reserve, and the read-back in Portuguese and English. Still to do on Sat 28: hear the read-back on the phone, run a second demo campaign to refill the reserve for the video, check the repository, and freeze. The summary for judges is in the README. The hackathon's rules (updated 19/11/2026): an existing project may enter, but **the improvements must be made between 27 and 29 November**. So no code for this plan is written or committed before **Fri 27/11**. **Build Fri 27 and Sat 28, frozen on the night of the 28th; Sun 29 is for the submission only** (founder, 19/11/2026). Until the 27th, only preparation that is not code (§4c). The hackathon asks for a **public repository** (credit-forge-x already is) and a **demo video**; a dApp Store listing is not required. Last revised 25/11/2026.

## 0a · An MVP on the dev database (founder, 18/11/2026)

For the hackathon this is an **MVP, not a production release**. It runs entirely on the app's **dev** Supabase project, **`boivrcjvsnrmzbregavl`**, never on production (`efylyaroluqatqmtuuml`):

- **Migrations.** The Seeker migrations are applied to dev only. Production gets them only if the founder decides to launch after the hackathon.
- **Functions and secrets.** `diary-speak-seeker` and `seeker-wallet` are deployed to dev; the changed `reward-payout`, `campaign-attest` and any other function the MVP needs are deployed to dev only. Secrets are set on dev, by name: `ELEVENLABS_API_KEY` (set 25/11). The campaign operator stays **the one devnet operator, `Ax71…UNb`**: the code pins it (`OPERATOR_WALLET` in `_shared/campaign-vault`, checked by `campaign-register`), both projects pay only on devnet, and dev has had its `CAMPAIGN_OPERATOR_*` secrets since 07/11. A wallet of dev's own would mean changing that pin, for no gain on devnet (decided 25/11, replacing "a dev operator wallet"). Production keeps its functions and secrets untouched.
- **Bringing dev up to date.** Dev was behind while everything went straight to production (04/11/2026). Day one starts by applying main's migrations to dev and deploying the existing diary functions there.
- **The app.** The Seeker deployment (Vercel project `empowerfi-seeker-dev`) points the diary's own client at dev (`VITE_DIARY_SUPABASE_URL` / `_PUBLISHABLE_KEY`) and opens `/app/seeker` with `VITE_SEEKER=1`; the production site does not set it, so `/app/seeker` there shows "not available". No diary code changes for it (27/11, replacing `VITE_SEEKER_SUPABASE_*`). The webshell wraps that deployment's URL.
- **Accounts.** Sign-ups, test accounts and the demo campaign all live in dev. Nothing of the demo can reach a real woman's diary, a real sponsor or an impact figure.

## 0 · The rule: Seeker only

Every change for the hackathon lives in the Seeker app. **The web diary (`/app/diario`) that the women use today does not change**: no new button, no new wording, no new behaviour, no new dependency in its bundle. That rule shapes everything below:

- **A route of its own.** The Seeker app is the dApp Store shell (`npx solana-mobile webshell`) around a route of its own, **`/app/seeker`**. It reuses the diary's screens and adds the Seeker-only modules: wallet connection (MWA) and ElevenLabs voice. Those modules are lazy-loaded from that route only, so the `/app/diario` bundle does not grow. A build check (`scripts/seeker-guard.ts`, a Vite plugin) walks the module graph from the diary, imports and lazy imports, and fails the build if it reaches anything under `src/app/seeker/`.
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

### 2.2b Two languages (founder, 19/11/2026)

The hackathon is international, so the Seeker voice works in **Portuguese and English**, following the language the app is set to. The diary already has both, through `tr({ en, pt })`.

- **Transcription.** Scribe gets `language_code` `pt` or `en` from the app's language. Today `transcribeRequest` fixes `pt`.
- **Reading and checks.** `_shared/spoken.ts` checks every figure against her words in Portuguese: number words, "mil", "reais", "conto". The Seeker path adds the English counterparts: number words, "thousand", "reais"/"real", "bucks". This lives behind a language argument, so the Portuguese path and the web diary's `diary-speak` behave exactly as before; their tests must stay unchanged. Amounts are still in reais.
- **Read-back.** Her two voices from the Voice Library (§4c), which the Starter plan she took on 25/11 can use through the API.
- **Plan.** **Starter**, taken by the founder on 25/11: library voices through the API and a licence for the public video.
- **Demo.** The founder records in English for the judges, plus one Portuguese moment, because the real users speak Portuguese.

### 2.3 Privacy and consent

- **Who can use it (founder, 18/11/2026).** During the hackathon the ElevenLabs voice is **for the founder and testers only**: an allow-list of accounts on the server (`diary-speak-seeker` refuses anyone else). Real entrepreneurs do not use it until the plan is chosen. Zero retention needs Enterprise.
- **Voice (founder).** English and Portuguese, two Voice Library voices she chose (§4c).
- **Consent.** Her audio goes to ElevenLabs, a processor outside Brazil, for transcription. The Seeker app says so before the first recording, in plain words, and she agrees once. The web diary's consent text does not change, since the web keeps OpenAI.
- **Retention.** ElevenLabs' **zero-retention mode is Enterprise-only** (`enable_logging=false`). On a lower plan, they log requests. Decide before launch: Enterprise or a hackathon arrangement, or accept logging with it written in the consent and in docs/PRIVACY.md.
- **What we keep.** We store the transcript and draft as today; the audio is never stored. Logs keep counts and status codes only.
- **Secrets.** A new secret on the diary project, `ELEVENLABS_API_KEY` (by name only), plus `ELEVENLABS_VOICE_ID_PT`, `ELEVENLABS_VOICE_ID_EN` and model ids (not secrets).

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
3. **Pay through.** After each `pay_reward` for her, `reward-payout` queues `withdraw_reward` at once. The money lands in the wallet on her phone with no step of hers. The 24-hour wait applies once, when the wallet is first recorded, and is the program's own safety rule.

**Order (found 25/11).** `set_payout` needs a **receipt**: only the operator of a campaign that has *already paid her* may write her destination (`SetPayout` checks `[paid, campaign, her ref]`; `diary_payout_set` refuses with `no_reward_yet`). So a wallet cannot be recorded before her first payment, and the 24 hours start only after it. Two consequences:
- `seeker-wallet` records the wallet and the automatic transfer at once; if she has no payment yet, it keeps the wallet and queues `set_payout` right after her first `pay_reward`, then `withdraw_reward` once the day has passed.
- For the demo, the payment has to exist **before Friday**, or the transfer lands on Sunday (§4a).

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

- Nothing else: two days hold the P0 and no more.

### P2 — not for the hackathon

- Store listing and submission to the dApp Store (not required by the hackathon).
- Native reminders in the shell.
- The conversational agent (§2.2.3).
- Realtime transcription: it costs more than batch.
- Any of this on the web diary.

## 4a · The demo campaign (founder, 18/11/2026; order fixed 25/11)

A reward unlocks after 30 days kept, and nothing is attested below five women, so a payout cannot happen live inside one week. The demo uses **a devnet demonstration campaign that started 29 days before it was made** (the Missions page's earliest start; the program accepts a past start as long as the end is still ahead). It has the founder's demo account and four test accounts, with their days filled in backwards. The video says plainly that it is a devnet demonstration campaign.

Because `set_payout` needs a payment first (§3.2, "Order"), the campaign is made, attested and paid **on Thursday 26/11**, with the product as it is: the Missions page and the web diary, pointed at dev. That is data, not an improvement: no code is written or committed for it, and the seed script is a throwaway in the scratchpad.

**Thursday 26/11, step by step:**
1. **Accounts.** The five demo e-mails sign in to the web diary on dev (run locally with `VITE_DIARY_SUPABASE_URL` and `VITE_DIARY_SUPABASE_PUBLISHABLE_KEY` set to dev), each says yes to the impact figures, and records today.
2. **Campaign.** On `/app/missions` (same local run, on dev), a campaign starting **28/10** (so it ends 26/11, still ahead when it is made), 100 seats at **0,10 USDC** = 10 devnet USDC, paid from a browser wallet that holds them and some SOL. `campaign-register` records it in dev.
3. **Days.** A seed, run by the founder in dev's SQL editor, fills 28/10–25/11 for the five accounts (sales and expenses, plausible and varied). Checked first: what "a day kept" is (`private.vault_cohort`, `private.campaign_progress`) so the seed writes exactly that, and that the demo accounts are ordinary accounts, not `is_simulated`.
4. **Attest and pay.** `campaign-attest` is called the same day, while the campaign is still open (pg_cron runs it daily; one call with `x-campaign-attest-secret` does it now). The run after the attestation confirms pays the five reward wallets (`pay_reward`).
5. **Destination.** On the web diary, her demo account gives the phone's Solflare address as destination (`diary_payout_set`). The 24 hours start; it is active on **Friday** at the same hour. On Friday the Seeker connects **the same wallet**: the program sees the same destination and does not restart the clock (`set_payout` is a no-op then).

Gate for Thursday night: in dev, her demo account shows a paid reward and a destination waiting for its day.

**If Thursday slips**, the same steps run first thing on Friday, and the transfer can land on Saturday afternoon only if the destination is in by about 14:00 on Friday.

## 4b · Schedule: Fri 27 → Sun 29 November

The 24-hour wait is started on Thursday (§4a), so Friday and Saturday are only the Seeker's own work. The detailed checklist is §4d.

| When | Work | Gate |
|---|---|---|
| **Fri 27, morning** | `/app/seeker` route reading `VITE_SEEKER_SUPABASE_*` (dev), and the build check that keeps it out of `/app/diario`; the separate Vercel deployment; webshell app built and installed on her Android; sign-in by e-mail code. | The app on her phone signs in to dev. |
| **Fri 27, midday** | Wallet connection (MWA + signed message), `seeker-wallet`, the additive migration (wallet, automatic transfer), deployed to dev. | Her Solflare (devnet) is recorded by the Seeker app, proven by its signature. |
| **Fri 27, afternoon** | `diary-speak-seeker` with batch Scribe, allow-list and consent text, deployed to dev. | She says a sale aloud and it becomes a draft. |
| **Sat 28, morning** | Read-back with Flash (her two voices); confirm by tap. English in transcription and in the figure checks (§2.2b), behind a language argument, with the Portuguese tests unchanged. | She says a sale in English and in Portuguese, hears each back, and confirms. |
| **Sat 28, midday** | Automatic transfer in `reward-payout` (dev): after a payment, and at once for a balance already paid when the destination is active. | The queue holds a `withdraw_reward` for her demo account, made by the automatic transfer. |
| **Sat 28, afternoon** | The transfer lands on the phone. Fixes. **Code freeze at the end of the day.** | The test USDC shows in the wallet on the phone. |
| **Sun 29** | No new features. Demo video (voice, read-back, the payout landing), README section for judges, repository checked (no secret, no personal data), submission. | Submitted. |

**Cut line.** Dropped first: the dApp Store listing and native reminders, both now out. If Friday runs late, English goes first and the demo is in Portuguese with English subtitles; then the read-back (TTS), leaving the voice as transcription only. If the transfer does not land by Saturday night, the video shows the connected wallet, the attestation and the payment transaction on the explorer, and says the transfer is the next step.

## 4c · Before the 27th: preparation that is not code

None of this is an improvement to the project; it is what lets Friday start at full speed.

**Done (25/11):**
- **ElevenLabs.** Starter plan (not free): library voices work through the API and the licence covers a public video. `ELEVENLABS_API_KEY` is set on dev, by name, restricted to Text to Speech, Speech to Text and Voices (read), with a credit cap.
- **Voices.** Portuguese `33B4UnXyTNbgLmdEDh5P`, English `RGymW84CSmfVugnA5tvA` (to confirm which is which by name on ElevenLabs before Friday). They become `ELEVENLABS_VOICE_ID_PT` and `ELEVENLABS_VOICE_ID_EN`, not secrets.
- **Phone.** Unknown sources and USB debugging on; Solflare on devnet, with devnet SOL and USDC; its address is kept out of this public repository.
- **Demo accounts.** Her demo e-mail and four test e-mails exist.
- **Operator.** No new wallet (§0a). The operator `Ax71…UNb` holds about 5 devnet SOL, enough for the demo's transactions.
- **Dev database.** Migrations through `20270115`; the diary's functions are on dev.
- **Build tools.** JDK 21, Android SDK (build-tools 35–37, platform 36), `adb`. No `cmdline-tools`: installed only if the webshell asks for `sdkmanager`.

**Thursday 26/11:** the demo campaign, §4a.

## 4d · Friday and Saturday, task by task

Each task ends in a PR on main (never stacked), merged by the founder before the next one that needs it. Migrations go to dev only, applied by her (`apply-credit-migrations.sh` with dev's `DB_URL`); functions deploy from `platform/` with `--project-ref boivrcjvsnrmzbregavl`.

### Friday 27

**F1 · The route (08:00–10:00)**
- `src/app/seeker/` with `SeekerApp.tsx`, routed at `/app/seeker` with `React.lazy`, so its chunk is separate.
- `src/app/seeker/db.ts`: a Supabase client from `VITE_SEEKER_SUPABASE_URL` / `VITE_SEEKER_SUPABASE_PUBLISHABLE_KEY`; without them the route shows "not available here". It reuses the diary's screens (Today, History, Reports) by passing them this client, with no change to how `/app/diario` builds its own.
- Build check: a script after `vite build` that reads the manifest and fails if the `/app/diario` chunk graph includes any module under `src/app/seeker/`; added to `npm run build` in CI.
- Done when: `npm run build` passes, the check fails on purpose when a diary file imports from `seeker/`, the web diary's tests are unchanged.

**F2 · Deployment and the APK (10:00–11:30)**
- A second Vercel project on the same repo, with only `VITE_SEEKER_*` (dev) set. Production's project gets nothing.
- `npx solana-mobile@0.6.0 webshell --help`, then `init` with package id `io.empowerfi.diario` and that deployment's `/app/seeker` URL; the generated Android project lives outside `src/` (`apps/seeker-shell/`), with no keystore in the repo. A debug build is enough for the demo.
- `adb install` on her phone, by cable.
- Done when: the app opens on her phone, signs in to dev with the e-mail code, and records a day.

**F3 · The wallet (11:30–14:00)**
- `@solana-mobile/wallet-standard-mobile` (0.7.x) imported only under `src/app/seeker/`; `registerMwa` with chain `solana:devnet`.
- Sign In With Solana: the app asks `seeker-wallet` for a nonce, the wallet signs the message (domain, her account, nonce, expiry), no transaction.
- Migration `…_her_phone_wallet_on_the_seeker.sql` (additive): `private.seeker_wallets` (her account, address, auto transfer, nonce, verified at) and RPCs `seeker_wallet_nonce()`, `seeker_wallet_record(address, signature, message)` through the function only.
- `seeker-wallet` (new function): checks the ed25519 signature, the nonce and its age, and that the address is a valid key; records the wallet; calls `diary_payout_set` for her if she has a payment and the destination differs; otherwise keeps it for after her first payment.
- Tests: wrong signer, old nonce, another account's nonce, same address twice.
- Done when: on the phone she connects Solflare, signs, and dev shows the wallet recorded with automatic transfer on.

**F4 · Voice in (14:00–18:00)**
- `_shared/elevenlabs.ts`: `scribeRequest(apiKey, model, audio, language)` building the `multipart/form-data` call to `POST /v1/speech-to-text` (`model_id`, `language_code`, `file`), and `readTranscript(body)`. The model id from `ELEVENLABS_STT_MODEL`, default the cheapest batch Scribe listed on the day.
- `diary-speak-seeker`: a copy of `diary-speak` that transcribes with `scribeRequest` and refuses accounts outside the allow-list (`SEEKER_VOICE_ALLOW`, e-mails, as a secret on dev) with 403; reading, checks and draft through `_shared/spoken.ts` as today.
- The Seeker's record button posts to it; a one-time consent screen ("sua voz vai para a ElevenLabs, fora do Brasil, para virar texto") stored per account.
- Tests: request builder with fetch mocked; allow-list refusal; `spoken.test.ts` unchanged.
- Done when: on the phone she says "vendi trinta reais de bolo no pix" and gets the draft.

### Saturday 28

**S1 · Voice out (08:00–10:30)**
- `ttsRequest(apiKey, voiceId, model, text)` for `POST /v1/text-to-speech/{voice_id}` with `eleven_flash_v2_5` (or the cheapest listed), `output_format` mp3 at the lowest bitrate.
- `diary-speak-seeker` returns the read-back audio (base64) with the draft; a per-account daily cap on characters. If TTS fails, the draft comes without audio.
- The Seeker plays it and shows Confirm / Discard; the tap decides.
- Done when: she hears "Entendi: venda de R$ 30,00 de bolo, no Pix. Está certo?" and confirms.

**S2 · English (10:30–12:00)**
- A `lang` argument through `diary-speak-seeker`: Scribe `language_code`, the voice, and the read-back wording from `tr({ en, pt })`.
- `_shared/spoken.ts`: English number words, "thousand", "bucks", "reais"/"real" behind `lang = "en"`; the Portuguese path byte-for-byte as before.
- Tests: new English cases; every existing Portuguese test unchanged.
- Done when: "I sold thirty reais of cake by pix" becomes the same draft.

**S3 · Automatic transfer (12:00–14:00)**
- Additive change in `reward-payout` (or a step in `campaign-attest` after `pay_reward`): for a woman with a Seeker wallet and automatic transfer on, queue `withdraw_reward` after a payment, and once at the start for a balance already paid when her destination becomes active. Nothing changes for anyone without a Seeker wallet.
- Only devnet campaigns (Missions and the demo), never mirrors.
- Tests: queued once per payment; never without opt-in; never for a mirror.
- Done when: the queue holds her `withdraw_reward` and `reward-payout` sends it.

**S4 · Landing and freeze (14:00–19:00)**
- The USDC shows in Solflare on devnet on the phone; the Seeker shows "R$ … na sua carteira" with the explorer link.
- The web diary's tests and the screenshot pass of `/app/diario` before/after (§5).
- Repository check: no key, no e-mail, no address of a real woman.
- **Code freeze at 19:00.**

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
