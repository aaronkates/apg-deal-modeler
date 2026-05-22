# APG Music — Master Rights Deal Modeler

*A case study in browser-only deal economics*

---

## How to read this document

This case study is layered. Each section is independently useful:

- **Section 1** (Executive Summary) — for A&R / leadership; ~5 min read
- **Sections 2–8** (Methodology) — for analysts evaluating the model; formulas + worked examples
- **Section 9** (Technical Overview) — for engineers reviewing the implementation
- **Sections 10–11** (Open Questions, Appendix) — what we'd want to validate with APG, plus reference data

Every formula and heuristic ties back to a specific file and line range in the codebase, so any claim can be verified against the source.

---

## 1. Executive Summary

The Master Rights Deal Modeler is a browser-based tool that helps APG evaluate whether — and on what terms — to sign any artist on its roster. It does two things:

1. **Roster Recommendation** — scores all 100 artists across four dimensions (catalog growth, stability, listener trend, catalog ratio) and identifies the strongest signing candidate. Weights are user-adjustable so APG can prioritize different deal theses.
2. **Artist Deal Modeler** — for any selected artist, projects 36-to-60 months of streaming revenue, simulates the recoupment cascade, and reports break-even month, recoupment month, ROI, and label profit across best / base / worst-case scenarios.

The tool runs entirely in the browser against the synthetic dataset APG provided (100 artists, 365k daily streaming rows, 2016–2026).

### Five things APG should know at a glance

1. **The model is calibrated to artist tier, not a one-size-fits-all default.** Picking Hadley North auto-suggests a $4.6M advance over 5 years; picking Cyrus North suggests $420K over 4 years; picking an indie artist suggests $10K over 2 years. The tier mapping and the underlying formula are documented in §4 and are tunable.

2. **Growth projections are tempered by an 18-month half-life decay.** A breakout artist growing 10%/mo today is not assumed to grow 10%/mo for the next 3-5 years. This is the single most important judgment call in the model — without it, breakout artists project to absurd 2000%+ ROI. With it, they land in a defensible 300–500% range. The half-life is a heuristic we'd want APG to validate against real catalog cohorts.

3. **Headline outputs for the default Hadley North deal (mega-tier, 5-year, $4.6M advance):**
   - Break-even: Month 10
   - Recoupment: Month 40
   - Total ROI: 388% (base) / 498% (best) / 272% (worst)
   - Label profit: $24.8M base case
   - These numbers are *derived live from the model* and reproduced step-by-step in §8.

4. **The model warns automatically when its own outputs are suspicious.** Any deal whose ROI projects above 500% triggers an in-app warning explaining the underlying assumptions (peak multiplier, growth trajectory, decay rate) so users sanity-check inputs before relying on the figure.

5. **The model does *not* capture every revenue stream APG cares about.** Sync licensing, publishing, brand deals, touring, and physical/merch are out of scope. The tool is specifically about master-rights streaming economics. See §7 for the full limitations list.

---

## 2. Tool Overview

The app has two main views, accessed via the top-right navigation.

### Artist Deal Modeler

1. User picks an artist from a dropdown (sorted by trailing-12-month daily streams).
2. Four "Key Metrics" cards populate immediately: trailing daily streams, monthly listeners (with 12-month trend arrow), catalog/new-release split, and average monthly growth.
3. A 24-month catalog trajectory chart shows the smoothed month-over-month growth pattern.
4. A "Deal Parameters" panel pre-fills 12 fields with **tier-calibrated suggestions**: contract term, advance, marketing budget, distribution fee, label/artist splits (pre/post recoupment), recoupment rate, cost of capital, number of releases, delivery window, frontline peak multiplier, monthly decay rate.
5. Three scenario tabs (Best / Base / Worst) show:
   - Four summary cards: Break-Even, Recoupment, ROI, Label Profit
   - A monthly cash-flow chart with cumulative line and confidence band
   - A revenue composition chart (catalog vs new-release contribution per month)

Every parameter is editable; the model recalculates instantly.

### Roster Recommendation

1. Four sliders (with proportional redistribution to maintain 100%) let the user re-weight the four scoring dimensions.
2. A top-3 podium shows the highest-scoring artists with per-dimension breakdowns.
3. The **APG Recommendation** card highlights the #1 ranked artist with an auto-generated rationale referencing their actual metrics.
4. A full ranked table lists all 100 artists; clicking any row opens that artist in the Deal Modeler.

