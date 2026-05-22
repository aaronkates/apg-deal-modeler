import React from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

const CATALOG_FILL    = '#c0392b'
const NEWRELEASE_FILL = '#ffffff'

function fmtUSD(v) {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `$${(abs / 1_000).toFixed(0)}K`
  return `$${abs.toFixed(0)}`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const catalog = payload.find(p => p.dataKey === 'catalogRevenue')?.value ?? 0
  const newRel  = payload.find(p => p.dataKey === 'newReleaseRevenue')?.value ?? 0
  const total   = catalog + newRel
  return (
    <div className="bg-apg-surface border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-gray-400 mb-1.5">Month {label}</div>
      <div className="flex justify-between gap-4">
        <span style={{ color: CATALOG_FILL }}>Catalog</span>
        <span className="mono text-white">{fmtUSD(catalog)} ({total > 0 ? ((catalog/total)*100).toFixed(0) : 0}%)</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-300">New Release</span>
        <span className="mono text-white">{fmtUSD(newRel)} ({total > 0 ? ((newRel/total)*100).toFixed(0) : 0}%)</span>
      </div>
      <div className="border-t border-gray-700 mt-1.5 pt-1.5 flex justify-between gap-4">
        <span className="text-gray-400">Total label rev</span>
        <span className="mono text-white">{fmtUSD(total)}</span>
      </div>
    </div>
  )
}

export default function CompositionChart({ cashFlows }) {
  if (!cashFlows?.length) return null

  const data = cashFlows.length > 36
    ? cashFlows.filter((_, i) => i % 2 === 0)
    : cashFlows

  return (
    <div className="bg-apg-surface border border-gray-800 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-white">Revenue Composition</h3>
        <p className="text-xs text-gray-500 mt-0.5">Label share by source · catalog vs new release</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barSize={cashFlows.length > 36 ? 8 : 12}>
          <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmtUSD}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }}
            formatter={v => v === 'catalogRevenue' ? 'Catalog' : 'New Release'}
          />
          <Bar dataKey="catalogRevenue"    stackId="rev" fill={CATALOG_FILL}    fillOpacity={1.0} isAnimationActive={false} />
          <Bar dataKey="newReleaseRevenue" stackId="rev" fill={NEWRELEASE_FILL} fillOpacity={0.85} radius={[2,2,0,0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
