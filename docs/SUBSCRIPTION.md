# Statmanac subscriptions (Clerk + Stripe)

Statmanac uses [Clerk Billing](https://clerk.com/docs/guides/billing) for B2C subscriptions. Stripe handles payments; plans are managed in the Clerk Dashboard (not Stripe Billing directly).

## 1. Clerk Dashboard (step-by-step)

### A. Create the app

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) → **Create application** → name it `Statmanac`.
2. Copy your keys from **Configure → API keys**:
   - Publishable key (`pk_test_...` or `pk_live_...`)
   - Secret key (`sk_test_...` or `sk_live_...`)

### B. Enable billing + Stripe

1. Open [Billing → Settings](https://dashboard.clerk.com/last-active?path=billing/settings).
2. Toggle billing **on** and connect your Stripe account (test mode is fine for dev).

### C. Create all plans (Users tab — important)

Plans must be under **Plans for Users**, not Organizations. Wrong tab = empty `<PricingTable />`.

Open [Billing → Plans](https://dashboard.clerk.com/last-active?path=billing/plans) → **Plans for Users** → create each plan:

| Slug | Name | USD price | Features to add |
|------|------|-----------|-----------------|
| `football` | Football Pro | $14.99/mo | `football_builder`, `football_props`, `football_stats` |
| `racing` | Racing Pro | $17.99/mo | `racing_intel`, `racing_analysis` |
| `nba` | NBA Pro | $12.99/mo | `nba_props` |
| `pro` | All-Access Pro | $24.99/mo + $199/yr | `full_access` |

For each plan:
- **Publicly available:** on (required for checkout buttons on `/subscribe/`)
- **Trial:** 7 days (recommended on `pro`)

Clerk billing is **USD only** — prices above are what customers are charged.

**Annual pricing:** Clerk's annual field is the **monthly equivalent**, not the yearly total. For `pro` at $199/yr, enter **$16.66** as the annual monthly fee — not $199.

### D. Feature checklist (nothing missing)

Each plan must have these Clerk features assigned so gating works:

| Plan slug | Required Clerk features |
|-----------|-------------------------|
| `football` | `football_builder`, `football_props`, `football_stats` |
| `racing` | `racing_intel`, `racing_analysis` |
| `nba` | `nba_props` |
| `pro` | `full_access` |

What each feature unlocks in the app — see `CLERK_FEATURE_GATES` in `src/lib/subscription/config.ts`.

**Free without any plan:** World Cup matchups/fixtures, racecard top pick, NBA stats leaderboard.

| Slug | Gates |
|------|-------|
| `full_access` | Unlocks everything (all-access plans) |
| `football_builder` | Bet365 builder + underpriced gems |
| `football_props` | Star players, team model, player H2H |
| `football_stats` | Stats hub |
| `racing_intel` | Tipsters, naps, performance, learning |
| `racing_analysis` | Deep analysis pages |
| `nba_props` | NBA prop builder |

`usePremiumAccess()` checks the user's plan slug against required features, then falls back to individual feature slugs.

### E. Allowed origins (required for auth)

In **Configure → Domains**, add:

- `http://localhost:3000` (local dev)
- `https://statmanac.com` and `https://www.statmanac.com` (custom domain)
- `https://daraghkearney.github.io` (GitHub Pages fallback)

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

Until a Clerk publishable key is set, **all content stays free**. With a key present, subscriptions auto-enable (set `NEXT_PUBLIC_SUBSCRIPTION_ENABLED=false` to force free mode locally).

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

## 4. What is gated

| Area | Free | Football | Racing | NBA | All-Access |
|------|------|----------|--------|-----|------------|
| World Cup matchups / fixtures | ✓ | ✓ | ✓ | ✓ | ✓ |
| Underpriced gems + Bet365 builder | — | ✓ | — | — | ✓ |
| Player H2H + team bet model | — | ✓ | — | — | ✓ |
| Star players / stats | — | ✓ | — | — | ✓ |
| Racecards (top pick per race) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Full runner model + value naps | — | — | ✓ | — | ✓ |
| Tipster intel + performance ledger | — | — | ✓ | — | ✓ |
| Deep racing analysis | — | — | ✓ | — | ✓ |
| NBA prop builder | — | — | — | ✓ | ✓ |

## 5. Static export note (GitHub Pages)

This site uses `output: "export"`. Auth uses `@clerk/clerk-react` via a client-side `ClerkProvider` (required for static export — `@clerk/nextjs` server middleware and catch-all routes are not compatible with GitHub Pages). Premium JSON in `public/data/` is still publicly fetchable — the gate is a **soft paywall** on the UI. For hard protection of data, migrate premium exports to API routes on Vercel (see future `BUILD_MODE=server`).

## 6. Pricing reference

Configured in `src/lib/subscription/config.ts` (USD charged, GBP shown in marketing):

| Plan slug | USD/mo | GBP display |
|-----------|--------|-------------|
| `football` | $14.99 | £11.99 |
| `racing` | $17.99 | £14.99 |
| `nba` | $12.99 | £9.99 |
| `pro` | $24.99/mo · $16.66/mo annual · $199/yr | £24.99 · £199 |

Match these in the Clerk Dashboard.
