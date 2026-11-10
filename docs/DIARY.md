# The EmpowerFI diary

The diary is the entrepreneur's daily financial record. It is free, on the web at **[www.empowerfi.io/app/diario](https://www.empowerfi.io/app/diario)**, and installable as an app on the phone (a PWA). Since 5 November 2026 it is the only channel: the WhatsApp check-in and the store apps came before it ([STUDY-WHATSAPP.md](STUDY-WHATSAPP.md) is kept as history).

**Real data, a separate database.** The diary has its own client (`src/app/diary/db.ts`, `VITE_DIARY_SUPABASE_URL` and `VITE_DIARY_SUPABASE_PUBLISHABLE_KEY`) pointed at the app's production database. The rest of the platform, the showroom, stays on its own project with simulated data, so real figures never land there. A build that points the diary at the showroom shows "the diary is not open here yet".

## What she sees

| Screen | Route | What |
|---|---|---|
| **Sign in** | `/app/diario/entrar` | A 6-digit code sent to her e-mail. An account of the EmpowerFI app is reused. |
| **Today** | `/app/diario` | *I sold or spent*, one item at a time, by typing or by voice (`diary-speak` turns what she says into a draft she confirms); paid now, later or in instalments. *No activity?* records a quiet day in one tap. Then, in order: **Your month** (sales, business expenses, her monthly salary and the profit so far), the day's summary, **Your week**, the latest weekly reading, and the campaigns open to her. |
| **History** | `/app/diario/historico` | The days she recorded, with corrections and voids, her Missions rewards and all her weekly readings. |
| **Sponsors** | `/app/diario/patrocinadores` | *Who supports you*: the sponsors of the **real** campaigns running today that she is in, one tile each, the logo (or the name) opening the sponsor's page in a new tab. Devnet campaigns never show here; the dashboard sets which campaigns are real ([MISSIONS.md](MISSIONS.md)). |
| **Reminders** | `/app/diario/lembretes` | The days her business opens, the reminder's time (a Web Push notification, sent only on those days), the impact-figures consent, the AI reading choice, the tutorial and deleting her account. |

- **Her monthly salary.** The month card asks *Coloque aqui o seu salário mensal* once (she can leave it for later) and the profit is what is left after the expenses and that salary. A day's share of it is counted only on the days her business opens.
- **The weekly reading.** When a week closes with at least three days kept, `diary-reading` writes a short reading the next time she opens the diary: by AI only if she agreed, its figures checked against hers one by one, and fixed sentences otherwise.
- **The tutorial.** A carousel of screenshots of the diary itself (`tour-steps.ts`), shown once and reopened from Reminders. Retake the pictures whenever a screen changes: `scripts/diary/tour-shots.mjs` answers every call itself, so it needs no account and no network.
- **Offline.** Items she noted but has not saved stay on the phone (`localStorage`) until she confirms them.

## Campaigns and sponsors

- A campaign is a `programs` row of a sponsor. She is in one through `program_participants` (by e-mail) or, for a published Missions campaign, by sharing her impact figures. The house campaign, EmpowerFI's own, has no end.
- Sponsors see only group totals, never her name: every count obeys the floor of five women. Their reserved area is `/impacto`.
- **Real or devnet** (`programs.is_real`): only real campaigns put a sponsor in her Sponsors tab. Dashboard campaigns start real; Missions campaigns start devnet.
- Missions pays a reward into a wallet that is hers on chain once she keeps 30 days: [MISSIONS.md](MISSIONS.md).

## Where things are

| Piece | Where |
|---|---|
| Screens | `src/app/diary/` (`DiaryApp.tsx` holds the routes and the tab bar) |
| Calls | `src/app/diary/diary.ts`: one function per `diary_*` database function (`diary_profile`, `diary_record`, `diary_history`, `diary_month`, `diary_monthly_need_set`, `diary_readings`, `diary_sponsors`, …) |
| Edge Functions | `diary-speak` (voice or text into a draft), `diary-reading` (the weekly reading), `diary-push` (reminders, by pg_cron every fifteen minutes) |
| Push keys | `scripts/diary/generate-push-keys.mts`, once per environment. Never regenerate them: every phone's subscription would stop. |
| Tests | `src/app/diary/diary.test.ts`; the database functions in the migrations' pgTAP suite |
