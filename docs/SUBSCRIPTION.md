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

For GitHub Actions → repo **Settings → Secrets and variables → Actions**:

| Secret / variable | Purpose |
|-------------------|---------|
| `CLERK_PUBLISHABLE_KEY` | Baked into static build as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — use `pk_live_...` in production |
| `CLERK_SECRET_KEY` | World Cup reminder emails (`world-cup-reminder.yml`) — use `sk_live_...` in production |
| `USE_CUSTOM_DOMAIN` (variable) | Set `true` when `statmanac.com` DNS is live |

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

Configured in `src/lib/subscription/config.ts` (USD charged at checkout; GBP/EUR shown on `/subscribe/`):

| Plan slug | USD/mo | GBP display | EUR display |
|-----------|--------|-------------|-------------|
| `football` | $14.99 | £11.18 | €13.09 |
| `racing` | $17.99 | £13.41 | €15.71 |
| `nba` | $12.99 | £9.68 | €11.35 |
| `pro` | $24.99/mo | £18.63/mo | €21.83/mo |
| `pro` annual | $199/yr ($16.66/mo equiv.) | £148.35/yr | €173.84/yr |

Match USD prices in the Clerk Dashboard. Annual field in Clerk = **monthly equivalent** ($16.66), not $199.

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

**Cloudflare users:** set A/CNAME records to **DNS only** (grey cloud, not proxied). Orange-cloud proxy blocks GitHub Pages HTTPS certificate provisioning and can break asset delivery. After the cert is issued, you can re-enable Cloudflare proxy with SSL mode **Full**.

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

## 8. Production go-live (Stripe Live + Clerk Production)

Clerk **Development** and **Production** are completely separate. Test users, plans, Stripe connections, and keys do **not** carry over. You must configure Production from scratch.

**Do not create subscription products in Stripe manually.** Clerk Billing creates Stripe prices when you add plans in the Clerk Dashboard.

### Phase A — Stripe (live payments)

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) and complete **Activate your account**:
   - Business type, address, identity verification
   - Payout bank account (where subscription revenue lands)
2. Toggle **Test mode → Live** (top-right). You are now in live mode.
3. **Settings → Business settings → Public business name** → set **Statmanac** (appears on card statements).
4. Leave Products/Prices empty — Clerk manages these via Billing.

### Phase B — Clerk Production instance

