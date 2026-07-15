# Racing model seed

Checked-in factor weights so GitHub Actions deploys don't start from
`samples: 0` when the `.cache/racing-model` Actions cache is empty or stale.

`loadModel()` uses these weights when the cache is missing or has zero samples,
then writes them into `.cache/` so subsequent learning continues from here.

Refresh this seed periodically after a strong local/CI backfill:

```bash
cp .cache/racing-model/weights.json data/racing-model-seed/weights.json
```
