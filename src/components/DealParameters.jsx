import React, { useState, useEffect } from 'react'

const LinkIcon = ({ size = 12, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M10 14a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-1.5 1.5M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l1.5-1.5"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

function Field({ label, name, value, onChange, type = 'number', min, max, step = 1, prefix, suffix, hint, linked }) {
  const [draft, setDraft] = useState(String(value ?? ''))

  useEffect(() => { setDraft(String(value ?? '')) }, [value])

  const handleChange = (e) => {
    const raw = e.target.value
    setDraft(raw)
    if (type === 'number') {
      const v = parseFloat(raw)
      if (!isNaN(v)) onChange(name, v)
    } else {
      onChange(name, raw)
    }
  }
  const handleBlur = () => {
    if (type !== 'number') return
    const v = parseFloat(draft)
    if (isNaN(v)) setDraft(String(value ?? ''))
    else { onChange(name, v); setDraft(String(v)) }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-400 flex items-center gap-1.5">
        {label}
        {linked && <LinkIcon size={10} className="text-apg-red" />}
      </label>
      <div className="flex items-center bg-apg-bg border border-gray-700 rounded-lg overflow-hidden
                      focus-within:border-apg-red focus-within:ring-1 focus-within:ring-apg-red/50
                      transition-colors">
        {prefix && <span className="px-2.5 text-xs text-gray-500 border-r border-gray-700 shrink-0">{prefix}</span>}
        <input
          type={type === 'number' ? 'text' : type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          name={name}
          value={draft}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none mono"
        />
        {suffix && <span className="px-2.5 text-xs text-gray-500 border-l border-gray-700 shrink-0">{suffix}</span>}
      </div>
      {hint && <span className="text-xs text-gray-600">{hint}</span>}
    </div>
  )
}

export default function DealParameters({ params, onChange, linked, onToggleLinked }) {
  const set = (k, v) => onChange(k, v)

  return (
    <div className="bg-apg-surface border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">Deal Parameters</h3>
        <button
          onClick={onToggleLinked}
          title={linked ? 'Linked mode on — changing one field updates dependents' : 'Linked mode off — fields are independent'}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-colors ${
            linked
              ? 'bg-apg-red/10 border-apg-red text-apg-red'
              : 'bg-apg-bg border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
          }`}
        >
          <LinkIcon size={12} />
          <span>{linked ? 'Linked' : 'Unlinked'}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Field label="Contract Term" name="contractTermYears" value={params.contractTermYears}
          onChange={set} min={1} max={10} suffix="yrs" linked={linked} />
        <Field label="Advance" name="advance" value={params.advance}
          onChange={set} min={0} step={10000} prefix="$" linked={linked} />
        <Field label="Marketing Budget" name="marketingBudget" value={params.marketingBudget}
          onChange={set} min={0} step={10000} prefix="$" linked={linked} />
        <Field label="Distribution Fee" name="distributionFee" value={params.distributionFee}
          onChange={set} min={0} max={50} step={0.5} suffix="%" />

        <Field label="Label Split (pre-recoup)" name="labelSplitPre" value={params.labelSplitPre}
          onChange={set} min={0} max={100} suffix="% label" hint="Artist gets remainder" />
        <Field label="Label Split (post-recoup)" name="labelSplitPost" value={params.labelSplitPost}
          onChange={set} min={0} max={100} suffix="% label" hint="Artist gets remainder" />
        <Field label="Recoupment Rate" name="recoupmentRate" value={params.recoupmentRate}
          onChange={set} min={0} max={100} suffix="%" hint="Of artist royalties applied" />
        <Field label="Cost of Capital" name="costOfCapital" value={params.costOfCapital}
          onChange={set} min={0} max={30} step={0.5} suffix="% / yr" />

        <Field label="New Releases" name="numReleases" value={params.numReleases}
          onChange={set} min={0} max={20} />
        <Field label="Delivery Window" name="deliveryWindowMonths" value={params.deliveryWindowMonths}
          onChange={set} min={1} max={120} suffix="mo" hint="Releases spread over" linked={linked} />
        <Field label="Peak Multiplier" name="frontlinePeakMultiplier" value={params.frontlinePeakMultiplier}
          onChange={set} min={0.5} max={20} step={0.1} suffix="×" hint="Frontline vs catalog base" />
        <Field label="Monthly Decay" name="monthlyDecayRate" value={params.monthlyDecayRate}
          onChange={set} min={1} max={60} suffix="%" hint="Frontline stream decay" />
      </div>
    </div>
  )
}
