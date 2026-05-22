import React from 'react'

function fmtNum(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n?.toLocaleString() ?? '—'
}

function TrendArrow({ pct }) {
  if (pct === undefined || pct === null) return null
  const up = pct >= 0
  return (
    <span className={`text-xs ml-1 ${up ? 'text-apg-green' : 'text-apg-red'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function Card({ label, value, sub, trend }) {
  return (
    <div className="bg-apg-surface rounded-xl p-5 flex flex-col gap-1" style={{ border: '1px solid #2a2a2a' }}>
      <div className="text-xs uppercase tracking-widest text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mono text-white leading-tight">
        {value}
        {trend !== undefined && <TrendArrow pct={trend} />}
      </div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

export default function KeyMetrics({ metrics }) {
  if (!metrics) return null

  const {
    trailing12mAvgDaily,
    monthlyListeners,
    catalogFraction,
    avgMonthlyGrowthRate,
    listenersTrend,
  } = metrics

  const catalogPct = (catalogFraction * 100).toFixed(0)
  const newRelPct  = (100 - catalogFraction * 100).toFixed(0)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        label="Trailing 12m Avg Daily"
        value={fmtNum(trailing12mAvgDaily)}
        sub="streams / day"
      />
      <Card
        label="Monthly Listeners"
        value={fmtNum(monthlyListeners)}
        trend={listenersTrend}
        sub="rolling 30-day est."
      />
      <Card
        label="Catalog / New Release"
        value={`${catalogPct}% / ${newRelPct}%`}
        sub="last 12 months"
      />
      <Card
        label="Avg Monthly Growth"
        value={`${avgMonthlyGrowthRate >= 0 ? '+' : ''}${avgMonthlyGrowthRate.toFixed(2)}%`}
        sub="catalog (last 12mo)"
      />
    </div>
  )
}
