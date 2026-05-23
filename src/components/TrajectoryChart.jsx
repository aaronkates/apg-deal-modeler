import React, { useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts'

const CATALOG_FILL = '#aaaaaa'   // lighter — older/established streams
const NEWREL_FILL  = '#666666'   // darker — recent/highlighted streams
const MOM_POS      = '#4caf50'
const MOM_NEG      = '#e32f2f'

function fmtStreams(v) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}
const fmtPct = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

function WeeklyTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-apg-surface border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl min-w-[170px]">
      <div className="text-gray-400 mb-1.5">Week of {d.weekLabel}</div>
      <div className="flex justify-between gap-3"><span className="text-gray-500">Catalog</span>     <span className="mono text-white">{fmtStreams(d.catalog)}</span></div>
      <div className="flex justify-between gap-3"><span className="text-gray-500">New Release</span> <span className="mono text-white">{fmtStreams(d.newRelease)}</span></div>
      <div className="flex justify-between gap-3 border-t border-gray-800 mt-1 pt-1"><span className="text-gray-400">Total</span> <span className="mono text-white">{fmtStreams(d.total)}</span></div>
    </div>
  )
}

function MoMTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-apg-surface border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-gray-400 mb-1">{d?.monthLabel}</div>
      <div className="font-semibold mono text-white">{fmtPct(d?.growthPct ?? 0)} MoM</div>
      <div className="text-gray-500">{(d?.avgStreams / 1_000_000).toFixed(2)}M avg daily (smoothed)</div>
    </div>
  )
}

function WeeklyChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 12, left: 4, bottom: 0 }} barCategoryGap="15%">
        <CartesianGrid stroke="#1f1f1f" vertical={false} horizontal={true} />
        <XAxis
          dataKey="weekLabel"
          tick={{ fontSize: 9, fill: '#6b7280' }}
          interval={Math.max(0, Math.floor(data.length / 12))}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtStreams}
          tick={{ fontSize: 10, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip content={<WeeklyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="catalog"    stackId="streams" fill={CATALOG_FILL} fillOpacity={1.0} isAnimationActive={false} />
        <Bar dataKey="newRelease" stackId="streams" fill={NEWREL_FILL}  fillOpacity={1.0} radius={[1.5, 1.5, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function MoMChart({ data }) {
  const enriched = data.map((d, i) => {
    const slice = data.slice(Math.max(0, i - 2), i + 1).map(x => x.growthPct)
    return { ...d, trend: slice.reduce((s, v) => s + v, 0) / slice.length }
  })
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={enriched} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1f1f1f" vertical={false} />
        <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: '#6b7280' }} interval={2} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<MoMTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <ReferenceLine y={0} stroke="#404040" strokeWidth={1} />
        <Bar dataKey="growthPct" radius={[2, 2, 0, 0]} maxBarSize={20} isAnimationActive={false}>
          {enriched.map((entry, i) => (
            <Cell key={i} fill={entry.growthPct >= 0 ? MOM_POS : MOM_NEG} fillOpacity={1.0} />
          ))}
        </Bar>
        <Line type="monotone" dataKey="trend" stroke="#ffffff" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export default function TrajectoryChart({ trajectoryData, weeklyStreams }) {
  const [mode, setMode] = useState('weekly')

  const hasWeekly = weeklyStreams?.length > 0
  const hasMoM    = trajectoryData?.length > 0
  if (!hasWeekly && !hasMoM) return null

  return (
    <div className="bg-apg-surface border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-sm font-medium text-white">
            {mode === 'weekly' ? '24-Month Streaming Activity' : '24-Month Catalog Trajectory'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {mode === 'weekly'
              ? 'Weekly totals · catalog + new release'
              : 'Month-over-month % growth · 30-day rolling mean applied'}
          </p>
        </div>
        <div className="flex bg-apg-bg border border-gray-800 rounded-full p-0.5 text-xs shrink-0">
          <button
            onClick={() => setMode('weekly')}
            className={`px-3 py-1 rounded-full transition-colors ${
              mode === 'weekly' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setMode('mom')}
            className={`px-3 py-1 rounded-full transition-colors ${
              mode === 'mom' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            MoM Growth
          </button>
        </div>
      </div>

      {mode === 'weekly' && hasWeekly && <WeeklyChart data={weeklyStreams} />}
      {mode === 'mom'    && hasMoM    && <MoMChart   data={trajectoryData} />}

      {mode === 'weekly' && (
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: CATALOG_FILL }} />Catalog</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: NEWREL_FILL }} />New Release</span>
        </div>
      )}
    </div>
  )
}
