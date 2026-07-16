# Racing performance seed

Checked-in pick→result ledger so production track record is not stuck at 0/0
when the GitHub Actions `.cache/racing-performance` is empty.

Built from local prediction logs matched to HorseRacing.net results:

- 2026-07-10, 2026-07-12, 2026-07-14
- ~89 model #1 picks + EW gems

`loadLedger()` and the deploy workflow fall back to this seed when the cache
has no entries. Ongoing deploys append new days on top.
