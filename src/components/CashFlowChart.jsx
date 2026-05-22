import React, { useMemo } from 'react'
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
  Cell,
} from 'recharts'

const APG_RED   = '#e32f2f'   // reserved for recoupment milestone marker
const APG_MUTED = '#555555'   // negative bars

function fmtUSD(v) {
  const abs = Math.abs(v)
  const s   = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${s}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${s}$${(abs / 1_000).toFixed(0)}K`
  return `${s}$${abs.toFixed(0)}`
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-apg-surface border border-gray-700 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[180px]">
      <div className="text-gray-400 font-medium mb-2">Month {d?.month}</div>
      {[
        { key: 'labelNet',         label: 'Monthly Net' },
        { key: 'cumulative',       label: 'Cumulative'  },
        { key: 'cumulativeUpper',  label: 'Upper band'  },
        { key: 'cumulativeLower',  label: 'Lower band'  },
      ].map(({ key, label }) => {
        const v = d?.[key] ?? 0
        const col = key === 'cumulative'
          ? 'text-white'
          : key === 'labelNet'
            ? (v >= 0 ? 'text-white' : 'text-gray-400')
            : 'text-gray-500'
        return (
          <div key={key} className="flex justify-between gap-4">
            <span className="text-gray-500">{label}</span>
            <span className={`mono ${col}`}>{fmtUSD(v)}</span>
          </div>
        )
      })}
      {d?.isRecouped && <div className="mt-1.5 text-xs text-white">✓ Recouped</div>}
    </div>
  )
}

export default function CashFlowChart({ cashFlows, breakEvenMonth, recoupmentMonth, scenario, bandPct }) {
  const processed = useMemo(() => {
    if (!cashFlows?.length) return []
    // Set a visible floor on small positive bars so they don't disappear next to large ones.
    const maxAbs = Math.max(...cashFlows.map(d => Math.abs(d.labelNet)), 1)
    const minVisible = maxAbs * 0.012  // 1.2% of largest bar = guaranteed-visible nub
    return cashFlows.map(d => ({
      ...d,
      labelNetDisplay: d.labelNet === 0
        ? 0
        : (d.labelNet > 0 ? Math.max(d.labelNet, minVisible) : Math.min(d.labelNet, -minVisible)),
      _bandBase: Math.min(d.cumulativeUpper, d.cumulativeLower),
      _bandSize: Math.abs(d.cumulativeUpper - d.cumulativeLower),
    }))
  }, [cashFlows])

  if (!processed.length) return null

  const allVals = processed.flatMap(d => [d.labelNet, d.cumulativeUpper, d.cumulativeLower])
  const yMin = Math.min(0, ...allVals) * 1.1
  const yMax = Math.max(0, ...allVals) * 1.1

  return (
    <div className="bg-apg-surface border border-gray-800 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-white">Monthly Cash Flow</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Bars = monthly net · Line = cumulative · Band = ±{bandPct !== undefined ? (bandPct * 100).toFixed(0) : '15'}% stream variance
        </p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={processed} margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Month', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#4b5563' }}
          />
          <YAxis
            tickFormatter={fmtUSD}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            width={64}
            domain={[yMin, yMax]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine y={0} stroke="#404040" strokeWidth={1} />

          {/* Confidence band: transparent base + colored width (works for negative values) */}
          <Area
            type="monotone"
            dataKey="_bandBase"
            stackId="band"
            stroke="none"
            fill="transparent"
            fillOpacity={0}
            legendType="none"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="_bandSize"
            stackId="band"
            stroke="none"
            fill="#ffffff"
            fillOpacity={0.08}
            legendType="none"
            isAnimationActive={false}
          />

          {/* Monthly bars — full opacity, minimum visible height */}
          <Bar dataKey="labelNetDisplay" maxBarSize={18} radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {processed.map((d, i) => (
              <Cell key={i} fill={d.labelNet >= 0 ? '#ffffff' : APG_MUTED} fillOpacity={1.0} />
            ))}
          </Bar>

          {/* Cumulative line in white per APG branding */}
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="#ffffff"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />

          {breakEvenMonth && (
            <ReferenceLine
              x={breakEvenMonth}
              stroke="#ffffff"
              strokeDasharray="4 3"
              strokeWidth={1.25}
              strokeOpacity={0.6}
              label={{ value: `BEP M${breakEvenMonth}`, fontSize: 9, fill: '#ffffff', position: 'insideTopRight' }}
            />
          )}
          {recoupmentMonth && recoupmentMonth !== breakEvenMonth && (
            <ReferenceLine
              x={recoupmentMonth}
              stroke="#ffffff"
              strokeDasharray="4 3"
              strokeWidth={1.25}
              strokeOpacity={0.5}
              label={{ value: `Rec. M${recoupmentMonth}`, fontSize: 9, fill: '#ffffff', position: 'insideTopLeft' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
