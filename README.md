# APG Music — Master Rights Deal Modeler

A browser-based tool for evaluating master-rights deal economics across APG's 100-artist roster. Pick an artist, configure deal terms (advance, splits, marketing, recoupment), and inspect projected cash flows, break-even / recoupment timing, and total ROI across best / base / worst-case scenarios. The Roster Recommendation tab scores all 100 artists across four weighted dimensions (growth, stability, listeners, catalog ratio) and surfaces APG's top signing candidate with auto-generated rationale.

## Stack

- **React 18** + **Vite 5** for the app shell and dev experience
- **Papa Parse 5** for streaming CSV ingest
- **Recharts 2** for all visualizations
- **Tailwind CSS 3** for styling

All computation runs in the browser — no backend.

## Run locally

```bash
npm install
npm run dev
```

Then visit `http://localhost:5173`.

The two CSV files must be present at:

- `public/data/artists.csv`
- `public/data/streaming_data.csv`

Vite serves anything in `public/` from the URL root, so these are accessible at `/data/artists.csv` and `/data/streaming_data.csv` both in dev and in production builds.

## Build for deployment

```bash
npm run build
```

Output lands in `dist/`. Deploy that directory to any static host (Vercel, Netlify, S3+CloudFront, GitHub Pages, etc.). A `vercel.json` is included with a rewrite rule so client-side state survives page refresh on Vercel.

## Data

The CSV files contain **synthetic data provided by APG**. No real artists are represented. Shape:

- `artists.csv` — 100 rows, one per artist (id, name, genre, country, catalog size, debut date, trailing 12-month daily streams)
- `streaming_data.csv` — ~365,000 rows of daily per-artist streaming activity (total streams, catalog vs. new-release split, monthly listeners, followers), spanning 2016-05-16 through 2026-05-14

## Key assumptions baked into the model

- **Royalty rate**: $0.0035 per stream
- **Growth decay**: an artist's recent monthly catalog growth rate decays with an **18-month half-life** when projected forward, so a 10%/mo growth artist is assumed to be growing 5%/mo by month 18 and 2.5%/mo by month 36. This prevents fast-growing artists from compounding to absurd multi-year returns.
- **Confidence band**: ±15% on best/base scenarios, ±30% on worst — applied to the streaming-revenue portion of each monthly cash flow
- **Frontline streams**: new releases peak in their release month and decay at a configurable monthly rate (default 30%)
- **Tier-aware deal defaults**: when an artist is selected, the advance and marketing budget are calibrated to that artist's revenue tier (advance ≈ 60% of expected artist royalties over the contract term)
- **Recoupment**: artist royalties (× recoupment rate) pay down the outstanding advance + marketing balance; once recouped, the label/artist split switches from pre-recoup (default 80/20) to post-recoup (default 50/50)
- **Cost of capital**: compounded monthly on the unrecouped balance (default 8% annual)