---

## 3. Methodology I — Per-Artist Metrics

All per-artist metrics are computed from `streaming_data.csv` (365k daily rows) when an artist is selected. Code: [`src/utils/metrics.js:28–87`](src/utils/metrics.js) (`computeArtistDetailMetrics`) and `:90–150` (`computeRosterMetrics`).

### 3.1 Trailing 12-month average daily streams

The simplest and most-cited tier indicator.

**Formula:**
```
trailing12mAvgDaily = mean(streams) over last 365 days
```

**Worked example (Hadley North):** mean of her last 365 days of total streams ≈ **7,472,521**. This figure is also pre-computed in `artists.csv` as `trailing_12mo_avg_daily_streams` for sort/filter purposes.

### 3.2 30-day rolling mean (smoothing)

Raw daily streams contain strong day-of-week seasonality (Fri/Sat/Sun lift ~10%, Monday dip ~8%, per the dataset's documented behavior). Any trajectory measurement on raw data would be noise. We smooth first.

**Formula** (sliding-window mean, [`src/utils/metrics.js:2–11`](src/utils/metrics.js)):
```
smoothed[i] = mean(arr[max(0, i-29) : i+1])
```

The first 29 days use a partial window — acceptable for artists with enough history; flagged as a limitation for very recent debuts.

### 3.3 24-month catalog trajectory + monthly growth rate

After smoothing the last 730 days of `catalog_streams`, we group by calendar month and compute month-over-month percent change.

**Formula:**
```
For each of the last 24 months:
  monthlyAvg[m]  = mean(smoothed values in month m)
  growthPct[m]   = (monthlyAvg[m] - monthlyAvg[m-1]) / monthlyAvg[m-1] × 100

avgMonthlyGrowthRate = mean(growthPct over last 12 trajectory months)
```

**Worked example (Hadley North):** her trajectory chart shows monthly growth fluctuating around +1.0%/mo over the last 12 months. The tool reports `+1.00%` as the headline growth metric, and this feeds directly into the 36–60-month forward projection in §6.

### 3.4 Coefficient of variation (stability — roster scoring only)

CoV captures how *consistent* the catalog stream volume is over the 24-month window. Used for roster scoring; lower is better.

**Formula:**
```
CoV = stddev(monthlyCatalogTotals) / mean(monthlyCatalogTotals)
```

**Why it matters:** an artist with a CoV of 0.05 has rock-steady catalog streams (low risk for the label). A CoV of 0.40 is spiky — the deal could either over- or under-perform dramatically.

### 3.5 Monthly listeners trend

Uses the `monthly_listeners` column directly from the streaming data (already a rolling 30-day estimate per APG's schema documentation).

**Formula:**
```
listenersTrend = (monthlyListeners_now - monthlyListeners_12moAgo) / monthlyListeners_12moAgo × 100
```

### 3.6 Catalog vs new-release ratio

```
catalogRatio = sum(catalog_streams over last 12mo) / sum(total_streams over last 12mo)
```

This drives one of the roster scoring dimensions (§4) and also feeds the financial model's revenue mix.

---

## 4. Methodology II — Roster Scoring

Code: [`src/utils/metrics.js:153–195`](src/utils/metrics.js) (`scoreArtists`); UI in [`src/components/RosterRecommendation.jsx`](src/components/RosterRecommendation.jsx).

Each artist receives a composite **0–100 score** computed from four normalized dimension scores.

### 4.1 Per-dimension normalization

Each dimension is min-max normalized across the **whole roster** (so the highest-ranked artist on any one dimension scores 100, the lowest 0).

**Formula:**
```
For each dimension D:
  D_score[i] = (D[i] - min(D)) / (max(D) - min(D)) × 100
```

**Special cases:**
- **Stability** is inverted (lower CoV = higher score): `100 - normalized`
- **Catalog ratio** uses a custom scoring curve (not min-max) because the *optimal* range is 65–85%, not "as high as possible." An artist with 99% catalog and 1% new release has no frontline pipeline — bad. An artist with 30% catalog and 70% new release is over-leveraged on hits — also risky. The curve:
  ```
  If catalogRatio in [65%, 85%]:  score = 100
  If catalogRatio < 65%:           score = (catalogRatio / 65) × 100
  If catalogRatio > 85%:           score = max(0, 100 - (catalogRatio - 85) × 4)
  ```

### 4.2 Weighted composite

**Formula:**
```
totalScore = wG × growthScore + wS × stabilityScore + wL × listenerScore + wR × ratioScore
where wG + wS + wL + wR = 1.0
```

**Default weights:** Growth 40%, Stability 30%, Listeners 20%, Catalog Ratio 10% ([`src/utils/metrics.js:25`](src/utils/metrics.js), `DEFAULT_WEIGHTS`).

### 4.3 User-adjustable weights

The Roster tab exposes four sliders (5% increments). When the user moves one slider, the other three are **proportionally redistributed** so the total stays at 100%. The "Total: X%" indicator turns red if rounding drift produces an off-100 value as a safety net.

The roster re-sorts in real time as weights change. This lets APG quickly answer "who's our best signing if we *only* care about growth?" (push Growth to 70%) or "who's safest if we prioritize stability?" (push Stability to 60%).

---

## 5. Methodology III — Tier-Based Deal Defaults

**The problem:** an earlier version of the tool used a static $500K default advance for every artist. That's roughly right for a mid-tier signing — and absurd for a 7M-daily-streams superstar (a $500K advance for an artist generating $9.5M/year in gross streaming revenue would never happen in real industry deals). It was also too high for indie artists generating $25K/year.

**The fix:** when an artist is selected, the model auto-suggests three parameters scaled to that artist's revenue tier: contract term, advance, marketing budget. Other parameters (splits, CoC, releases, decay) are preserved across artist switches so user tweaks stick.

Code: [`src/utils/dealModel.js:38–66`](src/utils/dealModel.js) (`tierContractTerm` + `suggestDealDefaults`).

### 5.1 Tier mapping

```
Daily streams      Tier            Default contract
≥ 2,000,000        Mega-tier       5 years
500,000 – 2M       Top-tier        4 years
50,000 – 500,000   Mid-tier        3 years
< 50,000           Indie/Emerging  2 years
```

Industry norm: bigger artists sign longer deals because both sides want to lock in the relationship.

### 5.2 Annual artist royalty (the foundation)

**Formula:**
```
annualGross   = dailyStreams × 365 × $0.0035
annualRoyalty = annualGross × (1 − distributionFee) × artistSplit
              = annualGross × 0.80 × 0.20   (using defaults)
              = annualGross × 0.16
```

So under the default deal structure, **the artist receives 16% of every dollar in gross streaming revenue.** The other 84% breaks down as 20% to distribution platforms (Spotify et al.) and 64% to the label.

### 5.3 Advance formula

**Formula:**
```
advance = annualRoyalty × contractTermYears × 0.6
        (rounded to a clean number — $5K / $25K / $100K / $500K depending on magnitude)
```

**Plain English:** the label fronts the artist roughly what they'd earn in royalties over the **first 60% of the contract**, leaving the back 40% as profit margin.

**Marketing budget:** ~40% of advance, same rounding logic.

### 5.4 Worked examples

**Hadley North (mega-tier, 7.47M daily, 1%/mo growth):**
```
annualGross    = 7,472,521 × 365 × 0.0035       = $9.55M
annualRoyalty  = $9.55M × 0.80 × 0.20           = $1.53M
contractTerm   = 5 years   (mega tier)
advance        = $1.53M × 5 × 0.6 = $4.58M      → rounds to $4.60M
marketingBudget= $4.60M × 0.4 = $1.84M          → rounds to $1.80M
```

**Cyrus North (top-tier, 887K daily, 2.3%/mo growth):**
```
annualGross    = 887,576 × 365 × 0.0035         = $1.13M
annualRoyalty  = $1.13M × 0.80 × 0.20           = $181K
contractTerm   = 4 years   (top tier)
advance        = $181K × 4 × 0.6 = $435K        → rounds to $425K
marketingBudget= $425K × 0.4 = $170K            → rounds to $175K
```

These two artists are the same model, same formula — only the inputs change.

---

## 6. Methodology IV — Deal Financial Model

This is the heart of the tool. Given an artist's metrics and a parameter set, project month-by-month cash flows for the full contract term, track recoupment, and return summary KPIs. Code: [`src/utils/dealModel.js:68–192`](src/utils/dealModel.js) (`calculateDeal`).

The model runs a single loop, month 1 → contract length × 12. Each month does six things in order:

1. Project streams (catalog + frontline new releases)
2. Convert streams to revenue (gross → net → label/artist split)
3. Track marketing spend
4. Charge cost of capital on outstanding balance
5. Apply artist royalties against the outstanding balance (recoupment)
6. Accumulate cumulative cash position; mark break-even and recoupment crossings

### 6.1 Catalog stream projection (with growth-rate decay)

**The naïve approach** would be: project catalog streams as `monthlyBase × (1 + growthRate)^t` and let it compound. This breaks for breakout artists — a 10%/mo growth artist projects to **30× their current volume by month 36**. Real catalog growth saturates and decays toward the long-run streaming-industry baseline.

**The fix** ([`dealModel.js:97–103`](src/utils/dealModel.js)): the effective monthly growth rate decays with an **18-month half-life**. The catalog compounds at the decaying rate, not the static one.

**Formula:**
```
catalogMonthlyBase  = dailyAvg × 30 × catalogFraction         (set once at t=0)
catalogRunRate[0]   = catalogMonthlyBase

For each month t = 1 … termMonths:
  effectiveGrowth   = recentGrowthRate × (0.5)^(t / 18)
  catalogRunRate[t] = catalogRunRate[t-1] × (1 + effectiveGrowth)
  catalogStreams[t] = catalogRunRate[t]
```

**What this means:**
- An artist growing 10%/mo today is assumed to grow 5%/mo by month 18 and 2.5%/mo by month 36.
- An artist growing 1%/mo today is assumed to grow 0.5%/mo by month 18 (still meaningful, but tempered).
- A flat artist (0% growth) stays flat — decay multiplies zero by anything.

**Worked example (Hadley, 1%/mo current growth, 5-year deal):**
- Month 1: catalog streams ≈ 181M (close to current monthly volume of 887K × 30 × 0.80 × ~1.01)
- Month 12: ≈ 197M
- Month 24: ≈ 209M
- Month 36: ≈ 217M
- Month 60: ≈ 225M

Net catalog growth ≈ 25% over 5 years rather than the ~80% that uncapped compounding would project.

### 6.2 New-release ("frontline") stream projection

Each new release in the contract is a single event: hits **peak in its release month**, decays exponentially each month after.

**Formulas:**
```
releaseMonths = [m_1, m_2, …, m_n]  (n releases spread evenly over delivery window)
releasePeak   = dailyAvg × 30 × frontlinePeakMultiplier    (set once at t=0)

For each month t:
  newReleaseStreams[t] = Σ_(r in releaseMonths, r ≤ t)  releasePeak × (1 − decayRate)^(t − r)
```

**Defaults:** `frontlinePeakMultiplier = 1.5×` (peak month ≈ 1.5× catalog daily rate × 30); `monthlyDecayRate = 30%` (each month, the release does 70% of the prior month).

**Worked example (Hadley, 3 releases over 24-mo delivery window):**
- Release schedule: months 8, 16, 24
- Release peak per release: 7.47M × 30 × 1.5 = **336M streams in peak month**
- Month 8 (first release drops): catalog 192M + frontline 336M = 528M total streams
- Month 9: catalog 193M + frontline (1 release × 0.70) ≈ 235M + 0 new = 428M
- Month 16 (second release drops): catalog 200M + frontline (release 1 at 0.7^8 + release 2 at peak) ≈ 200M + (19M + 336M) = 555M

The exponential decay (30%/mo default) is intentionally aggressive — a song still doing 14% of its peak a year later (the previous 15% decay default) was unrealistic for typical streaming catalog.

### 6.3 Revenue accounting

```
totalStreams[t]   = catalogStreams[t] + newReleaseStreams[t]
grossRevenue[t]   = totalStreams[t] × $0.0035
netRevenue[t]     = grossRevenue[t] × (1 − distributionFee/100)
                  = grossRevenue[t] × 0.80   (default)

labelSplit[t]     = labelSplitPre  if outstanding > 0     (default 80%)
                  = labelSplitPost if outstanding ≤ 0     (default 50%)

labelGross[t]     = netRevenue[t] × labelSplit[t]
artistRoyalty[t]  = netRevenue[t] × (1 − labelSplit[t])
```

### 6.4 Recoupment mechanics

The advance is recoupable from the **artist's** royalty share, not the label's. Each month, a portion of the artist's royalty pays down the outstanding balance.

```
outstanding[0]   = advance + marketingBudget

For each month t:
  outstanding[t] = max(0, outstanding[t-1] − artistRoyalty[t] × recoupmentRate)
  if outstanding[t] = 0 and recoupmentMonth = null:
    recoupmentMonth = t
    labelSplit changes from Pre to Post for all subsequent months
```

**Default recoupment rate is 100%** — every dollar of artist royalty applies until the advance is paid back. (Some real deals use lower rates so the artist sees cashflow before full recoupment; the field is adjustable.)

**Worked example (Hadley, base case):**
- Outstanding at month 0: $4.60M advance + $1.80M marketing = **$6.40M**
- Each month, artist royalty (20% of net) reduces this
- Outstanding reaches zero at **month 40** → recoupment month = 40
- Months 41–60: label split drops from 80% to 50% (artist takes home more, but label has already protected their margin)

### 6.5 Cost of capital

A real label has financing costs on the advance — they could have invested that $6.4M elsewhere. We charge an opportunity cost monthly.

**Formula:**
```
monthlyCoC = (1 + annualCostOfCapital/100)^(1/12) − 1     (default annual = 8%)
cocCost[t] = outstanding[t] × monthlyCoC                   (when outstanding > 0)
```

The CoC is a real expense in the cash-flow calculation; it stops accruing once the deal is recouped.

### 6.6 Monthly cash flow + headline KPIs

```
marketingCost[t]   = marketingBudget / deliveryWindow   if t ≤ deliveryWindow else 0
labelNet[t]        = labelGross[t] − marketingCost[t] − cocCost[t]
cumulative[t]      = cumulative[t-1] + labelNet[t]      (with cumulative[0] = −advance)

breakEvenMonth     = first t where cumulative[t] ≥ 0
recoupmentMonth    = first t where outstanding[t] ≤ 0

totalLabelGross    = Σ labelGross[t]
totalCosts         = advance + marketingBudget + Σ cocCost[t]
totalLabelProfit   = totalLabelGross − totalCosts
totalROI           = (totalLabelProfit / (advance + marketingBudget)) × 100
```

### 6.7 Full Hadley walkthrough — selected months

| Month | Catalog streams | New-release streams | Gross rev | Label gross | Marketing | CoC | Net | Cumulative | Outstanding | Recouped |
|------:|----------------:|--------------------:|----------:|------------:|----------:|----:|----:|-----------:|------------:|---------:|
| 1     | 181M            | 0                   | $634K     | $406K       | $75K      | $41K | $289K | −$4.31M  | $6.30M      | no       |
| 8     | 192M            | 336M                | $1.85M    | $1.18M      | $75K      | $37K | $1.07M| −$1.41M | $5.38M      | no       |
| 12    | 197M            | 81M                 | $972K     | $622K       | $75K      | $31K | $516K | $1.24M   | $4.60M      | no       |
| 24    | 209M            | 357M                | $1.98M    | $1.27M      | $75K      | $17K | $1.18M| $9.12M   | $2.34M      | no       |
| 36    | 217M            | 5M                  | $777K     | $497K       | $0        | $4K  | $493K | $16.60M  | $0.44M      | no       |
| 48    | 222M            | 0.1M                | $778K     | $311K       | $0        | $0   | $311K | $21.04M  | $0          | **yes**  |
| 60    | 226M            | 0                   | $789K     | $316K       | $0        | $0   | $316K | $24.81M  | $0          | yes      |

Reading the table:
- **Month 1:** Hadley earns $634K gross from catalog alone; label takes $406K after distribution + split; net of marketing and CoC, the label gains $289K — but is still $4.3M underwater because the advance was paid up front.
- **Month 12:** the first release has decayed substantially, but cumulative crosses zero (break-even at month 10 in this run).
- **Month 24:** the third release drops; total monthly label net hits a $1.18M peak.
- **Month 36:** delivery window has closed, marketing spend stops, the model is purely catalog economics.
- **Month 40:** recoupment crosses (not shown in the row sample) — the split switches from 80/20 to 50/50, halving the label's per-month gross.
- **Month 60:** end of contract. Cumulative position: **$24.81M**. ROI: **388%**.

### 6.8 Headline outputs across scenarios (Hadley)

| Scenario | Stream multiplier | Break-Even | Recoupment | ROI    | Label Profit |
|----------|-------------------|-----------:|-----------:|-------:|-------------:|
| Best     | 1.3×              | Mo. 9      | Mo. 29     | 498%   | $31.84M      |
| Base     | 1.0×              | Mo. 10     | Mo. 40     | 388%   | $24.81M      |
| Worst    | 0.7×              | Mo. 16     | >60        | 272%   | $17.44M      |

Even in the **worst case**, the deal is profitable — but recoupment doesn't happen within the contract term, which is a meaningful negotiating signal. The worst case for an indie artist in the same model would not just fail to recoup but go negative.

---

## 7. Methodology V — Scenarios & Confidence Bands

Code: [`SCENARIO_MULTIPLIER` and `SCENARIO_BAND`](src/utils/dealModel.js#L25-L26) in `dealModel.js:25–26`.

### 7.1 Scenarios

A single stream-volume multiplier wraps the entire projection:

```
Best  = 1.3× streams everywhere
Base  = 1.0× streams (the model's central estimate)
Worst = 0.7× streams everywhere
```

Everything else — splits, recoupment math, CoC — is identical across scenarios.

### 7.2 Confidence band on the cumulative cash-flow line

Each scenario also has a ±band applied to the revenue component (label gross) of each monthly cash flow:

```
Best  / Base bands: ±15% on labelGross[t]
Worst band:         ±30% on labelGross[t]

cumulativeUpper[t] = cumulativeUpper[t-1] + labelNet[t] + (labelGross[t] × band)
cumulativeLower[t] = cumulativeLower[t-1] + labelNet[t] − (labelGross[t] × band)
```

**Important caveat:** the band is a *directional* sensitivity envelope, not a statistical confidence interval. It tells the reader "if monthly revenue ran ±X% from the projected line all year, here's where cumulative would land," which is useful for sanity-checking the headline ROI but should not be presented as a true probability bound.

### 7.3 Why worst case has a wider band

The Worst scenario already shifts the central projection down by 30%, then layers an additional ±30% sensitivity on top. The reasoning: when things go wrong in streaming economics, they tend to go wrong in correlated ways (a flop release also dampens catalog interest), so the *uncertainty* itself is larger in the downside case. Best/base use a tighter ±15% — they're scenarios where the central projection is more reliable.

---

## 8. Key Assumptions & Limitations

What the model does — and does not — claim to capture.

### 8.1 Hard-coded model assumptions

| Assumption | Value | Where to find it | Why it's set this way |
|---|---|---|---|
| Per-stream royalty | $0.0035 | `dealModel.js:1` | Industry-standard blended rate, per APG spec |
| Growth half-life | 18 months | `dealModel.js:5` | Heuristic — see §6.1 motivation |
| Advance coefficient | 0.6 × royalty × term | `dealModel.js:62` | Heuristic — see §5.3 motivation |
| Marketing as % of advance | 40% | `dealModel.js:63` | Heuristic — typical label budgeting |
| Confidence band (best/base) | ±15% | `dealModel.js:26` | Conservative tight band on central case |
| Confidence band (worst) | ±30% | `dealModel.js:26` | Wider band on the downside scenario |
| ROI warning threshold | 500% | `dealModel.js:8` | Empirically calibrated — above this, double-check inputs |

The first four of these are the heuristics most worth validating against APG's real-world experience.

### 8.2 What the model intentionally does *not* capture

- **Other revenue streams.** Sync licensing, publishing, brand partnerships, touring, merch, physical sales — all out of scope. The tool is master-rights *streaming* only.
- **Platform mix.** All streams are valued at the same $0.0035 rate. In reality, the per-stream rate varies by platform (Spotify ≠ Apple ≠ Amazon ≠ YouTube).
- **Geographic mix.** No modeling of US vs international royalty differences.
- **Marketing efficacy.** Marketing spend is treated as a flat cost over the delivery window, not as a driver of stream growth. A more sophisticated model would model marketing → discovery → catalog growth.
- **Release ramp-up.** New releases hit peak in their drop month. Real releases often ramp over 2–3 weeks before peaking.
- **Inter-release cannibalization.** Three releases in the model produce 3× the frontline streams; in reality, a new release pulls some attention from prior releases.
- **Catalyst events.** Sync placements, viral TikTok moments, awards — none of these are modeled. They show up in real data as positive shocks the model can't predict.

### 8.3 Self-aware safety rail

When projected ROI exceeds 500%, the UI shows an amber warning banner ([`src/components/ScenarioTabs.jsx`](src/components/ScenarioTabs.jsx)) explaining the assumptions driving the figure and prompting the user to sanity-check Peak Multiplier and the artist's growth rate. The threshold catches both legitimately exceptional artists (e.g., true breakout cases) and user-error parameter combinations.

---

## 9. Technical Overview

### 9.1 Stack

| Layer | Library | Why |
|---|---|---|
| UI framework | React 18 | Standard, well-understood, plays well with Vite |
| Build / dev server | Vite 5 | Fast HMR; native ES modules in dev |
| CSV ingest | Papa Parse 5 | Browser-side streaming parse of the 365k-row CSV |
| Charts | Recharts 2 | Composable, React-idiomatic, sufficient for the visualizations needed |
| Styling | Tailwind CSS 3 | Co-located classes; APG palette extended via `tailwind.config.js` |

### 9.2 Architecture decisions

**Zero backend.** All computation runs in the browser. The two CSVs (`public/data/artists.csv` and `public/data/streaming_data.csv`) are served as static assets by Vite. No API, no database, no auth — deploy anywhere that serves static files.

**Reactive state, not stored state.** All computed values (artist metrics, deal projections, roster scores) are derived from raw data via `useMemo`. Adjust a slider or a parameter, React recomputes downstream values in the same render cycle. No invalidation logic, no stale state.

**Lazy detail computation.** Roster-level metrics (used for scoring all 100 artists) are computed once on data load. Per-artist *detail* metrics (the smoothed 24-month trajectory, the 12mo trailing window) are computed only when an artist is selected, via a `useCallback`-wrapped `getArtistMetrics(id)` ([`src/hooks/useData.js`](src/hooks/useData.js)). This keeps initial load fast and per-artist switches near-instant.

**`DATA_END` is dynamic, not hardcoded.** On load, the hook computes `max(date)` across all 365k rows and threads that value through to the metric functions. If APG regenerates the dataset with newer data, the model's "12-month window" automatically advances.

### 9.3 File layout

```
src/
├── App.jsx                    # Top-level view router + global state
├── main.jsx                   # React root
├── index.css                  # Tailwind directives + font setup
│
├── hooks/
│   └── useData.js             # CSV loading, grouping, DATA_END detection
│
├── utils/
│   ├── dealModel.js           # Financial model + tier-based defaults
│   └── metrics.js             # Per-artist metrics + roster scoring
│
└── components/
    ├── ArtistSelector.jsx
    ├── KeyMetrics.jsx
    ├── TrajectoryChart.jsx
    ├── DealParameters.jsx
    ├── ScenarioTabs.jsx
    ├── FinancialSummary.jsx
    ├── CashFlowChart.jsx
    ├── CompositionChart.jsx
    └── RosterRecommendation.jsx

public/
└── data/
    ├── artists.csv            # 100 rows
    ├── streaming_data.csv     # 365k rows
    └── README.md              # APG's dataset documentation
```

**Pure functions live in `utils/`.** The financial model and scoring logic have no React dependencies and can be tested or repurposed independently.

### 9.4 Performance characteristics

- **First load:** ~5 seconds (dominated by streaming the ~22 MB streaming_data.csv from disk and parsing it in the browser).
- **Subsequent interactions:** instant. Selecting an artist triggers a single-pass computation over their ~3,650 daily rows (sub-100ms). Adjusting deal parameters triggers a single 36–60 month loop (sub-10ms).
- **Roster re-scoring on weight change:** ~5ms — 100 artists × 4 normalized dimensions.
- **Build output:** 608 KB minified (~174 KB gzipped). Recharts is the dominant contributor. Acceptable for an internal tool; code-splittable if needed.

### 9.5 Deployment

`vercel.json` is included with an SPA rewrite rule, ready for one-click Vercel deploy. The CSV files in `public/data/` are bundled into the production build and served at `/data/artists.csv` and `/data/streaming_data.csv` — identical to the dev environment.

### 9.6 Brand and UI choices

APG brand red (`#e32f2f`) is intentionally **reserved** for three places only:
1. Active navigation/tab indicators
2. Primary action buttons (e.g., "Model deal →" on the APG Recommendation card)
3. The APG Recommendation card border + label

Everything else uses muted red (`#c0392b`) for secondary accents (score bars, trajectory bars, composition chart catalog stack), white for data values and the cumulative cash-flow line, and muted gray (`#555555`) for negative values. The result: the eye is drawn to the recommendation card and the active controls, not to every chart.

Trend arrows follow semantic color: **green `#4caf50` for up, red `#e32f2f` for down** — these are the *only* place red is used to indicate "negative" rather than "APG-brand."

---

## 10. Open Questions for APG

The model contains several heuristics that we'd want to validate against APG's institutional knowledge. Most could be calibrated quickly given access to real outcome data.

1. **Advance coefficient (currently 0.6 × annualRoyalty × term).** What multiples does APG actually use across artist tiers? Is the 60% margin assumption realistic, conservative, or aggressive? Are there genre- or market-specific variations?

2. **Growth-rate half-life (currently 18 months).** Does APG have data on how quickly catalog growth rates decay over 1–3 years for past signings? A 12-month or 24-month half-life would meaningfully change the projections for fast-growing artists.

3. **Frontline release mechanics.** Two open variables here:
   - Is `frontlinePeakMultiplier = 1.5×` of current daily run rate realistic for APG's release strategy?
   - Is `monthlyDecayRate = 30%/mo` a defensible decay curve for typical frontline catalog?

4. **Additional revenue streams.** Should the model include sync, publishing, and/or brand deals? If yes, what's the right per-stream- or per-month-equivalent valuation?

5. **Other roster screening dimensions.** Are there factors APG cares about that we haven't surfaced as scoring dimensions? Examples: genre/market focus, brand fit, social signals, prior label history.

6. **ROI warning threshold.** 500% is a soft heuristic. Where would APG actually want the safety rail to fire — 300%? 800%?

7. **Confidence band semantics.** The current bands are sensitivity envelopes, not statistical CIs. If APG would value true CIs, we'd need to model stream variance per artist and Monte Carlo the projection — feasible but a meaningful expansion.

---

## 11. Appendix

### A. Default deal parameters

[`src/utils/dealModel.js:10–23`](src/utils/dealModel.js):

| Parameter | Default | Notes |
|---|---|---|
| `contractTermYears` | 3 | Overridden by tier-based suggestion when an artist is selected |
| `advance` | $500,000 | Overridden by tier-based suggestion |
| `marketingBudget` | $200,000 | Overridden by tier-based suggestion |
| `distributionFee` | 20% | Platform take (Spotify/Apple/etc.) |
| `labelSplitPre` | 80% | Label's share before advance recouped |
| `labelSplitPost` | 50% | Label's share after advance recouped |
| `recoupmentRate` | 100% | Share of artist royalties applied against advance |
| `costOfCapital` | 8% / yr | Compounded monthly on unrecouped balance |
| `numReleases` | 3 | New tracks the artist must deliver during the contract |
| `deliveryWindowMonths` | 24 | How long the artist has to deliver them |
| `frontlinePeakMultiplier` | 1.5× | Peak release-month streams as multiple of current run rate |
| `monthlyDecayRate` | 30% | Release-stream decay per month after the peak |

### B. Default roster scoring weights

[`src/utils/metrics.js:25`](src/utils/metrics.js):

| Dimension | Weight | Rationale |
|---|---|---|
| Growth | 40% | Forward-looking value — what will the catalog be worth in 2-3 years? |
| Stability | 30% | Risk control — predictable cash flows derisk the advance |
| Listeners | 20% | Audience momentum — independent signal from catalog streams |
| Catalog Ratio | 10% | Balance check — penalize over-leveraged or stagnant catalogs |

### C. Repo / install commands

```bash
git clone <repo>
cd apg-case-study
npm install
npm run dev          # → http://localhost:5173
npm run build        # → static output in dist/
```

CSVs must be present at `public/data/artists.csv` and `public/data/streaming_data.csv`.

### D. Glossary

- **Advance** — upfront payment to the artist, recouped from the artist's royalty share over the contract.
- **Catalog streams** — streams of songs released more than ~6 months ago (per APG dataset definition).
- **CoV (coefficient of variation)** — standard deviation ÷ mean. Dimensionless measure of relative variability; used as a stability metric.
- **Cost of capital** — opportunity cost of having the advance tied up. Charged monthly on the unrecouped balance.
- **Delivery window** — period within the contract during which the artist must release the contracted number of new tracks.
- **Distribution fee** — share of gross streaming revenue taken by the streaming platforms before label/artist split.
- **Frontline / New-release streams** — streams of songs released in the last ~6 months.
- **MoM** — Month-over-month.
- **Recoupment** — repayment of the advance from the artist's share of royalties. Once fully repaid, the label/artist split changes.
- **Royalty rate** — per-stream payout, $0.0035 in this model.

---

*Generated as a companion to the APG Master Rights Deal Modeler. All numbers in worked examples are reproducible by running the tool against the included synthetic dataset.*
