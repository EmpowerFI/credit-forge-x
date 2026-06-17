# EmpowerFI — Landing Page

Marketing/investor landing page for **EmpowerFI**, financial infrastructure for
Brazilian women micro-entrepreneurs (MEIs).

EmpowerFI connects women micro-entrepreneurs to new clients and to each other,
builds the financial history banks never recognized, and unlocks access to
credit and impact capital. It's global financial infrastructure (Solana,
tokenized RWA backed by Brazilian Treasury) with a phased rollout starting in
Brazil. The marketplace product is live on Google Play.

The page is **bilingual** and aimed primarily at investors and strategic
partners, secondarily at entrepreneurs who may download the app.

- **PT-BR** (default): [`/`](/)
- **EN**: [`/en`](/en)

## Tech stack

- [Vite](https://vitejs.dev/) + React 18 + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (Radix primitives)
- [React Router](https://reactrouter.com/) for routing
- [TanStack Query](https://tanstack.com/query) for data fetching
- [Supabase](https://supabase.com/) — Edge Function (`send-transactional-email`) powers the investor contact form
- [Vitest](https://vitest.dev/) for tests

## Getting started

Requires Node.js 18+ (Node 20 recommended).

```bash
npm install        # install dependencies
npm run dev        # start the dev server at http://localhost:8080
```

### Scripts

| Command            | Description                                  |
| ------------------ | -------------------------------------------- |
| `npm run dev`      | Start the Vite dev server (port 8080)        |
| `npm run build`    | Production build to `dist/`                  |
| `npm run preview`  | Preview the production build locally         |
| `npm run lint`     | Run ESLint                                   |
| `npm run test`     | Run the Vitest suite once                    |

## Environment variables

Build-time variables (prefixed `VITE_`, baked into the client bundle). These are
public-safe Supabase values — the publishable key is the anon key.

| Variable                        | Description                          |
| ------------------------------- | ------------------------------------ |
| `VITE_SUPABASE_URL`             | Supabase project URL                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon / publishable key      |
| `VITE_SUPABASE_PROJECT_ID`      | Supabase project id                  |

A `.env` with these values is included for local development. The contact form
also requires the `send-transactional-email` Edge Function to be deployed to the
Supabase project and the sender domain (`notify.empowerfi.io`) verified.

## Project structure

```
src/
  pages/            Index.tsx (PT-BR /) · IndexEn.tsx (EN /en) · NotFound · Unsubscribe
  components/       PT-BR sections (Hero, Problem, HowItWorks, Differential, Traction, CTA, Footer)
    en/             EN mirrors of every section — keep both languages in sync
    ui/             shadcn/ui primitives
  config/links.ts   Shared external links (Play Store, socials, contact emails)
  index.css         Design tokens (brand palette: navy primary + amber accent)
supabase/functions/ send-transactional-email Edge Function + email templates
```

> **Bilingual rule:** every change to a PT-BR section must be mirrored in its
> `components/en/` counterpart, and vice versa.

Before going live, confirm the placeholder in [`src/config/links.ts`](src/config/links.ts):
`PLAY_STORE_URL` points to the live Google Play listing.

## Deploying to Vercel

The repo includes [`vercel.json`](vercel.json), which sets the Vite framework
preset and a SPA rewrite so client-side routes (`/en`, `/unsubscribe`) resolve
on direct load / refresh.

### Option A — Vercel dashboard

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Vercel, **Add New → Project** and import the repo.
3. Framework preset, build command (`npm run build`), and output dir (`dist`)
   are detected from `vercel.json` — leave the defaults.
4. Under **Settings → Environment Variables**, add the three `VITE_*` variables
   above (Production + Preview).
5. **Deploy.**

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel            # preview deployment
vercel --prod     # production deployment
```

Add the env vars once with `vercel env add VITE_SUPABASE_URL` (repeat for each),
or set them in the dashboard.
