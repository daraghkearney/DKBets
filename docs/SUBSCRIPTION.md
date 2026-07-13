# DKBets subscriptions (Clerk + Stripe)

DKBets uses [Clerk Billing](https://clerk.com/docs/guides/billing) for B2C subscriptions. Stripe handles payments; plans are managed in the Clerk Dashboard (not Stripe Billing directly).

## 1. Clerk setup

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com).
2. Enable **Billing** → connect your Stripe account.
3. Create a user plan:
   - **Slug:** `pro` (must match `PRO_PLAN_SLUG` in `src/lib/subscription/config.ts`)
   - **Price:** £24.99/month (optional £199/year)
   - **Trial:** 7 days (recommended)
4. Add features to the plan (optional granular gates):
   - `full_access`
   - `football_builder`
   - `football_props`
   - `football_stats`
   - `racing_intel`
   - `racing_analysis`
   - `nba_props`

## 2. Environment variables

Copy `.env.example` to `.env.local` for development:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_SUBSCRIPTION_ENABLED=true
```

For GitHub Actions (Settings → Secrets):

- `CLERK_PUBLISHABLE_KEY` → maps to `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in workflow
- Set `NEXT_PUBLIC_SUBSCRIPTION_ENABLED=true` in the deploy workflow when ready

Until `NEXT_PUBLIC_SUBSCRIPTION_ENABLED=true`, **all content stays free** (safe for existing deploys).

## 3. Local development

```bash
npm run dev
```

Visit `/subscribe/` for the Clerk `<PricingTable />`. Sign in at `/sign-in/`.

## 4. What is gated (Pro)

| Area | Free | Pro |
|------|------|-----|
| World Cup matchups / fixtures | ✓ | ✓ |
| Bet365 builder | — | ✓ |
| Star players / team model / stats | — | ✓ |
| Racecards (top pick per race) | ✓ | ✓ |
| Full runner model + value edges | — | ✓ |
| Value naps + performance ledger | — | ✓ |
| Deep analysis + tipster intel | — | ✓ |
| NBA prop builder | — | ✓ |

## 5. Static export note (GitHub Pages)

This site uses `output: "export"`. Auth uses `@clerk/nextjs/static` (client-side). Premium JSON in `public/data/` is still publicly fetchable — the gate is a **soft paywall** on the UI. For hard protection of data, migrate premium exports to API routes on Vercel (see future `BUILD_MODE=server`).

## 6. Pricing reference

Configured in `src/lib/subscription/config.ts`:

- Intro: £14.99/mo
- Standard: £24.99/mo
- Annual: £199/yr

Match these in the Clerk Dashboard pricing table.
