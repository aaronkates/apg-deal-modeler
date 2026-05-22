import React, { useState, useMemo } from 'react'
import { scoreArtists, DEFAULT_WEIGHTS } from '../utils/metrics.js'

const SCORE_BAR_TRACK = '#666666'   // muted track
const SCORE_BAR_FILL  = '#ffffff'   // white fill
const APG_RED         = '#e32f2f'   // reserved: APG Recommendation only

function fmtNum(n) {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

const SCORE_DIMS = [
  { key: 'growth',    scoreKey: 'growthScore',    label: 'Growth',        explain: '30d rolling avg MoM catalog growth' },
  { key: 'stability', scoreKey: 'stabilityScore', label: 'Stability',     explain: 'Low CoV of monthly catalog streams' },
  { key: 'listener',  scoreKey: 'listenerScore',  label: 'Listeners',     explain: '12-month listener trend growth' },
  { key: 'ratio',     scoreKey: 'ratioScore',     label: 'Catalog Ratio', explain: 'Catalog 65-85% optimal band' },
]

function ScoreBar({ score }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: SCORE_BAR_TRACK }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: SCORE_BAR_FILL }} />
    </div>
  )
}

function TopPickCard({ artist, rank }) {
  if (!artist) return null
  const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : '🥉'

  return (
    <div className="bg-apg-surface border border-gray-800 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-0.5">{medal} Rank #{rank + 1}</div>
          <h3 className="text-xl font-semibold text-white">{artist.artist_name}</h3>
          <div className="text-xs text-gray-400 mt-0.5">
            {artist.genre} · {artist.primary_country}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl font-bold mono text-white">
            {artist.totalScore.toFixed(0)}
          </div>
          <div className="text-xs text-gray-500">/ 100</div>
        </div>
      </div>

      <div className="space-y-2">
        {SCORE_DIMS.map(d => (
          <div key={d.key}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-400">{d.label}</span>
              <span className="mono text-white">{(artist[d.scoreKey] ?? 0).toFixed(0)}</span>
            </div>
            <ScoreBar score={artist[d.scoreKey] ?? 0} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs border-t border-gray-800 pt-3">
        <div>
          <div className="text-gray-500">Avg Daily Streams</div>
          <div className="text-white mono">{fmtNum(artist.trailing12mAvgDaily)}</div>
        </div>
        <div>
          <div className="text-gray-500">Monthly Listeners</div>
          <div className="text-white mono">{fmtNum(artist.monthlyListeners)}</div>
        </div>
        <div>
          <div className="text-gray-500">Catalog Growth</div>
          <div className={`mono ${artist.avgMonthlyGrowthPct >= 0 ? 'text-apg-green' : 'text-apg-red'}`}>
            {artist.avgMonthlyGrowthPct >= 0 ? '+' : ''}{artist.avgMonthlyGrowthPct.toFixed(2)}% / mo
          </div>
        </div>
        <div>
          <div className="text-gray-500">Catalog Ratio</div>
          <div className="text-white mono">{(artist.catalogRatio * 100).toFixed(0)}%</div>
        </div>
      </div>
    </div>
  )
}

function generateRecommendation(artist) {
  const dims = [
    {
      key: 'growth',
      score: artist.growthScore,
      label: 'Growth',
      phrase: `catalog growth of ${artist.avgMonthlyGrowthPct >= 0 ? '+' : ''}${artist.avgMonthlyGrowthPct.toFixed(2)}%/mo`,
    },
    {
      key: 'stability',
      score: artist.stabilityScore,
      label: 'Stability',
      phrase: `stable catalog performance (coefficient of variation ${artist.cv.toFixed(2)})`,
    },
    {
      key: 'listener',
      score: artist.listenerScore,
      label: 'Listeners',
      phrase: `${artist.listenersTrend >= 0 ? 'growing' : 'declining'} monthly listeners (${artist.listenersTrend >= 0 ? '+' : ''}${artist.listenersTrend.toFixed(0)}% over 12 months)`,
    },
    {
      key: 'ratio',
      score: artist.ratioScore,
      label: 'Catalog Ratio',
      phrase: `a ${(artist.catalogRatio * 100).toFixed(0)}% catalog ratio`,
    },
  ].sort((a, b) => b.score - a.score)

  const [top1, top2, top3] = dims

  const listenersStr = artist.monthlyListeners >= 1_000_000
    ? `${(artist.monthlyListeners / 1_000_000).toFixed(1)}M monthly listeners`
    : `${(artist.monthlyListeners / 1_000).toFixed(0)}K monthly listeners`

  return (
    <p className="text-sm text-gray-200 leading-relaxed">
      <span className="font-semibold text-white">{artist.artist_name}</span> ranks <span className="text-apg-red font-semibold">#1</span> with a composite score of <span className="text-white font-semibold mono">{artist.totalScore.toFixed(0)}/100</span>,
      driven by strong <span className="text-white">{top1.phrase}</span> ({top1.label} score: <span className="mono text-white">{top1.score.toFixed(0)}</span>) and <span className="text-white">{top2.phrase}</span> ({top2.label} score: <span className="mono text-white">{top2.score.toFixed(0)}</span>).
      Their {listenersStr} reflect <span className="text-white">{top3.phrase}</span> ({top3.label} score: <span className="mono text-white">{top3.score.toFixed(0)}</span>).
    </p>
  )
}

function APGRecommendation({ artist, onSelect }) {
  if (!artist) return null
  return (
    <div className="bg-gradient-to-br from-apg-red/10 to-apg-surface border-2 border-apg-red rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-apg-red font-semibold mb-1">
            APG Recommendation
          </div>
          <h2 className="text-2xl font-bold text-white">Sign {artist.artist_name}</h2>
        </div>
        <button
          onClick={() => onSelect?.(artist.artist_id)}
          className="px-4 py-2 rounded-lg bg-apg-red hover:bg-apg-red/90 text-white text-sm font-medium transition-colors shrink-0"
        >
          Model deal →
        </button>
      </div>
      {generateRecommendation(artist)}
    </div>
  )
}

function WeightSlider({ label, value, onChange, weight }) {
  return (
    <div className="bg-apg-bg border border-gray-800 rounded-lg p-3">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="mono text-sm text-white font-semibold">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={e => onChange(weight, parseInt(e.target.value, 10))}
        className="w-full accent-apg-red cursor-pointer"
      />
    </div>
  )
}

function redistributeWeights(weights, changedKey, newValue) {
  const others = Object.keys(weights).filter(k => k !== changedKey)
  const oldOthersSum = others.reduce((s, k) => s + weights[k], 0)
  const newOthersTarget = 100 - newValue
  const next = { ...weights, [changedKey]: newValue }

  if (oldOthersSum > 0) {
    let runningSum = 0
    others.forEach((k, idx) => {
      if (idx === others.length - 1) {
        next[k] = Math.max(0, newOthersTarget - runningSum)
      } else {
        const v = Math.round(weights[k] * newOthersTarget / oldOthersSum)
        next[k] = Math.max(0, v)
        runningSum += next[k]
      }
    })
  } else {
    const each = Math.floor(newOthersTarget / others.length)
    let runningSum = 0
    others.forEach((k, idx) => {
      if (idx === others.length - 1) {
        next[k] = newOthersTarget - runningSum
      } else {
        next[k] = each
        runningSum += each
      }
    })
  }
  return next
}

function RankTable({ artists, onSelect }) {
  return (
    <div className="bg-apg-surface border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800">
        <h3 className="text-sm font-medium text-white">Full Roster Rankings</h3>
        <p className="text-xs text-gray-500">All scored artists · click to inspect</p>
      </div>
      <div className="overflow-auto max-h-[520px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-apg-surface/95 backdrop-blur">
            <tr className="border-b border-gray-800">
              {['#','Artist','Genre','Growth','Stability','Listeners','Cat. Ratio','Score'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {artists.map((a, i) => (
              <tr
                key={a.artist_id}
                onClick={() => onSelect?.(a.artist_id)}
                className="border-b border-gray-800/50 cursor-pointer transition-colors hover:bg-white/5"
              >
                <td className="px-3 py-2 text-gray-500 mono">{i + 1}</td>
                <td className="px-3 py-2">
                  <div className="text-white font-medium">{a.artist_name}</div>
                  <div className="text-gray-500">{a.primary_country}</div>
                </td>
                <td className="px-3 py-2 text-gray-400">{a.genre}</td>
                <td className="px-3 py-2"><span className="mono text-gray-300">{a.growthScore.toFixed(0)}</span></td>
                <td className="px-3 py-2"><span className="mono text-gray-300">{a.stabilityScore.toFixed(0)}</span></td>
                <td className="px-3 py-2"><span className="mono text-gray-300">{a.listenerScore.toFixed(0)}</span></td>
                <td className="px-3 py-2"><span className="mono text-gray-300">{a.ratioScore.toFixed(0)}</span></td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: SCORE_BAR_TRACK }}>
                      <div className="h-full rounded-full" style={{ width: `${a.totalScore}%`, backgroundColor: SCORE_BAR_FILL }} />
                    </div>
                    <span className="mono text-white font-medium">{a.totalScore.toFixed(0)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function RosterRecommendation({ rosterMetrics, onSelectArtist }) {
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS)
  const [expanded, setExpanded] = useState(false)

  const roster = useMemo(
    () => scoreArtists(rosterMetrics, weights),
    [rosterMetrics, weights]
  )

  if (!rosterMetrics?.length) {
    return <div className="text-gray-500 text-sm p-8 text-center">Computing roster scores…</div>
  }

  const handleWeightChange = (key, value) => {
    setWeights(prev => redistributeWeights(prev, key, value))
  }
  const handleReset = () => setWeights(DEFAULT_WEIGHTS)

  const total = weights.growth + weights.stability + weights.listener + weights.ratio
  const top3  = roster.slice(0, 3)
  const display = expanded ? roster : roster.slice(0, 20)

  return (
    <div className="space-y-6">
      {/* Adjustable weights */}
      <div className="bg-apg-surface border border-gray-800 rounded-xl p-5">
        <div className="flex justify-between items-baseline mb-4">
          <div>
            <h3 className="text-sm font-medium text-white">Scoring Weights</h3>
            <p className="text-xs text-gray-500 mt-0.5">Adjust how much each dimension contributes to the composite score</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleReset} className="text-xs text-gray-400 hover:text-white transition-colors">
              Reset
            </button>
            <div className="text-xs">
              <span className="text-gray-500">Total: </span>
              <span className={`mono font-semibold ${total === 100 ? 'text-white' : 'text-apg-red'}`}>
                {total}%
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SCORE_DIMS.map(d => (
            <WeightSlider
              key={d.key}
              label={d.label}
              value={weights[d.key]}
              onChange={handleWeightChange}
              weight={d.key}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          {SCORE_DIMS.map(d => (
            <p key={d.key} className="text-xs text-gray-600">{d.explain}</p>
          ))}
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top3.map((a, i) => (
          <div key={a.artist_id}>
            <TopPickCard artist={a} rank={i} />
            <button
              onClick={() => onSelectArtist?.(a.artist_id)}
              className="mt-2 w-full text-xs text-gray-400 hover:text-white transition-colors py-1"
            >
              Open in deal modeler →
            </button>
          </div>
        ))}
      </div>

      {/* APG Recommendation — the one place red lives */}
      <APGRecommendation artist={roster[0]} onSelect={onSelectArtist} />

      {/* Full ranked table */}
      <RankTable artists={display} onSelect={onSelectArtist} />
      {!expanded && roster.length > 20 && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full py-2 text-xs text-gray-500 hover:text-white border border-gray-800 rounded-lg transition-colors"
        >
          Show all {roster.length} artists ↓
        </button>
      )}
    </div>
  )
}
