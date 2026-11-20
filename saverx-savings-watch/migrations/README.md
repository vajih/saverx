# D1 migrations

`schema.sql` is the full current schema (use it for a brand-new database). Files here are **one-time upgrades for databases
that already exist**, applied in order with `wrangler d1 execute saverx-savings-watch --remote --file=migrations/<file>`.

| File | What it adds | Already in schema.sql? |
|---|---|---|
| `0001` (implicit) | the original tables | yes (this is the baseline) |
| `0002_utm_attribution.sql` | `utm_*` columns on `requests` | yes |

Open item: PR #17 adds a `superseded_at` column but ships no migration. When that PR is resolved, add it here as `0003_*`
(or number it before 0002 if it is applied first) so existing databases can upgrade.
