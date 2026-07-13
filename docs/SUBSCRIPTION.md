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

**Free without any plan:** racecard top pick, NBA stats leaderboard.

| Slug | Gates |
|------|-------|
| `full_access` | Unlocks everything (all-access plans) |
| `football_builder` | Bet365 builder + underpriced gems |
| `football_props` | Matchups, star players, team model, player H2H |
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
| Underpriced gems + Bet365 builder | — | ✓ | — | — | ✓ |
| Matchups + player H2H + team bet model | — | ✓ | — | — | ✓ |
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

## 7. Custom domain (statmanac.com)

### A. DNS (at your registrar)

Point the domain at GitHub Pages:

| Type | Host | Value |
|------|------|-------|
| `A` | `@` | `185.199.108.153` |
| `A` | `@` | `185.199.109.153` |
| `A` | `@` | `185.199.110.153` |
| `A` | `@` | `185.199.111.153` |
| `CNAME` | `www` | `daraghkearney.github.io` |

DNS can take up to 24–48 hours (often much faster).

### B. GitHub Pages

1. Repo **Settings → Pages → Custom domain** → enter `statmanac.com`
2. Enable **Enforce HTTPS** once the certificate is issued
3. Optionally add `www.statmanac.com` as a second custom domain (or redirect www → apex at your registrar)

### C. Build path (required)

The site currently builds with `NEXT_PUBLIC_BASE_PATH=/DKBets` for `github.io/DKBets/`.

For `statmanac.com` at the root:

1. Repo **Settings → Secrets and variables → Actions → Variables**
2. Add variable: `USE_CUSTOM_DOMAIN` = `true`
3. Push to `main` (or re-run the deploy workflow) — builds will use an empty base path

Until you flip that variable, `statmanac.com` can 404 assets if DNS is pointed but the build still uses `/DKBets`.

### D. Clerk domains (production)

In **Clerk Production** → **Configure → Domains**, add:

- `https://statmanac.com`
- `https://www.statmanac.com`

Keep `http://localhost:3000` for local dev.

## 8. Live Stripe payments

Clerk **Development** and **Production** are separate instances. Plans, users, and Stripe connections do not carry over — you must set up Production.

### Checklist

| Step | Where | Action |
|------|-------|--------|
| 1 | Stripe | Complete business verification, add payout bank account |
| 2 | Stripe | Switch to **Live** mode |
| 3 | Clerk | Open **Production** instance (toggle in Dashboard) |
| 4 | Clerk Production | **Billing → Settings** → connect your **live** Stripe account |
| 5 | Clerk Production | Recreate all 4 plans + features (same slugs as dev) |
| 6 | GitHub | Update secret `CLERK_PUBLISHABLE_KEY` to `pk_live_...` from Production |
| 7 | GitHub | Set `USE_CUSTOM_DOMAIN=true` when DNS is live |
| 8 | Deploy | Push or re-run workflow; test checkout on `statmanac.com/subscribe/` |

### Test live checkout

1. Sign up with a real email on production
2. Subscribe with a real card (or use Stripe test mode only in dev — live mode charges real money)
3. Confirm gated pages unlock and Stripe Dashboard → Customers shows the subscription

**Note:** Clerk billing is USD-only. Your marketing copy can still show £/€ equivalents.

## 9. Family / complimentary all-access

**Yes — use a hidden free plan and assign it manually.** Clerk does not yet have a one-click “gift subscription without charging” button for paid plans, but this pattern works today:

### Create the plan (Production + Dev)

1. **Billing → Plans for Users → Add plan**
2. Settings:
   - **Slug:** `family` (must match `COMPLIMENTARY_PLAN_SLUG` in `config.ts`)
   - **Name:** e.g. `Family` (internal only)
   - **Price:** `$0.00` / month (if Clerk accepts $0; otherwise use the lowest allowed price)
   - **Publicly available:** **OFF** (hidden from `/subscribe/`)
   - **Features:** add `full_access`
3. Do **not** add this plan to `PLANS` in code — it stays off the public pricing page

### Assign someone after they sign up

1. They create a normal account (Sign up on the site)
2. You: **Clerk Dashboard → Billing → Subscriptions** (or open the user → Subscriptions)
3. Find their user → **Change plan** → select `family`
4. They get `full_access` immediately — no Stripe charge

Repeat for each family member. Your own account: sign up, then assign yourself `family`.

### What does not work well

| Approach | Problem |
|----------|---------|
| Adding `full_access` to the default free plan | Everyone gets Pro for free |
| Manually assigning paid `pro` without payment | Clerk may attempt to bill unless you use a $0 custom price |
| Sharing your login | One account, no per-person audit trail |

### Alternative (future)

Clerk is building native “assign paid plan without billing” for gifting and internal access. Until then, the hidden `family` plan is the right approach.
