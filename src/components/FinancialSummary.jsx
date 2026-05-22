import React from 'react'

function fmtUSD(v) {
  if (v === null || v === undefined) return '—'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function MetricCard({ label, value, sub }) {
  return (
    <div className="bg-apg-bg rounded-xl p-4 flex flex-col gap-1.5" style={{ border: '1px solid #2a2a2a' }}>
      <div className="text-xs uppercase tracking-widest text-gray-500">{label}</div>
      <div className="text-2xl font-semibold mono text-white">{value}</div>
      {sub && <div className="text-xs text-gray-600">{sub}</div>}
    </div>
  )
}

export default function FinancialSummary({ result, params }) {
  if (!result) return null

  const { breakEvenMonth, recoupmentMonth, totalROI, totalLabelProfit, totalInvestment, totalLabelGross } = result
  const contractMonths = params.contractTermYears * 12

  const beText  = breakEvenMonth  ? `Month ${breakEvenMonth}`  : `>${contractMonths} mo`
  const recText = recoupmentMonth ? `Month ${recoupmentMonth}` : `>${contractMonths} mo`

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard
        label="Break-Even"
        value={beText}
        sub={breakEvenMonth ? `${contractMonths - breakEvenMonth} mo remaining` : 'Not within term'}
      />
      <MetricCard
        label="Recoupment"
        value={recText}
        sub={recoupmentMonth ? `Artist recoups in term` : 'Not recouped in term'}
      />
      <MetricCard
        label="Total ROI"
        value={`${totalROI >= 0 ? '+' : ''}${totalROI.toFixed(1)}%`}
        sub={`On ${fmtUSD(totalInvestment)} invested`}
      />
      <MetricCard
        label="Label Profit"
        value={fmtUSD(totalLabelProfit)}
        sub={`${fmtUSD(totalLabelGross)} gross streaming`}
      />
    </div>
  )
}
