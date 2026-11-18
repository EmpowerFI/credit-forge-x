# EmpowerFI on Seeker — hackathon plan

Status: **planned, not started.** Work starts when the hackathon begins (founder, 14/11/2026). Last revised 18/11/2026.

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
- **Testing.** She has an Android phone, not a Seeker. Test with Phantom and Solflare on it, and on a Seeker if one can be borrowed.
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
   - Model: the batch Scribe model for a voice note. Today `scribe_v2`; a newer realtime `scribe_v2_realtime` / `scribe_v3_live` exists. Pin the model id from the live API reference when work starts, and keep it in an env var as `OPENAI_TRANSCRIBE_MODEL` is.
2. **Answering her aloud: ElevenLabs Text to Speech.**
   - After the draft, the app reads it back: "Entendi: venda de R$ 30,00 de bolo, no dinheiro. Está certo?"
   - She still confirms by tapping Confirm / Discard: the voice informs and the tap decides.
   - This is the part that matters for women who read with difficulty, and the hackathon demo moment.
   - Model: Flash, for low latency, with a Brazilian Portuguese voice chosen by the founder in the voice library.
   - The function returns the audio with the draft, or streams it. The API key never reaches the phone.
3. **Talking it through (P2, only if P0/P1 are done): an ElevenLabs conversational agent.**
   - The end-of-day check-in asks: "Quanto você vendeu hoje? E gastou com o quê?"
   - Its output must still become a draft she confirms. The agent never writes to her journal.

### 2.3 Privacy and consent

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

- **Which campaigns pay through to the phone?**
  - **Recommended:** devnet campaigns (Missions and the hackathon's) pay through.
  - **Mirrored real campaigns** (20270109): their test payouts are hidden in the diary so test money never looks like her real reward. Sending them to the phone would show test USDC in her personal wallet. Recommendation: not for mirrors, or only with the wallet labelled "USDC de teste (devnet)".
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

- Store listing and submission to the dApp Store.
- Native reminders in the shell, if Web Push does not work there.
- ElevenLabs realtime transcription (words appear while she speaks).

### P2 — not for the hackathon

- The conversational agent (§2.2.3).
- Any of this on the web diary.

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

- The hackathon's dates and tracks, which set the schedule.
- The ElevenLabs plan (zero retention needs Enterprise) and the voice for the read-back.
- Mirrored real campaigns paying through to the phone, as test money: yes or no (§3.3).
- Whether a Seeker can be borrowed for testing.
