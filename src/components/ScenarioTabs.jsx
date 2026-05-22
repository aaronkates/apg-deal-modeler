import React, { useState, useMemo } from 'react'
import { calculateDeal, calcScenarioMultipliers, ROI_WARNING_THRESHOLD } from '../utils/dealModel.js'
import FinancialSummary from './FinancialSummary.jsx'
import CashFlowChart from './CashFlowChart.jsx'
import CompositionChart from './CompositionChart.jsx'

function HighROIWarning({ roi, params }) {
  return (
    <div className="bg-apg-red/10 border border-apg-red/50 rounded-xl px-4 py-3 flex items-start gap-3">
      <span className="text-apg-red text-base leading-none shrink-0 mt-0.5">⚠</span>
      <div className="flex-1 text-xs leading-relaxed">
        <div className="font-medium text-apg-red mb-1">
          Unusually high projected ROI ({roi.toFixed(0)}%)
        </div>
        <div className="text-gray-300">
          The model assumes the artist's recent monthly growth rate continues (decaying with an 18-month half-life),
          {' '}{params.numReleases} new release{params.numReleases === 1 ? '' : 's'} each peaking at {params.frontlinePeakMultiplier}× the current daily run rate,
          and frontline streams decaying at {params.monthlyDecayRate}%/mo.
          Sustained returns above {ROI_WARNING_THRESHOLD}% on master-rights deals are historically rare —
          sanity-check the inputs (especially Peak Multiplier and the artist's growth assumption) before relying on this.
        </div>
      </div>
    </div>
  )
}

export default function ScenarioTabs({ artistMetrics, params }) {
  const [active, setActive] = useState('base')

  const multipliers = useMemo(
    () => calcScenarioMultipliers(artistMetrics?.trailing12mAvgDaily ?? 0),
    [artistMetrics?.trailing12mAvgDaily]
  )

  const result = useMemo(
    () => calculateDeal(artistMetrics, params, active),
    [artistMetrics, params, active]
  )

  const TABS = [
    { id: 'best',  label: 'Best Case',  mult: multipliers.best  },
    { id: 'base',  label: 'Base Case',  mult: multipliers.base  },
    { id: 'worst', label: 'Worst Case', mult: multipliers.worst },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-800">
        {TABS.map(t => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-apg-red text-apg-red'
                  : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs opacity-60 mono">{t.mult.toFixed(1)}× streams</span>
            </button>
          )
        })}
      </div>

      {result.totalROI > ROI_WARNING_THRESHOLD && (
        <HighROIWarning roi={result.totalROI} params={params} />
      )}

      <FinancialSummary result={result} params={params} scenario={active} />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          <CashFlowChart
            cashFlows={result.cashFlows}
            breakEvenMonth={result.breakEvenMonth}
            recoupmentMonth={result.recoupmentMonth}
            scenario={active}
            bandPct={result.bandPct}
          />
        </div>
        <div className="xl:col-span-2">
          <CompositionChart cashFlows={result.cashFlows} />
        </div>
      </div>
    </div>
  )
}