1. Open [dashboard.clerk.com](https://dashboard.clerk.com).
2. Switch the instance toggle from **Development** to **Production** (top of sidebar). This is a fresh environment.
3. **Configure → API keys** — copy and store safely:
   - Publishable: `pk_live_...`
   - Secret: `sk_live_...` (needed for reminder emails + API; never commit)
4. **Configure → Domains** — add allowed origins:
   - `https://statmanac.com`
   - `https://www.statmanac.com`
   - `http://localhost:3000` (optional, for local dev against production — usually keep dev keys locally instead)
5. **Customization → Application** (or **Settings → General**):
   - Application name: **Statmanac**
   - Support email: your real support address
6. **Customization → Emails** — update templates so they say **Statmanac**, not DKBets or a default Clerk app name. Check: welcome, magic link, subscription receipts.

### Phase C — Clerk Billing + live Stripe

1. **Billing → Settings** → enable billing → **Connect Stripe** → choose your **live** Stripe account (not test).
2. **Billing → Features** — create each feature slug **exactly** as below (create features before plans):

| Feature slug | Display name (your choice) |
|--------------|----------------------------|
| `football_builder` | Football builder |
| `football_props` | Football props |
| `football_stats` | Football stats |
| `racing_intel` | Racing intel |
| `racing_analysis` | Racing analysis |
| `nba_props` | NBA props |
| `full_access` | Full access |

3. **Billing → Plans for Users** (not Organizations) — create each plan:

| Slug | Name | Monthly USD | Annual | Features | Public | Trial |
|------|------|-------------|--------|----------|--------|-------|
| `football` | Football Pro | $14.99 | — | `football_builder`, `football_props`, `football_stats` | ON | — |
| `racing` | Racing Pro | $17.99 | — | `racing_intel`, `racing_analysis` | ON | — |
| `nba` | NBA Pro | $12.99 | — | `nba_props` | ON | — |
| `pro` | All-Access Pro | $24.99 | **$16.66**/mo equiv. | `full_access` | ON | 7 days |
| `family` | Family (internal) | $0.00 | — | `full_access` | **OFF** | — |

**Annual pricing:** Clerk's annual field is the monthly equivalent. For $199/year, enter **$16.66** — not $199.

4. Open `https://statmanac.com/subscribe/` after deploy — all four public plans should appear with checkout buttons.

### Phase D — GitHub Actions secrets & variables

Repo → **Settings → Secrets and variables → Actions**:

| Name | Type | Value |
|------|------|-------|
| `CLERK_PUBLISHABLE_KEY` | Secret | `pk_live_...` from Clerk **Production** |
| `CLERK_SECRET_KEY` | Secret | `sk_live_...` from Clerk **Production** (reminder emails) |
| `RESEND_API_KEY` | Secret | Optional — World Cup ending reminder emails |
| `USE_CUSTOM_DOMAIN` | **Variable** | `true` (builds for `statmanac.com` root, not `/DKBets`) |

Until `CLERK_PUBLISHABLE_KEY` is set, the site stays in free mode. The deploy workflow warns if `USE_CUSTOM_DOMAIN=true` but the key is still `pk_test_...`.

After updating secrets: **Actions → Deploy to GitHub Pages → Run workflow** (or push to `main`).

### Phase E — Verify production checkout

Use a **real card** — live mode charges real money.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Visit `https://statmanac.com/subscribe/` | Four plans + currency toggle |
| 2 | Sign up at `/sign-up/` | Clerk modal / page works |
| 3 | Subscribe to **All-Access Pro** (7-day trial) | Stripe checkout completes |
| 4 | Check Stripe Dashboard → **Customers** | New customer + subscription |
| 5 | Check Clerk → **Billing → Subscriptions** | Active `pro` plan |
| 6 | Open `/football/world-cup/builder/` signed in | Full builder (or sign-up gate if WC promo requires account) |
| 7 | Open `/horse-racing/todays-races/` without plan | Racecard only; naps gated |
| 8 | Cancel test sub in Clerk if needed | Access revokes after period ends |

### Common mistakes

| Mistake | Symptom |
|---------|---------|
| `pk_test_...` in GitHub secret with live domain | Checkout works in test only; no real revenue |
| Plans under **Organizations** not **Users** | Empty pricing table on `/subscribe/` |
| Wrong plan slug (`football-pro` vs `football`) | Payment succeeds but gates don't unlock |
| `USE_CUSTOM_DOMAIN` not `true` | Broken assets/CSS on `statmanac.com` |
| Features not attached to plans | User pays but still sees upgrade prompts |
| Stripe still in test mode when connecting Clerk | Clerk billing uses test charges only |

### Local dev vs production

Keep **test** keys in `.env.local` for development:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_SUBSCRIPTION_ENABLED=true
```

Production keys live only in GitHub Actions secrets (baked into the static build). Never commit `sk_live_...`.

**Note:** Clerk billing charges in **USD only**. GBP/EUR on the site are display conversions; checkout is always USD via Stripe.

## 9. Family / complimentary all-access

Clerk Billing does not allow **$0.00** plans, so the hidden `family` plan may show as $1/mo. Two ways to grant free all-access:

### A. Public metadata (recommended — no charge, no plan)

The app treats users with complimentary metadata as having full access (same as `full_access`).

1. **Clerk Dashboard → Users** → open the account
2. **Metadata → Public metadata** → add:

```json
{ "complimentary": true }
```

Alternatively `"role": "admin"` works the same way.

3. Save — user gets full Pro access on next page load. No subscription, no Stripe, no $1.

Use this for yourself, family, and beta testers. Revoke by removing the metadata.

Implemented in `src/lib/subscription/complimentary.ts` and checked in `usePremiumAccess()`.

### B. Hidden `family` plan (when metadata is awkward)

**Yes — use a hidden plan and assign it manually.** Clerk does not yet have a one-click “gift subscription without charging” button for paid plans, but this pattern works today:

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
