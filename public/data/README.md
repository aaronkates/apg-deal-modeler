# Dataset

Two CSV files. All data is **synthetic** — designed to behave like real
streaming data, but no real artists are represented.

| File | Rows | Description |
|---|---|---|
| `artists.csv` | 100 | One row per artist (metadata + summary stat) |
| `streaming_data.csv` | 365,100 | One row per artist per day from 2016-05-16 to 2026-05-14 |

## `artists.csv`

| Column | Type | Notes |
|---|---|---|
| `artist_id` | string | Stable ID (`A001`–`A100`). Use this as the join key. |
| `artist_name` | string | Stage name. Unique within the roster. |
| `genre` | string | One of: `pop`, `hip-hop`, `r&b`, `rock`, `country`, `electronic`, `latin`, `indie`, `k-pop`, `afrobeats`. |
| `primary_country` | string | The artist's biggest market. |
| `catalog_size` | int | Number of released songs as of `2026-05-14`. |
| `signed_to_major` | bool | Always `False` — every artist is treated as available for a deal. |
| `debut_date` | date (ISO) | First release date. Always within the data window. |
| `trailing_12mo_avg_daily_streams` | int | Mean of `streams` over the last 365 days. Useful as a quick sort key. |

## `streaming_data.csv`

| Column | Type | Notes |
|---|---|---|
| `date` | date (ISO) | UTC, daily. |
| `artist_id` | string | Foreign key to `artists.csv`. |
| `artist_name` | string | Denormalized for convenience. |
| `streams` | int | Total streams on that day. = `catalog_streams + new_release_streams`. |
| `catalog_streams` | int | Streams from songs older than ~6 months at the date of measurement. |
| `new_release_streams` | int | Streams from songs released in the trailing ~6 months (frontline). |
| `monthly_listeners` | int | Rolling 30-day approximation of unique monthly listeners. |
| `followers` | int | Cumulative follower count, never decreases by more than measurement noise. |

## Behavior baked into the data

- **Industry growth.** Streaming grew across the window — earlier years are
  smaller in absolute terms than later years across the roster as a whole.
- **Day-of-week seasonality.** Friday/Saturday/Sunday lift (~+10%), Monday
  dip (~−8%). Your trajectory metric should be computed on a smoothed
  series (e.g. 30-day rolling mean) so it is not confused by this.
- **Release pulses.** New-release streams arrive as ramp-up + exponential
  decay pulses, with per-artist counts and decay rates that vary by artist.
- **Catalog vs new release.** Every stream is attributed. Catalog and
  new-release columns always sum to `streams` (modulo rounding).
- **Volatility.** Different artists have different noise profiles. Some
  look spiky on raw daily streams even though their underlying catalog is
  stable; some look smooth because they genuinely are.

