# Racing performance history (durable)

Git-backed source of truth for:

- `ledger.json` — settled pick→result rows (hit rates / ROI)
- `predictions/YYYY-MM-DD.json` — full model rankings for each race day
- `confident-*.json` / `naps-*.json` — selective pick tiers

## Why this exists

`.cache/` (GitHub Actions) and the GitHub Pages mirror are both lossy.
Pages redeploys replace the whole site, so any prediction log missing from
that run’s export was permanently wiped — and the model could not learn
from those days.

This directory is dual-written on every `export:data` run and **committed
back to `main`** by the deploy workflow. That is what keeps daily learning
and track-record settlement alive across deploys.

## Retention

- Ledger rows: last ~120 days
- Prediction logs: last ~90 days (kept in git; older files may remain until pruned)

`data/racing-performance-seed/` remains a bootstrap fallback only.
