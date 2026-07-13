# DKBets subscriptions (Clerk + Stripe)

DKBets uses [Clerk Billing](https://clerk.com/docs/guides/billing) for B2C subscriptions. Stripe handles payments; plans are managed in the Clerk Dashboard (not Stripe Billing directly).

## 1. Clerk Dashboard (step-by-step)

### A. Create the app

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) → **Create application** → name it `DKBets`.
2. Copy your keys from **Configure → API keys**:
   - Publishable key (`pk_test_...` or `pk_live_...`)
   - Secret key (`sk_test_...` or `sk_live_...`)

### B. Enable billing + Stripe

1. Open [Billing → Settings](https://dashboard.clerk.com/last-active?path=billing/settings).
2. Toggle billing **on** and connect your Stripe account (test mode is fine for dev).

### C. Create the Pro plan (Users tab — important)

Plans must be under **Plans for Users**, not Organizations. Wrong tab = empty `<PricingTable />`.

1. Open [Billing → Plans](https://dashboard.clerk.com/last-active?path=billing/plans).
2. Select the **Plans for Users** tab → **Add plan**.
3. Set:
   - **Name:** DKBets Pro
   - **Slug:** `pro` (must match `PRO_PLAN_SLUG` in `src/lib/subscription/config.ts`)
   - **Price:** £24.99/month
   - **Trial:** 7 days (optional)
   - **Publicly available:** on (so it appears in `<PricingTable />`)
4. Optional: add an annual price at £199/year on the same plan.

### D. Add features to the `pro` plan

Open the `pro` plan → **Features** → **Add feature** for each slug (lowercase, exact match):

| Slug | Gates |
|------|-------|
| `full_access` | Unlocks everything (fallback) |
| `football_builder` | World Cup Bet365 builder |
| `football_props` | Star players, team model |
| `football_stats` | Stats hub |
| `racing_intel` | Tipsters, naps, performance, learning |
| `racing_analysis` | Deep analysis pages |
| `nba_props` | NBA prop builder |

`usePremiumAccess()` checks `has({ plan: 'pro' })` first, then `full_access`, then the specific feature slug.

### E. Allowed origins (required for auth)

In **Configure → Domains**, add:

- `http://localhost:3000` (local dev)
- `https://daraghkearney.github.io` (GitHub Pages — adjust if using a custom domain)

Paths are handled by the app; Clerk only needs the origin.

## 2. Environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_SUBSCRIPTION_ENABLED=true
```

For GitHub Actions → repo **Settings → Secrets → Actions**:

| Secret | Purpose |
|--------|---------|
| `CLERK_PUBLISHABLE_KEY` | Baked into static build as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` |

When that secret is set, CI auto-enables subscriptions (`NEXT_PUBLIC_SUBSCRIPTION_ENABLED=true`).

Until both the key and flag are set, **all content stays free** (safe for existing deploys).

## 3. Local development + testing

```bash
npm run dev
```

### Test checklist

| Step | URL | Expected |
|------|-----|----------|
| 1 | `/subscribe/` | Clerk pricing table with `pro` plan |
| 2 | `/sign-up/` | Create a test account |
| 3 | `/subscribe/` | Subscribe via Stripe test card `4242 4242 4242 4242` |
| 4 | `/football/world-cup/builder/` (signed out) | Upgrade prompt |
| 5 | Same page (signed in, no plan) | Upgrade prompt |
| 6 | Same page (Pro subscriber) | Full builder UI |
| 7 | `/horse-racing/todays-races/` | Free: top pick only; Pro: full card + naps |

To simulate free mode locally, set `NEXT_PUBLIC_SUBSCRIPTION_ENABLED=false` and restart dev server.

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

This site uses `output: "export"`. Auth uses `@clerk/clerk-react` (client-side only). Premium JSON in `public/data/` is still publicly fetchable — the gate is a **soft paywall** on the UI. For hard protection of data, migrate premium exports to API routes on Vercel (see future `BUILD_MODE=server`).

## 6. Pricing reference

Configured in `src/lib/subscription/config.ts`:

- Intro: £14.99/mo
- Standard: £24.99/mo
- Annual: £199/yr

Match these in the Clerk Dashboard pricing table.
